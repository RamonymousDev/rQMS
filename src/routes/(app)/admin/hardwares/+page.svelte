<script lang="ts">
	import CrudPage from '$lib/components/admin/crud-page.svelte';
</script>

<CrudPage
	title="Hardware"
	description="Hanya identitas hardware. Standard ditentukan di konfigurasi Part + Line."
	endpoint="/api/master/hardwares"
	searchKeys={['hwNo', 'hwName']}
	columns={[
		{ key: 'hwNo', header: 'HW No' },
		{ key: 'hwName', header: 'HW Name' },
		{ key: 'isActive', header: 'Status', badge: true }
	]}
	fields={[
		{ name: 'hwNo', label: 'HW No', required: true, placeholder: 'contoh: 12911' },
		{ name: 'hwName', label: 'HW Name', required: true, placeholder: 'contoh: Bolt M8 Torque' }
	]}
/>
