import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAdmin } from '$lib/server/master/admin.js';
import { createConfig, listConfigs } from '$lib/server/configs/index.js';
import { enforceRateLimit } from '$lib/server/rate-limit.js';
import { logAction } from '$lib/server/audit.js';

export const GET: RequestHandler = async (event) => {
	await requireAdmin(event.locals.user);
	await enforceRateLimit('admin', event.getClientAddress());
	return json({ data: await listConfigs() });
};

export const POST: RequestHandler = async (event) => {
	await requireAdmin(event.locals.user);
	await enforceRateLimit('admin', event.getClientAddress());
	const data = await createConfig(await event.request.json());
	await logAction(event.locals.user, {
		action: 'create_config',
		entity: 'configs',
		metadata: data
	});
	return json({ data }, { status: 201 });
};
