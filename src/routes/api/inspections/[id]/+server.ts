import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAdmin } from '$lib/server/master/admin.js';
import { getInspection } from '$lib/server/inspections/reports.js';

export const GET: RequestHandler = async ({ locals, params }) => {
	await requireAdmin(locals.user);
	return json({ data: await getInspection(params.id) });
};
