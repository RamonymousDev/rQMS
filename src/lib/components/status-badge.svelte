<script lang="ts">
	import { cn } from '$lib/utils.js';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import CircleDashedIcon from '@lucide/svelte/icons/circle-dashed';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';

	/**
	 * Pill status hasil inspeksi.
	 *
	 * Bentuknya: background tint transparan + teks berwarna + dot. BUKAN blok
	 * warna solid — solid menutupi teks dan tidak terbaca dari monitor jauh.
	 *
	 * Aksesibilitas: warna TIDAK pernah jadi satu-satunya penanda. Setiap pill
	 * selalu membawa ikon + label teks, jadi tetap terbaca oleh pengguna
	 * buta warna maupun di layar low-contrast.
	 */
	type Status = 'OK' | 'NG' | 'WARN' | 'IDLE';

	let {
		status,
		label,
		size = 'default',
		dot = true,
		class: className
	}: {
		/** Hasil inspeksi. `IDLE` = belum ada data pada rentang tersebut. */
		status: Status | 'ok' | 'ng' | 'warn' | null | undefined;
		/** Override teks. Default: nama status (`—` untuk IDLE). */
		label?: string;
		size?: 'sm' | 'default' | 'lg';
		dot?: boolean;
		class?: string;
	} = $props();

	// Normalisasi supaya pemanggil boleh mengirim 'OK' maupun 'ok'.
	const resolved = $derived<Status>(
		status === 'ok'
			? 'OK'
			: status === 'ng' || status === 'NG'
				? 'NG'
				: status === 'warn' || status === 'WARN'
					? 'WARN'
					: 'IDLE'
	);

	const Icon = $derived(
		resolved === 'OK'
			? CircleCheckIcon
			: resolved === 'NG'
				? TriangleAlertIcon
				: resolved === 'WARN'
					? TriangleAlertIcon
					: CircleDashedIcon
	);

	const text = $derived(label ?? (resolved === 'IDLE' ? 'Belum ada data' : resolved));
</script>

<span
	class={cn(
		'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
		// Icon + teks selalu ada; dot opsional untuk hemat ruang di tabel padat.
		size === 'sm' && 'px-1.5 py-0.5 text-[11px]',
		size === 'default' && 'px-2 py-0.5 text-label',
		size === 'lg' && 'gap-2 px-2.5 py-1 text-body',
		resolved === 'OK' && 'border-status-ok/25 bg-status-ok-fill text-status-ok',
		resolved === 'NG' && 'border-status-ng/25 bg-status-ng-fill text-status-ng',
		resolved === 'WARN' && 'border-status-warn/25 bg-status-warn-fill text-status-warn',
		resolved === 'IDLE' && 'border-border bg-muted text-muted-foreground',
		className
	)}
>
	{#if dot}
		<span
			aria-hidden="true"
			class={cn(
				'size-1.5 shrink-0 rounded-full',
				resolved === 'OK' && 'bg-status-ok',
				resolved === 'NG' && 'bg-status-ng',
				resolved === 'WARN' && 'bg-status-warn',
				resolved === 'IDLE' && 'bg-status-idle'
			)}
		></span>
	{/if}
	<Icon aria-hidden="true" class={size === 'lg' ? 'size-4' : 'size-3.5'} />
	{text}
</span>
