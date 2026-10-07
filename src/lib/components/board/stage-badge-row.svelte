<script lang="ts">
	import { cn } from '$lib/utils.js';
	import type { StageStatus, ShiftKey, StageKey } from '$lib/server/board/index.js';

	type Props = {
		shift: ShiftKey;
		statuses: Record<StageKey, StageStatus>;
		onBadgeClick: (shift: ShiftKey, stage: StageKey) => void;
		/** 'lg' dipakai di Mode TV supaya status terbaca dari jarak beberapa meter. */
		size?: 'default' | 'lg';
	};

	const { shift, statuses, onBadgeClick, size = 'default' }: Props = $props();

	const STAGE_LABELS: Record<StageKey, string> = {
		START: 'S',
		MIDDLE: 'M',
		END: 'E'
	};

	const STAGE_NAMES: Record<StageKey, string> = {
		START: 'Start',
		MIDDLE: 'Middle',
		END: 'End'
	};

	const STAGES: StageKey[] = ['START', 'MIDDLE', 'END'];

	/**
	 * Warna solid (bukan tint) supaya status tetap terbaca dari jarak jauh di TV
	 * line produksi. NG diberi ring tebal supaya menonjol lebih dulu dari OK.
	 *
	 * Catatan a11y: badge hanya menampilkan inisial stage (S/M/E), jadi warna
	 * bukan satu-satunya pembeda OK/NG. Dua penanda lain: `aria-label` menyebut
	 * statusnya secara eksplisit, dan NG memakai ring 4px sementara OK tidak —
	 * bentuk, bukan hanya hue. Jangan samakan `badgeClass` OK dan NG.
	 */
	function badgeClass(status: StageStatus['status']): string {
		if (status === 'OK') return 'border-status-ok bg-status-ok text-white shadow-sm';
		if (status === 'NG')
			return 'border-status-ng bg-status-ng text-white shadow-md ring-4 ring-status-ng/35';
		return 'border-dashed border-muted-foreground/40 bg-muted/50 text-muted-foreground/70';
	}

	function lineClass(status: StageStatus['status']): string {
		if (status === 'OK') return 'bg-status-ok';
		if (status === 'NG') return 'bg-status-ng';
		return 'bg-border';
	}

	/** Keterangan recency untuk tooltip badge, mis. "terakhir 21:04 WIB · 3 inspeksi". */
	function formatLatest(s: StageStatus): string {
		if (!s.latestInspectedAt) return 'belum ada data';
		const time = new Date(s.latestInspectedAt).toLocaleTimeString('id-ID', {
			hour: '2-digit',
			minute: '2-digit',
			timeZone: 'Asia/Jakarta'
		});
		const suffix = s.count > 1 ? ` · ${s.count} inspeksi` : '';
		return `terakhir ${time} WIB${suffix}`;
	}
</script>

<div class="flex items-center">
	{#each STAGES as stage, i (stage)}
		{@const s = statuses[stage]}
		{@const hasData = s.status !== null}

		{#if i > 0}
			<!--
				Garis penghubung antar stage: flex-1 supaya menyusut dulu saat ruang
				sempit (badge tidak pernah overflow), dan melebar natural di kartu lebar.
			-->
			<div
				class={cn(
					'min-w-[0.25rem] flex-1 transition-colors',
					size === 'lg' ? 'h-1' : 'h-0.5',
					lineClass(statuses[stage].status)
				)}
			></div>
		{/if}

		<button
			type="button"
			disabled={!hasData}
			title={formatLatest(s)}
			onclick={() => hasData && onBadgeClick(shift, stage)}
			class={cn(
				'flex shrink-0 items-center justify-center rounded-full border-2 font-bold transition-all',
				// Ukuran moderat: nyaman disentuh di HP, terbaca dari TV tanpa membuat kartu meluber
				size === 'lg'
					? 'h-14 w-14 text-lg sm:h-16 sm:w-16 sm:text-xl'
					: 'h-9 w-9 text-xs sm:h-10 sm:w-10 sm:text-sm',
				badgeClass(s.status),
				// Hover memakai brightness + ring, bukan scale: transform mengubah batas
				// layout sehingga badge bertabrakan dengan tetangganya dan bergetar.
				hasData
					? 'cursor-pointer hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none'
					: 'cursor-default'
			)}
			aria-label="{shift === 'DAY' ? 'Day' : 'Night'} shift — {STAGE_NAMES[stage]}: {s.status ??
				'belum ada data'}"
		>
			{STAGE_LABELS[stage]}
		</button>
	{/each}
</div>
