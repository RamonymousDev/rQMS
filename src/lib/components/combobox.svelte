<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import { tick } from 'svelte';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';

	type ComboboxOption = { value: string; label: string };

	let {
		options,
		value = $bindable(''),
		placeholder = 'Pilih...',
		searchPlaceholder = 'Cari...',
		emptyText = 'Tidak ada hasil.',
		class: className = ''
	}: {
		options: ComboboxOption[];
		value?: string;
		placeholder?: string;
		searchPlaceholder?: string;
		emptyText?: string;
		class?: string;
	} = $props();

	let open = $state(false);
	let search = $state('');
	let triggerRef = $state<HTMLButtonElement>(null!);

	const selectedLabel = $derived(options.find((o) => o.value === value)?.label ?? '');

	// Reset pencarian setiap popover menutup agar hasil tidak terfilter sisa ketikan.
	function handleOpenChange(next: boolean) {
		open = next;
		if (!next) search = '';
	}

	function handleSelect(option: ComboboxOption) {
		value = option.value;
		open = false;
		tick().then(() => triggerRef.focus());
	}
</script>

<Popover.Root onOpenChange={handleOpenChange}>
	<Popover.Trigger bind:ref={triggerRef}>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="outline"
				role="combobox"
				aria-expanded={open}
				class={cn('h-10 w-full justify-between gap-2 font-normal', className)}
			>
				{#if selectedLabel}
					<span class="truncate">{selectedLabel}</span>
				{:else}
					<span class="text-muted-foreground">{placeholder}</span>
				{/if}
				<ChevronsUpDownIcon class="size-4 shrink-0 opacity-50" />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-[var(--bits-floating-anchor-width)] p-0" align="start">
		<Command.Root>
			<Command.Input
				bind:value={search}
				placeholder={searchPlaceholder}
				autofocus
				onkeydown={(e) => {
					if (e.key === 'Escape') open = false;
				}}
			/>
			<Command.List>
				<Command.Empty>{emptyText}</Command.Empty>
				<Command.Group>
					{#each options as option (option.value)}
						<Command.Item value={option.value} onSelect={() => handleSelect(option)}>
							<CheckIcon class={cn('me-2 size-4', value !== option.value && 'text-transparent')} />
							<span class="truncate">{option.label}</span>
						</Command.Item>
					{/each}
				</Command.Group>
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
