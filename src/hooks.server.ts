import type { Handle } from '@sveltejs/kit';
import { SESSION_COOKIE, verifySession } from '$lib/server/auth.js';

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);

	if (token) {
		const user = await verifySession(token);
		if (user) {
			event.locals.user = user;
		}
	}

	return resolve(event);
};
