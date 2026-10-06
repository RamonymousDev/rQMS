<script lang="ts" module>
	import { type VariantProps, tv } from 'tailwind-variants';

	export const badgeVariants = tv({
		base: 'gap-1 rounded-md border px-2 py-0.5 text-xs font-medium w-fit shrink-0 inline-flex items-center justify-center overflow-hidden whitespace-nowrap transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:size-3! [&>svg]:pointer-events-none',
		variants: {
			variant: {
				default: 'border-transparent bg-primary text-primary-foreground [a]:hover:bg-primary/90',
				secondary:
					'border-transparent bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80',
				destructive:
					'border-transparent bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20',
				outline: 'border-border text-foreground [a]:hover:bg-muted',
				ghost: 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
				link: 'border-transparent text-primary underline-offset-4 hover:underline'
			}
		},
		defaultVariants: {
			variant: 'default'
		}
	});

	export type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];
</script>

<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAnchorAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		href,
		class: className,
		variant = 'default',
		children,
		...restProps
	}: WithElementRef<HTMLAnchorAttributes> & {
		variant?: BadgeVariant;
	} = $props();
</script>

<svelte:element
	this={href ? 'a' : 'span'}
	bind:this={ref}
	data-slot="badge"
	{href}
	class={cn(badgeVariants({ variant }), className)}
	{...restProps}
>
	{@render children?.()}
</svelte:element>
