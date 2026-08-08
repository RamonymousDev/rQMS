<script lang="ts">
	import CrudPage from '$lib/components/admin/crud-page.svelte';
</script>

<CrudPage
	title="Part"
	description="Part bersifat global dan bisa dikonfigurasi di banyak Line."
	endpoint="/api/master/parts"
	searchKeys={['partNo', 'partName']}
	columns={[
		{ key: 'partNo', header: 'Part No' },
		{ key: 'partName', header: 'Part Name' },
		{ key: 'isActive', header: 'Status', badge: true }
	]}
	fields={[
		{ name: 'partNo', label: 'Part No', required: true, placeholder: 'contoh: 64300' },
		{ name: 'partName', label: 'Part Name', required: true, placeholder: 'contoh: Frame Body' }
	]}
/>
