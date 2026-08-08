import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { Cookies } from '@sveltejs/kit';
import { SignJWT, jwtVerify } from 'jose';

if (!env.JWT_SECRET) throw new Error('JWT_SECRET is not set');

const secret = new TextEncoder().encode(env.JWT_SECRET);

export const SESSION_COOKIE = 'rqms_token';
const SESSION_MAX_AGE = 60 * 60 * 24;

export interface SessionUser {
	id: string;
	nik: string;
	name: string;
}

export async function signSession(user: SessionUser): Promise<string> {
	return new SignJWT({ nik: user.nik, name: user.name })
		.setProtectedHeader({ alg: 'HS256' })
		.setSubject(user.id)
		.setIssuedAt()
		.setExpirationTime('1d')
		.sign(secret);
}

export async function verifySession(token: string): Promise<SessionUser | null> {
	try {
		const { payload } = await jwtVerify(token, secret);
		if (!payload.sub || typeof payload.nik !== 'string' || typeof payload.name !== 'string') {
			return null;
		}
		return { id: payload.sub, nik: payload.nik, name: payload.name };
	} catch {
		return null;
	}
}

export function setSessionCookie(cookies: Cookies, token: string): void {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: SESSION_MAX_AGE
	});
}

export function clearSessionCookie(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

export async function getSessionUser(cookies: Cookies): Promise<SessionUser | null> {
	const token = cookies.get(SESSION_COOKIE);
	if (!token) return null;
	return verifySession(token);
}
