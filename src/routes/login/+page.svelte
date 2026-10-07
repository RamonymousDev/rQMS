<script lang="ts">
	import LoginCinematic from '$lib/components/login/login-cinematic.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SunIcon from '@lucide/svelte/icons/sun';
	import { mode, toggleMode } from 'mode-watcher';

	let { form } = $props();

	const isDark = $derived(mode.current === 'dark');
</script>

<svelte:head><title>Login · Q-Jun</title></svelte:head>

<div class="absolute top-4 right-4 z-30">
	<Button
		variant="outline"
		size="icon"
		class="size-9 cursor-pointer rounded-md bg-card"
		aria-label={isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
		onclick={toggleMode}
	>
		{#if isDark}
			<SunIcon class="size-4" aria-hidden="true" />
		{:else}
			<MoonIcon class="size-4" aria-hidden="true" />
		{/if}
	</Button>
</div>

<LoginCinematic {form} />
