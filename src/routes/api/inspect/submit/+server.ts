import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireUser } from '$lib/server/inspections/guard.js';
import { submitInspection } from '$lib/server/inspections/index.js';

export const POST: RequestHandler = async ({ locals, request }) => {
	const user = requireUser(locals.user);
	return json({ data: await submitInspection(user, await request.json()) }, { status: 201 });
};
