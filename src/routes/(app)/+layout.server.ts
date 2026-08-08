import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types.js';
import { getUserPermissionCodes } from '$lib/server/permissions.js';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(302, '/login');
	}

	return {
		user: locals.user,
		permissionCodes: await getUserPermissionCodes(locals.user.id)
	};
};
