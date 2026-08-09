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
	import StageBadgeRow from '$lib/components/board/stage-badge-row.svelte';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { cn } from '$lib/utils.js';

	const { data }: { data: PageData } = $props();

	// ── Reactive state ───────────────────────────────────────────────────
	let parts = $state<BoardPart[]>(untrack(() => data.parts));
	let sseConnected = $state(false);

	/**
	 * Tanggal operasional yang sedang ditampilkan. Bisa berubah dari dua arah:
	 * navigasi (`data.date`) dan payload SSE — board yang dibiarkan terbuka
	 * melewati 07:30 WIB akan berpindah hari dengan sendirinya.
	 */
	let viewDate = $state(untrack(() => data.date));
	let todayDate = $state(untrack(() => data.today));

	const isToday = $derived(viewDate === todayDate);

	// Modal state
	let modalOpen = $state(false);
	let modalLoading = $state(false);
	let modalHistory = $state<InspectionHistoryRow[]>([]);
	let modalTitle = $state('');
	let modalSubtitle = $state('');
	/** Set inspeksi yang sedang di-expand (by id) */
	let expandedId = $state<string | null>(null);

	// ── SSE ──────────────────────────────────────────────────────────────
	type BoardPayload = { parts: BoardPart[]; date: string; today: string };

	/**
	 * Koneksi SSE dibuka ulang setiap kali line atau tanggal berubah, karena
	 * server memfilter stream berdasarkan tanggal. Saat melihat hari berjalan,
	 * `date` sengaja tidak dikirim agar server menghitung ulang hari operasional
	 * pada tiap event — board yang menyala 24 jam ikut berganti hari sendiri.
	 */
	$effect(() => {
		const code = data.line.code;
		const requested = data.date === data.today ? null : data.date;

		// Sinkronkan tampilan dengan hasil SSR sebelum SSE mengambil alih.
		parts = data.parts;
		viewDate = data.date;
		todayDate = data.today;
		sseConnected = false;

		const query = requested ? `?date=${encodeURIComponent(requested)}` : '';
		const es = new EventSource(`/api/board/${code}/stream${query}`);

		const applyPayload = (e: MessageEvent) => {
			const payload = JSON.parse(e.data) as BoardPayload;
			parts = payload.parts;
			viewDate = payload.date;
			todayDate = payload.today;
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

	// ── Filter tanggal ───────────────────────────────────────────────────
	const DAY_MS = 24 * 60 * 60 * 1000;

	function goToDate(next: string) {
		if (!next || next === viewDate) return;
		const code = data.line.code;
		// Hari berjalan tidak perlu query — URL board tetap bersih untuk layar produksi.
		goto(
			next === todayDate
				? resolve('/board/[code]', { code })
				: resolve(`/board/[code]?date=${next}`, { code }),
			{ keepFocus: true, noScroll: true }
		);
	}

	/** Geser tanggal operasional `delta` hari, tidak pernah melewati hari berjalan. */
	function shiftDate(delta: number) {
		// dateKey diperlakukan sebagai UTC midnight, jadi aritmetika ms aman dari DST.
		const next = new Date(Date.parse(`${viewDate}T00:00:00.000Z`) + delta * DAY_MS)
			.toISOString()
			.slice(0, 10);
		if (next > todayDate) return;
		goToDate(next);
	}

	/**
	 * Label ramah untuk tanggal operasional yang sedang ditampilkan.
	 * Dirender sebagai UTC karena `viewDate` sudah berupa tanggal Jakarta.
	 */
	const dateLabel = $derived(
		new Date(Date.parse(`${viewDate}T00:00:00.000Z`)).toLocaleDateString('id-ID', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			timeZone: 'UTC'
		})
	);

	// ── Badge click → buka Modal ─────────────────────────────────────────
	const STAGE_LABELS: Record<StageKey, string> = { START: 'Start', MIDDLE: 'Middle', END: 'End' };

	async function handleBadgeClick(part: BoardPart, shift: ShiftKey, stage: StageKey) {
		modalTitle = `${part.partNo} — ${STAGE_LABELS[stage]}`;
		modalSubtitle = `${shift === 'DAY' ? 'Day Shift' : 'Night Shift'} · ${data.line.code} · ${dateLabel}`;
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
				// Auto-expand inspeksi pertama (terbaru)
				if (modalHistory.length > 0) expandedId = modalHistory[0].id;
			}
		} finally {
			modalLoading = false;
		}
	}

	function toggleExpand(id: string) {
		expandedId = expandedId === id ? null : id;
	}

	// ── Helpers ──────────────────────────────────────────────────────────
	function formatDate(iso: string): string {
		return new Date(iso).toLocaleString('id-ID', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			timeZone: 'Asia/Jakarta'
		});
	}

	function statusClass(status: 'OK' | 'NG') {
		return status === 'OK'
			? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
			: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400';
	}
</script>

<svelte:head>
	<title>Parts Overview — {data.line.name}</title>
</svelte:head>

<div class="min-h-screen bg-background">
	<!-- Header -->
	<div class="border-b bg-card px-6 py-5">
		<div class="mx-auto flex max-w-5xl items-start justify-between gap-4">
			<div>
				<div class="flex items-center gap-2">
					<h1 class="text-2xl font-bold tracking-tight">Parts Overview</h1>
					<Badge variant="secondary" class="font-mono text-xs">{data.line.code}</Badge>
					{#if sseConnected}
						<span class="flex items-center gap-1 text-xs text-green-600">
							<span class="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500"></span>
							Live
						</span>
					{:else}
						<span class="flex items-center gap-1 text-xs text-muted-foreground">
							<span class="inline-block h-2 w-2 rounded-full bg-muted-foreground/50"></span>
							Connecting…
						</span>
					{/if}
				</div>
				<p class="mt-1 text-sm text-muted-foreground">
					{data.line.name} · Click a stage badge to view inspection history for that shift.
				</p>
			</div>

			<div class="flex shrink-0 flex-col items-end gap-3">
				<!-- Legend -->
				<div class="flex items-center gap-4 text-xs text-muted-foreground">
					<div class="flex items-center gap-1.5">
						<span class="h-4 w-4 rounded-full bg-green-500"></span>
						<span>OK</span>
					</div>
					<div class="flex items-center gap-1.5">
						<span class="h-4 w-4 rounded-full bg-red-500"></span>
						<span>NG</span>
					</div>
					<div class="flex items-center gap-1.5">
						<span class="h-4 w-4 rounded-full bg-muted-foreground/30"></span>
						<span>—</span>
					</div>
				</div>

				<!-- Filter tanggal operasional -->
				<div class="flex items-center gap-1.5">
					<Button
						variant="outline"
						size="sm"
						class="h-8 w-8 p-0"
						aria-label="Hari sebelumnya"
						onclick={() => shiftDate(-1)}
					>
						‹
					</Button>
					<Input
						type="date"
						max={todayDate}
						value={viewDate}
						aria-label="Tanggal operasional"
						class="h-8 w-[9.5rem] text-xs"
						onchange={(e) => goToDate(e.currentTarget.value)}
					/>
					<Button
						variant="outline"
						size="sm"
						class="h-8 w-8 p-0"
						aria-label="Hari berikutnya"
						disabled={isToday}
						onclick={() => shiftDate(1)}
					>
						›
					</Button>
					<Button
						variant={isToday ? 'secondary' : 'outline'}
						size="sm"
						class="h-8 text-xs"
						disabled={isToday}
						onclick={() => goToDate(todayDate)}
					>
						Hari ini
					</Button>
				</div>
			</div>
		</div>

		<!-- Konteks tanggal: shift malam melewati tengah malam, jadi perlu eksplisit -->
		<div class="mx-auto mt-3 max-w-5xl">
			<p class="text-xs text-muted-foreground">
				Menampilkan <span class="font-medium text-foreground">{dateLabel}</span>
				· 07:30 hari itu s/d 07:30 hari berikutnya (WIB){#if !isToday}
					<span class="ms-1 text-amber-600 dark:text-amber-500">· data historis</span>
				{/if}
			</p>
		</div>
	</div>

	<!-- Table -->
	<div class="mx-auto max-w-5xl px-6 py-6">
		{#if parts.length === 0}
			<div class="flex flex-col items-center gap-2 py-20 text-center text-muted-foreground">
				<p class="text-lg font-medium">Belum ada part terkonfigurasi</p>
				<p class="text-sm">Tambahkan konfigurasi part untuk line ini terlebih dahulu.</p>
			</div>
			<!-- Catatan: daftar part berasal dari config aktif, bukan dari inspeksi,
			     sehingga tabel tetap tampil (dengan badge kosong) pada tanggal tanpa data. -->
		{:else}
			<div class="rounded-lg border bg-card shadow-sm">
				<Table.Root>
					<Table.Header>
						<Table.Row class="hover:bg-transparent">
							<Table.Head class="w-32 font-semibold">Part No.</Table.Head>
							<Table.Head class="font-semibold">Part Name</Table.Head>
							<Table.Head class="text-center font-semibold">Day Shift</Table.Head>
							<Table.Head class="text-center font-semibold">Night Shift</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each parts as part (part.configId)}
							<Table.Row class="border-b last:border-b-0">
								<Table.Cell class="font-mono font-bold text-primary">{part.partNo}</Table.Cell>
								<Table.Cell class="max-w-[14rem] leading-snug font-medium break-words uppercase">
									{part.partName}
								</Table.Cell>
								<Table.Cell class="text-center">
									<div class="flex justify-center">
										<StageBadgeRow
											shift="DAY"
											statuses={part.status.DAY}
											onBadgeClick={(shift, stage) => handleBadgeClick(part, shift, stage)}
										/>
									</div>
								</Table.Cell>
								<Table.Cell class="text-center">
									<div class="flex justify-center">
										<StageBadgeRow
											shift="NIGHT"
											statuses={part.status.NIGHT}
											onBadgeClick={(shift, stage) => handleBadgeClick(part, shift, stage)}
										/>
									</div>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</div>
		{/if}
	</div>
</div>

<!-- Modal: Inspection History -->
<Dialog.Root bind:open={modalOpen}>
	<Dialog.Portal>
		<Dialog.Overlay />
		<Dialog.Content class="flex max-h-[85vh] w-full max-w-lg flex-col gap-0 p-0">
			<!-- Header -->
			<Dialog.Header class="border-b px-6 py-4">
				<Dialog.Title class="text-base">{modalTitle}</Dialog.Title>
				<Dialog.Description class="text-xs">{modalSubtitle}</Dialog.Description>
			</Dialog.Header>

			<!-- List -->
			<div class="flex-1 overflow-y-auto px-6 py-4">
				{#if modalLoading}
					<div class="space-y-2">
						{#each [0, 1, 2, 3] as i (i)}
							<Skeleton class="h-14 w-full rounded-md" />
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
										? 'border-red-200 dark:border-red-900/50'
										: 'border-border'
								)}
							>
								<!-- Summary row — klik untuk expand -->
								<button
									type="button"
									class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
									onclick={() => toggleExpand(row.id)}
								>
									<!-- Nomor urut (dari terlama = #1) -->
									<span class="w-7 shrink-0 text-center text-xs font-bold text-muted-foreground">
										#{num}
									</span>

									<!-- Status badge -->
									<span
										class={cn(
											'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold',
											statusClass(row.overallStatus)
										)}
									>
										{row.overallStatus}
									</span>

									<!-- Info -->
									<div class="min-w-0 flex-1">
										<p class="truncate text-xs font-medium">
											{row.operatorName}
											{#if row.operator?.nik}
												<span class="font-normal text-muted-foreground">({row.operator.nik})</span>
											{/if}
										</p>
										<p class="text-xs text-muted-foreground">
											{formatDate(row.inspectedAt.toString())}
										</p>
									</div>

									<!-- Chevron -->
									<span
										class={cn(
											'shrink-0 text-muted-foreground transition-transform duration-200',
											isExpanded ? 'rotate-180' : ''
										)}
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="h-4 w-4"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<path d="m6 9 6 6 6-6" />
										</svg>
									</span>
								</button>

								<!-- Detail (expanded) -->
								{#if isExpanded}
									<div class="border-t bg-muted/20 px-4 pt-3 pb-4">
										<div class="grid gap-3 text-sm">
											<!-- Spot -->
											{#if row.spotActual !== null && row.spotActual !== undefined}
												<div class="grid gap-1">
													<p
														class="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
													>
														Spot
													</p>
													<div class="rounded border bg-background px-3 py-1.5 text-xs">
														Actual: {row.spotActual}
													</div>
												</div>
											{/if}

											<!-- Points -->
											{#if row.points.length > 0}
												<div class="grid gap-1">
													<p
														class="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
													>
														Points
													</p>
													{#each row.points as point (point.pointNo)}
														<div
															class="flex items-start justify-between gap-3 rounded border bg-background px-3 py-1.5"
														>
															<div class="grid">
																<span class="text-xs">{point.pointNo}</span>
																{#if point.remarks}
																	<span class="text-xs text-muted-foreground">{point.remarks}</span>
																{/if}
															</div>
															<span
																class={cn(
																	'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
																	statusClass(point.status)
																)}
															>
																{point.status}
															</span>
														</div>
													{/each}
												</div>
											{/if}

											<!-- Hardwares -->
											{#if row.hardwares.length > 0}
												<div class="grid gap-1">
													<p
														class="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
													>
														Hardwares
													</p>
													{#each row.hardwares as hw (hw.hwNo)}
														<div
															class="flex items-start justify-between gap-3 rounded border bg-background px-3 py-1.5"
														>
															<div class="grid">
																<span class="text-xs">{hw.hwNo} — {hw.hwName}</span>
																<span class="text-xs text-muted-foreground">
																	Std {hw.standardValue}
																	{hw.unit} · Actual {hw.actualValue}
																	{hw.unit}
																</span>
																{#if hw.remarks}
																	<span class="text-xs text-muted-foreground">{hw.remarks}</span>
																{/if}
															</div>
															<span
																class={cn(
																	'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
																	statusClass(hw.status)
																)}
															>
																{hw.status}
															</span>
														</div>
													{/each}
												</div>
											{/if}

											<!-- Lengths -->
											{#if row.lengths.length > 0}
												<div class="grid gap-1">
													<p
														class="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
													>
														Lengths
													</p>
													{#each row.lengths as length (length.lengthNo)}
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
															</div>
															<span
																class={cn(
																	'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
																	statusClass(length.status)
																)}
															>
																{length.status}
															</span>
														</div>
													{/each}
												</div>
											{/if}

											<!-- Visual -->
											{#if row.visualStatus}
												<div class="grid gap-1">
													<p
														class="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
													>
														Visual
													</p>
													<div
														class="flex items-start justify-between gap-3 rounded border bg-background px-3 py-1.5"
													>
														<span class="text-xs text-muted-foreground"
															>{row.visualRemarks ?? '-'}</span
														>
														<span
															class={cn(
																'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
																statusClass(row.visualStatus)
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

			<!-- Footer -->
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
