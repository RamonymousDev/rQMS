<script lang="ts">
	import { cn } from '$lib/utils.js';

	/**
	 * Sparkline tren 7 hari untuk KPI strip.
	 *
	 * Tanpa sumbu, tanpa label, tanpa interaksi — murni bentuk. Kalau semua
	 * nilai nol, area dikosongkan (bukan menggambar garis di sepanjang
	 * baseline, yang akan terlihat seperti "data ada tapi datar").
	 */
	let {
		values,
		class: className = ''
	}: {
		values: number[];
		class?: string;
	} = $props();

	const hasData = $derived(values.some((value) => value > 0));

	const path = $derived.by(() => {
		if (!hasData) return '';
		const max = Math.max(...values, 1);
		const step = 100 / Math.max(values.length - 1, 1);
		return values
			.map((value, index) => {
				const x = index * step;
				const y = 26 - (value / max) * 24;
				return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(' ');
	});
</script>

{#if hasData}
	<svg
		viewBox="0 0 100 28"
		preserveAspectRatio="none"
		class={cn('h-7 w-24 shrink-0', className)}
		aria-hidden="true"
	>
		<path
			d={path}
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
			stroke-linejoin="round"
			vector-effect="non-scaling-stroke"
		/>
	</svg>
{:else}
	<span class={cn('h-7 w-24 shrink-0', className)} aria-hidden="true"></span>
{/if}
