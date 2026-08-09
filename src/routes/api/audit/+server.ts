import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAdmin } from '$lib/server/master/admin.js';
import { listAuditLogs } from '$lib/server/audit.js';
import { enforceRateLimit } from '$lib/server/rate-limit.js';

export const GET: RequestHandler = async (event) => {
	await requireAdmin(event.locals.user);
	await enforceRateLimit('admin', event.getClientAddress());
	return json({ data: await listAuditLogs(event.url.searchParams) });
};
