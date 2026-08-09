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
		if (tone === 'ng') return tvMode ? 'text-red-400' : 'text-red-600 dark:text-red-400';
		if (tone === 'ok') return tvMode ? 'text-green-400' : 'text-green-600 dark:text-green-400';
		return tvMode ? 'text-white/70' : 'text-foreground';
	}
</script>

<div
	class={cn(
		'border-b transition-colors',
		tvMode ? 'border-white/10 bg-white/[0.02]' : 'border-border bg-muted/30'
	)}
>
	<div
		class={cn(
			'mx-auto flex max-w-6xl items-center justify-between gap-4 px-6',
			tvMode ? 'py-4' : 'py-3'
		)}
	>
		{#if parts.length === 0}
			<span class={cn('text-xs', tvMode ? 'text-white/50' : 'text-muted-foreground')}>
				Tidak ada part terkonfigurasi
			</span>
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
								'font-semibold tracking-wide uppercase',
								tvMode ? 'text-xs text-white/50' : 'text-[11px] text-muted-foreground'
							)}
						>
							{tile.label}
						</span>
					</div>
				{/each}
			</div>
		{/if}

		{#if isHistorical}
			<span
				class={cn(
					'shrink-0 text-xs font-medium',
					tvMode ? 'text-amber-400' : 'text-amber-600 dark:text-amber-500'
				)}
			>
				· data historis
			</span>
		{/if}
	</div>
</div>
