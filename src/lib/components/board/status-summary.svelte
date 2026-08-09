<script lang="ts">
	import type { BoardPart } from '$lib/server/board/index.js';
	import { latestOverall } from './status.js';
	import { cn } from '$lib/utils.js';

	type Props = {
		parts: BoardPart[];
		date: string;
		today: string;
		tvMode?: boolean;
	};

	const { parts, date, today, tvMode = false }: Props = $props();

	const ngCount = $derived(parts.filter((p) => latestOverall(p)?.status === 'NG').length);

	const okCount = $derived(parts.filter((p) => latestOverall(p)?.status === 'OK').length);

	const pendingCount = $derived(parts.length - ngCount - okCount);

	const isHistorical = $derived(date !== today);

	/**
	 * Papan skor 3 angka besar (NG · OK · Belum) — lebih cepat dipindai daripada
	 * badge kecil, dan NG selalu di kiri karena itu yang paling butuh perhatian.
	 */
	const tiles = $derived([
		{ label: 'NG', value: ngCount, tone: 'ng' as const },
		{ label: 'OK', value: okCount, tone: 'ok' as const },
		{ label: 'Belum', value: pendingCount, tone: 'pending' as const }
	]);

	function tileValueClass(tone: 'ng' | 'ok' | 'pending'): string {
		if (tone === 'ng') return 'text-red-600 dark:text-red-400';
		if (tone === 'ok') return 'text-green-600 dark:text-green-400';
		return 'text-foreground';
	}
</script>

<div class={cn('border-b border-border bg-muted/30 transition-colors')}>
	<div
		class={cn(
			'mx-auto flex max-w-6xl items-center justify-between gap-4 px-6',
			tvMode ? 'py-4' : 'py-3'
		)}
	>
		{#if parts.length === 0}
			<span class="text-xs text-muted-foreground">Tidak ada part terkonfigurasi</span>
		{:else}
			<div class="flex items-stretch divide-x divide-border/60">
				{#each tiles as tile, i (tile.label)}
					<div
						class={cn('flex items-baseline gap-2', i > 0 && 'pl-5', i < tiles.length - 1 && 'pr-5')}
					>
						<span
							class={cn(
								'font-mono font-bold tabular-nums',
								tvMode ? 'text-3xl' : 'text-xl',
								tileValueClass(tile.tone)
							)}
						>
							{tile.value}
						</span>
						<span
							class={cn(
								'font-semibold tracking-wide text-muted-foreground uppercase',
								tvMode ? 'text-xs' : 'text-[11px]'
							)}
						>
							{tile.label}
						</span>
					</div>
				{/each}
			</div>
		{/if}

		{#if isHistorical}
			<span class="shrink-0 text-xs font-medium text-amber-600 dark:text-amber-500">
				· data historis
			</span>
		{/if}
	</div>
</div>
