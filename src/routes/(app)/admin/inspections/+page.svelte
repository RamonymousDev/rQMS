<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
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
	import { Separator } from '$lib/components/ui/separator/index.js';
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

	let filterPartNo = $state('');
	let filterLineCode = $state('');
	let filterStage = $state('');
	let filterShift = $state('');
	let filterStatus = $state('');
	let filterDateFrom = $state('');
	let filterDateTo = $state('');

	let detail: InspectionDetail | null = $state(null);
	let detailOpen = $state(false);

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
		loading = true;
		try {
			const res = await fetch(`/api/inspections?${buildQuery(targetPage)}`);
			const body = await res.json();
			if (!res.ok) {
				toast.error(body?.message ?? 'Gagal memuat data inspeksi.');
				return;
			}
			rows = body.data.rows ?? [];
			page = body.data.page;
			totalPages = body.data.totalPages;
			total = body.data.total;
		} finally {
			loading = false;
		}
	}

	onMount(() => load(1));

	function resetFilters() {
		filterPartNo = '';
		filterLineCode = '';
		filterStage = '';
		filterShift = '';
		filterStatus = '';
		filterDateFrom = '';
		filterDateTo = '';
		load(1);
	}

	async function openDetail(row: InspectionRow) {
		const res = await fetch(`/api/inspections/${row.id}`);
		const body = await res.json();
		if (!res.ok) {
			toast.error(body?.message ?? 'Gagal memuat detail inspeksi.');
			return;
		}
		detail = body.data;
		detailOpen = true;
	}

	/** Timestamp disimpan UTC; tampilkan dalam waktu Jakarta. */
	function formatDateTime(value: string): string {
		return new Date(value).toLocaleString('id-ID', {
			timeZone: 'Asia/Jakarta',
			dateStyle: 'short',
			timeStyle: 'short'
		});
	}

	const cycleStage = () => {
		const options = ['', 'START', 'MIDDLE', 'END'];
		filterStage = options[(options.indexOf(filterStage) + 1) % options.length];
	};
	const cycleShift = () => {
		const options = ['', 'DAY', 'NIGHT'];
		filterShift = options[(options.indexOf(filterShift) + 1) % options.length];
	};
	const cycleStatus = () => {
		const options = ['', 'OK', 'NG'];
		filterStatus = options[(options.indexOf(filterStatus) + 1) % options.length];
	};
</script>

<Card>
	<CardHeader>
		<CardTitle>Hasil Inspeksi</CardTitle>
		<CardDescription>
			Riwayat inspeksi beserta seluruh snapshot nilai saat pemeriksaan dilakukan.
		</CardDescription>
	</CardHeader>
	<CardContent class="grid gap-4">
		<div class="grid gap-3 md:grid-cols-4">
			<div class="grid gap-1.5">
				<Label for="filterPartNo">Part No</Label>
				<Input id="filterPartNo" placeholder="contoh: 64300" bind:value={filterPartNo} />
			</div>
			<div class="grid gap-1.5">
				<Label for="filterLineCode">Line Code</Label>
				<Input id="filterLineCode" placeholder="contoh: RSW" bind:value={filterLineCode} />
			</div>
			<div class="grid gap-1.5">
				<Label for="filterDateFrom">Dari Tanggal</Label>
				<Input id="filterDateFrom" type="date" bind:value={filterDateFrom} />
			</div>
			<div class="grid gap-1.5">
				<Label for="filterDateTo">Sampai Tanggal</Label>
				<Input id="filterDateTo" type="date" bind:value={filterDateTo} />
			</div>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<Button variant="outline" size="sm" onclick={cycleStage}>
				Stage: {filterStage || 'Semua'}
			</Button>
			<Button variant="outline" size="sm" onclick={cycleShift}>
				Shift: {filterShift || 'Semua'}
			</Button>
			<Button variant="outline" size="sm" onclick={cycleStatus}>
				Status: {filterStatus || 'Semua'}
			</Button>
			<div class="ms-auto flex gap-2">
				<Button variant="outline" size="sm" onclick={resetFilters}>Reset</Button>
				<Button size="sm" onclick={() => load(1)}>Terapkan</Button>
			</div>
		</div>

		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Waktu</Table.Head>
					<Table.Head>Part No</Table.Head>
					<Table.Head>Line</Table.Head>
					<Table.Head>Stage</Table.Head>
					<Table.Head>Shift</Table.Head>
					<Table.Head>Operator</Table.Head>
					<Table.Head>Status</Table.Head>
					<Table.Head class="text-end">Aksi</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each rows as row (row.id)}
					<Table.Row>
						<Table.Cell>{formatDateTime(row.inspectedAt)}</Table.Cell>
						<Table.Cell>{row.partNo}</Table.Cell>
						<Table.Cell>{row.lineCode}</Table.Cell>
						<Table.Cell>{row.stage}</Table.Cell>
						<Table.Cell>{row.shift}</Table.Cell>
						<Table.Cell>{row.operatorName}</Table.Cell>
						<Table.Cell>
							<Badge variant={row.overallStatus === 'OK' ? 'default' : 'destructive'}>
								{row.overallStatus}
							</Badge>
						</Table.Cell>
						<Table.Cell class="text-end">
							<Button variant="outline" size="sm" onclick={() => openDetail(row)}>Detail</Button>
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={8} class="h-24 text-center text-muted-foreground">
							{loading ? 'Memuat data...' : 'Belum ada inspeksi.'}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>

		<div class="flex items-center justify-between">
			<span class="text-sm text-muted-foreground">
				{total} inspeksi · Halaman {page} dari {totalPages}
			</span>
			<div class="flex gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={page <= 1 || loading}
					onclick={() => load(page - 1)}
				>
					Sebelumnya
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={page >= totalPages || loading}
					onclick={() => load(page + 1)}
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
		{#if detail}
			<div class="grid gap-4 py-2 text-sm">
				<div class="grid grid-cols-2 gap-2">
					<span class="text-muted-foreground">Part No</span><span>{detail.partNo}</span>
					<span class="text-muted-foreground">Line</span><span>{detail.lineCode}</span>
					<span class="text-muted-foreground">Stage</span><span>{detail.stage}</span>
					<span class="text-muted-foreground">Shift</span><span>{detail.shift}</span>
					<span class="text-muted-foreground">Operator</span>
					<span>{detail.operatorName} ({detail.operator?.nik ?? '-'})</span>
					<span class="text-muted-foreground">Waktu</span>
					<span>{formatDateTime(detail.inspectedAt)}</span>
					<span class="text-muted-foreground">Overall</span>
					<span>
						<Badge variant={detail.overallStatus === 'OK' ? 'default' : 'destructive'}>
							{detail.overallStatus}
						</Badge>
					</span>
				</div>

				{#if detail.points.length}
					<Separator />
					<div class="grid gap-2">
						<h3 class="font-semibold">Points</h3>
						{#each detail.points as point (point.pointNo)}
							<div class="flex items-start justify-between gap-3 rounded-md border p-2">
								<div class="grid">
									<span>{point.pointNo}</span>
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
				{/if}

				{#if detail.spotActual !== null}
					<Separator />
					<div class="grid gap-2">
						<h3 class="font-semibold">Spot</h3>
						<div class="rounded-md border p-2">Actual: {detail.spotActual}</div>
					</div>
				{/if}

				{#if detail.hardwares.length}
					<Separator />
					<div class="grid gap-2">
						<h3 class="font-semibold">Hardwares</h3>
						{#each detail.hardwares as hw (hw.hwNo)}
							<div class="flex items-start justify-between gap-3 rounded-md border p-2">
								<div class="grid">
									<span>{hw.hwNo} — {hw.hwName}</span>
									<span class="text-xs text-muted-foreground">
										Standard {hw.standardValue}
										{hw.unit} · Actual {hw.actualValue}
										{hw.unit}
									</span>
									{#if hw.remarks}
										<span class="text-xs text-muted-foreground">{hw.remarks}</span>
									{/if}
								</div>
								<Badge variant={hw.status === 'OK' ? 'default' : 'destructive'}>{hw.status}</Badge>
							</div>
						{/each}
					</div>
				{/if}

				{#if detail.lengths.length}
					<Separator />
					<div class="grid gap-2">
						<h3 class="font-semibold">Lengths</h3>
						{#each detail.lengths as length (length.lengthNo)}
							<div class="flex items-start justify-between gap-3 rounded-md border p-2">
								<div class="grid">
									<span>{length.lengthNo}</span>
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
				{/if}

				{#if detail.visualStatus}
					<Separator />
					<div class="grid gap-2">
						<h3 class="font-semibold">Visual</h3>
						<div class="flex items-start justify-between gap-3 rounded-md border p-2">
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
