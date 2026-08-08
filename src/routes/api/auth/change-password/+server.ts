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
import { getSessionUser } from '$lib/server/auth.js';
import { enforceRateLimit } from '$lib/server/rate-limit.js';

export const POST = async (event) => {
	const session = await getSessionUser(event.cookies);
	if (!session) throw error(401, 'Belum login.');

	await enforceRateLimit('admin', event.getClientAddress());

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

	return json({ ok: true });
};
