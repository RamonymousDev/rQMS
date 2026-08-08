<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
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
	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';

	import MapPinIcon from '@lucide/svelte/icons/map-pin';
	import ClipboardListIcon from '@lucide/svelte/icons/clipboard-list';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import UserIcon from '@lucide/svelte/icons/user';

	const { data } = $props();
	const user = $derived(data?.user ?? null);
	const lines = $derived(data?.lines ?? []);
	const inspections = $derived(data?.inspections ?? []);
	const okCount = $derived(data?.okCount ?? 0);
	const ngCount = $derived(data?.ngCount ?? 0);

	const today = new Date().toLocaleDateString('id-ID', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});

	function getInitials(name: string) {
		return name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.slice(0, 2)
			.toUpperCase();
	}

	const initials = $derived(getInitials(user?.name ?? user?.nik ?? 'U'));

	function computeOkRate(ok: number, ng: number) {
		const total = ok + ng;
		return total === 0 ? 0 : Math.round((ok / total) * 100);
	}

	const okRate = $derived(computeOkRate(okCount, ngCount));
</script>

<div class="flex flex-col gap-6">
	<header class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<Avatar.Root class="size-10">
				<Avatar.Fallback>{initials}</Avatar.Fallback>
			</Avatar.Root>
			<div>
				<h1 class="text-2xl font-semibold">Dashboard</h1>
				<p class="text-sm text-muted-foreground">Halo, {user?.name ?? user?.nik ?? 'Operator'}</p>
			</div>
		</div>
		<div class="flex items-center gap-2 text-sm text-muted-foreground">
			<UserIcon class="size-4" />
			<span class="hidden sm:inline">{today}</span>
			<span class="sm:hidden">{new Date().toLocaleDateString('id-ID')}</span>
		</div>
	</header>

	<Alert.Root>
		<TriangleAlertIcon class="size-4" />
		<Alert.Title>Selamat datang di QMS Dashboard</Alert.Title>
		<Alert.Description>
			Pantau status inspeksi dan akses line produksi Anda dari sini.
		</Alert.Description>
	</Alert.Root>

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
						<MapPinIcon class="size-10 text-muted-foreground" />
					</Empty.Media>
					<Empty.Header>
						<Empty.Title>No accessible lines</Empty.Title>
						<Empty.Description>Anda belum memiliki akses ke line manapun.</Empty.Description>
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
						<ClipboardListIcon class="size-10 text-muted-foreground" />
					</Empty.Media>
					<Empty.Header>
						<Empty.Title>No recent inspections</Empty.Title>
						<Empty.Description>Belum ada hasil inspeksi yang tercatat.</Empty.Description>
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
			{/if}
		</Tabs.Content>
	</Tabs.Root>
</div>
