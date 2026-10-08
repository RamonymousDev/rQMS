<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import StatusBadge from '$lib/components/status-badge.svelte';
	import Sparkline from '$lib/components/kpi-sparkline.svelte';
	import * as Chart from '$lib/components/ui/chart/index.js';
	import { BarChart, PieChart } from 'layerchart';
	import { cn } from '$lib/utils.js';
	import { getShift } from '$lib/shift.js';
	import type { DashboardStats } from '$lib/server/dashboard.js';
	import type { PageProps } from './$types.js';

	type InspectionRow = {
		id: string;
		partNo: string;
		lineCode: string;
		stage: string;
		shift: string;
		overallStatus: 'OK' | 'NG' | 'REPAIR';
		operatorName: string;
		inspectedAt: string;
	};

	type Line = { id: string; code: string; name: string; process?: { name: string } };

	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import CircleDashedIcon from '@lucide/svelte/icons/circle-dashed';
	import InboxIcon from '@lucide/svelte/icons/inbox';
	import PlayIcon from '@lucide/svelte/icons/play';

	const { data }: PageProps = $props();

	const emptyStats: DashboardStats = {
		totals: { ok: 0, ng: 0, repair: 0, total: 0 },
		today: { ok: 0, ng: 0, repair: 0, total: 0 },
		trend: [],
		lines: []
	};

	let freshStats: DashboardStats | null = $state(null);
	const stats = $derived(freshStats ?? data?.stats ?? emptyStats);
	let freshInspections: InspectionRow[] | null = $state(null);
	const inspections = $derived(freshInspections ?? data?.inspections ?? []);

	/** Line dari API (hanya yang sesuai permission) digabung dengan status hari ini. */
	const lines = $derived<Line[]>(data?.lines ?? []);
	const lineStatusByCode = $derived(new Map(stats.lines.map((point) => [point.lineCode, point])));

	/** Garis dengan inspeksi hari ini; line tanpa data tetap ditampilkan sebagai "idle". */
	const lineRows = $derived(
		lines.map((line) => ({ line, status: lineStatusByCode.get(line.code) ?? null }))
	);

	let loading = $state(false);
	let now = $state(new Date());
	const shift = $derived(getShift(now));

	const okRate = $derived.by(() => {
		const total = stats.today.ok + stats.today.ng;
		return total === 0 ? null : Math.round((stats.today.ok / total) * 100);
	});

	/** Deret tren 7 hari untuk sparkline KPI. */
	/** Jumlah line yang punya minimal satu inspeksi hari ini. */
	const dashboardLinesWithData = $derived(stats.lines.length);

	const trendTotals = $derived(stats.trend.map((p) => p.total));
	const trendOk = $derived(stats.trend.map((p) => p.ok));
	const trendRepair = $derived(stats.trend.map((p) => p.repair));
	const trendNg = $derived(stats.trend.map((p) => p.ng));

	async function refreshDashboard() {
		loading = true;
		try {
			const res = await fetch('/api/dashboard');
			if (!res.ok) return;
			const body = await res.json();
			if (body.data?.stats) freshStats = body.data.stats;
			if (body.data?.inspections) freshInspections = body.data.inspections;
		} catch {
			// Pertahankan data terakhir — dashboard harus tetap terbaca saat offline.
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		void refreshDashboard();
		const interval = setInterval(() => {
			now = new Date();
			void refreshDashboard();
		}, 30000);
		return () => clearInterval(interval);
	});

	const timeString = $derived(
		now.toLocaleTimeString('id-ID', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			timeZone: 'Asia/Jakarta'
		})
	);

	const dateString = $derived(
		now.toLocaleDateString('id-ID', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			timeZone: 'Asia/Jakarta'
		})
	);

	const statusChartConfig = {
		ok: { label: 'OK', theme: { light: 'var(--status-ok)', dark: 'var(--status-ok)' } },
		repair: {
			label: 'Repair',
			theme: { light: 'var(--status-warn)', dark: 'var(--status-warn)' }
		},
		ng: { label: 'NG', theme: { light: 'var(--status-ng)', dark: 'var(--status-ng)' } }
	} satisfies Chart.ChartConfig;

	const donutData = $derived([
		{ key: 'ok', label: 'OK', value: stats.totals.ok },
		{ key: 'repair', label: 'Repair', value: stats.totals.repair },
		{ key: 'ng', label: 'NG', value: stats.totals.ng }
	]);

	/** Total inspeksi sepanjang masa — dipakai di tengah donut. */
	const lifetimeTotal = $derived(stats.totals.total);
</script>

<svelte:head><title>Dashboard · Q-Jun</title></svelte:head>

<div class="flex flex-col gap-4">
	<!--
		Header: ramping. Judul + metadata chip, CTA solid di kanan.
		Hero card "Halo, ..." dihapus — memakan tinggi layar tanpa memuat
		informasi yang dipakai operator.
	-->
	<header class="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div
			class="pointer-events-none absolute inset-x-0 -top-6 -z-10 h-24 header-glow"
			aria-hidden="true"
		></div>
		<div class="min-w-0">
			<h1 class="text-page">Dashboard</h1>
			<div class="mt-2 flex flex-wrap items-center gap-2">
				<span class="rounded-full border bg-card px-2 py-0.5 text-label text-muted-foreground">
					{dateString}
				</span>
				<span
					class="rounded-full border bg-card px-2 py-0.5 text-label font-medium text-foreground tabular-nums"
				>
					{timeString} WIB
				</span>
				<span
					class="rounded-full border bg-primary/10 px-2 py-0.5 text-label font-medium text-primary"
				>
					Shift {shift}
				</span>
			</div>
		</div>
		<Button href="/inspect" size="lg" class="h-11 shrink-0 gap-2 sm:h-12">
			<PlayIcon class="size-4" aria-hidden="true" />
			Mulai Inspeksi
			<kbd
				class="ml-0.5 hidden rounded border border-primary-foreground/25 px-1.5 py-0.5 font-sans text-[11px] font-medium text-primary-foreground/80 sm:inline-block"
				aria-hidden="true">N</kbd
			>
		</Button>
	</header>

	<!--
		KPI strip: SATU panel dengan pemisah vertikal, bukan 3 kartu terpisah.
		Angka + label + konteks + sparkline 7 hari operasional.
		Saat kosong: "-" muted, bukan angka 0 besar yang menyesatkan.
	-->
	<Card.Root size="sm" class="card-edge">
		<Card.Content class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
			<div class="flex flex-col justify-between gap-3 px-1 py-2 sm:border-r sm:border-border">
				<div>
					<p class="text-label text-muted-foreground">Inspeksi hari ini</p>
					<p class="mt-1.5 text-kpi tabular-nums">
						{stats.today.total > 0 ? stats.today.total : '–'}
					</p>
				</div>
				<div class="flex items-end justify-between gap-3">
					<p class="text-label text-muted-foreground">
						OK <span class="font-medium text-status-ok tabular-nums">{stats.today.ok}</span>
						· Repair
						<span class="font-medium text-status-warn tabular-nums">{stats.today.repair}</span>
						· NG
						<span class="font-medium text-status-ng tabular-nums">{stats.today.ng}</span>
					</p>
					<Sparkline values={trendTotals} class="text-muted-foreground" />
				</div>
			</div>

			<div class="flex flex-col justify-between gap-3 px-1 py-2 lg:border-r lg:border-border">
				<div>
					<p class="text-label text-muted-foreground">OK rate</p>
					<p class="mt-1.5 text-kpi tabular-nums">
						{#if okRate === null}
							–
						{:else}
							{okRate}<span class="text-body font-medium text-muted-foreground">%</span>
						{/if}
					</p>
				</div>
				<div class="flex items-end justify-between gap-3">
					<p class="text-label text-muted-foreground">OK hari ini</p>
					<Sparkline values={trendOk} class="text-status-ok" />
				</div>
			</div>

			<div class="flex flex-col justify-between gap-3 px-1 py-2 sm:border-r sm:border-border">
				<div>
					<p class="text-label text-muted-foreground">Repair hari ini</p>
					<p
						class={cn(
							'mt-1.5 text-kpi tabular-nums',
							stats.today.repair > 0 ? 'text-status-warn' : ''
						)}
					>
						{stats.today.repair > 0 ? stats.today.repair : '–'}
					</p>
				</div>
				<div class="flex items-end justify-between gap-3">
					<p class="text-label text-muted-foreground">Sudah ditangani</p>
					<Sparkline values={trendRepair} class="text-status-warn" />
				</div>
			</div>

			<div class="flex flex-col justify-between gap-3 px-1 py-2 lg:border-r lg:border-border">
				<div>
					<p class="text-label text-muted-foreground">NG hari ini</p>
					<p class={cn('mt-1.5 text-kpi tabular-nums', stats.today.ng > 0 ? 'text-status-ng' : '')}>
						{stats.today.ng > 0 ? stats.today.ng : '–'}
					</p>
				</div>
				<div class="flex items-end justify-between gap-3">
					<p class="text-label text-muted-foreground">Perlu perhatian</p>
					<Sparkline values={trendNg} class="text-status-ng" />
				</div>
			</div>

			<div class="flex flex-col justify-between gap-3 px-1 py-2">
				<div>
					<p class="text-label text-muted-foreground">Line diakses</p>
					<p class="mt-1.5 text-kpi tabular-nums">{lines.length > 0 ? lines.length : '–'}</p>
				</div>
				<div class="flex items-end justify-between gap-3">
					<p class="text-label text-muted-foreground">
						{dashboardLinesWithData} aktif hari ini
					</p>
					<span class="text-label text-muted-foreground tabular-nums">
						{stats.lines.length > 0 ? `${stats.lines.length}/${lines.length}` : '–'}
					</span>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<!--
		Bento: tren lebar (2/3) + donut sempit (1/3).
		Donut memakai angka di tengah supaya tidak perlu legend.
	-->
	<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
		<Card.Root size="sm" class="card-edge lg:col-span-2">
			<Card.Header>
				<div class="flex items-center justify-between gap-3">
					<Card.Title class="text-section">Tren inspeksi</Card.Title>
					<span class="text-label text-muted-foreground">7 hari operasional</span>
				</div>
			</Card.Header>
			<Card.Content>
				{#if loading && stats.trend.length === 0}
					<Skeleton class="h-[220px] w-full" />
				{:else if stats.trend.every((point) => point.total === 0)}
					<Empty.Root class="border-0 py-6">
						<Empty.Media variant="icon">
							<InboxIcon />
						</Empty.Media>
						<Empty.Header>
							<Empty.Title>Belum ada data 7 hari terakhir</Empty.Title>
							<Empty.Description>Chart muncul setelah inspeksi pertama tercatat.</Empty.Description>
							<Empty.Content>
								<Button size="sm" href="/inspect">Mulai inspeksi pertama</Button>
							</Empty.Content>
						</Empty.Header>
					</Empty.Root>
				{:else}
					<Chart.Container config={statusChartConfig} class="h-[220px] w-full">
						<BarChart
							data={stats.trend}
							x="label"
							seriesLayout="group"
							series={[
								{ key: 'ok', label: 'OK', color: 'var(--color-ok)' },
								{ key: 'repair', label: 'Repair', color: 'var(--color-status-warn)' },
								{ key: 'ng', label: 'NG', color: 'var(--color-ng)' }
							]}
							yDomain={[0, Math.max(1, ...trendTotals)]}
							legend
						>
							{#snippet tooltip()}
								<Chart.Tooltip />
							{/snippet}
						</BarChart>
					</Chart.Container>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root size="sm" class="card-edge">
			<Card.Header>
				<Card.Title class="text-section">Distribusi OK / NG / Repair</Card.Title>
			</Card.Header>
			<Card.Content>
				{#if loading && stats.totals.total === 0}
					<Skeleton class="h-[220px] w-full" />
				{:else if stats.totals.total === 0}
					<Empty.Root class="border-0 py-6">
						<Empty.Media variant="icon">
							<CircleDashedIcon />
						</Empty.Media>
						<Empty.Header>
							<Empty.Title>Belum ada inspeksi</Empty.Title>
							<Empty.Description>Distribusi akan muncul setelah inspeksi pertama.</Empty.Description
							>
						</Empty.Header>
					</Empty.Root>
				{:else}
					<div class="relative">
						<Chart.Container config={statusChartConfig} class="h-[220px] w-full">
							<PieChart
								data={donutData}
								key="key"
								label="label"
								value="value"
								cDomain={['ok', 'repair', 'ng']}
								cRange={['var(--color-ok)', 'var(--color-status-warn)', 'var(--color-ng)']}
								innerRadius={62}
								outerRadius={92}
								legend
							>
								{#snippet tooltip()}
									<Chart.Tooltip hideLabel />
								{/snippet}
							</PieChart>
						</Chart.Container>
						<!-- Angka total di tengah lubang donut; tidak butuh legend. -->
						<div
							class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
						>
							<span class="text-kpi tabular-nums">{lifetimeTotal}</span>
							<span class="text-label text-muted-foreground">Total</span>
						</div>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Baris bawah: status per line + inspeksi terakhir -->
	<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
		<Card.Root size="sm" class="card-edge">
			<Card.Header>
				<div class="flex items-center justify-between gap-3">
					<Card.Title class="text-section">Status per line</Card.Title>
					<span class="text-label text-muted-foreground">{lines.length} line</span>
				</div>
			</Card.Header>
			<Card.Content>
				{#if loading && lineRows.length === 0}
					<div class="grid gap-2 sm:grid-cols-2">
						{#each [0, 1, 2, 3] as i (i)}
							<Skeleton class="h-20 w-full" />
						{/each}
					</div>
				{:else if lineRows.length === 0}
					<Empty.Root class="border-0 py-6">
						<Empty.Media variant="icon">
							<CircleDashedIcon />
						</Empty.Media>
						<Empty.Header>
							<Empty.Title>Belum ada akses line</Empty.Title>
							<Empty.Description>Hubungi admin untuk mendapatkan permission.</Empty.Description>
						</Empty.Header>
					</Empty.Root>
				{:else}
					<div class="grid gap-2 sm:grid-cols-2">
						{#each lineRows as row (row.line.id)}
							<div
								class="flex items-center gap-3 rounded-lg bg-card p-3 card-edge transition-colors duration-150 hover:bg-accent/40"
							>
								<div class="min-w-0 flex-1">
									<p class="truncate font-mono text-section font-semibold">
										{row.line.code}
									</p>
									<p class="truncate text-label text-muted-foreground">{row.line.name}</p>
									<div class="mt-1.5">
										<StatusBadge
											status={row.status?.latestStatus ?? null}
											size="sm"
											label={row.status ? `${row.status.total} inspeksi` : 'Belum inspeksi'}
										/>
									</div>
								</div>
								<Button variant="outline" size="sm" href="/inspect" aria-label="Mulai inspeksi">
									<PlayIcon class="size-3.5" aria-hidden="true" />
								</Button>
							</div>
						{/each}
					</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root size="sm" class="card-edge">
			<Card.Header>
				<div class="flex items-center justify-between gap-3">
					<Card.Title class="text-section">Inspeksi terakhir</Card.Title>
					<Button variant="ghost" size="sm" href="/admin/inspections" class="gap-1">
						Semua
						<ArrowRightIcon class="size-3.5" aria-hidden="true" />
					</Button>
				</div>
			</Card.Header>
			<Card.Content>
				{#if loading && inspections.length === 0}
					<div class="grid gap-2">
						{#each [0, 1, 2, 3, 4] as i (i)}
							<Skeleton class="h-9 w-full" />
						{/each}
					</div>
				{:else if inspections.length === 0}
					<Empty.Root class="border-0 py-6">
						<Empty.Media variant="icon">
							<InboxIcon />
						</Empty.Media>
						<Empty.Header>
							<Empty.Title>Belum ada inspeksi</Empty.Title>
							<Empty.Description>Hasil inspeksi terbaru akan tampil di sini.</Empty.Description>
							<Empty.Content>
								<Button size="sm" href="/inspect">Mulai inspeksi pertama</Button>
							</Empty.Content>
						</Empty.Header>
					</Empty.Root>
				{:else}
					<ul class="-mx-2 divide-y divide-border">
						{#each inspections as ins (ins.id)}
							<li
								class="flex items-center gap-3 px-2 py-2 transition-colors duration-150 hover:bg-accent/40"
							>
								<StatusBadge status={ins.overallStatus} size="sm" dot={false} />
								<span class="font-mono text-body font-medium">{ins.partNo}</span>
								<span class="min-w-0 flex-1 truncate text-label text-muted-foreground">
									{ins.lineCode} · {ins.stage}
								</span>
								<span class="shrink-0 text-label text-muted-foreground tabular-nums">
									{new Date(ins.inspectedAt).toLocaleTimeString('id-ID', {
										hour: '2-digit',
										minute: '2-digit',
										timeZone: 'Asia/Jakarta'
									})}
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</div>
