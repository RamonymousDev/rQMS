import { error } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import { users } from '$lib/server/db/schema.js';
import {
	hashPassword,
	verifyPassword,
	validatePasswordStrength,
	isPasswordReused
} from '$lib/server/password.js';
import {
	getSessionUser,
	revokeUserSessions,
	setSessionCookie,
	signSession
} from '$lib/server/auth.js';
import { enforceUserRateLimit } from '$lib/server/rate-limit.js';

export const POST = async (event) => {
	const session = await getSessionUser(event.cookies);
	if (!session) throw error(401, 'Belum login.');

	await enforceUserRateLimit('admin', session.id);

	const body = await event.request.json().catch(() => null);
	if (!body || typeof body.currentPassword !== 'string' || typeof body.newPassword !== 'string') {
		throw error(400, 'Payload tidak valid.');
	}

	const row = await db.query.users.findFirst({
		where: (u, { eq }) => eq(u.id, session.id)
	});
	if (!row) throw error(404, 'User tidak ditemukan.');

	const valid = await verifyPassword(row.password, body.currentPassword);
	if (!valid) throw error(400, 'Password saat ini salah.');

	const strength = validatePasswordStrength(body.newPassword);
	if (!strength.valid) {
		throw error(400, strength.message);
	}

	const reused = await isPasswordReused(body.newPassword, row.passwordHistory ?? []);
	if (reused) {
		throw error(400, 'Password baru tidak boleh sama dengan 5 password sebelumnya.');
	}

	const hashed = await hashPassword(body.newPassword);
	const history = [...(row.passwordHistory ?? []), hashed].slice(-5);

	await db
		.update(users)
		.set({ password: hashed, passwordHistory: history, updatedAt: new Date() })
		.where(eq(users.id, session.id));

	// Password berubah → semua sesi lama (termasuk perangkat lain) tidak valid
	// lagi. Terbitkan ulang token untuk perangkat ini agar user tidak ter-logout
	// dari sesi yang sedang dipakai.
	await revokeUserSessions(session.id);
	const token = await signSession({ id: session.id, nik: session.nik, name: session.name });
	setSessionCookie(event.cookies, token);

	return json({ ok: true });
};
