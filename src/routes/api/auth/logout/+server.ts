import { json } from '@sveltejs/kit';
import { SESSION_COOKIE, clearSessionCookie, revokeSession } from '$lib/server/auth.js';
import { getSessionUser } from '$lib/server/auth.js';
import { logAction } from '$lib/server/audit.js';

export const POST = async (event) => {
	const token = event.cookies.get(SESSION_COOKIE);
	const user = await getSessionUser(event.cookies);

	if (token) {
		await revokeSession(token);
	}

	clearSessionCookie(event.cookies);

	await logAction(user ?? null, {
		action: 'logout',
		entity: 'auth',
		ipAddress: event.getClientAddress()
	});

	return json({ ok: true });
};
