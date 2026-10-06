<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		description,
		actions
	}: {
		title: string;
		description?: string;
		actions?: Snippet;
	} = $props();
</script>

<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
	<div>
		<h1 class="text-xl font-bold tracking-tight">{title}</h1>
		{#if description}
			<p class="mt-0.5 text-sm text-muted-foreground">{description}</p>
		{/if}
	</div>
	{#if actions}
		<div class="flex flex-wrap items-center gap-2">{@render actions()}</div>
	{/if}
</div>
