import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAdmin } from '$lib/server/master/admin.js';
import { masterServices } from '$lib/server/master/index.js';

function getService(entity: string) {
	const svc = masterServices[entity];
	if (!svc) throw error(404, 'Entitas tidak dikenal.');
	return svc;
}

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	await requireAdmin(locals.user);
	const body = await request.json();
	return json({ data: await getService(params.entity).update(params.id, body) });
};
