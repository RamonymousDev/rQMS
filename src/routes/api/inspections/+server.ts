import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAdmin } from '$lib/server/master/admin.js';
import { listInspections } from '$lib/server/inspections/reports.js';

export const GET: RequestHandler = async ({ locals, url }) => {
	await requireAdmin(locals.user);
	return json({ data: await listInspections(url.searchParams) });
};
