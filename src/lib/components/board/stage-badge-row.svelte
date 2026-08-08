<script lang="ts">
	import { cn } from '$lib/utils.js';
	import type { StageStatus, ShiftKey, StageKey } from '$lib/server/board/index.js';

	type Props = {
		shift: ShiftKey;
		statuses: Record<StageKey, StageStatus>;
		onBadgeClick: (shift: ShiftKey, stage: StageKey) => void;
	};

	const { shift, statuses, onBadgeClick }: Props = $props();

	const STAGE_LABELS: Record<StageKey, string> = {
		START: 'S',
		MIDDLE: 'M',
		END: 'E'
	};

	const STAGES: StageKey[] = ['START', 'MIDDLE', 'END'];

	function badgeClass(status: StageStatus['status']): string {
		if (status === 'OK') return 'bg-green-500 text-white border-green-500';
		if (status === 'NG') return 'bg-red-500 text-white border-red-500';
		return 'bg-muted text-muted-foreground border-muted-foreground/30';
	}

	function lineClass(status: StageStatus['status']): string {
		if (status === 'OK') return 'bg-green-400';
		if (status === 'NG') return 'bg-red-400';
		return 'bg-muted-foreground/20';
	}
</script>

<div class="flex items-center gap-0">
	{#each STAGES as stage, i (stage)}
		{@const s = statuses[stage]}
		{@const hasData = s.status !== null}

		{#if i > 0}
			<!-- Garis penghubung antar badge -->
			<div class={cn('h-px w-4 shrink-0', lineClass(s.status))}></div>
		{/if}

		<button
			type="button"
			disabled={!hasData}
			onclick={() => hasData && onBadgeClick(shift, stage)}
			class={cn(
				'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[0.65rem] font-bold transition-all',
				badgeClass(s.status),
				hasData
					? 'cursor-pointer hover:opacity-80 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
					: 'cursor-default opacity-50'
			)}
			aria-label="{shift === 'DAY' ? 'Day' : 'Night'} Shift — {stage} ({s.status ?? 'no data'})"
		>
			{STAGE_LABELS[stage]}
		</button>
	{/each}
</div>
