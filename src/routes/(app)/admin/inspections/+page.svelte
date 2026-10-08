<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import StatusBadge from '$lib/components/status-badge.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent } from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import DatePicker from '$lib/components/date-picker.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger
	} from '$lib/components/ui/select/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import PageHeader from '$lib/components/page-header.svelte';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import PaginationFooter from '$lib/components/pagination-footer.svelte';
	import SearchIcon from '@lucide/svelte/icons/search';
	import InboxIcon from '@lucide/svelte/icons/inbox';
	import { formatDateTime } from '$lib/format.js';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import WrenchIcon from '@lucide/svelte/icons/wrench';
	import Undo2Icon from '@lucide/svelte/icons/undo-2';

	type ItemStatus = 'OK' | 'NG' | 'REPAIR';
	type RepairItemType = 'POINT' | 'HARDWARE' | 'LENGTH' | 'SPOT' | 'VISUAL';

	type RepairRow = {
		id: string;
		itemType: RepairItemType;
		itemId: string | null;
		action: string;
		actorName: string;
		createdAt: string;
	};

	type InspectionRow = {
		id: string;
		partNo: string;
		lineCode: string;
		stage: string;
		shift: string;
		overallStatus: ItemStatus;
		operatorName: string;
		inspectedAt: string;
	};

	type InspectionDetail = InspectionRow & {
		spotActual: number | null;
		spotStatus: ItemStatus | null;
		visualStatus: ItemStatus | null;
		visualRemarks: string | null;
		operator?: { nik: string; name: string };
		points: { id: string; pointNo: string; status: ItemStatus; remarks: string | null }[];
		hardwares: {
			id: string;
			hwNo: string;
			hwName: string;
			standardValue: number;
			unit: string;
			actualValue: number;
			checkType: 'TORQUE' | 'HAMMER' | null;
			checkNo: number;
			status: ItemStatus;
			remarks: string | null;
		}[];
		lengths: {
			id: string;
			lengthNo: string;
			standardMm: number;
			actualMm: number;
			status: ItemStatus;
			remarks: string | null;
		}[];
		/** Hanya repair aktif — yang sudah dibatalkan tidak dikirim server. */
		repairs: RepairRow[];
	};

	let rows: InspectionRow[] = $state([]);
	let loading = $state(true);
	let page = $state(1);
	let totalPages = $state(1);
	let total = $state(0);
	let okCount = $state(0);
	let ngCount = $state(0);
	let repairCount = $state(0);

	let filterPartNo = $state('');
	let filterLineCode = $state('');
	let filterStage = $state('');
	let filterShift = $state('');
	let filterStatus = $state('');
	let filterDateFrom = $state('');
	let filterDateTo = $state('');

	/** Hanya shortcut visual untuk filterStatus === 'NG' — selalu sinkron dengan select. */
	const showNgOnly = $derived(filterStatus === 'NG');

	let detail: InspectionDetail | null = $state(null);
	let detailOpen = $state(false);
	let detailLoading = $state(false);

	/** Target form repair inline: `${itemType}:${itemId ?? 'self'}`. */
	let repairingKey: string | null = $state(null);
	let repairAction = $state('');
	let repairSubmitting = $state(false);
	/** Key item yang sedang menampilkan konfirmasi batalkan repair. */
	let revertConfirmKey: string | null = $state(null);
	/** Key item yang sedang diproses pembatalannya (cegah double-submit). */
	let revertingKey: string | null = $state(null);

	let mounted = $state(false);
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	let requestSeq = 0;
	let detailSeq = 0;
	/** true sampai pencarian pertama selesai dipicu — supaya mount langsung load tanpa debounce. */
	let firstSearch = true;
	/** cegah klik ganda saat export sedang dipicu. */
	let exporting = $state(false);

	function buildQuery(targetPage: number): string {
		const entries: [string, string][] = [
			['page', String(targetPage)],
			['pageSize', '25'],
			['partNo', filterPartNo.trim()],
			['lineCode', filterLineCode.trim()],
			['stage', filterStage],
			['shift', filterShift],
			['status', filterStatus],
			['dateFrom', filterDateFrom],
			['dateTo', filterDateTo]
		];
		return entries
			.filter(([, value]) => value !== '')
			.map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
			.join('&');
	}

	async function load(targetPage = 1) {
		const seq = ++requestSeq;
		loading = true;
		try {
			const res = await fetch(`/api/inspections?${buildQuery(targetPage)}`);
			const body = await res.json();
			if (seq !== requestSeq) return; // response basi — abaikan
			if (!res.ok) {
				toast.error(body?.message ?? 'Gagal memuat data inspeksi.');
				return;
			}
			rows = body.data.rows ?? [];
			page = body.data.page;
			totalPages = body.data.totalPages;
			total = body.data.total;
			okCount = body.data.ok ?? 0;
			ngCount = body.data.ng ?? 0;
			repairCount = body.data.repair ?? 0;
		} finally {
			if (seq === requestSeq) loading = false;
		}
	}

	/** Tulis filter + halaman saat ini ke URL (replaceState, tidak menambah riwayat). */
	function syncUrl(targetPage: number) {
		const qs = buildQuery(targetPage);
		goto(resolve(qs ? `/admin/inspections?${qs}` : '/admin/inspections'), {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	/** Cari segera (tombol Cari / Enter) — batalkan debounce yang tertunda. */
	function runSearch(targetPage = 1) {
		clearTimeout(searchTimer);
		syncUrl(targetPage);
		load(targetPage);
	}

	/** Debounce untuk perubahan filter dari ketikan/select/date. */
	function scheduleSearch() {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => runSearch(1), 400);
	}

	function goToPage(targetPage: number) {
		clearTimeout(searchTimer);
		syncUrl(targetPage);
		load(targetPage);
	}

	$effect(() => {
		void [
			filterPartNo,
			filterLineCode,
			filterStage,
			filterShift,
			filterStatus,
			filterDateFrom,
			filterDateTo
		];
		if (!mounted) return;
		if (firstSearch) {
			firstSearch = false;
			load(1);
			return;
		}
		scheduleSearch();
	});

	onMount(() => {
		const sp = new URLSearchParams(window.location.search);
		filterPartNo = sp.get('partNo') ?? '';
		filterLineCode = sp.get('lineCode') ?? '';
		filterStage = sp.get('stage') ?? '';
		filterShift = sp.get('shift') ?? '';
		filterStatus = sp.get('status') ?? '';
		filterDateFrom = sp.get('dateFrom') ?? '';
		filterDateTo = sp.get('dateTo') ?? '';
		mounted = true;
	});

	function resetFilters() {
		filterPartNo = '';
		filterLineCode = '';
		filterStage = '';
		filterShift = '';
		filterStatus = '';
		filterDateFrom = '';
		filterDateTo = '';
		runSearch(1);
	}

	function toggleNgOnly() {
		filterStatus = filterStatus === 'NG' ? '' : 'NG';
	}

	/** Query export = filter aktif tanpa page/pageSize. */
	function buildExportQuery(): string {
		const entries: [string, string][] = [
			['partNo', filterPartNo.trim()],
			['lineCode', filterLineCode.trim()],
			['stage', filterStage],
			['shift', filterShift],
			['status', filterStatus],
			['dateFrom', filterDateFrom],
			['dateTo', filterDateTo]
		];
		return entries
			.filter(([, value]) => value !== '')
			.map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
			.join('&');
	}

	function exportExcel() {
		if (exporting) return;
		exporting = true;
		const qs = buildExportQuery();
		window.location.assign(`/api/inspections/export${qs ? `?${qs}` : ''}`);
		setTimeout(() => (exporting = false), 5000);
	}

	async function loadDetail(id: string, opts: { silent?: boolean } = {}) {
		const seq = ++detailSeq;
		const silent = opts.silent ?? false;
		if (!silent) {
			detail = null;
			detailLoading = true;
			detailOpen = true;
			// Detail baru mulai bersih — jangan bawa form repair item sebelumnya.
			repairingKey = null;
			repairAction = '';
			revertConfirmKey = null;
		}
		try {
			const res = await fetch(`/api/inspections/${id}`);
			const body = await res.json();
			if (seq !== detailSeq) return;
			if (!res.ok) {
				toast.error(body?.message ?? 'Gagal memuat detail inspeksi.');
				if (!silent) detailOpen = false;
				return;
			}
			detail = body.data;
		} finally {
			if (seq === detailSeq && !silent) detailLoading = false;
		}
	}

	async function openDetail(row: InspectionRow) {
		await loadDetail(row.id);
	}

	/** Refresh detail yang sedang terbuka TANPA menutup dialog / menampilkan skeleton. */
	async function refreshDetail() {
		if (!detail) return;
		await loadDetail(detail.id, { silent: true });
	}

	function itemKey(itemType: RepairItemType, itemId: string | null): string {
		return `${itemType}:${itemId ?? 'self'}`;
	}

	function parseKey(key: string): { itemType: RepairItemType; itemId: string | null } {
		const [itemType, rawId] = key.split(':');
		return {
			itemType: itemType as RepairItemType,
			itemId: rawId && rawId !== 'self' ? rawId : null
		};
	}

	/** Repair AKTIF milik satu item (SPOT/VISUAL selalu itemId null). */
	function findActiveRepair(itemType: RepairItemType, itemId: string | null): RepairRow | null {
		return (
			(detail?.repairs ?? []).find((r) => r.itemType === itemType && r.itemId === itemId) ?? null
		);
	}

	function startRepair(itemType: RepairItemType, itemId: string | null) {
		repairingKey = itemKey(itemType, itemId);
		repairAction = '';
	}

	function cancelRepair() {
		repairingKey = null;
		repairAction = '';
	}

	async function submitRepair() {
		if (!detail || !repairingKey || repairSubmitting) return;
		const action = repairAction.trim();
		if (!action) return; // tombol memang disabled, ini jaring pengaman
		const { itemType, itemId } = parseKey(repairingKey);
		const inspectionId = detail.id;
		repairSubmitting = true;
		try {
			const res = await fetch(`/api/inspections/${inspectionId}/repair`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ itemType, itemId, action })
			});
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				toast.error(body?.message ?? 'Gagal menyimpan repair.');
				return;
			}
			toast.success('Repair tersimpan.');
			cancelRepair();
			// Refresh detail (status item + overall) dan list (badge + counter).
			await Promise.all([refreshDetail(), load(page)]);
		} finally {
			repairSubmitting = false;
		}
	}

	async function submitRevert(itemType: RepairItemType, itemId: string | null) {
		if (!detail || revertingKey) return;
		const inspectionId = detail.id;
		revertingKey = itemKey(itemType, itemId);
		try {
			const res = await fetch(`/api/inspections/${inspectionId}/repair/revert`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ itemType, itemId })
			});
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				toast.error(body?.message ?? 'Gagal membatalkan repair.');
				return;
			}
			toast.success('Repair dibatalkan — status kembali NG.');
			revertConfirmKey = null;
			await Promise.all([refreshDetail(), load(page)]);
		} finally {
			revertingKey = null;
		}
	}

	const stageOptions = [
		{ value: '', label: 'Semua Stage' },
		{ value: 'START', label: 'Start' },
		{ value: 'MIDDLE', label: 'Middle' },
		{ value: 'END', label: 'End' }
	];
	const shiftOptions = [
		{ value: '', label: 'Semua Shift' },
		{ value: 'DAY', label: 'Day' },
		{ value: 'NIGHT', label: 'Night' }
	];
	const statusOptions = [
		{ value: '', label: 'Semua Status' },
		{ value: 'OK', label: 'OK' },
		{ value: 'REPAIR', label: 'Repair' },
		{ value: 'NG', label: 'NG' }
	];
</script>

<!--
	Kontrol repair per item: tombol Repair (NG), form action inline, atau
	info repair aktif + Batalkan (REPAIR). Item OK / inspeksi lama (null) tidak
	menampilkan apa-apa. Dipakai di Points, Spot, Hardwares, Lengths, Visual.
-->
{#snippet repairControls(
	itemType: RepairItemType,
	itemId: string | null,
	status: ItemStatus | null,
	activeRepair: RepairRow | null
)}
	{#if status === 'NG'}
		{#if repairingKey === itemKey(itemType, itemId)}
			<div class="grid gap-2 rounded-lg border border-dashed p-3">
				<Label for={`repair-action-${itemType}-${itemId ?? 'self'}`}>Action (wajib)</Label>
				<Textarea
					id={`repair-action-${itemType}-${itemId ?? 'self'}`}
					rows={2}
					placeholder="Tindakan perbaikan yang dilakukan…"
					bind:value={repairAction}
					disabled={repairSubmitting}
				/>
				<div class="flex justify-end gap-2">
					<Button
						size="sm"
						onclick={submitRepair}
						disabled={!repairAction.trim() || repairSubmitting}
					>
						{repairSubmitting ? 'Menyimpan…' : 'Simpan Repair'}
					</Button>
					<Button variant="outline" size="sm" onclick={cancelRepair} disabled={repairSubmitting}>
						Batal
					</Button>
				</div>
			</div>
		{:else}
			<div class="flex justify-end">
				<Button variant="outline" size="sm" onclick={() => startRepair(itemType, itemId)}>
					<WrenchIcon class="size-3.5" />
					Repair
				</Button>
			</div>
		{/if}
	{:else if status === 'REPAIR' && activeRepair}
		<div class="grid gap-2 rounded-lg border border-status-warn/30 bg-status-warn-fill/40 p-3">
			<div class="flex items-start justify-between gap-3">
				<div class="grid gap-0.5">
					<span class="text-xs font-medium text-status-warn">Repair: {activeRepair.action}</span>
					<span class="text-[11px] text-status-warn/80">
						oleh {activeRepair.actorName} · {formatDateTime(activeRepair.createdAt)}
					</span>
				</div>
				{#if revertConfirmKey !== itemKey(itemType, itemId)}
					<Button
						variant="outline"
						size="sm"
						onclick={() => (revertConfirmKey = itemKey(itemType, itemId))}
						disabled={revertingKey !== null}
					>
						<Undo2Icon class="size-3.5" />
						Batalkan
					</Button>
				{/if}
			</div>
			{#if revertConfirmKey === itemKey(itemType, itemId)}
				<div
					class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-status-warn/30 bg-background/60 px-3 py-2"
				>
					<span class="text-xs text-status-warn">Batalkan repair ini? Status kembali NG.</span>
					<div class="flex gap-2">
						<Button
							size="sm"
							variant="destructive"
							onclick={() => submitRevert(itemType, itemId)}
							disabled={revertingKey !== null}
						>
							{revertingKey === itemKey(itemType, itemId) ? 'Membatalkan…' : 'Ya, Batalkan'}
						</Button>
						<Button
							variant="outline"
							size="sm"
							onclick={() => (revertConfirmKey = null)}
							disabled={revertingKey !== null}
						>
							Tidak
						</Button>
					</div>
				</div>
			{/if}
		</div>
	{/if}
{/snippet}

<PageHeader
	title="Hasil Inspeksi"
	description="Riwayat inspeksi beserta seluruh snapshot nilai saat pemeriksaan dilakukan."
>
	{#snippet actions()}
		<Button variant="outline" size="sm" onclick={exportExcel} disabled={exporting}>
			<DownloadIcon class="size-4" />
			Export Excel
		</Button>
		<Button variant={showNgOnly ? 'destructive' : 'outline'} size="sm" onclick={toggleNgOnly}>
			{showNgOnly ? 'Semua' : 'Hanya NG'}
		</Button>
	{/snippet}
</PageHeader>

<!-- Summary Stats (total global sesuai filter) -->
<div class="grid grid-cols-2 gap-3 md:grid-cols-4">
	<div class="rounded-lg border bg-muted/30 px-3 py-2 text-center">
		<p class="text-2xl font-bold">{total}</p>
		<p class="text-xs text-muted-foreground">Total</p>
	</div>
	<div class="rounded-lg border border-status-ok/30 bg-status-ok-fill px-3 py-2 text-center">
		<p class="text-2xl font-bold text-status-ok tabular-nums">{okCount}</p>
		<p class="text-xs font-medium text-status-ok">OK</p>
	</div>
	<div class="rounded-lg border border-status-warn/30 bg-status-warn-fill px-3 py-2 text-center">
		<p class="text-2xl font-bold text-status-warn tabular-nums">{repairCount}</p>
		<p class="text-xs font-medium text-status-warn">Repair</p>
	</div>
	<div class="rounded-lg border border-status-ng/30 bg-status-ng-fill px-3 py-2 text-center">
		<p class="text-2xl font-bold text-status-ng tabular-nums">{ngCount}</p>
		<p class="text-xs font-medium text-status-ng">NG</p>
	</div>
</div>

<Card>
	<CardContent class="grid gap-4">
		<!-- Filters -->
		<div class="grid gap-4 rounded-xl bg-muted/40 p-4 ring-1 ring-foreground/5">
			<div class="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
				<div class="grid gap-1.5">
					<Label for="filterPartNo">Part No</Label>
					<div class="relative">
						<SearchIcon
							class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
							aria-hidden="true"
						/>
						<Input
							id="filterPartNo"
							placeholder="contoh: 64300"
							class="pl-9"
							bind:value={filterPartNo}
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									runSearch();
								}
							}}
						/>
					</div>
				</div>
				<div class="grid gap-1.5">
					<Label for="filterLineCode">Line Code</Label>
					<div class="relative">
						<SearchIcon
							class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
							aria-hidden="true"
						/>
						<Input
							id="filterLineCode"
							placeholder="contoh: RSW"
							class="pl-9"
							bind:value={filterLineCode}
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									runSearch();
								}
							}}
						/>
					</div>
				</div>
				<div class="grid gap-1.5">
					<Label>Dari Tanggal</Label>
					<DatePicker bind:value={filterDateFrom} clearable placeholder="Dari tanggal" />
					<p class="text-[10px] text-muted-foreground">Tanggal operasional (07:30–07:30 WIB)</p>
				</div>
				<div class="grid gap-1.5">
					<Label>Sampai Tanggal</Label>
					<DatePicker bind:value={filterDateTo} clearable placeholder="Sampai tanggal" />
					<p class="text-[10px] text-muted-foreground">Tanggal operasional (07:30–07:30 WIB)</p>
				</div>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				<div class="grid gap-1.5">
					<Label>Stage</Label>
					<Select type="single" bind:value={filterStage}>
						<SelectTrigger class="w-[140px]">
							{#if filterStage}
								<span>{stageOptions.find((o) => o.value === filterStage)?.label}</span>
							{:else}
								<span class="text-muted-foreground">Semua Stage</span>
							{/if}
						</SelectTrigger>
						<SelectContent>
							{#each stageOptions as opt (opt.value)}
								<SelectItem value={opt.value}>{opt.label}</SelectItem>
							{/each}
						</SelectContent>
					</Select>
				</div>
				<div class="grid gap-1.5">
					<Label>Shift</Label>
					<Select type="single" bind:value={filterShift}>
						<SelectTrigger class="w-[140px]">
							{#if filterShift}
								<span>{shiftOptions.find((o) => o.value === filterShift)?.label}</span>
							{:else}
								<span class="text-muted-foreground">Semua Shift</span>
							{/if}
						</SelectTrigger>
						<SelectContent>
							{#each shiftOptions as opt (opt.value)}
								<SelectItem value={opt.value}>{opt.label}</SelectItem>
							{/each}
						</SelectContent>
					</Select>
				</div>
				<div class="grid gap-1.5">
					<Label>Status</Label>
					<Select type="single" bind:value={filterStatus}>
						<SelectTrigger class="w-[140px]">
							{#if filterStatus}
								<span>{statusOptions.find((o) => o.value === filterStatus)?.label}</span>
							{:else}
								<span class="text-muted-foreground">Semua Status</span>
							{/if}
						</SelectTrigger>
						<SelectContent>
							{#each statusOptions as opt (opt.value)}
								<SelectItem value={opt.value}>{opt.label}</SelectItem>
							{/each}
						</SelectContent>
					</Select>
				</div>
				<div class="ms-auto flex items-end gap-2">
					<Button size="sm" onclick={() => runSearch()}>Cari</Button>
					<Button variant="outline" size="sm" onclick={resetFilters}>Reset</Button>
				</div>
			</div>
		</div>

		<!-- Table -->
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Waktu</Table.Head>
					<Table.Head>Part No</Table.Head>
					<Table.Head>Line</Table.Head>
					<Table.Head>Stage</Table.Head>
					<Table.Head>Shift</Table.Head>
					<Table.Head>Operator</Table.Head>
					<Table.Head class="text-center">Status</Table.Head>
					<Table.Head class="text-end">Aksi</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each rows as row (row.id)}
					<Table.Row
						class={row.overallStatus === 'NG'
							? 'bg-status-ng-fill/40 transition-colors hover:bg-status-ng-fill'
							: 'transition-colors hover:bg-muted/50'}
					>
						<Table.Cell>{formatDateTime(row.inspectedAt)}</Table.Cell>
						<Table.Cell class="font-mono font-medium">{row.partNo}</Table.Cell>
						<Table.Cell>
							<Badge variant="secondary">{row.lineCode}</Badge>
						</Table.Cell>
						<Table.Cell>
							<Badge variant="outline">{row.stage}</Badge>
						</Table.Cell>
						<Table.Cell>
							<Badge variant="outline">{row.shift}</Badge>
						</Table.Cell>
						<Table.Cell>{row.operatorName}</Table.Cell>
						<Table.Cell class="text-center">
							<StatusBadge status={row.overallStatus} />
						</Table.Cell>
						<Table.Cell class="text-end">
							<Button
								variant="ghost"
								size="sm"
								onclick={() => openDetail(row)}
								disabled={detailLoading}
							>
								Detail
							</Button>
						</Table.Cell>
					</Table.Row>
				{:else}
					{#if loading}
						{#each [0, 1, 2, 3, 4] as i (i)}
							<Table.Row>
								<Table.Cell colspan={8}>
									<Skeleton class="h-10 w-full" />
								</Table.Cell>
							</Table.Row>
						{/each}
					{:else}
						<Table.Row>
							<Table.Cell colspan={8} class="p-0">
								<div class="p-4">
									<Empty.Root>
										<Empty.Media variant="icon">
											<InboxIcon />
										</Empty.Media>
										<Empty.Header>
											<Empty.Title>Belum ada inspeksi</Empty.Title>
											<Empty.Description
												>Hasil inspeksi akan muncul di sini setelah operator melakukan pemeriksaan.</Empty.Description
											>
										</Empty.Header>
									</Empty.Root>
								</div></Table.Cell
							>
						</Table.Row>
					{/if}
				{/each}
			</Table.Body>
		</Table.Root>

		<PaginationFooter
			{total}
			{page}
			{totalPages}
			{loading}
			unit="inspeksi"
			onPrev={() => goToPage(page - 1)}
			onNext={() => goToPage(page + 1)}
		/>
	</CardContent>
</Card>

<Dialog.Root bind:open={detailOpen}>
	<Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>Detail Inspeksi</Dialog.Title>
			<Dialog.Description>
				Semua nilai di bawah adalah snapshot saat inspeksi dilakukan.
			</Dialog.Description>
		</Dialog.Header>
		{#if detailLoading}
			<div class="grid gap-4 py-2 text-sm">
				<Skeleton class="h-44 w-full" />
			</div>
		{:else if detail}
			<div class="grid gap-4 py-2 text-sm">
				<!-- Meta Info -->
				<div class="grid grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-3">
					<div>
						<span class="text-muted-foreground">Part No</span>
						<p class="font-mono font-medium">{detail.partNo}</p>
					</div>
					<div>
						<span class="text-muted-foreground">Line</span>
						<p class="font-medium">{detail.lineCode}</p>
					</div>
					<div>
						<span class="text-muted-foreground">Stage</span>
						<p class="font-medium">{detail.stage}</p>
					</div>
					<div>
						<span class="text-muted-foreground">Shift</span>
						<p class="font-medium">{detail.shift}</p>
					</div>
					<div>
						<span class="text-muted-foreground">Operator</span>
						<p class="font-medium">
							{detail.operatorName}
							<span class="text-muted-foreground">({detail.operator?.nik ?? '-'})</span>
						</p>
					</div>
					<div>
						<span class="text-muted-foreground">Waktu</span>
						<p class="font-medium">{formatDateTime(detail.inspectedAt)}</p>
					</div>
					<div class="col-span-2">
						<span class="text-muted-foreground">Overall</span>
						<div class="mt-1">
							<StatusBadge status={detail.overallStatus} />
						</div>
					</div>
				</div>

				{#if detail.points.length}
					<div class="grid gap-2">
						<h3 class="font-semibold">Points</h3>
						<div class="grid gap-2">
							{#each detail.points as point (point.pointNo)}
								<div class="grid gap-2">
									<div class="flex items-start justify-between gap-3 rounded-lg border p-3">
										<div class="grid">
											<span class="font-medium">{point.pointNo}</span>
											{#if point.remarks}
												<span class="text-xs text-muted-foreground">{point.remarks}</span>
											{/if}
										</div>
										<StatusBadge status={point.status} />
									</div>
									{@render repairControls(
										'POINT',
										point.id,
										point.status,
										findActiveRepair('POINT', point.id)
									)}
								</div>
							{/each}
						</div>
					</div>
				{/if}

				{#if detail.spotActual !== null}
					<div class="grid gap-2">
						<h3 class="font-semibold">Spot</h3>
						<div class="grid gap-2">
							<div class="flex items-center justify-between gap-3 rounded-lg border p-3">
								<span>Actual: {detail.spotActual}</span>
								{#if detail.spotStatus}
									<StatusBadge status={detail.spotStatus} />
								{/if}
							</div>
							{@render repairControls(
								'SPOT',
								null,
								detail.spotStatus,
								findActiveRepair('SPOT', null)
							)}
						</div>
					</div>
				{/if}

				{#if detail.hardwares.length}
					<div class="grid gap-2">
						<h3 class="font-semibold">Hardwares</h3>
						<div class="grid gap-2">
							{#each detail.hardwares as hw (hw.id)}
								<div class="grid gap-2">
									<div class="flex items-start justify-between gap-3 rounded-lg border p-3">
										<div class="grid">
											<span class="font-medium">
												{hw.hwNo} ({hw.hwName}) {#if hw.checkType}
													{hw.checkType === 'TORQUE' ? 'Torque' : 'Hammer'} #{hw.checkNo}{/if}
											</span>
											<span class="text-xs text-muted-foreground">
												Standard {hw.standardValue}
												{hw.unit} · Actual {hw.actualValue}
												{hw.unit}
											</span>
											{#if hw.remarks}
												<span class="text-xs text-muted-foreground">{hw.remarks}</span>
											{/if}
										</div>
										<StatusBadge status={hw.status} />
									</div>
									{@render repairControls(
										'HARDWARE',
										hw.id,
										hw.status,
										findActiveRepair('HARDWARE', hw.id)
									)}
								</div>
							{/each}
						</div>
					</div>
				{/if}

				{#if detail.lengths.length}
					<div class="grid gap-2">
						<h3 class="font-semibold">Lengths</h3>
						<div class="grid gap-2">
							{#each detail.lengths as length (length.lengthNo)}
								<div class="grid gap-2">
									<div class="flex items-start justify-between gap-3 rounded-lg border p-3">
										<div class="grid">
											<span class="font-medium">{length.lengthNo}</span>
											<span class="text-xs text-muted-foreground">
												Standard {length.standardMm} mm · Actual {length.actualMm} mm
											</span>
											{#if length.remarks}
												<span class="text-xs text-muted-foreground">{length.remarks}</span>
											{/if}
										</div>
										<StatusBadge status={length.status} />
									</div>
									{@render repairControls(
										'LENGTH',
										length.id,
										length.status,
										findActiveRepair('LENGTH', length.id)
									)}
								</div>
							{/each}
						</div>
					</div>
				{/if}

				{#if detail.visualStatus}
					<div class="grid gap-2">
						<h3 class="font-semibold">Visual</h3>
						<div class="grid gap-2">
							<div class="flex items-start justify-between gap-3 rounded-lg border p-3">
								<span class="text-xs text-muted-foreground">{detail.visualRemarks ?? '-'}</span>
								<StatusBadge status={detail.visualStatus} />
							</div>
							{@render repairControls(
								'VISUAL',
								null,
								detail.visualStatus,
								findActiveRepair('VISUAL', null)
							)}
						</div>
					</div>
				{/if}
			</div>
		{/if}
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (detailOpen = false)}>Tutup</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
