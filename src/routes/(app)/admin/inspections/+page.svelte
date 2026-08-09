<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger
	} from '$lib/components/ui/select/index.js';
	import * as Table from '$lib/components/ui/table/index.js';

	type InspectionRow = {
		id: string;
		partNo: string;
		lineCode: string;
		stage: string;
		shift: string;
		overallStatus: 'OK' | 'NG';
		operatorName: string;
		inspectedAt: string;
	};

	type InspectionDetail = InspectionRow & {
		spotActual: number | null;
		visualStatus: 'OK' | 'NG' | null;
		visualRemarks: string | null;
		operator?: { nik: string; name: string };
		points: { pointNo: string; status: 'OK' | 'NG'; remarks: string | null }[];
		hardwares: {
			hwNo: string;
			hwName: string;
			standardValue: number;
			unit: string;
			actualValue: number;
			status: 'OK' | 'NG';
			remarks: string | null;
		}[];
		lengths: {
			lengthNo: string;
			standardMm: number;
			actualMm: number;
			status: 'OK' | 'NG';
			remarks: string | null;
		}[];
	};

	let rows: InspectionRow[] = $state([]);
	let loading = $state(true);
	let page = $state(1);
	let totalPages = $state(1);
	let total = $state(0);
	let okCount = $state(0);
	let ngCount = $state(0);

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

	let mounted = $state(false);
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	let requestSeq = 0;
	let detailSeq = 0;
	/** true sampai pencarian pertama selesai dipicu — supaya mount langsung load tanpa debounce. */
	let firstSearch = true;

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

	async function openDetail(row: InspectionRow) {
		const seq = ++detailSeq;
		detail = null;
		detailLoading = true;
		detailOpen = true;
		try {
			const res = await fetch(`/api/inspections/${row.id}`);
			const body = await res.json();
			if (seq !== detailSeq) return;
			if (!res.ok) {
				toast.error(body?.message ?? 'Gagal memuat detail inspeksi.');
				detailOpen = false;
				return;
			}
			detail = body.data;
		} finally {
			if (seq === detailSeq) detailLoading = false;
		}
	}

	/** Timestamp disimpan UTC; tampilkan dalam waktu Jakarta. */
	function formatDateTime(value: string): string {
		return new Date(value).toLocaleString('id-ID', {
			timeZone: 'Asia/Jakarta',
			dateStyle: 'short',
			timeStyle: 'short'
		});
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
		{ value: 'NG', label: 'NG' }
	];
</script>

<Card>
	<CardHeader>
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<CardTitle>Hasil Inspeksi</CardTitle>
				<CardDescription>
					Riwayat inspeksi beserta seluruh snapshot nilai saat pemeriksaan dilakukan.
				</CardDescription>
			</div>
			<div class="flex items-center gap-2">
				<Button variant={showNgOnly ? 'destructive' : 'outline'} size="sm" onclick={toggleNgOnly}>
					{showNgOnly ? 'Semua' : 'Hanya NG'}
				</Button>
			</div>
		</div>

		<!-- Summary Stats (total global sesuai filter) -->
		<div class="grid grid-cols-3 gap-3 pt-2">
			<div class="rounded-lg border bg-muted/30 px-3 py-2 text-center">
				<p class="text-2xl font-bold">{total}</p>
				<p class="text-xs text-muted-foreground">Total</p>
			</div>
			<div class="rounded-lg border bg-green-50 px-3 py-2 text-center dark:bg-green-950/30">
				<p class="text-2xl font-bold text-green-700 dark:text-green-400">{okCount}</p>
				<p class="text-xs text-green-600 dark:text-green-400">OK</p>
			</div>
			<div class="rounded-lg border bg-red-50 px-3 py-2 text-center dark:bg-red-950/30">
				<p class="text-2xl font-bold text-red-700 dark:text-red-400">{ngCount}</p>
				<p class="text-xs text-red-600 dark:text-red-400">NG</p>
			</div>
		</div>
	</CardHeader>

	<CardContent class="grid gap-4">
		<!-- Filters -->
		<div class="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
			<div class="grid gap-1.5">
				<Label for="filterPartNo">Part No</Label>
				<Input
					id="filterPartNo"
					placeholder="contoh: 64300"
					bind:value={filterPartNo}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							runSearch();
						}
					}}
				/>
			</div>
			<div class="grid gap-1.5">
				<Label for="filterLineCode">Line Code</Label>
				<Input
					id="filterLineCode"
					placeholder="contoh: RSW"
					bind:value={filterLineCode}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							runSearch();
						}
					}}
				/>
			</div>
			<div class="grid gap-1.5">
				<Label for="filterDateFrom">Dari Tanggal</Label>
				<Input id="filterDateFrom" type="date" bind:value={filterDateFrom} />
				<p class="text-[10px] text-muted-foreground">Tanggal operasional (07:30–07:30 WIB)</p>
			</div>
			<div class="grid gap-1.5">
				<Label for="filterDateTo">Sampai Tanggal</Label>
				<Input id="filterDateTo" type="date" bind:value={filterDateTo} />
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
					<Table.Row class={row.overallStatus === 'NG' ? 'bg-red-50/50 dark:bg-red-950/20' : ''}>
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
							<Badge variant={row.overallStatus === 'OK' ? 'default' : 'destructive'}>
								{row.overallStatus}
							</Badge>
						</Table.Cell>
						<Table.Cell class="text-end">
							<Button
								variant="outline"
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
							<Table.Cell colspan={8} class="h-24 text-center text-muted-foreground">
								Belum ada inspeksi.
							</Table.Cell>
						</Table.Row>
					{/if}
				{/each}
			</Table.Body>
		</Table.Root>

		<div class="flex items-center justify-between">
			<span class="text-sm text-muted-foreground">
				{total} inspeksi · Halaman {page} dari {totalPages}
				{#if loading}<span class="ms-1">· Memuat…</span>{/if}
			</span>
			<div class="flex gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={page <= 1 || loading}
					onclick={() => goToPage(page - 1)}
				>
					Sebelumnya
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={page >= totalPages || loading}
					onclick={() => goToPage(page + 1)}
				>
					Berikutnya
				</Button>
			</div>
		</div>
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
							<Badge variant={detail.overallStatus === 'OK' ? 'default' : 'destructive'}>
								{detail.overallStatus}
							</Badge>
						</div>
					</div>
				</div>

				{#if detail.points.length}
					<div class="grid gap-2">
						<h3 class="font-semibold">Points</h3>
						<div class="grid gap-2">
							{#each detail.points as point (point.pointNo)}
								<div class="flex items-start justify-between gap-3 rounded-lg border p-3">
									<div class="grid">
										<span class="font-medium">{point.pointNo}</span>
										{#if point.remarks}
											<span class="text-xs text-muted-foreground">{point.remarks}</span>
										{/if}
									</div>
									<Badge variant={point.status === 'OK' ? 'default' : 'destructive'}>
										{point.status}
									</Badge>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				{#if detail.spotActual !== null}
					<div class="grid gap-2">
						<h3 class="font-semibold">Spot</h3>
						<div class="rounded-lg border p-3">Actual: {detail.spotActual}</div>
					</div>
				{/if}

				{#if detail.hardwares.length}
					<div class="grid gap-2">
						<h3 class="font-semibold">Hardwares</h3>
						<div class="grid gap-2">
							{#each detail.hardwares as hw (hw.hwNo)}
								<div class="flex items-start justify-between gap-3 rounded-lg border p-3">
									<div class="grid">
										<span class="font-medium">{hw.hwNo} — {hw.hwName}</span>
										<span class="text-xs text-muted-foreground">
											Standard {hw.standardValue}
											{hw.unit} · Actual {hw.actualValue}
											{hw.unit}
										</span>
										{#if hw.remarks}
											<span class="text-xs text-muted-foreground">{hw.remarks}</span>
										{/if}
									</div>
									<Badge variant={hw.status === 'OK' ? 'default' : 'destructive'}>{hw.status}</Badge
									>
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
									<Badge variant={length.status === 'OK' ? 'default' : 'destructive'}>
										{length.status}
									</Badge>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				{#if detail.visualStatus}
					<div class="grid gap-2">
						<h3 class="font-semibold">Visual</h3>
						<div class="flex items-start justify-between gap-3 rounded-lg border p-3">
							<span class="text-xs text-muted-foreground">{detail.visualRemarks ?? '-'}</span>
							<Badge variant={detail.visualStatus === 'OK' ? 'default' : 'destructive'}>
								{detail.visualStatus}
							</Badge>
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
