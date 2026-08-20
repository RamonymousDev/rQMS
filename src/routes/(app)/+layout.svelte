<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import { toast } from 'svelte-sonner';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import { mode, toggleMode } from 'mode-watcher';

	const { children, data } = $props();

	const routeLabels: Record<string, string> = {
		dashboard: 'Dashboard',
		inspect: 'Inspeksi',
		admin: 'Admin',
		permissions: 'Permission',
		processes: 'Process',
		lines: 'Line',
		parts: 'Part',
		hardwares: 'Hardware',
		users: 'User',
		configs: 'Konfigurasi',
		inspections: 'Hasil Inspeksi',
		audit: 'Audit Log'
	};

	function getBreadcrumbs() {
		const segments = page.url.pathname.split('/').filter(Boolean);
		const items: { label: string; href: string }[] = [];

		let cumulativePath = '';
		for (const segment of segments) {
			cumulativePath += `/${segment}`;
			const label = routeLabels[segment] || segment;
			items.push({
				label,
				href: cumulativePath
			});
		}

		return items;
	}

	const breadcrumbs = $derived(getBreadcrumbs());
	const pageTitle = $derived(getBreadcrumbs().at(-1)?.label ?? 'Q-Jun');

	let settingsOpen = $state(false);
	let changePasswordOpen = $state(false);
	let logoutConfirmOpen = $state(false);
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let changing = $state(false);
	let loggingOut = $state(false);

	const isDark = $derived(mode.current === 'dark');

	function openChangePassword() {
		settingsOpen = false;
		changePasswordOpen = true;
		currentPassword = '';
		newPassword = '';
		confirmPassword = '';
	}

	async function submitChangePassword() {
		if (!currentPassword || !newPassword || !confirmPassword) {
			toast.error('Semua field harus diisi.');
			return;
		}
		if (newPassword !== confirmPassword) {
			toast.error('Password baru tidak cocok.');
			return;
		}
		if (newPassword.length < 6) {
			toast.error('Password baru minimal 6 karakter.');
			return;
		}

		changing = true;
		try {
			const res = await fetch('/api/auth/change-password', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ currentPassword, newPassword })
			});
			const payload = await res.json().catch(() => ({}));
			if (!res.ok) {
				toast.error(payload?.message ?? 'Gagal mengganti password.');
				return;
			}
			toast.success('Password berhasil diganti.');
			changePasswordOpen = false;
		} finally {
			changing = false;
		}
	}

	function openLogoutConfirm() {
		settingsOpen = false;
		logoutConfirmOpen = true;
	}

	async function confirmLogout() {
		loggingOut = true;
		try {
			await fetch('/api/auth/logout', { method: 'POST' });
			goto(resolve('/login'));
		} finally {
			loggingOut = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === ',') {
			e.preventDefault();
			settingsOpen = !settingsOpen;
		}
	}
</script>

<svelte:head><title>{pageTitle} · Q-Jun</title></svelte:head>

<svelte:window on:keydown={handleKeydown} />

<Sidebar.Provider>
	<AppSidebar
		user={data.user}
		permissionCodes={data.permissionCodes}
		ngInspectionCount={data.ngInspectionCount}
	/>
	<Sidebar.Inset>
		<header class="flex h-16 shrink-0 items-center gap-2 border-b px-4">
			<Sidebar.Trigger class="-ms-1" />
			<Separator orientation="vertical" class="me-2 h-4" />
			<Breadcrumb.Root>
				<Breadcrumb.List>
					{#each breadcrumbs as item, index (item.href)}
						{@const isLast = index === breadcrumbs.length - 1}
						<Breadcrumb.Item>
							{#if isLast}
								<Breadcrumb.Page>{item.label}</Breadcrumb.Page>
							{:else}
								<Breadcrumb.Link href={item.href}>{item.label}</Breadcrumb.Link>
							{/if}
						</Breadcrumb.Item>
						{#if !isLast}
							<Breadcrumb.Separator />
						{/if}
					{/each}
				</Breadcrumb.List>
			</Breadcrumb.Root>
			<div class="ms-auto flex items-center gap-2">
				<span class="text-sm font-medium">{data.user.nik}</span>
				<DropdownMenu.Root bind:open={settingsOpen}>
					<DropdownMenu.Trigger>
						<div
							class="inline-flex size-9 items-center justify-center rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground"
							aria-label="Settings"
						>
							<SettingsIcon class="size-4" />
						</div>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-56">
						<DropdownMenu.Item onclick={toggleMode}>
							<SunIcon
								class="size-4 scale-100 rotate-0 !transition-all dark:scale-0 dark:-rotate-90"
							/>
							<MoonIcon
								class="absolute size-4 scale-0 rotate-90 !transition-all dark:scale-100 dark:rotate-0"
							/>
							<span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
						</DropdownMenu.Item>
						<DropdownMenu.Item onclick={openChangePassword}>Ganti Password</DropdownMenu.Item>
						<DropdownMenu.Separator />
						<DropdownMenu.Item variant="destructive" onclick={openLogoutConfirm}>
							Logout
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		</header>
		<div class="flex flex-1 flex-col gap-4 p-4">
			{@render children()}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>

<Toaster />

<Dialog.Root bind:open={changePasswordOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Ganti Password</Dialog.Title>
			<Dialog.Description>Masukkan password saat ini dan password baru Anda.</Dialog.Description>
		</Dialog.Header>
		<div class="grid gap-4">
			<div class="grid gap-2">
				<Label for="currentPassword">Password Saat Ini</Label>
				<Input
					id="currentPassword"
					type="password"
					bind:value={currentPassword}
					autocomplete="current-password"
				/>
			</div>
			<div class="grid gap-2">
				<Label for="newPassword">Password Baru</Label>
				<Input
					id="newPassword"
					type="password"
					bind:value={newPassword}
					autocomplete="new-password"
				/>
			</div>
			<div class="grid gap-2">
				<Label for="confirmPassword">Konfirmasi Password Baru</Label>
				<Input
					id="confirmPassword"
					type="password"
					bind:value={confirmPassword}
					autocomplete="new-password"
				/>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (changePasswordOpen = false)}>Batal</Button>
			<Button disabled={changing} onclick={submitChangePassword}>
				{changing ? 'Menyimpan...' : 'Simpan'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={logoutConfirmOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Konfirmasi Logout</Dialog.Title>
			<Dialog.Description>Apakah Anda yakin ingin keluar dari sistem?</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (logoutConfirmOpen = false)}>Batal</Button>
			<Button disabled={loggingOut} variant="destructive" onclick={confirmLogout}>
				{loggingOut ? 'Keluar...' : 'Ya, Logout'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
