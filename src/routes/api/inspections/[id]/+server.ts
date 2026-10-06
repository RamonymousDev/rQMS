import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAdmin } from '$lib/server/master/admin.js';
import { getInspection } from '$lib/server/inspections/reports.js';
import { enforceUserRateLimit } from '$lib/server/rate-limit.js';

export const GET: RequestHandler = async (event) => {
	const user = await requireAdmin(event.locals.user);
	await enforceUserRateLimit('admin', user.id);
	return json({ data: await getInspection(event.params.id) });
};
