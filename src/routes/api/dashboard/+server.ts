import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireUser } from '$lib/server/inspections/guard.js';
import { getDashboardStats, getRecentInspections } from '$lib/server/dashboard.js';
import { enforceUserRateLimit } from '$lib/server/rate-limit.js';

export const GET: RequestHandler = async (event) => {
	const user = requireUser(event.locals.user);
	await enforceUserRateLimit('admin', user.id);
	const [stats, inspections] = await Promise.all([getDashboardStats(), getRecentInspections(5)]);
	return json({ data: { stats, inspections } });
};
