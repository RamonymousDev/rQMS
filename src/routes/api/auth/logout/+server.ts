import { json } from '@sveltejs/kit';
import { clearSessionCookie } from '$lib/server/auth.js';

export const POST = async ({ cookies }) => {
	clearSessionCookie(cookies);
	return json({ ok: true });
};
