<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types.js';
	import type {
		BoardPart,
		ShiftKey,
		StageKey,
		InspectionHistoryRow
	} from '$lib/server/board/index.js';
	import MonitorIcon from '@lucide/svelte/icons/monitor';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import PartCard from '$lib/components/board/part-card.svelte';
	import StatusSummary from '$lib/components/board/status-summary.svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import DatePicker from '$lib/components/date-picker.svelte';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { cn } from '$lib/utils.js';
	import { mode, toggleMode } from 'mode-watcher';

	const { data }: { data: PageData } = $props();

	let parts = $state<BoardPart[]>(untrack(() => data.parts));
	let viewDate = $state(untrack(() => data.date));
	let todayDate = $state(untrack(() => data.today));
	let currentShift = $state(untrack(() => data.currentShift));
	let sseConnected = $state(false);

	const isToday = $derived(viewDate === todayDate);

	let tvMode = $state(false);
	let clockTime = $state('');

	const isDark = $derived(mode.current === 'dark');

	function updateClock() {
		const n = new Date();
		const jt = new Date(n.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
		const h = jt.getHours().toString().padStart(2, '0');
		const m = jt.getMinutes().toString().padStart(2, '0');
		const s = jt.getSeconds().toString().padStart(2, '0');
		clockTime = `${h}:${m}:${s}`;
	}

	updateClock();

	$effect(() => {
		if (!tvMode) return;
		const interval = setInterval(updateClock, 1000);
		return () => clearInterval(interval);
	});

	$effect(() => {
		const code = data.line.code;
		const requested = data.date === data.today ? null : data.date;

		parts = data.parts;
		viewDate = data.date;
		todayDate = data.today;
		currentShift = data.currentShift;
		sseConnected = false;

		const query = requested ? `?date=${encodeURIComponent(requested)}` : '';
		const es = new EventSource(`/api/board/${code}/stream${query}`);

		const applyPayload = (e: MessageEvent) => {
			const payload = JSON.parse(e.data) as {
				parts: BoardPart[];
				date: string;
				today: string;
				currentShift: ShiftKey;
			};
			parts = payload.parts;
			viewDate = payload.date;
			todayDate = payload.today;
			currentShift = payload.currentShift;
		};

		es.addEventListener('init', (e) => {
			applyPayload(e);
			sseConnected = true;
		});
		es.addEventListener('update', applyPayload);
		es.addEventListener('error', () => {
			sseConnected = false;
		});
		es.onopen = () => {
			sseConnected = true;
		};

		return () => es.close();
	});

	const DAY_MS = 24 * 60 * 60 * 1000;

	function goToDate(next: string) {
		if (!next || next === viewDate) return;
		const code = data.line.code;
		goto(
			next === todayDate
				? resolve('/board/[code]', { code })
				: resolve(`/board/[code]?date=${next}`, { code }),
			{ keepFocus: true, noScroll: true }
		);
	}

	function shiftDate(delta: number) {
		const next = new Date(Date.parse(`${viewDate}T00:00:00.000Z`) + delta * DAY_MS)
			.toISOString()
			.slice(0, 10);
		if (next > todayDate) return;
		goToDate(next);
	}

	const dateLabel = $derived(
		new Date(Date.parse(`${viewDate}T00:00:00.000Z`)).toLocaleDateString('id-ID', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			timeZone: 'UTC'
		})
	);

	const shiftLabel = $derived(currentShift === 'DAY' ? 'Day Shift' : 'Night Shift');

	// Modal state
	let modalOpen = $state(false);
	let modalLoading = $state(false);
	let modalHistory = $state<InspectionHistoryRow[]>([]);
	let modalTitle = $state('');
	let modalSubtitle = $state('');
	let expandedId = $state<string | null>(null);

	type RepairRow = InspectionHistoryRow['repairs'][number];

	/**
	 * Board history API mungkin tidak menyertakan `id` baris child (points /
	 * lengths), jadi baca secara defensif supaya matching repair tetap type-safe.
	 */
	function childId(item: object | null | undefined): string | null {
		if (!item || !('id' in item)) return null;
		const id = (item as { id?: unknown }).id;
		return typeof id === 'string' ? id : null;
	}

	/** Repair AKTIF untuk satu item; SPOT/VISUAL tidak punya baris child (itemId null). */
	function findRepair(
		row: InspectionHistoryRow,
		itemType: RepairRow['itemType'],
		itemId: string | null = null
	): RepairRow | null {
		return row.repairs.find((r) => r.itemType === itemType && r.itemId === itemId) ?? null;
	}

	async function handleBadgeClick(part: BoardPart, shift: ShiftKey, stage: StageKey) {
		const STAGE_LABELS: Record<StageKey, string> = { START: 'Start', MIDDLE: 'Middle', END: 'End' };
		const SHIFT_LABELS: Record<ShiftKey, string> = { DAY: 'Day', NIGHT: 'Night' };
		modalTitle = `${part.partNo} — ${STAGE_LABELS[stage]}`;
		modalSubtitle = `${SHIFT_LABELS[shift]} · ${data.line.code} · ${dateLabel}`;
		modalHistory = [];
		expandedId = null;
		modalLoading = true;
		modalOpen = true;

		try {
			const res = await fetch(
				`/api/board/${data.line.code}/history?configId=${part.configId}&shift=${shift}&stage=${stage}&date=${viewDate}`
			);
			if (res.ok) {
				modalHistory = await res.json();
				if (modalHistory.length > 0) expandedId = modalHistory[0].id;
			}
		} finally {
			modalLoading = false;
		}
	}

	function toggleTvMode() {
		tvMode = !tvMode;
	}
</script>

<svelte:head>
	<title>Ringkasan Part · {data.line.name} · Q-Jun</title>
</svelte:head>

<div class={cn('min-h-screen overflow-x-hidden bg-background transition-colors')}>
	<!-- Header -->
	<header class={cn('border-b bg-card px-6 py-5 transition-colors')}>
		<div
			class="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
		>
			<div class="min-w-0">
				<div class="flex flex-wrap items-center gap-2.5">
					<h1 class="text-2xl font-bold tracking-tight">Ringkasan Part</h1>
					<Badge variant="secondary" class="font-mono text-xs">
						{data.line.code}
					</Badge>
					{#if sseConnected}
						<span class="flex items-center gap-1.5 text-xs font-medium text-status-ok">
							<span class="inline-block h-2 w-2 animate-pulse rounded-full bg-status-ok"></span>
							Live
						</span>
					{:else}
						<span class="flex items-center gap-1.5 text-xs text-muted-foreground">
							<span class="inline-block h-2 w-2 rounded-full bg-muted-foreground/50"></span>
							Menghubungkan…
						</span>
					{/if}
				</div>
				<p class="mt-1.5 text-sm text-muted-foreground">
					{data.line.name} · Klik badge stage untuk melihat riwayat inspeksi shift tersebut.
				</p>
			</div>

			<div class="flex w-full flex-col items-start gap-3 lg:w-auto lg:items-end">
				<!-- Legend -->
				<div class="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
					<div class="flex items-center gap-1.5">
						<span class="size-3 rounded-full bg-status-ok"></span>
						<span>OK</span>
					</div>
					<div class="flex items-center gap-1.5">
						<!--
							NG di legend memakai ring yang sama dengan badge aslinya
							(stage-badge-row.svelte) supaya bentuk, bukan hanya hue,
							membedakan OK dari NG.
						-->
						<span class="size-3 rounded-full bg-status-ng ring-2 ring-status-ng/35"></span>
						<span>NG</span>
					</div>
					<div class="flex items-center gap-1.5">
						<span class="size-3 rounded-full border border-dashed border-muted-foreground/40"
						></span>
						<span>—</span>
					</div>
				</div>

				<!-- Actions: Mode TV + Navigasi Tanggal, dikelompokkan jadi satu toolbar -->
				<div
					class="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/40 p-1"
				>
					<Button
						variant={tvMode ? 'default' : 'ghost'}
						size="sm"
						class={cn(
							'h-8 gap-1.5 text-xs',
							tvMode && 'bg-amber-500 text-black hover:bg-amber-400'
						)}
						onclick={toggleTvMode}
					>
						<MonitorIcon class="h-3.5 w-3.5" />
						Mode TV
					</Button>

					<Button
						variant="ghost"
						size="sm"
						class="h-8 w-8 p-0"
						aria-label={isDark ? 'Mode terang' : 'Mode gelap'}
						onclick={toggleMode}
					>
						{#if isDark}
							<SunIcon class="h-4 w-4" />
						{:else}
							<MoonIcon class="h-4 w-4" />
						{/if}
					</Button>

					{#if !tvMode}
						<Separator orientation="vertical" class="mx-0.5 h-5" />
						<div class="flex items-center">
							<Button
								variant="ghost"
								size="sm"
								class="h-8 w-8 p-0"
								aria-label="Hari sebelumnya"
								onclick={() => shiftDate(-1)}
							>
								<ChevronLeftIcon class="h-4 w-4" />
							</Button>
							<DatePicker
								value={viewDate}
								maxKey={todayDate}
								onSelect={goToDate}
								aria-label="Tanggal operasional"
								class="h-8 w-[9.5rem] border-0 bg-transparent text-xs shadow-none"
							/>
							<Button
								variant="ghost"
								size="sm"
								class="h-8 w-8 p-0"
								aria-label="Hari berikutnya"
								disabled={isToday}
								onclick={() => shiftDate(1)}
							>
								<ChevronRightIcon class="h-4 w-4" />
							</Button>
							<Separator orientation="vertical" class="mx-0.5 h-5" />
							<Button
								variant={isToday ? 'secondary' : 'ghost'}
								size="sm"
								class="h-8 text-xs"
								disabled={isToday}
								onclick={() => goToDate(todayDate)}
							>
								Hari ini
							</Button>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Mode TV: Jam Besar -->
		{#if tvMode}
			<div class="mx-auto mt-5 flex max-w-6xl flex-col items-center">
				<p
					class="font-mono text-7xl font-bold tracking-tight text-amber-600 tabular-nums sm:text-8xl dark:text-amber-400"
				>
					{clockTime}
				</p>
				<p class="mt-2 text-lg text-muted-foreground">
					{shiftLabel} · {dateLabel}
				</p>
			</div>
		{/if}

		<!-- Konteks tanggal -->
		{#if !tvMode}
			<div class="mx-auto mt-3 max-w-6xl">
				<p class="text-xs text-muted-foreground">
					Menampilkan <span class="font-medium text-foreground">{dateLabel}</span>
					· 07:30 hari itu s/d 07:30 hari berikutnya (WIB)
					{#if !isToday}
						<span class="ms-1 text-amber-600 dark:text-amber-500">· data historis</span>
					{/if}
				</p>
			</div>
		{/if}
	</header>

	<!-- Status Summary: tetap tampil di Mode TV karena jumlah NG adalah info paling penting di board -->
	<StatusSummary {parts} date={viewDate} today={todayDate} {tvMode} />

	<!--
		Parts Grid — responsif di semua viewport:
		HP 1 kolom · tablet 2 · laptop 3 · PC 4 · TV/2xl auto-fill memenuhi layar.
		Connector antar badge fleksibel sehingga kartu tetap muat berapapun lebarnya.
	-->
	<main class={cn('mx-auto max-w-6xl px-6 py-6', tvMode && 'w-full max-w-none px-8 py-8')}>
		{#if parts.length === 0}
			<div class="flex flex-col items-center gap-2 py-20 text-center text-muted-foreground">
				<p class="text-lg font-medium">Belum ada part terkonfigurasi</p>
				<p class="text-sm">Tambahkan konfigurasi part untuk line ini terlebih dahulu.</p>
			</div>
		{:else}
			<div
				class={cn(
					'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]',
					tvMode &&
						'gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-[repeat(auto-fill,minmax(20rem,1fr))]'
				)}
			>
				{#each parts as part (part.configId)}
					<PartCard {part} {currentShift} onBadgeClick={handleBadgeClick} {tvMode} />
				{/each}
			</div>
		{/if}
	</main>
</div>

<!-- Modal: Riwayat Inspeksi -->
<Dialog.Root bind:open={modalOpen}>
	<Dialog.Portal>
		<Dialog.Overlay />
		<Dialog.Content class="flex max-h-[85vh] w-full max-w-lg flex-col gap-0 p-0">
			<Dialog.Header class="border-b px-6 py-4">
				<Dialog.Title class="text-base">{modalTitle}</Dialog.Title>
				<Dialog.Description class="text-xs">{modalSubtitle}</Dialog.Description>
			</Dialog.Header>

			<div class="flex-1 overflow-y-auto px-6 py-4">
				{#if modalLoading}
					<div class="space-y-2">
						{#each [0, 1, 2, 3] as i (i)}
							<Skeleton class="h-16 w-full" />
						{/each}
					</div>
				{:else if modalHistory.length === 0}
					<div class="py-12 text-center text-sm text-muted-foreground">
						Belum ada riwayat inspeksi pada tanggal ini.
					</div>
				{:else}
					<p class="mb-3 text-xs text-muted-foreground">
						{modalHistory.length} inspeksi ditemukan, urut terbaru
					</p>
					<div class="space-y-2">
						{#each modalHistory as row, idx (row.id)}
							{@const isExpanded = expandedId === row.id}
							{@const num = modalHistory.length - idx}
							<div
								class={cn(
									'overflow-hidden rounded-md border text-sm transition-colors',
									row.overallStatus === 'NG'
										? 'border-status-ng/30'
										: row.overallStatus === 'REPAIR'
											? 'border-status-warn/30'
											: 'border-border'
								)}
							>
								<button
									type="button"
									class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
									onclick={() => (expandedId = isExpanded ? null : row.id)}
								>
									<span class="w-7 shrink-0 text-center text-xs font-bold text-muted-foreground">
										#{num}
									</span>

									<span
										class={cn(
											'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold',
											row.overallStatus === 'OK'
												? 'bg-status-ok-fill text-status-ok'
												: row.overallStatus === 'REPAIR'
													? 'bg-status-warn-fill text-status-warn'
													: 'bg-status-ng-fill text-status-ng'
										)}
									>
										{row.overallStatus}
									</span>

									<div class="min-w-0 flex-1">
										<p class="truncate text-xs font-medium">
											{row.operatorName}
											{#if row.operator?.nik}
												<span class="font-normal text-muted-foreground">({row.operator.nik})</span>
											{/if}
										</p>
										<p class="text-xs text-muted-foreground">
											{new Date(row.inspectedAt).toLocaleString('id-ID', {
												day: '2-digit',
												month: 'short',
												year: 'numeric',
												hour: '2-digit',
												minute: '2-digit',
												timeZone: 'Asia/Jakarta'
											})}
										</p>
									</div>

									<span
										class={cn(
											'shrink-0 text-muted-foreground transition-transform duration-200',
											isExpanded ? 'rotate-180' : ''
										)}
									>
										<ChevronDownIcon class="h-4 w-4" />
									</span>
								</button>

								{#if isExpanded}
									<div class="border-t bg-muted/20 px-4 pt-3 pb-4">
										<div class="grid gap-3 text-sm">
											{#if row.spotActual !== null && row.spotActual !== undefined}
												{@const spotRepair = findRepair(row, 'SPOT')}
												<div class="grid gap-1">
													<p
														class="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
													>
														Spot
													</p>
													<div
														class="flex items-start justify-between gap-3 rounded border bg-background px-3 py-1.5"
													>
														<div class="grid">
															<span class="text-xs">Actual: {row.spotActual}</span>
															{#if spotRepair}
																<span class="text-xs text-status-warn">
																	Repair: {spotRepair.action} — {spotRepair.actorName}
																</span>
															{/if}
														</div>
														{#if row.spotStatus}
															<span
																class={cn(
																	'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
																	row.spotStatus === 'OK'
																		? 'bg-status-ok-fill text-status-ok'
																		: row.spotStatus === 'REPAIR'
																			? 'bg-status-warn-fill text-status-warn'
																			: 'bg-status-ng-fill text-status-ng'
																)}
															>
																{row.spotStatus}
															</span>
														{/if}
													</div>
												</div>
											{/if}

											{#if row.points.length > 0}
												<div class="grid gap-1">
													<p
														class="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
													>
														Points
													</p>
													{#each row.points as point (point.pointNo)}
														{@const pointRepair = findRepair(row, 'POINT', childId(point))}
														<div
															class="flex items-start justify-between gap-3 rounded border bg-background px-3 py-1.5"
														>
															<div class="grid">
																<span class="text-xs">{point.pointNo}</span>
																{#if point.remarks}
																	<span class="text-xs text-muted-foreground">{point.remarks}</span>
																{/if}
																{#if pointRepair}
																	<span class="text-xs text-status-warn">
																		Repair: {pointRepair.action} — {pointRepair.actorName}
																	</span>
																{/if}
															</div>
															<span
																class={cn(
																	'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
																	point.status === 'OK'
																		? 'bg-status-ok-fill text-status-ok'
																		: point.status === 'REPAIR'
																			? 'bg-status-warn-fill text-status-warn'
																			: 'bg-status-ng-fill text-status-ng'
																)}
															>
																{point.status}
															</span>
														</div>
													{/each}
												</div>
											{/if}

											{#if row.hardwares.length > 0}
												<div class="grid gap-1">
													<p
														class="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
													>
														Hardwares
													</p>
													{#each row.hardwares as hw (hw.id)}
														{@const hwRepair = findRepair(row, 'HARDWARE', hw.id)}
														<div
															class="flex items-start justify-between gap-3 rounded border bg-background px-3 py-1.5"
														>
															<div class="grid">
																<span class="text-xs">
																	{hw.hwNo} ({hw.hwName}) {#if hw.checkType}
																		{hw.checkType === 'TORQUE' ? 'Torque' : 'Hammer'} #{hw.checkNo}{/if}
																</span>
																<span class="text-xs text-muted-foreground">
																	Std {hw.standardValue}
																	{hw.unit} · Actual {hw.actualValue}
																	{hw.unit}
																</span>
																{#if hw.remarks}
																	<span class="text-xs text-muted-foreground">{hw.remarks}</span>
																{/if}
																{#if hwRepair}
																	<span class="text-xs text-status-warn">
																		Repair: {hwRepair.action} — {hwRepair.actorName}
																	</span>
																{/if}
															</div>
															<span
																class={cn(
																	'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
																	hw.status === 'OK'
																		? 'bg-status-ok-fill text-status-ok'
																		: hw.status === 'REPAIR'
																			? 'bg-status-warn-fill text-status-warn'
																			: 'bg-status-ng-fill text-status-ng'
																)}
															>
																{hw.status}
															</span>
														</div>
													{/each}
												</div>
											{/if}

											{#if row.lengths.length > 0}
												<div class="grid gap-1">
													<p
														class="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
													>
														Lengths
													</p>
													{#each row.lengths as length (length.lengthNo)}
														{@const lengthRepair = findRepair(row, 'LENGTH', childId(length))}
														<div
															class="flex items-start justify-between gap-3 rounded border bg-background px-3 py-1.5"
														>
															<div class="grid">
																<span class="text-xs">{length.lengthNo}</span>
																<span class="text-xs text-muted-foreground">
																	Std {length.standardMm} mm · Actual {length.actualMm} mm
																</span>
																{#if length.remarks}
																	<span class="text-xs text-muted-foreground">{length.remarks}</span
																	>
																{/if}
																{#if lengthRepair}
																	<span class="text-xs text-status-warn">
																		Repair: {lengthRepair.action} — {lengthRepair.actorName}
																	</span>
																{/if}
															</div>
															<span
																class={cn(
																	'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
																	length.status === 'OK'
																		? 'bg-status-ok-fill text-status-ok'
																		: length.status === 'REPAIR'
																			? 'bg-status-warn-fill text-status-warn'
																			: 'bg-status-ng-fill text-status-ng'
																)}
															>
																{length.status}
															</span>
														</div>
													{/each}
												</div>
											{/if}

											{#if row.visualStatus}
												{@const visualRepair = findRepair(row, 'VISUAL')}
												<div class="grid gap-1">
													<p
														class="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
													>
														Visual
													</p>
													<div
														class="flex items-start justify-between gap-3 rounded border bg-background px-3 py-1.5"
													>
														<div class="grid">
															<span class="text-xs text-muted-foreground"
																>{row.visualRemarks ?? '-'}</span
															>
															{#if visualRepair}
																<span class="text-xs text-status-warn">
																	Repair: {visualRepair.action} — {visualRepair.actorName}
																</span>
															{/if}
														</div>
														<span
															class={cn(
																'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
																row.visualStatus === 'OK'
																	? 'bg-status-ok-fill text-status-ok'
																	: row.visualStatus === 'REPAIR'
																		? 'bg-status-warn-fill text-status-warn'
																		: 'bg-status-ng-fill text-status-ng'
															)}
														>
															{row.visualStatus}
														</span>
													</div>
												</div>
											{/if}
										</div>
									</div>
								{/if}
							</div>

							{#if idx < modalHistory.length - 1}
								<Separator class="my-0.5 opacity-0" />
							{/if}
						{/each}
					</div>
				{/if}
			</div>

			<div class="border-t px-6 py-3">
				<Dialog.Close
					class="inline-flex h-9 w-full items-center justify-center rounded-md border bg-background text-sm font-medium hover:bg-accent"
				>
					Tutup
				</Dialog.Close>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
