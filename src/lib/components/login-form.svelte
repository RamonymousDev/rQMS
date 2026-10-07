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

	const hasError = $derived(!!form?.message);
</script>

<form
	method="POST"
	class={cn('flex flex-col gap-5', className)}
	bind:this={ref}
	use:enhance={() => {
		pending = true;
		return async ({ update }) => {
			await update();
			pending = false;
		};
	}}
	{...restProps}
>
	{#if form?.message}
		<div
			id="login-error-{id}"
			role="alert"
			class="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive ring-1 ring-destructive/20"
		>
			<TriangleAlertIcon class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
			<span>{form.message}</span>
		</div>
	{/if}
	<FieldGroup>
		<Field>
			<FieldLabel for="nik-{id}">NIK</FieldLabel>
			<div class="relative">
				<IdCardIcon
					class="pointer-events-none absolute top-1/2 left-0 h-4 w-4 -translate-y-1/2 text-muted-foreground"
					aria-hidden="true"
				/>
				<Input
					id="nik-{id}"
					name="nik"
					type="text"
					value={form?.nik ?? ''}
					placeholder="e.g. OPR001"
					autocomplete="username"
					autocapitalize="characters"
					inputmode="text"
					spellcheck={false}
					aria-invalid={hasError}
					aria-describedby={hasError ? `login-error-{id}` : undefined}
					class="pl-7"
					required
					disabled={pending}
				/>
			</div>
		</Field>
		<Field>
			<FieldLabel for="password-{id}">Password</FieldLabel>
			<div class="relative">
				<LockKeyholeIcon
					class="pointer-events-none absolute top-1/2 left-0 h-4 w-4 -translate-y-1/2 text-muted-foreground"
					aria-hidden="true"
				/>
				<Input
					id="password-{id}"
					name="password"
					type={showPassword ? 'text' : 'password'}
					autocomplete="current-password"
					aria-invalid={hasError}
					aria-describedby={hasError ? `login-error-{id}` : undefined}
					class="pr-10 pl-7"
					required
					disabled={pending}
				/>
				<button
					type="button"
					class="absolute top-1/2 right-1 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:text-foreground"
					aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
					aria-pressed={showPassword}
					onclick={() => (showPassword = !showPassword)}
					disabled={pending}
				>
					{#if showPassword}
						<EyeOffIcon class="h-4 w-4" aria-hidden="true" />
					{:else}
						<EyeIcon class="h-4 w-4" aria-hidden="true" />
					{/if}
				</button>
			</div>
		</Field>
		<Field>
			<Button type="submit" class="h-11 w-full cursor-pointer font-semibold" disabled={pending}>
				{#if pending}
					<LoaderCircleIcon class="h-4 w-4 animate-spin" aria-hidden="true" />
					Masuk...
				{:else}
					<LogInIcon class="h-4 w-4" aria-hidden="true" />
					Sign-In
				{/if}
			</Button>
		</Field>
	</FieldGroup>
</form>
