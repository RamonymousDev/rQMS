import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireUser } from '$lib/server/inspections/guard.js';
import { listAccessibleLines } from '$lib/server/inspections/index.js';

export const GET: RequestHandler = async ({ locals }) => {
	const user = requireUser(locals.user);
	return json({ data: await listAccessibleLines(user) });
};
