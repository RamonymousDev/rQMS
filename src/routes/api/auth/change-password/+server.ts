import { error } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import { users } from '$lib/server/db/schema.js';
import { hashPassword, verifyPassword } from '$lib/server/password.js';
import { getSessionUser } from '$lib/server/auth.js';

export const POST = async ({ cookies, request }) => {
	const session = await getSessionUser(cookies);
	if (!session) throw error(401, 'Belum login.');

	const body = await request.json().catch(() => null);
	if (!body || typeof body.currentPassword !== 'string' || typeof body.newPassword !== 'string') {
		throw error(400, 'Payload tidak valid.');
	}

	const row = await db.query.users.findFirst({
		where: (u, { eq }) => eq(u.id, session.id)
	});
	if (!row) throw error(404, 'User tidak ditemukan.');

	const valid = await verifyPassword(row.password, body.currentPassword);
	if (!valid) throw error(400, 'Password saat ini salah.');

	if (body.newPassword.length < 6) {
		throw error(400, 'Password baru minimal 6 karakter.');
	}

	const hashed = await hashPassword(body.newPassword);
	await db
		.update(users)
		.set({ password: hashed, updatedAt: new Date() })
		.where(eq(users.id, session.id));

	return json({ ok: true });
};
