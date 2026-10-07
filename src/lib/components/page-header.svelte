<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Header halaman: judul + deskripsi + area aksi.
	 *
	 * Memakai skala tipografi token (text-page / text-label) — bukan ukuran
	 * bebas — supaya seluruh admin punya hierarki yang sama.
	 */
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
	<div class="min-w-0">
		<h1 class="text-page">{title}</h1>
		{#if description}
			<p class="mt-1 text-label text-muted-foreground">{description}</p>
		{/if}
	</div>
	{#if actions}
		<div class="flex flex-wrap items-center gap-2">{@render actions()}</div>
	{/if}
</div>
