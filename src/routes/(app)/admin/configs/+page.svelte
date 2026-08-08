<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		Card,
		CardAction,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import * as Table from '$lib/components/ui/table/index.js';

	type Option = { value: string; label: string };
	type ConfigRow = {
		id: string;
		partId: string;
		lineId: string;
		hasSpot: boolean;
		spotStandard: number | null;
		hasPoint: boolean;
		hasHardware: boolean;
		hasLength: boolean;
		hasVisual: boolean;
		isActive: boolean;
		part?: { partNo: string; partName: string };
		line?: { code: string; name: string };
		points: { pointNo: string; sequence: number }[];
		hardwares: {
			hardwareId: string;
			standardValue: number;
			unit: string;
			sequence: number;
			hardware?: { hwNo: string; hwName: string };
		}[];
		lengths: { lengthNo: string; standardMm: number; sequence: number }[];
	};

	let rows: ConfigRow[] = $state([]);
	let loading = $state(true);
	let search = $state('');
	let dialogOpen = $state(false);
	let editing: ConfigRow | null = $state(null);
	let submitting = $state(false);

	let partOptions: Option[] = $state([]);
	let lineOptions: Option[] = $state([]);
	let hardwareOptions: Option[] = $state([]);

	// Form state — child rows dipegang sebagai array agar bisa ditambah/hapus.
	let partId = $state('');
	let lineId = $state('');
	let hasSpot = $state(false);
	let spotStandard = $state('');
	let hasPoint = $state(false);
	let points: { pointNo: string }[] = $state([]);
	let hasHardware = $state(false);
	let hardwareRows: { hardwareId: string; standardValue: string; unit: string }[] = $state([]);
	let hasLength = $state(false);
	let lengths: { lengthNo: string; standardMm: string }[] = $state([]);
	let hasVisual = $state(false);

	async function load() {
		loading = true;
		try {
			const res = await fetch('/api/configs');
			if (!res.ok) {
				toast.error('Gagal memuat konfigurasi.');
				return;
			}
			rows = (await res.json()).data ?? [];
		} finally {
			loading = false;
		}
	}

	async function loadOptions() {
		const [partsRes, linesRes, hardwaresRes] = await Promise.all([
			fetch('/api/master/parts'),
			fetch('/api/master/lines'),
			fetch('/api/master/hardwares')
		]);
		if (partsRes.ok) {
			const data = (await partsRes.json()).data ?? [];
			partOptions = data.map((p: { id: string; partNo: string; partName: string }) => ({
				value: p.id,
				label: `${p.partNo} — ${p.partName}`
			}));
		}
		if (linesRes.ok) {
			const data = (await linesRes.json()).data ?? [];
			lineOptions = data.map((l: { id: string; code: string; name: string }) => ({
				value: l.id,
				label: `${l.code} — ${l.name}`
			}));
		}
		if (hardwaresRes.ok) {
			const data = (await hardwaresRes.json()).data ?? [];
			hardwareOptions = data.map((h: { id: string; hwNo: string; hwName: string }) => ({
				value: h.id,
				label: `${h.hwNo} — ${h.hwName}`
			}));
		}
	}

	onMount(load);

	const filtered = $derived(
		search.trim()
			? rows.filter((row) => {
					const q = search.trim().toLowerCase();
					return (
						(row.part?.partNo ?? '').toLowerCase().includes(q) ||
						(row.line?.code ?? '').toLowerCase().includes(q)
					);
				})
			: rows
	);

	function resetForm() {
		partId = '';
		lineId = '';
		hasSpot = false;
		spotStandard = '';
		hasPoint = false;
		points = [];
		hasHardware = false;
		hardwareRows = [];
		hasLength = false;
		lengths = [];
		hasVisual = false;
	}

	async function openCreate() {
		editing = null;
		resetForm();
		await loadOptions();
		dialogOpen = true;
	}

	async function openEdit(row: ConfigRow) {
		editing = row;
		partId = row.partId;
		lineId = row.lineId;
		hasSpot = row.hasSpot;
		spotStandard = row.spotStandard === null ? '' : String(row.spotStandard);
		hasPoint = row.hasPoint;
		points = row.points.map((p) => ({ pointNo: p.pointNo }));
		hasHardware = row.hasHardware;
		hardwareRows = row.hardwares.map((h) => ({
			hardwareId: h.hardwareId,
			standardValue: String(h.standardValue),
			unit: h.unit
		}));
		hasLength = row.hasLength;
		lengths = row.lengths.map((l) => ({
			lengthNo: l.lengthNo,
			standardMm: String(l.standardMm)
		}));
		hasVisual = row.hasVisual;
		await loadOptions();
		dialogOpen = true;
	}

	function closeDialog() {
		dialogOpen = false;
		editing = null;
	}

	function labelFor(options: Option[], value: string): string {
		return options.find((o) => o.value === value)?.label ?? '';
	}

	function summaryOf(row: ConfigRow): string {
		const parts: string[] = [];
		if (row.hasSpot) parts.push(`Spot ${row.spotStandard ?? '-'}`);
		if (row.hasPoint) parts.push(`${row.points.length} Point`);
		if (row.hasHardware) parts.push(`${row.hardwares.length} Hardware`);
		if (row.hasLength) parts.push(`${row.lengths.length} Length`);
		if (row.hasVisual) parts.push('Visual');
		return parts.join(' · ') || '-';
	}

	async function toggleActive(row: ConfigRow) {
		const next = !row.isActive;
		const res = await fetch(`/api/configs/${row.id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ isActive: next })
		});
		if (res.ok) {
			row.isActive = next;
			toast.success(next ? 'Konfigurasi diaktifkan.' : 'Konfigurasi dinonaktifkan.');
		} else {
			toast.error((await res.json())?.message ?? 'Gagal memperbarui status.');
		}
	}

	/** Field numerik dikirim sebagai number — backend menolak string. */
	function toNumber(value: string): number {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : NaN;
	}

	function buildPayload() {
		return {
			...(editing ? {} : { partId, lineId }),
			hasSpot,
			spotStandard: hasSpot ? toNumber(spotStandard) : null,
			hasPoint,
			hasHardware,
			hasLength,
			hasVisual,
			points: hasPoint ? points.map((p, i) => ({ pointNo: p.pointNo, sequence: i })) : [],
			hardwares: hasHardware
				? hardwareRows.map((h, i) => ({
						hardwareId: h.hardwareId,
						standardValue: toNumber(h.standardValue),
						unit: h.unit,
						sequence: i
					}))
				: [],
			lengths: hasLength
				? lengths.map((l, i) => ({
						lengthNo: l.lengthNo,
						standardMm: toNumber(l.standardMm),
						sequence: i
					}))
				: []
		};
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!editing && (!partId || !lineId)) {
			toast.error('Part dan Line wajib dipilih.');
			return;
		}
		submitting = true;
		try {
			const res = await fetch(editing ? `/api/configs/${editing.id}` : '/api/configs', {
				method: editing ? 'PATCH' : 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(buildPayload())
			});
			if (!res.ok) {
				toast.error((await res.json())?.message ?? 'Gagal menyimpan konfigurasi.');
				return;
			}
			toast.success(editing ? 'Konfigurasi diperbarui.' : 'Konfigurasi ditambahkan.');
			closeDialog();
			await load();
		} finally {
			submitting = false;
		}
	}
</script>

<Card>
	<CardHeader>
		<CardTitle>Konfigurasi Part + Line</CardTitle>
		<CardDescription>
			Menentukan item inspeksi beserta standard-nya untuk tiap kombinasi Part dan Line.
		</CardDescription>
		<CardAction>
			<Button onclick={openCreate}>
				<PlusIcon class="size-4" />
				Tambah
			</Button>
		</CardAction>
	</CardHeader>
	<CardContent class="grid gap-4">
		<Input
			type="search"
			placeholder="Cari part no / line code..."
			class="max-w-xs"
			bind:value={search}
		/>
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Part</Table.Head>
					<Table.Head>Line</Table.Head>
					<Table.Head>Item Inspeksi</Table.Head>
					<Table.Head>Status</Table.Head>
					<Table.Head class="text-end">Aksi</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each filtered as row (row.id)}
					<Table.Row>
						<Table.Cell>{row.part?.partNo ?? '-'}</Table.Cell>
						<Table.Cell>{row.line?.code ?? '-'}</Table.Cell>
						<Table.Cell class="text-muted-foreground">{summaryOf(row)}</Table.Cell>
						<Table.Cell>
							<Badge variant={row.isActive ? 'default' : 'secondary'}>
								{row.isActive ? 'AKTIF' : 'NONAKTIF'}
							</Badge>
						</Table.Cell>
						<Table.Cell class="text-end">
							<div class="flex items-center justify-end gap-2">
								<Switch
									checked={row.isActive}
									onCheckedChange={() => toggleActive(row)}
									aria-label="Toggle aktif"
								/>
								<Button
									variant="outline"
									size="icon-sm"
									onclick={() => openEdit(row)}
									aria-label="Edit"
								>
									<PencilIcon class="size-4" />
								</Button>
							</div>
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={5} class="h-24 text-center text-muted-foreground">
							{loading ? 'Memuat data...' : 'Belum ada konfigurasi.'}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</CardContent>
</Card>

<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>{editing ? 'Edit Konfigurasi' : 'Tambah Konfigurasi'}</Dialog.Title>
			<Dialog.Description>
				Aktifkan item yang perlu diinspeksi lalu isi standard-nya.
			</Dialog.Description>
		</Dialog.Header>
		<form onsubmit={handleSubmit}>
			<div class="grid gap-5 py-4">
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="grid gap-2">
						<Label>Part *</Label>
						{#if editing}
							<Input value={editing.part?.partNo ?? ''} disabled />
						{:else}
							<Select.Root type="single" bind:value={partId}>
								<Select.Trigger class="w-full">
									{#if labelFor(partOptions, partId)}
										<span>{labelFor(partOptions, partId)}</span>
									{:else}
										<span class="text-muted-foreground">Pilih part</span>
									{/if}
								</Select.Trigger>
								<Select.Content>
									{#each partOptions as option (option.value)}
										<Select.Item value={option.value} label={option.label}>
											{option.label}
										</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						{/if}
					</div>
					<div class="grid gap-2">
						<Label>Line *</Label>
						{#if editing}
							<Input value={editing.line?.code ?? ''} disabled />
						{:else}
							<Select.Root type="single" bind:value={lineId}>
								<Select.Trigger class="w-full">
									{#if labelFor(lineOptions, lineId)}
										<span>{labelFor(lineOptions, lineId)}</span>
									{:else}
										<span class="text-muted-foreground">Pilih line</span>
									{/if}
								</Select.Trigger>
								<Select.Content>
									{#each lineOptions as option (option.value)}
										<Select.Item value={option.value} label={option.label}>
											{option.label}
										</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						{/if}
					</div>
				</div>

				<!-- Spot -->
				<div class="grid gap-3 rounded-lg border p-4">
					<div class="flex items-center justify-between">
						<Label for="hasSpot">Spot</Label>
						<Switch id="hasSpot" bind:checked={hasSpot} />
					</div>
					{#if hasSpot}
						<div class="grid gap-2">
							<Label for="spotStandard">Spot Standard (qty) *</Label>
							<Input
								id="spotStandard"
								type="number"
								min="0"
								placeholder="contoh: 12"
								bind:value={spotStandard}
							/>
						</div>
					{/if}
				</div>

				<!-- Points -->
				<div class="grid gap-3 rounded-lg border p-4">
					<div class="flex items-center justify-between">
						<Label for="hasPoint">Point</Label>
						<Switch id="hasPoint" bind:checked={hasPoint} />
					</div>
					{#if hasPoint}
						<div class="grid gap-2">
							{#each points as point, i (i)}
								<div class="flex items-center gap-2">
									<Input placeholder={`Point ${i + 1}`} bind:value={point.pointNo} />
									<Button
										type="button"
										variant="outline"
										size="icon-sm"
										onclick={() => (points = points.filter((_, idx) => idx !== i))}
										aria-label="Hapus point"
									>
										<TrashIcon class="size-4" />
									</Button>
								</div>
							{/each}
							<Button
								type="button"
								variant="outline"
								size="sm"
								onclick={() => (points = [...points, { pointNo: '' }])}
							>
								<PlusIcon class="size-4" />
								Tambah Point
							</Button>
						</div>
					{/if}
				</div>

				<!-- Hardwares -->
				<div class="grid gap-3 rounded-lg border p-4">
					<div class="flex items-center justify-between">
						<Label for="hasHardware">Hardware</Label>
						<Switch id="hasHardware" bind:checked={hasHardware} />
					</div>
					{#if hasHardware}
						<div class="grid gap-2">
							{#each hardwareRows as hw, i (i)}
								<div class="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-center">
									<Select.Root type="single" bind:value={hw.hardwareId}>
										<Select.Trigger class="w-full">
											{#if labelFor(hardwareOptions, hw.hardwareId)}
												<span class="truncate">{labelFor(hardwareOptions, hw.hardwareId)}</span>
											{:else}
												<span class="text-muted-foreground">Pilih hardware</span>
											{/if}
										</Select.Trigger>
										<Select.Content>
											{#each hardwareOptions as option (option.value)}
												<Select.Item value={option.value} label={option.label}>
													{option.label}
												</Select.Item>
											{/each}
										</Select.Content>
									</Select.Root>
									<Input
										type="number"
										min="0"
										placeholder="Standard"
										bind:value={hw.standardValue}
									/>
									<Input placeholder="Unit (kgf/mm)" bind:value={hw.unit} />
									<Button
										type="button"
										variant="outline"
										size="icon-sm"
										onclick={() => (hardwareRows = hardwareRows.filter((_, idx) => idx !== i))}
										aria-label="Hapus hardware"
									>
										<TrashIcon class="size-4" />
									</Button>
								</div>
							{/each}
							<Button
								type="button"
								variant="outline"
								size="sm"
								onclick={() =>
									(hardwareRows = [
										...hardwareRows,
										{ hardwareId: '', standardValue: '', unit: '' }
									])}
							>
								<PlusIcon class="size-4" />
								Tambah Hardware
							</Button>
						</div>
					{/if}
				</div>

				<!-- Lengths -->
				<div class="grid gap-3 rounded-lg border p-4">
					<div class="flex items-center justify-between">
						<Label for="hasLength">Length</Label>
						<Switch id="hasLength" bind:checked={hasLength} />
					</div>
					{#if hasLength}
						<div class="grid gap-2">
							{#each lengths as length, i (i)}
								<div class="grid gap-2 sm:grid-cols-[2fr_1fr_auto] sm:items-center">
									<Input placeholder={`Length ${i + 1}`} bind:value={length.lengthNo} />
									<Input
										type="number"
										min="0"
										placeholder="Standard mm"
										bind:value={length.standardMm}
									/>
									<Button
										type="button"
										variant="outline"
										size="icon-sm"
										onclick={() => (lengths = lengths.filter((_, idx) => idx !== i))}
										aria-label="Hapus length"
									>
										<TrashIcon class="size-4" />
									</Button>
								</div>
							{/each}
							<Button
								type="button"
								variant="outline"
								size="sm"
								onclick={() => (lengths = [...lengths, { lengthNo: '', standardMm: '' }])}
							>
								<PlusIcon class="size-4" />
								Tambah Length
							</Button>
						</div>
					{/if}
				</div>

				<!-- Visual -->
				<div class="flex items-center justify-between rounded-lg border p-4">
					<div class="grid gap-1">
						<Label for="hasVisual">Visual</Label>
						<span class="text-xs text-muted-foreground">Hasil diisi OK/NG oleh operator.</span>
					</div>
					<Switch id="hasVisual" bind:checked={hasVisual} />
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={closeDialog}>Batal</Button>
				<Button type="submit" disabled={submitting}>
					{submitting ? 'Menyimpan...' : 'Simpan'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
