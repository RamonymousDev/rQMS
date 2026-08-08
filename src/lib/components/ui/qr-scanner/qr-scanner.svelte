<script lang="ts">
	import { onMount } from 'svelte';
	import { Html5Qrcode } from 'html5-qrcode';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { cn } from '$lib/utils.js';
	import { KeyboardIcon } from '@lucide/svelte/icons';

	let {
		value = $bindable(''),
		scan = false,
		placeholder = 'Scan QR atau ketik manual...',
		disabled = false,
		class: className
	}: {
		value: string;
		scan?: boolean;
		placeholder?: string;
		disabled?: boolean;
		class?: string;
	} = $props();

	let error = $state('');
	let scanner: Html5Qrcode | null = null;
	let scanning = $state(false);

	async function startScan() {
		error = '';
		const element = document.getElementById('qr-reader');
		if (!element) return;

		scanner = new Html5Qrcode('qr-reader');
		try {
			await scanner.start(
				{ facingMode: 'environment' },
				{
					fps: 10,
					qrbox: { width: 250, height: 250 }
				},
				(decodedText) => {
					value = decodedText;
					stopScan();
				},
				() => {}
			);
			scanning = true;
		} catch {
			error = 'Gagal mengakses kamera. Pastikan izin kamera diberikan.';
			scanning = false;
			scanner = null;
		}
	}

	async function stopScan() {
		if (scanner && scanning) {
			try {
				await scanner.stop();
			} catch {
				// ignore stop errors
			}
			try {
				scanner.clear();
			} catch {
				// ignore clear errors
			}
			scanner = null;
			scanning = false;
		}
	}

	onMount(() => {
		return () => {
			stopScan();
		};
	});

	$effect(() => {
		if (scan) {
			startScan();
		} else {
			stopScan();
		}
	});
</script>

<div class={cn('flex flex-col gap-2', className)}>
	{#if scan}
		<div class="w-full overflow-hidden rounded-md border bg-black">
			<div id="qr-reader" class="w-full"></div>
		</div>
		{#if value}
			<div class="flex items-center gap-2 rounded-md border bg-muted/50 p-2">
				<Label class="text-xs text-muted-foreground">Terdeteksi scan:</Label>
				<Badge variant="secondary" class="font-mono text-xs">{value}</Badge>
			</div>
		{/if}
		<p class="text-xs text-muted-foreground">Arahkan kamera ke QR code...</p>
	{:else}
		<div class="relative">
			<Input {placeholder} bind:value {disabled} oninput={() => (error = '')} class="pr-10" />
			<KeyboardIcon class="absolute end-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
		</div>
	{/if}
	{#if error}
		<p class="text-xs text-destructive">{error}</p>
	{/if}
</div>
