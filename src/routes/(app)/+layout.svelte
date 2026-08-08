<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import AppSidebar from '$lib/components/app-sidebar.svelte';

	const { children, data } = $props();

	const handleLogout = async () => {
		await fetch('/api/auth/logout', { method: 'POST' });
		goto(resolve('/login'));
	};
</script>

<Sidebar.Provider>
	<AppSidebar user={data.user} permissionCodes={data.permissionCodes} />
	<Sidebar.Inset>
		<header class="flex h-16 shrink-0 items-center gap-2 border-b px-4">
			<Sidebar.Trigger class="-ms-1" />
			<Separator orientation="vertical" class="me-2 h-4" />
			<Breadcrumb.Root>
				<Breadcrumb.List>
					<Breadcrumb.Item class="hidden md:block">
						<Breadcrumb.Link href="##">Build Your Application</Breadcrumb.Link>
					</Breadcrumb.Item>
					<Breadcrumb.Separator class="hidden md:block" />
					<Breadcrumb.Item>
						<Breadcrumb.Page>Data Fetching</Breadcrumb.Page>
					</Breadcrumb.Item>
				</Breadcrumb.List>
			</Breadcrumb.Root>
			<div class="ms-auto flex items-center gap-2">
				<span class="text-sm font-medium">{data.user.nik}</span>
				<Button variant="outline" size="sm" onclick={handleLogout}>Logout</Button>
			</div>
		</header>
		<div class="flex flex-1 flex-col gap-4 p-4">
			{@render children()}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>

<Toaster />
