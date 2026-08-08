<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { ComponentProps } from 'svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { useSidebar } from '$lib/components/ui/sidebar/context.svelte.js';
	import type { SessionUser } from '$lib/server/auth.js';
	import { ADMIN_PERMISSION } from '$lib/permissions.js';

	let {
		ref = $bindable(null),
		user,
		permissionCodes = [],
		...restProps
	}: ComponentProps<typeof Sidebar.Root> & {
		user: SessionUser;
		permissionCodes: string[];
	} = $props();

	const sidebar = useSidebar();
	const isAdmin = $derived(permissionCodes.includes(ADMIN_PERMISSION));

	const navMain = $derived([
		{
			title: 'Menu',
			items: [
				{ title: 'Dashboard', url: resolve('/dashboard') },
				{ title: 'Inspeksi', url: resolve('/inspect') }
			]
		},
		...(isAdmin
			? [
					{
						title: 'Master Data',
						items: [
							{ title: 'Permission', url: resolve('/admin/permissions') },
							{ title: 'Process', url: resolve('/admin/processes') },
							{ title: 'Line', url: resolve('/admin/lines') },
							{ title: 'Part', url: resolve('/admin/parts') },
							{ title: 'Hardware', url: resolve('/admin/hardwares') },
							{ title: 'User', url: resolve('/admin/users') }
						]
					},
					{
						title: 'Konfigurasi',
						items: [{ title: 'Part + Line', url: resolve('/admin/configs') }]
					},
					{
						title: 'Monitoring',
						items: [{ title: 'Hasil Inspeksi', url: resolve('/admin/inspections') }]
					}
				]
			: [])
	]);

	function handleNavClick() {
		if (sidebar.isMobile) {
			sidebar.setOpenMobile(false);
		}
	}
</script>

<Sidebar.Root {...restProps} bind:ref>
	<Sidebar.Header>
		<div class="grid gap-0.5 px-4 py-2">
			<span class="truncate text-sm font-semibold">QMS</span>
			<span class="truncate text-xs text-muted-foreground">
				{user.name} · {user.nik}
			</span>
		</div>
	</Sidebar.Header>
	<Sidebar.Content>
		{#each navMain as group (group.title)}
			<Sidebar.Group>
				<Sidebar.GroupLabel>{group.title}</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						{#each group.items as item (item.title)}
							<Sidebar.MenuItem>
								<Sidebar.MenuButton isActive={page.url.pathname === item.url}>
									{#snippet child({ props })}
										<a href={item.url} {...props} onclick={handleNavClick}>{item.title}</a>
									{/snippet}
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
						{/each}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		{/each}
	</Sidebar.Content>
	<Sidebar.Rail />
</Sidebar.Root>
