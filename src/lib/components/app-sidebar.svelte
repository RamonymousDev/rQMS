<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { ComponentProps } from 'svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { useSidebar } from '$lib/components/ui/sidebar/context.svelte.js';
	import type { SessionUser } from '$lib/server/auth.js';
	import { ADMIN_PERMISSION } from '$lib/permissions.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
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
	import ScrollTextIcon from '@lucide/svelte/icons/scroll-text';
	import LogOutIcon from '@lucide/svelte/icons/log-out';

	let {
		ref = $bindable(null),
		user,
		permissionCodes = [],
		ngInspectionCount = 0,
		onLogout,
		...restProps
	}: ComponentProps<typeof Sidebar.Root> & {
		user: SessionUser;
		permissionCodes: string[];
		ngInspectionCount?: number;
		onLogout?: () => void;
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
		'Hasil Inspeksi': FileCheckIcon,
		'Audit Log': ScrollTextIcon
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
						items: [
							{ title: 'Hasil Inspeksi', url: resolve('/admin/inspections') },
							{ title: 'Audit Log', url: resolve('/admin/audit') }
						]
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

	function isCurrent(url: string): boolean {
		const pathname = page.url.pathname;
		return pathname === url || pathname.startsWith(`${url}/`);
	}

	/** Inisial untuk avatar, mis. "Admin System" → "AS". */
	const initials = $derived(
		user.name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? '')
			.join('') || user.nik.slice(0, 2).toUpperCase()
	);
</script>

<Sidebar.Root {...restProps} bind:ref>
	<Sidebar.Header>
		<div class="flex items-center gap-2.5 px-2 py-2">
			<span
				class="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted p-1 ring-1 ring-foreground/10"
			>
				<img src="/adw.png" alt="" aria-hidden="true" class="h-full w-full object-contain" />
			</span>
			<span class="grid min-w-0 flex-1 gap-0.5 leading-none">
				<span class="truncate text-sm font-bold tracking-tight">Q-JUN</span>
				<span class="truncate text-[11px] text-muted-foreground">Quality System</span>
			</span>
		</div>
	</Sidebar.Header>
	<Sidebar.Content>
		{#each navMain as group (group.title)}
			<Sidebar.Group>
				<Sidebar.GroupLabel class="text-xs font-medium text-sidebar-foreground/60">
					{group.title}
				</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						{#each group.items as item (item.title)}
							{@const Icon = getIcon(item.title)}
							{@const isInspectionItem = item.title === 'Hasil Inspeksi'}
							{@const active = isCurrent(item.url)}
							<Sidebar.MenuItem>
								<Sidebar.MenuButton
									isActive={active}
									variant="default"
									class="relative transition-colors duration-200"
								>
									{#snippet child({ props })}
										<a href={item.url} {...props} onclick={handleNavClick}>
											{#if active}
												<span
													aria-hidden="true"
													class="absolute top-1/2 left-0 h-5 w-1 -translate-x-1 -translate-y-1/2 rounded-full bg-primary"
												></span>
											{/if}
											{#if Icon}
												<Icon class="size-4 shrink-0" />
											{/if}
											<span class="truncate">{item.title}</span>
											{#if isInspectionItem && ngInspectionCount > 0}
												<Badge variant="destructive" class="ml-auto shrink-0">
													<span class="relative flex size-1.5">
														<span
															class="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75 motion-reduce:animate-none"
														></span>
														<span class="relative inline-flex size-1.5 rounded-full bg-white"
														></span>
													</span>
													{ngInspectionCount > 99 ? '99+' : ngInspectionCount}
												</Badge>
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
	<Sidebar.Footer>
		<Separator class="mb-2" />
		<div
			class="flex items-center gap-2.5 rounded-lg bg-muted/50 px-2 py-2 ring-1 ring-foreground/5"
		>
			<span
				aria-hidden="true"
				class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
			>
				{initials}
			</span>
			<span class="grid min-w-0 flex-1 gap-0.5 leading-none">
				<span class="truncate text-xs font-semibold">{user.name}</span>
				<span class="truncate font-mono text-[11px] text-muted-foreground">{user.nik}</span>
			</span>
			<Button
				variant="ghost"
				size="icon-sm"
				class="shrink-0 cursor-pointer"
				aria-label="Logout"
				title="Logout"
				onclick={() => onLogout?.()}
			>
				<LogOutIcon class="size-4" />
			</Button>
		</div>
	</Sidebar.Footer>
	<Sidebar.Rail />
</Sidebar.Root>
