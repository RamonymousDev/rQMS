import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAdmin } from '$lib/server/master/admin.js';
import { getConfig, updateConfig } from '$lib/server/configs/index.js';
import { enforceUserRateLimit } from '$lib/server/rate-limit.js';
import { logAction } from '$lib/server/audit.js';

export const GET: RequestHandler = async (event) => {
	const user = await requireAdmin(event.locals.user);
	await enforceUserRateLimit('admin', user.id);
	return json({ data: await getConfig(event.params.id) });
};

export const PATCH: RequestHandler = async (event) => {
	const user = await requireAdmin(event.locals.user);
	await enforceUserRateLimit('admin', user.id);
	const body = await event.request.json();
	const data = await updateConfig(event.params.id, body);
	await logAction(event.locals.user, {
		action: 'update_config',
		entity: 'configs',
		entityId: event.params.id,
		metadata: body
	});
	return json({ data });
};
