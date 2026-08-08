import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAdmin } from '$lib/server/master/admin.js';
import { masterServices } from '$lib/server/master/index.js';
import { enforceRateLimit } from '$lib/server/rate-limit.js';
import { logAction } from '$lib/server/audit.js';

function getService(entity: string) {
	const svc = masterServices[entity];
	if (!svc) throw error(404, 'Entitas tidak dikenal.');
	return svc;
}

export const PATCH: RequestHandler = async (event) => {
	await requireAdmin(event.locals.user);
	await enforceRateLimit('admin', event.getClientAddress());
	const body = await event.request.json();
	const data = await getService(event.params.entity).update(event.params.id, body);
	await logAction(event.locals.user, {
		action: `update_${event.params.entity}`,
		entity: event.params.entity,
		entityId: event.params.id,
		metadata: body
	});
	return json({ data });
};
