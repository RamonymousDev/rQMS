<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlusIcon from '@lucide/svelte/icons/plus';
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
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import * as Table from '$lib/components/ui/table/index.js';

	export interface CrudField {
		name: string;
		label: string;
		type?: 'text' | 'password' | 'select' | 'checkbox' | 'switch' | 'checkbox-group';
		optionsSource?: string;
		options?: { value: string; label: string }[];
		/** Teks yang ditampilkan untuk tiap baris dari `optionsSource`. */
		optionLabel?: (row: CrudRow) => string;
		required?: boolean;
		placeholder?: string;
	}

	/**
	 * Baris master data bersifat generik — tiap entitas punya kolom berbeda,
	 * jadi nilainya sengaja `any` agar callback `render`/`toForm` milik pemanggil
	 * bisa mengakses field spesifiknya tanpa cast di setiap halaman.
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export type CrudRow = Record<string, any>;

	export interface CrudColumn {
		key: string;
		header: string;
		badge?: boolean;
		render?: (row: CrudRow) => string;
	}

	let {
		title,
		description,
		endpoint,
		columns,
		fields,
		searchKeys = [],
		toForm = (row: CrudRow) => ({ ...row })
	}: {
		title: string;
		description?: string;
		endpoint: string;
		columns: CrudColumn[];
		fields: CrudField[];
		searchKeys?: string[];
		toForm?: (row: CrudRow) => CrudRow;
	} = $props();

	let rows: CrudRow[] = $state([]);
	let loading = $state(true);
	let search = $state('');
	let dialogOpen = $state(false);
	let editing: CrudRow | null = $state(null);
	let form: CrudRow = $state({});
	let submitting = $state(false);
	let optionMap: Record<string, { value: string; label: string }[]> = $state({});

	async function load() {
		loading = true;
		try {
			const res = await fetch(endpoint);
			if (!res.ok) {
				toast.error('Gagal memuat data.');
				return;
			}
			rows = (await res.json()).data ?? [];
		} finally {
			loading = false;
		}
	}

	onMount(load);

	const filtered = $derived(
		search.trim()
			? rows.filter((row) =>
					searchKeys.some((key) =>
						String(row[key] ?? '')
							.toLowerCase()
							.includes(search.trim().toLowerCase())
					)
				)
			: rows
	);

	/**
	 * Endpoint master mengembalikan baris mentah (`id` + kolom entitas), sedangkan
	 * Select/Checkbox butuh `{ value, label }` — tanpa pemetaan ini `option.value`
	 * bernilai undefined dan `{#each}` berkunci duplikat.
	 */
	async function loadOptions() {
		for (const field of fields) {
			if (!field.optionsSource || field.name in optionMap) continue;

			const res = await fetch(field.optionsSource);
			if (!res.ok) continue;

			const data: CrudRow[] = (await res.json()).data ?? [];
			optionMap[field.name] = data.map((row) => ({
				value: String(row.id),
				// Entitas tanpa `code`/`name` (mis. parts, hardwares) wajib memberi
				// `optionLabel` — tanpa itu labelnya jatuh ke UUID yang tak berarti.
				label:
					field.optionLabel?.(row) ??
					String(row.code ?? row.name ?? row.partNo ?? row.hwNo ?? row.id)
			}));
		}
	}

	async function openCreate() {
		editing = null;
		form = {};
		await loadOptions();
		dialogOpen = true;
	}

	async function openEdit(row: CrudRow) {
		editing = row;
		form = toForm(row);
		await loadOptions();
		dialogOpen = true;
	}

	function closeDialog() {
		dialogOpen = false;
		editing = null;
		form = {};
	}

	function selectedLabel(field: CrudField): string {
		const value = form[field.name];
		const options = optionMap[field.name] ?? field.options ?? [];
		return options.find((o) => o.value === value)?.label ?? '';
	}

	function toggleGroupValue(name: string, value: string, checked: boolean) {
		const arr = Array.isArray(form[name]) ? [...form[name]] : [];
		if (checked) {
			if (!arr.includes(value)) arr.push(value);
		} else {
			const i = arr.indexOf(value);
			if (i >= 0) arr.splice(i, 1);
		}
		form[name] = arr;
	}

	async function toggleActive(row: CrudRow) {
		const next = !row.isActive;
		const res = await fetch(`${endpoint}/${row.id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ isActive: next })
		});
		if (res.ok) {
			row.isActive = next;
			toast.success(next ? 'Data diaktifkan.' : 'Data dinonaktifkan.');
		} else {
			const data = await res.json();
			toast.error(data?.message ?? 'Gagal memperbarui status.');
		}
	}

	function buildPayload(): Record<string, unknown> {
		const payload: Record<string, unknown> = {};
		for (const field of fields) {
			if (field.name === 'password' && editing && !form[field.name]) continue;
			if (field.type === 'checkbox' || field.type === 'switch') {
				payload[field.name] = !!form[field.name];
			} else if (Array.isArray(form[field.name])) {
				payload[field.name] = form[field.name];
			} else if (typeof form[field.name] === 'string') {
				payload[field.name] = form[field.name].trim();
			} else if (form[field.name] !== undefined && form[field.name] !== null) {
				payload[field.name] = form[field.name];
			}
		}
		return payload;
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		submitting = true;
		try {
			const url = editing ? `${endpoint}/${editing.id}` : endpoint;
			const res = await fetch(url, {
				method: editing ? 'PATCH' : 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(buildPayload())
			});
			if (!res.ok) {
				const data = await res.json();
				toast.error(data?.message ?? 'Gagal menyimpan data.');
				return;
			}
			toast.success(editing ? 'Data berhasil diperbarui.' : 'Data berhasil ditambahkan.');
			closeDialog();
			await load();
		} finally {
			submitting = false;
		}
	}
</script>

<Card>
	<CardHeader>
		<CardTitle>{title}</CardTitle>
		{#if description}
			<CardDescription>{description}</CardDescription>
		{/if}
		<CardAction>
			<Button onclick={openCreate}>
				<PlusIcon class="size-4" />
				Tambah
			</Button>
		</CardAction>
	</CardHeader>
	<CardContent class="grid gap-4">
		{#if searchKeys.length}
			<Input type="search" placeholder="Cari..." class="max-w-xs" bind:value={search} />
		{/if}
		<Table.Root>
			<Table.Header>
				<Table.Row>
					{#each columns as col (col.key)}
						<Table.Head>{col.header}</Table.Head>
					{/each}
					<Table.Head class="text-end">Aksi</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each filtered as row (row.id)}
					<Table.Row>
						{#each columns as col (col.key)}
							<Table.Cell>
								{#if col.badge}
									<Badge variant={row[col.key] ? 'default' : 'secondary'}>
										{row[col.key] ? 'AKTIF' : 'NONAKTIF'}
									</Badge>
								{:else if col.render}
									{col.render(row)}
								{:else}
									{row[col.key] ?? '-'}
								{/if}
							</Table.Cell>
						{/each}
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
						<Table.Cell colspan={columns.length + 1} class="h-24 text-center text-muted-foreground">
							{loading ? 'Memuat data...' : 'Belum ada data.'}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</CardContent>
</Card>

<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{editing ? `Edit ${title}` : `Tambah ${title}`}</Dialog.Title>
			<Dialog.Description>Lengkapi form berikut lalu simpan.</Dialog.Description>
		</Dialog.Header>
		<form onsubmit={handleSubmit}>
			<div class="grid gap-4 py-4">
				{#each fields as field (field.name)}
					<div class="grid gap-2">
						<Label for={field.name}>{field.label}{field.required ? ' *' : ''}</Label>

						{#if field.type === 'select'}
							<Select.Root type="single" bind:value={form[field.name]}>
								<Select.Trigger class="w-full">
									{#if selectedLabel(field)}
										<span>{selectedLabel(field)}</span>
									{:else}
										<span class="text-muted-foreground">{field.placeholder ?? 'Pilih...'}</span>
									{/if}
								</Select.Trigger>
								<Select.Content>
									{#each optionMap[field.name] ?? field.options ?? [] as option (option.value)}
										<Select.Item value={option.value} label={option.label}
											>{option.label}</Select.Item
										>
									{/each}
								</Select.Content>
							</Select.Root>
						{:else if field.type === 'checkbox-group'}
							<div class="grid max-h-44 gap-2 overflow-y-auto border-b pb-3">
								{#each optionMap[field.name] ?? field.options ?? [] as option (option.value)}
									<div class="flex items-center gap-2">
										<Checkbox
											id={`${field.name}-${option.value}`}
											checked={Array.isArray(form[field.name]) &&
												form[field.name].includes(option.value)}
											onCheckedChange={(checked) =>
												toggleGroupValue(field.name, option.value, !!checked)}
										/>
										<Label for={`${field.name}-${option.value}`} class="font-normal"
											>{option.label}</Label
										>
									</div>
								{/each}
							</div>
						{:else if field.type === 'checkbox'}
							<Checkbox
								id={field.name}
								checked={!!form[field.name]}
								onCheckedChange={(checked) => (form[field.name] = checked)}
							/>
						{:else if field.type === 'switch'}
							<Switch
								id={field.name}
								checked={!!form[field.name]}
								onCheckedChange={(checked) => (form[field.name] = checked)}
							/>
						{:else}
							<Input
								id={field.name}
								type={field.type === 'password' ? 'password' : 'text'}
								placeholder={field.placeholder}
								bind:value={form[field.name]}
							/>
						{/if}
					</div>
				{/each}
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={closeDialog}>Batal</Button>
				<Button type="submit" disabled={submitting}>{submitting ? 'Menyimpan...' : 'Simpan'}</Button
				>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
