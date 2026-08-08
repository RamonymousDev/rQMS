import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = ({ locals }) => {
	redirect(303, locals.user ? '/dashboard' : '/login');
};
