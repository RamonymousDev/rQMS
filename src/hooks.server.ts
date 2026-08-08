import type { Handle } from '@sveltejs/kit';
import {
	SESSION_COOKIE,
	verifySession,
	isSessionRevoked,
	clearSessionCookie
} from '$lib/server/auth.js';

export const MAX_BODY_BYTES = 1024 * 1024;

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);

	if (token) {
		const user = await verifySession(token);
		if (user) {
			const revoked = await isSessionRevoked(user.jti);
			if (revoked) {
				clearSessionCookie(event.cookies);
			} else {
				event.locals.user = user;
			}
		}
	}

	if (event.request.method !== 'GET' && event.request.method !== 'HEAD') {
		const contentLength = event.request.headers.get('content-length');
		if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
			return new Response('Payload terlalu besar.', { status: 413 });
		}
	}

	const response = await resolve(event);

	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

	return response;
};
