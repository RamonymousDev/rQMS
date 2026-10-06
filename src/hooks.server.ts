import type { Handle } from '@sveltejs/kit';
import {
	SESSION_COOKIE,
	verifySession,
	isSessionRevoked,
	isUserSessionRevoked,
	isUserActive,
	clearSessionCookie
} from '$lib/server/auth.js';

export const MAX_BODY_BYTES = 1024 * 1024;

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);

	if (token) {
		const user = await verifySession(token);
		if (user) {
			// Tiga lapis: blacklist per-token (logout), revoke per-user (password
			// diganti / NIK berubah), dan status isActive langsung dari DB agar
			// akun nonaktif tidak bisa memakai token lama kalau marker Redis hilang.
			const [revokedToken, revokedUser, active] = await Promise.all([
				isSessionRevoked(user.jti),
				isUserSessionRevoked(user.id, user.issuedAt),
				isUserActive(user.id)
			]);
			if (revokedToken || revokedUser || !active) {
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
	response.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');

	return response;
};
