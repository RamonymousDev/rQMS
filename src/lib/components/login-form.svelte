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

<form method="POST" class={cn('flex flex-col gap-6', className)} bind:this={ref} {...restProps}>
	{#if form?.message}
		<div role="alert" class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
			{form.message}
		</div>
	{/if}
	<FieldGroup>
		<div class="flex flex-col items-center gap-1 text-center">
			<h1 class="text-2xl font-bold">Login to your account</h1>
			<p class="text-sm text-balance text-muted-foreground">
				Enter your NIK and password to continue
			</p>
		</div>
		<Field>
			<FieldLabel for="nik-{id}">NIK</FieldLabel>
			<Input
				id="nik-{id}"
				name="nik"
				type="text"
				value={form?.nik ?? ''}
				placeholder="e.g. OPR001"
				autocomplete="username"
				required
			/>
		</Field>
		<Field>
			<FieldLabel for="password-{id}">Password</FieldLabel>
			<Input
				id="password-{id}"
				name="password"
				type="password"
				autocomplete="current-password"
				required
			/>
		</Field>
		<Field>
			<Button type="submit" class="w-full">Login</Button>
		</Field>
	</FieldGroup>
</form>
