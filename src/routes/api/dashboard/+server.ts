import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireUser } from '$lib/server/inspections/guard.js';
import { getDashboardStats, getRecentInspections } from '$lib/server/dashboard.js';
import { enforceRateLimit } from '$lib/server/rate-limit.js';

export const GET: RequestHandler = async (event) => {
	requireUser(event.locals.user);
	await enforceRateLimit('admin', event.getClientAddress());
	const [stats, inspections] = await Promise.all([getDashboardStats(), getRecentInspections(5)]);
	return json({ data: { stats, inspections } });
};
