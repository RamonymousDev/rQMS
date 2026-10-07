<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Field, FieldGroup, FieldLabel } from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import IdCardIcon from '@lucide/svelte/icons/id-card';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import LockKeyholeIcon from '@lucide/svelte/icons/lock-keyhole';
	import LogInIcon from '@lucide/svelte/icons/log-in';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import { tick } from 'svelte';
	import type { HTMLFormAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		form = null,
		...restProps
	}: WithElementRef<HTMLFormAttributes> & {
		form?: { nik?: string; message?: string } | null;
	} = $props();

	const id = $props.id();

	let showPassword = $state(false);
	let pending = $state(false);
	let capsOn = $state(false);
	let password = $state('');
	let passwordEl = $state<HTMLInputElement | null>(null);

	const hasError = $derived(!!form?.message);

	function trackCaps(event: KeyboardEvent) {
		capsOn = event.getModifierState?.('CapsLock') ?? false;
	}
</script>

<form
	method="POST"
	class={cn('flex flex-col gap-5', className)}
	bind:this={ref}
	aria-busy={pending}
	use:enhance={() => {
		pending = true;
		return async ({ result, update }) => {
			await update({ reset: false });
			pending = false;
			// Gagal login: kosongkan password dan kembalikan fokus ke sana,
			// supaya operator bisa langsung mengetik ulang.
			if (result.type === 'failure') {
				password = '';
				await tick();
				passwordEl?.focus();
			}
		};
	}}
	{...restProps}
>
	{#if form?.message}
		<div
			id="login-error-{id}"
			role="alert"
			class="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive ring-1 ring-destructive/25"
		>
			<TriangleAlertIcon class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
			<span>{form.message}</span>
		</div>
	{/if}

	<FieldGroup>
		<Field>
			<FieldLabel for="nik-{id}">NIK</FieldLabel>
			<div class="relative">
				<IdCardIcon
					class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
					aria-hidden="true"
				/>
				<Input
					id="nik-{id}"
					name="nik"
					type="text"
					value={form?.nik ?? ''}
					placeholder="Contoh: OPR001"
					autocomplete="username"
					autocapitalize="characters"
					inputmode="text"
					spellcheck={false}
					aria-invalid={hasError}
					aria-describedby={hasError ? `login-error-${id}` : undefined}
					class="h-11 pl-9"
					required
					readonly={pending}
				/>
			</div>
		</Field>

		<Field>
			<FieldLabel for="password-{id}">Password</FieldLabel>
			<div class="relative">
				<LockKeyholeIcon
					class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
					aria-hidden="true"
				/>
				<Input
					id="password-{id}"
					name="password"
					type={showPassword ? 'text' : 'password'}
					bind:value={password}
					bind:ref={passwordEl}
					autocomplete="current-password"
					aria-invalid={hasError}
					aria-describedby={hasError ? `login-error-${id}` : undefined}
					class="h-11 pr-11 pl-9"
					required
					readonly={pending}
					onkeydown={trackCaps}
					onkeyup={trackCaps}
					onblur={() => (capsOn = false)}
				/>
				<button
					type="button"
					class="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
					aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
					aria-pressed={showPassword}
					onclick={() => (showPassword = !showPassword)}
				>
					{#if showPassword}
						<EyeOffIcon class="size-4" aria-hidden="true" />
					{:else}
						<EyeIcon class="size-4" aria-hidden="true" />
					{/if}
				</button>
			</div>
			{#if capsOn}
				<p class="flex items-center gap-1.5 text-xs text-amber-400" role="status">
					<TriangleAlertIcon class="size-3.5 shrink-0" aria-hidden="true" />
					Caps Lock sedang aktif
				</p>
			{/if}
		</Field>

		<Field>
			<Button type="submit" class="h-11 w-full cursor-pointer font-semibold" disabled={pending}>
				{#if pending}
					<LoaderCircleIcon class="size-4 animate-spin" aria-hidden="true" />
					Memeriksa...
				{:else}
					<LogInIcon class="size-4" aria-hidden="true" />
					Masuk
				{/if}
			</Button>
		</Field>
	</FieldGroup>
</form>
