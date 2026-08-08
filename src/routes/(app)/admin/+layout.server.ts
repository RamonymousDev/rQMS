import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types.js';
import { getUserPermissionCodes } from '$lib/server/permissions.js';
import { ADMIN_PERMISSION } from '$lib/server/master/admin.js';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(302, '/login');
	}

	const codes = await getUserPermissionCodes(locals.user.id);
	if (!codes.includes(ADMIN_PERMISSION)) {
		redirect(302, '/dashboard');
	}

	return {};
};
