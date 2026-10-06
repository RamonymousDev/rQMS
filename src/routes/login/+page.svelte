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
		variant="ghost"
		size="sm"
		class="h-9 w-9 cursor-pointer rounded-full bg-card/80 p-0 shadow-sm ring-1 ring-foreground/10 backdrop-blur transition-colors duration-200 hover:bg-card"
		aria-label={isDark ? 'Mode terang' : 'Mode gelap'}
		onclick={toggleMode}
	>
		{#if isDark}
			<SunIcon class="h-4 w-4" />
		{:else}
			<MoonIcon class="h-4 w-4" />
		{/if}
	</Button>
</div>

<LoginCinematic {form} />
