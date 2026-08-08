import { json } from '@sveltejs/kit';
import { clearSessionCookie } from '$lib/server/auth.js';
import { getSessionUser } from '$lib/server/auth.js';
import { logAction } from '$lib/server/audit.js';

export const POST = async (event) => {
	const user = await getSessionUser(event.cookies);
	clearSessionCookie(event.cookies);
	await logAction(user ?? null, {
		action: 'logout',
		entity: 'auth',
		ipAddress: event.getClientAddress()
	});
	return json({ ok: true });
};
