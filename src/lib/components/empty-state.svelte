<script lang="ts">
	import type { Component, Snippet } from 'svelte';

	let {
		icon: Icon,
		title,
		description,
		action
	}: {
		icon?: Component;
		title: string;
		description?: string;
		action?: Snippet;
	} = $props();
</script>

<div
	class="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-6 py-14 text-center"
>
	{#if Icon}
		<span
			class="mb-2 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground"
		>
			<Icon class="size-5" aria-hidden="true" />
		</span>
	{/if}
	<p class="text-sm font-semibold">{title}</p>
	{#if description}
		<p class="max-w-sm text-sm text-muted-foreground">{description}</p>
	{/if}
	{#if action}
		<div class="mt-3">{@render action()}</div>
	{/if}
</div>
