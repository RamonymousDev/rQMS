<script lang="ts">
	import CrudPage from '$lib/components/admin/crud-page.svelte';
</script>

<CrudPage
	title="Line"
	description="Line produksi yang menjadi child dari Process, dengan required permission."
	endpoint="/api/master/lines"
	searchKeys={['code', 'name']}
	columns={[
		{ key: 'code', header: 'Code' },
		{ key: 'name', header: 'Name' },
		{
			key: 'process',
			header: 'Process',
			render: (row) => row.process?.name ?? '-'
		},
		{
			key: 'requiredPermission',
			header: 'Required Permission',
			render: (row) => row.requiredPermission?.code ?? '-'
		},
		{ key: 'isActive', header: 'Status', badge: true }
	]}
	fields={[
		{
			name: 'processId',
			label: 'Process',
			type: 'select',
			optionsSource: '/api/master/processes',
			required: true,
			placeholder: 'Pilih process'
		},
		{ name: 'code', label: 'Code', required: true, placeholder: 'contoh: RSW' },
		{ name: 'name', label: 'Name', required: true, placeholder: 'contoh: RSW Welding' },
		{
			name: 'requiredPermissionId',
			label: 'Required Permission',
			type: 'select',
			optionsSource: '/api/master/permissions',
			optionLabel: (row) => `${row.code} — ${row.name}`,
			required: true,
			placeholder: 'Pilih permission'
		}
	]}
/>
