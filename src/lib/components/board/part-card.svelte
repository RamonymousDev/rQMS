<script lang="ts">
	import { cn } from '$lib/utils.js';
	import type { BoardPart, ShiftKey, StageKey } from '$lib/server/board/index.js';
	import { latestInShift, latestOverall } from './status.js';
	import StageBadgeRow from './stage-badge-row.svelte';

	type Props = {
		part: BoardPart;
		currentShift: ShiftKey;
		onBadgeClick: (part: BoardPart, shift: ShiftKey, stage: StageKey) => void;
		tvMode?: boolean;
	};

	const { part, currentShift, onBadgeClick, tvMode = false }: Props = $props();

	const SHIFTS: ShiftKey[] = ['DAY', 'NIGHT'];
	const SHIFT_LABELS: Record<ShiftKey, string> = { DAY: 'Day', NIGHT: 'Night' };

	function aggregateStatus(part: BoardPart): 'NG' | 'OK' | null {
		return latestOverall(part)?.status ?? null;
	}

	const overall = $derived(aggregateStatus(part));
	const hasNg = $derived(overall === 'NG');

	/**
	 * Accent rail di sisi kiri kartu: penanda status pertama yang tertangkap mata
	 * sebelum sempat membaca teks — penting untuk board yang dipindai cepat.
	 */
	const railClass = $derived(
		overall === 'NG' ? 'bg-red-500' : overall === 'OK' ? 'bg-green-500' : 'bg-border'
	);

	const cardClass = $derived(
		cn(
			'flex overflow-hidden rounded-xl border bg-card shadow-sm transition-all',
			hasNg
				? 'border-red-300 ring-1 ring-red-500/20 dark:border-red-900/60'
				: 'border-border hover:shadow-md',
			tvMode && 'border-white/10 bg-white/[0.03]'
		)
	);

	const headerClass = $derived(
		cn(
			'flex items-center justify-between gap-3 px-5 py-4',
			hasNg && !tvMode ? 'bg-red-50/60 dark:bg-red-950/20' : '',
			hasNg && tvMode ? 'bg-red-500/10' : ''
		)
	);

	const statusBadgeClass = $derived(
		cn(
			'rounded-full font-bold',
			tvMode ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs',
			overall === 'NG'
				? 'bg-red-500 text-white'
				: overall === 'OK'
					? 'bg-green-500 text-white'
					: 'bg-muted text-muted-foreground'
		)
	);
</script>

<div class={cardClass}>
	<span class={cn('w-1.5 shrink-0', railClass)}></span>
	<div class="min-w-0 flex-1">
		<!-- Header -->
		<div class={headerClass}>
			<div class="min-w-0">
				<p class={cn('truncate font-mono font-bold text-primary', tvMode ? 'text-lg' : 'text-sm')}>
					{part.partNo}
				</p>
				<p
					class={cn(
						'mt-0.5 truncate text-muted-foreground',
						tvMode ? 'text-sm text-white/60' : 'text-xs'
					)}
				>
					{part.partName}
				</p>
			</div>
			<span class={statusBadgeClass}>{overall ?? '—'}</span>
		</div>

		<!--
			Shift Sections: SELALU satu baris per shift, lebar penuh kartu — bukan
			2 kolom berdampingan. sm:/lg: di sini berbasis lebar VIEWPORT, bukan
			lebar kartu, jadi di grid 3-4 kolom kartu tetap sempit walau layar
			lebar; 2 kolom berdampingan gampang kebentur. Baris penuh aman di
			semua ukuran kartu dan lebih enak dibaca.
		-->
		<div class={cn('divide-y', tvMode ? 'divide-white/10' : 'divide-border')}>
			{#each SHIFTS as shift (shift)}
				{@const shiftStatuses = part.status[shift]}
				{@const shiftHasNg = latestInShift(part, shift)?.status === 'NG'}
				{@const isActive = shift === currentShift}

				<div
					class={cn(
						'flex items-center justify-between gap-3 transition-colors',
						tvMode ? 'px-4 py-4' : 'px-4 py-2.5',
						shiftHasNg && !tvMode ? 'bg-red-50/40 dark:bg-red-950/10' : '',
						shiftHasNg && tvMode ? 'bg-red-500/10' : '',
						isActive && !tvMode ? 'bg-primary/5' : '',
						isActive && tvMode ? 'bg-amber-500/5' : ''
					)}
				>
					<div class="flex shrink-0 flex-col items-start gap-1">
						<p
							class={cn(
								'font-semibold tracking-wider uppercase',
								tvMode ? 'text-xs' : 'text-[10px]',
								shiftHasNg ? 'text-red-500' : tvMode ? 'text-white/50' : 'text-muted-foreground'
							)}
						>
							{SHIFT_LABELS[shift]}
						</p>
						{#if isActive}
							<span
								class={cn(
									'rounded-full px-1.5 py-px font-bold tracking-wide whitespace-nowrap uppercase',
									tvMode ? 'bg-amber-500/15 text-amber-400' : 'bg-primary/10 text-primary',
									tvMode ? 'text-[10px]' : 'text-[9px]'
								)}
							>
								Sekarang
							</span>
						{/if}
					</div>
					<StageBadgeRow
						{shift}
						statuses={shiftStatuses}
						onBadgeClick={(s, stage) => onBadgeClick(part, s, stage)}
						size={tvMode ? 'lg' : 'default'}
					/>
				</div>
			{/each}
		</div>
	</div>
</div>
