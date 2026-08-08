<script lang="ts">
	import CrudPage from '$lib/components/admin/crud-page.svelte';

	type PermissionRef = { id: string; code: string };
</script>

<CrudPage
	title="User"
	description="User operator/admin dengan assignment permission."
	endpoint="/api/master/users"
	searchKeys={['nik', 'name']}
	columns={[
		{ key: 'nik', header: 'NIK' },
		{ key: 'name', header: 'Name' },
		{
			key: 'permissions',
			header: 'Permissions',
			render: (row) => (row.permissions ?? []).map((p: PermissionRef) => p.code).join(', ') || '-'
		},
		{ key: 'isActive', header: 'Status', badge: true }
	]}
	fields={[
		{ name: 'nik', label: 'NIK', required: true, placeholder: 'contoh: OPR002' },
		{ name: 'name', label: 'Name', required: true, placeholder: 'contoh: Budi Santoso' },
		{
			name: 'password',
			label: 'Password',
			type: 'password',
			required: true,
			placeholder: 'Minimal 6 karakter'
		},
		{
			name: 'permissionIds',
			label: 'Permissions',
			type: 'checkbox-group',
			optionsSource: '/api/master/permissions',
			optionLabel: (row) => `${row.code} — ${row.name}`,
			placeholder: 'Pilih permission'
		}
	]}
	toForm={(row) => ({
		...row,
		permissionIds: (row.permissions ?? []).map((p: PermissionRef) => p.id)
	})}
/>
