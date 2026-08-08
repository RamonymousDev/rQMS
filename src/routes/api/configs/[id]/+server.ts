import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAdmin } from '$lib/server/master/admin.js';
import { getConfig, updateConfig } from '$lib/server/configs/index.js';

export const GET: RequestHandler = async ({ locals, params }) => {
	await requireAdmin(locals.user);
	return json({ data: await getConfig(params.id) });
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	await requireAdmin(locals.user);
	return json({ data: await updateConfig(params.id, await request.json()) });
};
