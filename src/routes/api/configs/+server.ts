import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAdmin } from '$lib/server/master/admin.js';
import { createConfig, listConfigs } from '$lib/server/configs/index.js';

export const GET: RequestHandler = async ({ locals }) => {
	await requireAdmin(locals.user);
	return json({ data: await listConfigs() });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	await requireAdmin(locals.user);
	return json({ data: await createConfig(await request.json()) }, { status: 201 });
};
