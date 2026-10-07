<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent } from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import DatePicker from '$lib/components/date-picker.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import PageHeader from '$lib/components/page-header.svelte';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import PaginationFooter from '$lib/components/pagination-footer.svelte';
	import InboxIcon from '@lucide/svelte/icons/inbox';
	import { formatDateTime } from '$lib/format.js';

	type AuditRow = {
		id: string;
		actorNik: string | null;
		action: string;
		entity: string | null;
		entityId: string | null;
		metadata: Record<string, unknown>;
		ipAddress: string | null;
		createdAt: string;
	};

	let rows: AuditRow[] = $state([]);
	let loading = $state(true);
	let page = $state(1);
	let totalPages = $state(1);
	let total = $state(0);

	let filterAction = $state('');
	let filterEntity = $state('');
	let filterActorNik = $state('');
	let filterDateFrom = $state('');
	let filterDateTo = $state('');

	let detail: AuditRow | null = $state(null);
	let detailOpen = $state(false);

	function buildQuery(targetPage: number): string {
		const entries: [string, string][] = [
			['page', String(targetPage)],
			['pageSize', '25'],
			['action', filterAction.trim()],
			['entity', filterEntity.trim()],
			['actorNik', filterActorNik.trim()],
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
			const res = await fetch(`/api/audit?${buildQuery(targetPage)}`);
			const body = await res.json();
			if (!res.ok) {
				toast.error(body?.message ?? 'Gagal memuat audit log.');
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

	function runSearch(targetPage = 1) {
		load(targetPage);
	}

	function resetFilters() {
		filterAction = '';
		filterEntity = '';
		filterActorNik = '';
		filterDateFrom = '';
		filterDateTo = '';
		runSearch(1);
	}

	function openDetail(row: AuditRow) {
		detail = row;
		detailOpen = true;
	}

	onMount(() => {
		load(1);
	});
</script>

<PageHeader
	title="Audit Log"
	description="Jejak aktivitas pengguna (login, perubahan master data, inspeksi, konfigurasi). Bersifat append-only."
/>

<Card>
	<CardContent class="grid gap-4">
		<!-- Filters -->
		<div class="grid gap-4 rounded-xl bg-muted/40 p-4 ring-1 ring-foreground/5">
			<div class="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
				<div class="grid gap-1.5">
					<Label for="filterAction">Aksi</Label>
					<Input
						id="filterAction"
						placeholder="contoh: login_success"
						bind:value={filterAction}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								runSearch();
							}
						}}
					/>
				</div>
				<div class="grid gap-1.5">
					<Label for="filterEntity">Entity</Label>
					<Input
						id="filterEntity"
						placeholder="contoh: part"
						bind:value={filterEntity}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								runSearch();
							}
						}}
					/>
				</div>
				<div class="grid gap-1.5">
					<Label for="filterActorNik">NIK Aktor</Label>
					<Input
						id="filterActorNik"
						placeholder="contoh: ADMIN001"
						bind:value={filterActorNik}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								runSearch();
							}
						}}
					/>
				</div>
				<div class="grid gap-1.5">
					<Label>Dari Tanggal</Label>
					<DatePicker bind:value={filterDateFrom} clearable placeholder="Dari tanggal" />
					<p class="text-[10px] text-muted-foreground">Hari kalender WIB</p>
				</div>
				<div class="grid gap-1.5">
					<Label>Sampai Tanggal</Label>
					<DatePicker bind:value={filterDateTo} clearable placeholder="Sampai tanggal" />
					<p class="text-[10px] text-muted-foreground">Hari kalender WIB</p>
				</div>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				<Button size="sm" onclick={() => runSearch()}>Cari</Button>
				<Button variant="outline" size="sm" onclick={resetFilters}>Reset</Button>
			</div>
		</div>

		<!-- Table -->
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Waktu</Table.Head>
					<Table.Head>Aktor</Table.Head>
					<Table.Head>Aksi</Table.Head>
					<Table.Head>Entity</Table.Head>
					<Table.Head class="text-end">IP</Table.Head>
					<Table.Head class="text-end">Aksi</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each rows as row (row.id)}
					<Table.Row class="transition-colors hover:bg-muted/50">
						<Table.Cell>{formatDateTime(row.createdAt)}</Table.Cell>
						<Table.Cell>
							<span class="font-mono font-medium">{row.actorNik ?? '-'}</span>
						</Table.Cell>
						<Table.Cell>
							<Badge variant="outline" class="font-mono">{row.action}</Badge>
						</Table.Cell>
						<Table.Cell>
							{#if row.entity}
								{row.entity}
								{#if row.entityId}
									<span class="font-mono text-xs text-muted-foreground"> · {row.entityId}</span>
								{/if}
							{:else}
								-
							{/if}
						</Table.Cell>
						<Table.Cell class="text-end font-mono text-xs">{row.ipAddress ?? '-'}</Table.Cell>
						<Table.Cell class="text-end">
							<Button variant="ghost" size="sm" onclick={() => openDetail(row)}>Detail</Button>
						</Table.Cell>
					</Table.Row>
				{:else}
					{#if loading}
						{#each [0, 1, 2, 3, 4] as i (i)}
							<Table.Row>
								<Table.Cell colspan={6}>
									<Skeleton class="h-10 w-full" />
								</Table.Cell>
							</Table.Row>
						{/each}
					{:else}
						<Table.Row>
							<Table.Cell colspan={6} class="p-0">
								<div class="p-4">
									<Empty.Root>
										<Empty.Media variant="icon">
											<InboxIcon />
										</Empty.Media>
										<Empty.Header>
											<Empty.Title>Belum ada audit log</Empty.Title>
											<Empty.Description
												>Aktivitas pengguna akan tercatat di sini secara otomatis.</Empty.Description
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
			unit="entri"
			onPrev={() => runSearch(page - 1)}
			onNext={() => runSearch(page + 1)}
		/>
	</CardContent>
</Card>

<Dialog.Root bind:open={detailOpen}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Detail Audit Log</Dialog.Title>
			<Dialog.Description>Metadata mentah dari entri ini.</Dialog.Description>
		</Dialog.Header>
		{#if detail}
			<div class="grid gap-4 py-2 text-sm">
				<div class="grid grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-3">
					<div>
						<span class="text-muted-foreground">Waktu</span>
						<p class="font-medium">{formatDateTime(detail.createdAt)}</p>
					</div>
					<div>
						<span class="text-muted-foreground">Aktor</span>
						<p class="font-mono font-medium">{detail.actorNik ?? '-'}</p>
					</div>
					<div>
						<span class="text-muted-foreground">Aksi</span>
						<p class="font-mono font-medium">{detail.action}</p>
					</div>
					<div>
						<span class="text-muted-foreground">Entity</span>
						<p class="font-medium">{detail.entity ?? '-'}</p>
					</div>
					<div>
						<span class="text-muted-foreground">Entity ID</span>
						<p class="font-mono font-medium break-all">{detail.entityId ?? '-'}</p>
					</div>
					<div>
						<span class="text-muted-foreground">IP</span>
						<p class="font-mono font-medium">{detail.ipAddress ?? '-'}</p>
					</div>
				</div>
				<div>
					<span class="text-muted-foreground">Metadata</span>
					<pre
						class="mt-1 max-h-64 overflow-auto rounded-lg border bg-muted/20 p-3 text-xs whitespace-pre-wrap">{JSON.stringify(
							detail.metadata ?? {},
							null,
							2
						)}</pre>
				</div>
			</div>
		{/if}
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (detailOpen = false)}>Tutup</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
