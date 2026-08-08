<script lang="ts">
	import CrudPage from '$lib/components/admin/crud-page.svelte';
</script>

<CrudPage
	title="Permission"
	description="Permission fleksibel yang di-assign ke Line dan User."
	endpoint="/api/master/permissions"
	searchKeys={['code', 'name']}
	columns={[
		{ key: 'code', header: 'Code' },
		{ key: 'name', header: 'Name' },
		{ key: 'isActive', header: 'Status', badge: true }
	]}
	fields={[
		{ name: 'code', label: 'Code', required: true, placeholder: 'contoh: rsw_check' },
		{ name: 'name', label: 'Name', required: true, placeholder: 'contoh: RSW Check' }
	]}
/>
