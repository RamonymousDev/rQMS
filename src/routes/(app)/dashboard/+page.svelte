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
	import { getShift } from '$lib/shift.js';

	import MapPinIcon from '@lucide/svelte/icons/map-pin';
	import ClipboardListIcon from '@lucide/svelte/icons/clipboard-list';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import ClockIcon from '@lucide/svelte/icons/clock';

	const { data } = $props();
	const lines = $derived(data?.lines ?? []);
	const inspections = $derived(data?.inspections ?? []);
	const okCount = $derived(data?.okCount ?? 0);
	const ngCount = $derived(data?.ngCount ?? 0);

	function computeOkRate(ok: number, ng: number) {
		const total = ok + ng;
		return total === 0 ? 0 : Math.round((ok / total) * 100);
	}

	const okRate = $derived(computeOkRate(okCount, ngCount));

	let now = $state(new Date());
	let shift = $derived(getShift(now));

	onMount(() => {
		const interval = setInterval(() => {
			now = new Date();
		}, 60000);
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
			<Alert.Title>Selamat datang di QMS Dashboard</Alert.Title>
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
				<Card.Title class="text-sm font-medium">Recent Inspections</Card.Title>
				<ClipboardListIcon class="size-4 text-muted-foreground" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{inspections.length}</div>
				<p class="text-xs text-muted-foreground">Inspeksi terbaru</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between pb-2">
				<Card.Title class="text-sm font-medium">OK Count</Card.Title>
				<CircleCheckIcon class="size-4 text-green-600 dark:text-green-400" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{okCount}</div>
				<Progress value={okRate} class="mt-2 h-2" />
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between pb-2">
				<Card.Title class="text-sm font-medium">NG Count</Card.Title>
				<TriangleAlertIcon class="size-4 text-destructive" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{ngCount}</div>
				<p class="text-xs text-muted-foreground">Perlu perhatian</p>
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
