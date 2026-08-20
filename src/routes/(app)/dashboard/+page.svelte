<script lang="ts">
	import { onMount } from 'svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import {
		Table,
		TableBody,
		TableHead,
		TableHeader,
		TableRow,
		TableCell
	} from '$lib/components/ui/table/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Chart from '$lib/components/ui/chart/index.js';
	import { BarChart, PieChart } from 'layerchart';
	import { getShift } from '$lib/shift.js';
	import type { DashboardStats } from '$lib/server/dashboard.js';

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

	import MapPinIcon from '@lucide/svelte/icons/map-pin';
	import ClipboardListIcon from '@lucide/svelte/icons/clipboard-list';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import PieChartIcon from '@lucide/svelte/icons/pie-chart';
	import ChartColumnIcon from '@lucide/svelte/icons/chart-column';

	const { data } = $props();
	const lines = $derived(data?.lines ?? []);

	const emptyStats: DashboardStats = {
		totals: { ok: 0, ng: 0, total: 0 },
		today: { ok: 0, ng: 0, total: 0 },
		trend: []
	};
	let freshStats: DashboardStats | null = $state(null);
	const stats = $derived(freshStats ?? data?.stats ?? emptyStats);
	let freshInspections: InspectionRow[] | null = $state(null);
	const inspections = $derived(freshInspections ?? data?.inspections ?? []);

	async function refreshDashboard() {
		try {
			const res = await fetch('/api/dashboard');
			if (!res.ok) return;
			const body = await res.json();
			if (body.data?.stats) freshStats = body.data.stats;
			if (body.data?.inspections) freshInspections = body.data.inspections;
		} catch {
			// Pertahankan data terakhir jika jaringan bermasalah.
		}
	}

	const okRate = $derived(computeOkRate(stats.today.ok, stats.today.ng));

	const statusChartConfig = {
		ok: { label: 'OK', theme: { light: '#16a34a', dark: '#4ade80' } },
		ng: { label: 'NG', theme: { light: '#dc2626', dark: '#f87171' } }
	} satisfies Chart.ChartConfig;

	const donutData = $derived([
		{ key: 'ok', label: 'OK', value: stats.totals.ok },
		{ key: 'ng', label: 'NG', value: stats.totals.ng }
	]);

	function computeOkRate(ok: number, ng: number) {
		const total = ok + ng;
		return total === 0 ? 0 : Math.round((ok / total) * 100);
	}

	let now = $state(new Date());
	let shift = $derived(getShift(now));

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
			second: '2-digit'
		})
	);
	const dateString = $derived(
		now.toLocaleDateString('id-ID', {
			weekday: 'short',
			day: 'numeric',
			month: 'short'
		})
	);
</script>

<div class="flex flex-col gap-6">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<Alert.Root>
			<TriangleAlertIcon class="size-4" />
			<Alert.Title>Selamat datang di Q-Jun Dashboard</Alert.Title>
			<Alert.Description>
				Pantau status inspeksi dan akses line produksi Anda dari sini.
			</Alert.Description>
		</Alert.Root>
		<div class="flex items-center gap-3 text-sm text-muted-foreground">
			<ClockIcon class="size-4" />
			<span>{dateString} · {timeString}</span>
			<Badge variant={shift === 'DAY' ? 'default' : 'secondary'}>Shift {shift}</Badge>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between pb-2">
				<Card.Title class="text-sm font-medium">Accessible Lines</Card.Title>
				<MapPinIcon class="size-4 text-muted-foreground" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{lines.length}</div>
				<p class="text-xs text-muted-foreground">Line yang bisa diakses</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between pb-2">
				<Card.Title class="text-sm font-medium">Inspeksi Hari Ini</Card.Title>
				<ClipboardListIcon class="size-4 text-muted-foreground" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{stats.today.total}</div>
				<p class="text-xs text-muted-foreground">Hari operasional berjalan</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between pb-2">
				<Card.Title class="text-sm font-medium">OK Hari Ini</Card.Title>
				<CircleCheckIcon class="size-4 text-green-600 dark:text-green-400" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{stats.today.ok}</div>
				<Progress value={okRate} class="mt-2 h-2" />
				<p class="mt-1 text-xs text-muted-foreground">OK rate {okRate}%</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between pb-2">
				<Card.Title class="text-sm font-medium">NG Hari Ini</Card.Title>
				<TriangleAlertIcon class="size-4 text-destructive" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{stats.today.ng}</div>
				<p class="text-xs text-muted-foreground">Perlu perhatian</p>
			</Card.Content>
		</Card.Root>
	</div>

	<div class="grid grid-cols-1 gap-4 lg:grid-cols-5">
		<Card.Root class="lg:col-span-2">
			<Card.Header>
				<Card.Title class="flex items-center gap-2 text-sm">
					<PieChartIcon class="size-4 text-muted-foreground" />
					Distribusi Hasil
				</Card.Title>
				<Card.Description>Perbandingan OK / NG sepanjang masa</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if stats.totals.total === 0}
					<div class="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
						Belum ada data inspeksi
					</div>
				{:else}
					<Chart.Container config={statusChartConfig} class="h-[220px] w-full">
						<PieChart
							data={donutData}
							key="key"
							label="label"
							value="value"
							cDomain={['ok', 'ng']}
							cRange={['var(--color-ok)', 'var(--color-ng)']}
							innerRadius={55}
							outerRadius={85}
							legend
						>
							{#snippet tooltip()}
								<Chart.Tooltip hideLabel />
							{/snippet}
						</PieChart>
					</Chart.Container>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root class="lg:col-span-3">
			<Card.Header>
				<Card.Title class="flex items-center gap-2 text-sm">
					<ChartColumnIcon class="size-4 text-muted-foreground" />
					Tren Inspeksi
				</Card.Title>
				<Card.Description>Hasil 7 hari operasional terakhir</Card.Description>
			</Card.Header>
			<Card.Content>
				<Chart.Container config={statusChartConfig} class="h-[240px] w-full">
					<BarChart
						data={stats.trend}
						x="label"
						seriesLayout="group"
						series={[
							{ key: 'ok', label: 'OK', color: 'var(--color-ok)' },
							{ key: 'ng', label: 'NG', color: 'var(--color-ng)' }
						]}
						legend
					>
						{#snippet tooltip()}
							<Chart.Tooltip />
						{/snippet}
					</BarChart>
				</Chart.Container>
			</Card.Content>
		</Card.Root>
	</div>

	<Tabs.Root value="lines">
		<Tabs.List>
			<Tabs.Trigger value="lines">Accessible Lines</Tabs.Trigger>
			<Tabs.Trigger value="inspections">Recent Inspections</Tabs.Trigger>
		</Tabs.List>
		<Separator class="mt-2" />
		<Tabs.Content value="lines" class="mt-4">
			{#if lines.length === 0}
				<Empty.Root>
					<Empty.Media>
						<MapPinIcon class="size-12 text-muted-foreground" />
					</Empty.Media>
					<Empty.Header>
						<Empty.Title>Belum ada akses line</Empty.Title>
						<Empty.Description>
							Anda belum memiliki akses ke line manapun. Hubungi admin untuk mendapatkan permission.
						</Empty.Description>
						<Empty.Content>
							<Button variant="outline" size="sm" href="/admin/lines">Kelola Line</Button>
						</Empty.Content>
					</Empty.Header>
				</Empty.Root>
			{:else}
				<div class="rounded-md border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Process</TableHead>
								<TableHead>Code</TableHead>
								<TableHead>Name</TableHead>
								<TableHead class="text-right">Board</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#each lines as line (line.id)}
								<TableRow>
									<TableCell class="font-medium">{line.process?.name ?? '-'}</TableCell>
									<TableCell>
										<Badge variant="secondary">{line.code}</Badge>
									</TableCell>
									<TableCell>{line.name}</TableCell>
									<TableCell class="text-right">
										<Button
											variant="outline"
											size="sm"
											href="/board/{line.code}"
											target="_blank"
											rel="noopener noreferrer"
										>
											Board ↗
										</Button>
									</TableCell>
								</TableRow>
							{/each}
						</TableBody>
					</Table>
				</div>
			{/if}
		</Tabs.Content>
		<Tabs.Content value="inspections" class="mt-4">
			{#if inspections.length === 0}
				<Empty.Root>
					<Empty.Media>
						<ClipboardListIcon class="size-12 text-muted-foreground" />
					</Empty.Media>
					<Empty.Header>
						<Empty.Title>Belum ada inspeksi</Empty.Title>
						<Empty.Description>
							Mulai lakukan inspeksi pertama Anda untuk melihat hasil di sini.
						</Empty.Description>
						<Empty.Content>
							<Button variant="default" size="sm" href="/inspect">Mulai Inspeksi</Button>
						</Empty.Content>
					</Empty.Header>
				</Empty.Root>
			{:else}
				<div class="rounded-md border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Part</TableHead>
								<TableHead>Line</TableHead>
								<TableHead>Stage</TableHead>
								<TableHead>Status</TableHead>
								<TableHead class="text-right">Time</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#each inspections as ins (ins.id)}
								<TableRow>
									<TableCell class="font-medium">{ins.partNo}</TableCell>
									<TableCell>{ins.lineCode}</TableCell>
									<TableCell>
										<Badge variant="outline">{ins.stage}</Badge>
									</TableCell>
									<TableCell>
										<Badge variant={ins.overallStatus === 'OK' ? 'default' : 'destructive'}>
											{ins.overallStatus}
										</Badge>
									</TableCell>
									<TableCell class="text-right text-muted-foreground">
										{new Date(ins.inspectedAt).toLocaleTimeString('id-ID', {
											hour: '2-digit',
											minute: '2-digit'
										})}
									</TableCell>
								</TableRow>
							{/each}
						</TableBody>
					</Table>
				</div>
				<div class="mt-3 flex justify-end">
					<Button variant="ghost" size="sm" href="/admin/inspections">Lihat Semua</Button>
				</div>
			{/if}
		</Tabs.Content>
	</Tabs.Root>
</div>
