<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { ComponentProps } from 'svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { useSidebar } from '$lib/components/ui/sidebar/context.svelte.js';
	import type { SessionUser } from '$lib/server/auth.js';
	import { ADMIN_PERMISSION } from '$lib/permissions.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard';
	import ClipboardListIcon from '@lucide/svelte/icons/clipboard-list';
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import Settings2Icon from '@lucide/svelte/icons/settings-2';
	import GitBranchIcon from '@lucide/svelte/icons/git-branch';
	import PackageIcon from '@lucide/svelte/icons/package';
	import WrenchIcon from '@lucide/svelte/icons/wrench';
	import UsersIcon from '@lucide/svelte/icons/users';
	import Link2Icon from '@lucide/svelte/icons/link-2';
	import FileCheckIcon from '@lucide/svelte/icons/file-check';

	let {
		ref = $bindable(null),
		user,
		permissionCodes = [],
		ngInspectionCount = 0,
		...restProps
	}: ComponentProps<typeof Sidebar.Root> & {
		user: SessionUser;
		permissionCodes: string[];
		ngInspectionCount?: number;
	} = $props();

	const sidebar = useSidebar();
	const isAdmin = $derived(permissionCodes.includes(ADMIN_PERMISSION));

	const iconMap: Record<string, typeof LayoutDashboardIcon> = {
		Dashboard: LayoutDashboardIcon,
		Inspeksi: ClipboardListIcon,
		Permission: ShieldIcon,
		Process: Settings2Icon,
		Line: GitBranchIcon,
		Part: PackageIcon,
		Hardware: WrenchIcon,
		User: UsersIcon,
		'Part + Line': Link2Icon,
		'Hasil Inspeksi': FileCheckIcon
	};

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

	function getIcon(title: string) {
		return iconMap[title] ?? null;
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
							{@const Icon = getIcon(item.title)}
							{@const isInspectionItem = item.title === 'Hasil Inspeksi'}
							<Sidebar.MenuItem>
								<Sidebar.MenuButton isActive={page.url.pathname === item.url} variant="default">
									{#snippet child({ props })}
										<a href={item.url} {...props} onclick={handleNavClick}>
											{#if Icon}
												<Icon class="size-4" />
											{/if}
											<span>{item.title}</span>
											{#if isInspectionItem && ngInspectionCount > 0}
												<Badge variant="destructive" class="ml-auto">{ngInspectionCount}</Badge>
											{/if}
										</a>
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
