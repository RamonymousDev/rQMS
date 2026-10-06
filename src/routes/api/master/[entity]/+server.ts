import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAdmin } from '$lib/server/master/admin.js';
import { masterServices } from '$lib/server/master/index.js';
import { enforceUserRateLimit } from '$lib/server/rate-limit.js';
import { logAction } from '$lib/server/audit.js';

function getService(entity: string) {
	const svc = masterServices[entity];
	if (!svc) throw error(404, 'Entitas tidak dikenal.');
	return svc;
}

export const GET: RequestHandler = async (event) => {
	const user = await requireAdmin(event.locals.user);
	await enforceUserRateLimit('admin', user.id);
	return json({ data: await getService(event.params.entity).list() });
};

export const POST: RequestHandler = async (event) => {
	const user = await requireAdmin(event.locals.user);
	await enforceUserRateLimit('admin', user.id);
	const body = await event.request.json();
	const data = await getService(event.params.entity).create(body);
	await logAction(event.locals.user, {
		action: `create_${event.params.entity}`,
		entity: event.params.entity,
		metadata: body
	});
	return json({ data }, { status: 201 });
};
