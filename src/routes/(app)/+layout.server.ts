import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types.js';
import { getUserPermissionCodes } from '$lib/server/permissions.js';
import { countNgInspections } from '$lib/server/inspections/reports.js';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(302, '/login');
	}

	const permissionCodes = await getUserPermissionCodes(locals.user.id);
	const ngInspectionCount = permissionCodes.includes('admin_access')
		? await countNgInspections()
		: 0;

	return {
		user: locals.user,
		permissionCodes,
		ngInspectionCount
	};
};
