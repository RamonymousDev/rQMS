<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import { ADMIN_PERMISSION } from '$lib/permissions.js';
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
		// Selaras dengan validatePasswordStrength() di server (src/lib/server/password.ts).
		if (newPassword.length < 8) {
			toast.error('Password baru minimal 8 karakter.');
			return;
		}
		if (!/[A-Z]/.test(newPassword)) {
			toast.error('Password baru wajib mengandung huruf besar.');
			return;
		}
		if (!/[a-z]/.test(newPassword)) {
			toast.error('Password baru wajib mengandung huruf kecil.');
			return;
		}
		if (!/\d/.test(newPassword)) {
			toast.error('Password baru wajib mengandung angka.');
			return;
		}
		if (!/[^A-Za-z0-9]/.test(newPassword)) {
			toast.error('Password baru wajib mengandung simbol.');
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

	/* ------------------------------------------------------------------
	 * Command palette (Ctrl/Cmd+K) + shortcut "N" untuk Mulai Inspeksi.
	 * Keduanya global, tapi "N" diabaikan saat pengguna sedang mengetik
	 * di field mana pun — tanpa guard itu, mengetik part number "N-something"
	 * akan melempar operator keluar dari form.
	 * ------------------------------------------------------------------ */
	let paletteOpen = $state(false);

	const isAdmin = $derived(data.permissionCodes.includes(ADMIN_PERMISSION));

	const paletteActions = $derived([
		{ id: 'inspect', label: 'Mulai Inspeksi', hint: 'N', href: resolve('/inspect'), group: 'Aksi' },
		{ id: 'dashboard', label: 'Dashboard', href: resolve('/dashboard'), group: 'Navigasi' },
		{
			id: 'admin-inspections',
			label: 'Hasil Inspeksi',
			href: resolve('/admin/inspections'),
			group: 'Monitoring'
		},
		{ id: 'admin-audit', label: 'Audit Log', href: resolve('/admin/audit'), group: 'Monitoring' },
		...[
			{ id: 'admin-lines', label: 'Line', href: resolve('/admin/lines'), group: 'Master Data' },
			{ id: 'admin-parts', label: 'Part', href: resolve('/admin/parts'), group: 'Master Data' },
			{
				id: 'admin-hardwares',
				label: 'Hardware',
				href: resolve('/admin/hardwares'),
				group: 'Master Data'
			},
			{ id: 'admin-users', label: 'User', href: resolve('/admin/users'), group: 'Master Data' },
			{
				id: 'admin-processes',
				label: 'Process',
				href: resolve('/admin/processes'),
				group: 'Master Data'
			},
			{
				id: 'admin-permissions',
				label: 'Permission',
				href: resolve('/admin/permissions'),
				group: 'Master Data'
			},
			{
				id: 'admin-configs',
				label: 'Part + Line Config',
				href: resolve('/admin/configs'),
				group: 'Master Data'
			}
		].filter((action) => !action.id.startsWith('admin') || isAdmin)
	]);

	/** True saat fokus berada di field yang sedang diketik pengguna. */
	function isTypingTarget(target: EventTarget | null): boolean {
		if (!(target instanceof HTMLElement)) return false;
		const tag = target.tagName;
		return (
			tag === 'INPUT' ||
			tag === 'TEXTAREA' ||
			tag === 'SELECT' ||
			target.isContentEditable ||
			target.closest('[contenteditable="true"]') !== null
		);
	}

	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === ',') {
			e.preventDefault();
			settingsOpen = !settingsOpen;
			return;
		}

		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			paletteOpen = !paletteOpen;
			return;
		}

		// "N" hanya bila tidak ada modifier dan tidak sedang mengetik.
		if (
			e.key.toLowerCase() === 'n' &&
			!e.metaKey &&
			!e.ctrlKey &&
			!e.altKey &&
			!paletteOpen &&
			!isTypingTarget(e.target)
		) {
			e.preventDefault();
			goto(resolve('/inspect'));
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
		onLogout={openLogoutConfirm}
	/>
	<Sidebar.Inset>
		<header
			class="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/70"
		>
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
				<DropdownMenu.Root bind:open={settingsOpen}>
					<DropdownMenu.Trigger>
						<div
							class="inline-flex size-9 cursor-pointer items-center justify-center rounded-md border border-input bg-background text-sm font-medium transition-colors duration-150 hover:bg-accent hover:text-accent-foreground"
							aria-label="Settings"
						>
							<SettingsIcon class="size-4" aria-hidden="true" />
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
		<!--
			Padding bawah diberi ruang ekstra karena halaman inspeksi punya sticky
			submit footer; tanpa ini footer akan menutupi baris input terakhir.
		-->
		<div class="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-5 p-4 pb-28 lg:p-6 lg:pb-28">
			{@render children()}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>

<Toaster />

<!-- Command palette: perpindahan halaman + aksi cepat -->
<Command.Dialog
	bind:open={paletteOpen}
	title="Pindah halaman"
	description="Ketik untuk mencari. Tekan Esc untuk menutup."
	class="max-w-lg"
>
	<Command.Input placeholder="Cari halaman atau aksi…" />
	<Command.List class="max-h-80">
		<Command.Empty>Tidak ada hasil.</Command.Empty>
		{#each ['Aksi', 'Navigasi', 'Monitoring', 'Master Data'] as group (group)}
			{@const items = paletteActions.filter((action) => action.group === group)}
			{#if items.length > 0}
				<Command.Group heading={group}>
					{#each items as action (action.id)}
						<Command.Item
							value={`${action.group} ${action.label}`}
							onSelect={() => {
								paletteOpen = false;
								goto(action.href);
							}}
						>
							<span>{action.label}</span>
							{#if action.hint}
								<Command.Shortcut>{action.hint}</Command.Shortcut>
							{/if}
						</Command.Item>
					{/each}
				</Command.Group>
			{/if}
		{/each}
	</Command.List>
</Command.Dialog>

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
					aria-describedby="newPasswordHint"
				/>
				<p id="newPasswordHint" class="text-xs text-muted-foreground">
					Min. 8 karakter, huruf besar, huruf kecil, angka, dan simbol.
				</p>
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
