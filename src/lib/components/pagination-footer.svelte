<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';

	let {
		total,
		page,
		totalPages,
		loading = false,
		unit = 'data',
		onPrev,
		onNext
	}: {
		total: number;
		page: number;
		totalPages: number;
		loading?: boolean;
		unit?: string;
		onPrev: () => void;
		onNext: () => void;
	} = $props();
</script>

<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
	<span class="text-sm text-muted-foreground">
		{total}
		{unit} · Halaman {page} dari {totalPages}
		{#if loading}<span class="ms-1">· Memuat…</span>{/if}
	</span>
	<div class="flex gap-2">
		<Button variant="outline" size="sm" disabled={page <= 1 || loading} onclick={onPrev}>
			Sebelumnya
		</Button>
		<Button variant="outline" size="sm" disabled={page >= totalPages || loading} onclick={onNext}>
			Berikutnya
		</Button>
	</div>
</div>
