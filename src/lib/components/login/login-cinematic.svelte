<script lang="ts">
	import LoginForm from '$lib/components/login-form.svelte';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import FactoryIcon from '@lucide/svelte/icons/factory';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import MonitorIcon from '@lucide/svelte/icons/monitor';

	let { form } = $props();
</script>

<div class="relative min-h-svh overflow-hidden bg-background">
	<img
		src="/product.png"
		alt=""
		aria-hidden="true"
		class="pointer-events-none fixed inset-0 h-full w-full object-cover"
	/>
	<div
		aria-hidden="true"
		class="pointer-events-none fixed inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/15"
	></div>

	<div
		class="relative z-10 mx-auto grid min-h-svh w-full max-w-6xl items-center gap-10 px-6 py-16 pb-28 sm:pb-16 lg:grid-cols-2 lg:px-10"
	>
		<div>
			<span
				class="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/20 backdrop-blur"
			>
				<FactoryIcon class="h-3.5 w-3.5" aria-hidden="true" />
				PT Adyawinsa Stamping Industries
			</span>
			<h2
				class="mt-4 max-w-xl text-4xl leading-tight font-bold tracking-tight text-white sm:text-5xl"
			>
				Inspeksi kualitas, langsung di line.
			</h2>
			<p class="mt-3 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">
				Q-JUN mencatat setiap pemeriksaan START, MIDDLE, dan END — lengkap dengan operator, shift,
				dan status OK/NG.
			</p>
		</div>

		<div
			class="w-full max-w-md rounded-2xl bg-card p-6 text-card-foreground shadow-2xl ring-1 ring-foreground/10 sm:p-8 lg:justify-self-end"
		>
			<div class="mb-5 flex items-center gap-3">
				<span
					class="flex size-11 items-center justify-center overflow-hidden rounded-xl bg-muted p-1 ring-1 ring-foreground/10"
				>
					<img src="/adw.png" alt="Logo ADW" class="h-full w-full object-contain" />
				</span>
				<div>
					<p class="text-lg font-bold tracking-tight">Sign in Q-JUN</p>
					<p class="text-xs text-muted-foreground">Masuk untuk mulai inspeksi</p>
				</div>
			</div>
			<LoginForm {form} class="w-full" />
		</div>
	</div>

	<ul
		class="absolute inset-x-0 bottom-0 z-10 hidden border-t border-white/10 bg-black/40 backdrop-blur sm:block"
	>
		<div
			class="mx-auto flex w-full max-w-6xl items-center gap-8 px-6 py-3 text-xs text-white/75 lg:px-10"
		>
			<li class="flex items-center gap-2">
				<LayersIcon class="h-4 w-4" aria-hidden="true" /> 3 stage: START · MIDDLE · END
			</li>
			<li class="flex items-center gap-2">
				<ClockIcon class="h-4 w-4" aria-hidden="true" /> Shift DAY/NIGHT otomatis (WIB)
			</li>
			<li class="flex items-center gap-2">
				<MonitorIcon class="h-4 w-4" aria-hidden="true" /> Board realtime per-line
			</li>
		</div>
	</ul>
</div>
