<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Field, FieldGroup, FieldLabel } from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
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
</script>

<form method="POST" class={cn('flex flex-col gap-5', className)} bind:this={ref} {...restProps}>
	{#if form?.message}
		<div
			role="alert"
			class="rounded-lg bg-destructive/15 px-3 py-2 text-sm text-destructive ring-1 ring-destructive/20"
		>
			{form.message}
		</div>
	{/if}
	<FieldGroup>
		<Field>
			<FieldLabel for="nik-{id}" class="text-white/80">Username</FieldLabel>
			<Input
				id="nik-{id}"
				name="nik"
				type="text"
				value={form?.nik ?? ''}
				placeholder="e.g. OPR001"
				autocomplete="username"
				class="border-white/10 bg-white/10 text-white placeholder:text-white/40 focus-visible:ring-white/30"
				required
			/>
		</Field>
		<Field>
			<FieldLabel for="password-{id}" class="text-white/80">Password</FieldLabel>
			<Input
				id="password-{id}"
				name="password"
				type="password"
				autocomplete="current-password"
				class="border-white/10 bg-white/10 text-white placeholder:text-white/40 focus-visible:ring-white/30"
				required
			/>
		</Field>
		<Field>
			<Button
				type="submit"
				class="w-full bg-gradient-to-r from-white to-white/80 font-semibold text-black shadow-lg hover:to-white hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] active:from-white/90 active:to-white/70"
			>
				Sign-In
			</Button>
		</Field>
	</FieldGroup>
</form>
