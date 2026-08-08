import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { Cookies } from '@sveltejs/kit';
import { SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'crypto';
import { redis } from './redis.js';

if (!env.JWT_SECRET) throw new Error('JWT_SECRET is not set');

const secret = new TextEncoder().encode(env.JWT_SECRET);

export const SESSION_COOKIE = 'rqms_token';
const SESSION_MAX_AGE = 60 * 60 * 24;
const REVOKE_KEY_PREFIX = 'revoked_jti:';

export interface SessionUser {
	id: string;
	nik: string;
	name: string;
	jti: string;
}

type SignSessionInput = Omit<SessionUser, 'jti'>;

export async function signSession(user: SignSessionInput): Promise<string> {
	return new SignJWT({ nik: user.nik, name: user.name })
		.setProtectedHeader({ alg: 'HS256' })
		.setSubject(user.id)
		.setJti(randomUUID())
		.setIssuedAt()
		.setExpirationTime('1d')
		.sign(secret);
}

export async function verifySession(token: string): Promise<SessionUser | null> {
	try {
		const { payload } = await jwtVerify(token, secret);
		if (
			!payload.sub ||
			typeof payload.nik !== 'string' ||
			typeof payload.name !== 'string' ||
			typeof payload.jti !== 'string'
		) {
			return null;
		}
		return { id: payload.sub, nik: payload.nik, name: payload.name, jti: payload.jti };
	} catch {
		return null;
	}
}

/**
 * Masukkan jti ke Redis blacklist hingga token expired.
 * TTL disesuaikan dengan sisa waktu token agar key tidak menumpuk selamanya.
 */
export async function revokeSession(token: string): Promise<void> {
	try {
		const { payload } = await jwtVerify(token, secret);
		if (typeof payload.jti !== 'string' || typeof payload.exp !== 'number') return;
		const ttl = payload.exp - Math.floor(Date.now() / 1000);
		if (ttl <= 0) return; // sudah expired, tidak perlu di-revoke
		await redis.set(`${REVOKE_KEY_PREFIX}${payload.jti}`, '1', 'EX', ttl);
	} catch {
		// Token tidak valid — tidak perlu di-revoke
	}
}

/**
 * Cek apakah jti sudah di-revoke (ada di blacklist Redis).
 */
export async function isSessionRevoked(jti: string): Promise<boolean> {
	try {
		const val = await redis.get(`${REVOKE_KEY_PREFIX}${jti}`);
		return val !== null;
	} catch {
		// Redis error: fail-open agar app tidak down, tapi log warning
		console.warn('[auth] Redis unavailable during revocation check, allowing request through');
		return false;
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
