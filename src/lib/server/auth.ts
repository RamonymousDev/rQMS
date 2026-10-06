import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { Cookies } from '@sveltejs/kit';
import { SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'crypto';
import { redis } from './redis.js';
import { db } from './db/index.js';

if (!env.JWT_SECRET) throw new Error('JWT_SECRET is not set');

const secret = new TextEncoder().encode(env.JWT_SECRET);

export const SESSION_COOKIE = 'rqms_token';
const SESSION_MAX_AGE = 60 * 60 * 24;
const REVOKE_KEY_PREFIX = 'revoked_jti:';
const USER_REVOKE_KEY_PREFIX = 'user_revoked_at:';
/** Marker revoke user hanya perlu hidup selama token masih mungkin beredar (1 hari) + buffer. */
const USER_REVOKE_TTL = 60 * 60 * 24 * 2;

export interface SessionUser {
	id: string;
	nik: string;
	name: string;
	jti: string;
	/** Waktu terbit token (detik epoch) — dasar cek revoke per-user. */
	issuedAt?: number;
}

type SignSessionInput = Omit<SessionUser, 'jti' | 'issuedAt'>;

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
		return {
			id: payload.sub,
			nik: payload.nik,
			name: payload.name,
			jti: payload.jti,
			issuedAt: payload.iat ?? 0
		};
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

/**
 * Revoke SEMUA sesi milik user (mis. setelah ganti password atau akun
 * dinonaktifkan). Bekerja dengan menandai waktu revoke; token yang diterbitkan
 * sebelum waktu itu (iat < marker) dianggap tidak valid.
 */
export async function revokeUserSessions(userId: string): Promise<void> {
	try {
		await redis.set(
			`${USER_REVOKE_KEY_PREFIX}${userId}`,
			String(Math.floor(Date.now() / 1000)),
			'EX',
			USER_REVOKE_TTL
		);
	} catch (err) {
		console.warn('[auth] Gagal menandai revoke sesi user:', err);
	}
}

/**
 * Cek apakah token user diterbitkan sebelum penandaan revoke per-user
 * (lihat `revokeUserSessions`). Fail-open saat Redis down.
 */
export async function isUserSessionRevoked(
	userId: string,
	issuedAt: number | undefined
): Promise<boolean> {
	try {
		const val = await redis.get(`${USER_REVOKE_KEY_PREFIX}${userId}`);
		if (val === null) return false;
		const revokedAt = Number(val);
		if (!Number.isFinite(revokedAt)) return false;
		return (issuedAt ?? 0) < revokedAt;
	} catch {
		console.warn('[auth] Redis unavailable during user revocation check, allowing request through');
		return false;
	}
}

/**
 * Lapisan terakhir: cek status akun langsung ke DB. Menutup celah token lama
 * hidup kembali saat marker revoke Redis hilang (restart tanpa persistence,
 * eviction). Fail-open saat DB error — halaman akan gagal render sendiri.
 */
export async function isUserActive(userId: string): Promise<boolean> {
	try {
		const row = await db.query.users.findFirst({
			where: (u, { eq }) => eq(u.id, userId),
			columns: { isActive: true }
		});
		return row?.isActive ?? false;
	} catch (err) {
		console.warn('[auth] Gagal cek status user, request dilewatkan:', err);
		return true;
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
