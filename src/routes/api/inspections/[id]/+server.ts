import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAdmin } from '$lib/server/master/admin.js';
import { getInspection } from '$lib/server/inspections/reports.js';
import { enforceRateLimit } from '$lib/server/rate-limit.js';

export const GET: RequestHandler = async (event) => {
	await requireAdmin(event.locals.user);
	await enforceRateLimit('admin', event.getClientAddress());
	return json({ data: await getInspection(event.params.id) });
};
