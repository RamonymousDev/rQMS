<script lang="ts">
	import CrudPage from '$lib/components/admin/crud-page.svelte';
</script>

<CrudPage
	title="Process"
	description="Kelompok proses produksi seperti Welding, Stamping, Painting."
	endpoint="/api/master/processes"
	searchKeys={['name']}
	columns={[
		{ key: 'name', header: 'Name' },
		{ key: 'isActive', header: 'Status', badge: true }
	]}
	fields={[{ name: 'name', label: 'Name', required: true, placeholder: 'contoh: Welding' }]}
/>
