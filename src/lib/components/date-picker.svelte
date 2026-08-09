<script lang="ts">
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import XIcon from '@lucide/svelte/icons/x';
	import {
		CalendarDate,
		DateFormatter,
		getLocalTimeZone,
		type DateValue
	} from '@internationalized/date';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Calendar } from '$lib/components/ui/calendar/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { cn } from '$lib/utils.js';

	const df = new DateFormatter('id-ID', { dateStyle: 'medium' });

	function parseKey(key: string | undefined): CalendarDate | undefined {
		if (!key) return undefined;
		const parts = key.split('-').map(Number);
		if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return undefined;
		return new CalendarDate(parts[0], parts[1], parts[2]);
	}

	function keyOf(value: DateValue): string {
		return value.toString();
	}

	let {
		value = $bindable(''),
		placeholder = 'Pilih tanggal',
		maxKey,
		minKey,
		clearable = false,
		align = 'start',
		onSelect,
		class: className = '',
		...restProps
	}: {
		/** Tanggal terpilih dalam format key `YYYY-MM-DD` (hari operasional). */
		value?: string;
		placeholder?: string;
		/** Batas maksimal tanggal (key `YYYY-MM-DD`). */
		maxKey?: string;
		/** Batas minimal tanggal (key `YYYY-MM-DD`). */
		minKey?: string;
		/** Tampilkan tombol bersihkan di popover. */
		clearable?: boolean;
		align?: 'start' | 'center' | 'end';
		/** Dipanggil dengan key baru setelah user memilih tanggal. */
		onSelect?: (key: string) => void;
		class?: string;
	} & Record<string, unknown> = $props();

	let open = $state(false);

	const selected = $derived(parseKey(value));
	const maxValue = $derived(parseKey(maxKey));
	const minValue = $derived(parseKey(minKey));
	const label = $derived(selected ? df.format(selected.toDate(getLocalTimeZone())) : '');

	function handleSelect(v: DateValue | undefined) {
		if (v) {
			value = keyOf(v);
			onSelect?.(value);
		}
		open = false;
	}

	function handleClear() {
		value = '';
		open = false;
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger {...restProps}>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="outline"
				aria-expanded={open}
				class={cn('h-9 w-full justify-start gap-2 font-normal', className)}
			>
				<CalendarIcon class="size-4 shrink-0 opacity-50" />
				{#if selected}
					<span class="truncate">{label}</span>
				{:else}
					<span class="truncate text-muted-foreground">{placeholder}</span>
				{/if}
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-auto p-0" {align}>
		<Calendar
			type="single"
			locale="id-ID"
			captionLayout="dropdown"
			value={selected}
			{maxValue}
			{minValue}
			onValueChange={handleSelect}
		/>
		{#if clearable && value}
			<Separator />
			<div class="p-2">
				<Button
					variant="ghost"
					size="sm"
					class="w-full justify-start text-muted-foreground"
					onclick={handleClear}
				>
					<XIcon class="size-4" />
					Bersihkan
				</Button>
			</div>
		{/if}
	</Popover.Content>
</Popover.Root>
