import { eq, inArray } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { db } from '../db/index.js';
import { permissions, users, userPermissions } from '../db/schema.js';
import { hashPassword } from '../password.js';
import { parseBody, parseId } from './admin.js';
import { userSchema, userUpdateSchema } from './types.js';

export async function listUsers() {
	const rows = await db.query.users.findMany({
		with: { userPermissions: { with: { permission: true } } },
		orderBy: (u, { asc }) => [asc(u.nik)]
	});

	return rows.map((u) => ({
		...u,
		permissions: u.userPermissions.map((up) => up.permission)
	}));
}

async function validatePermissionIds(ids: string[]): Promise<string[]> {
	const unique = [...new Set(ids)];
	if (!unique.length) return [];

	const found = await db
		.select({ id: permissions.id })
		.from(permissions)
		.where(inArray(permissions.id, unique));

	if (found.length !== unique.length) {
		throw error(400, 'Terdapat permission yang tidak valid.');
	}
	return unique;
}

export async function createUser(body: unknown) {
	const data = parseBody(userSchema, body);

	const existing = await db.query.users.findFirst({
		where: (u, { eq }) => eq(u.nik, data.nik)
	});
	if (existing) throw error(409, `NIK "${data.nik}" sudah digunakan.`);

	const permissionIds = await validatePermissionIds(data.permissionIds);
	const password = await hashPassword(data.password);

	return db.transaction(async (tx) => {
		const [row] = await tx
			.insert(users)
			.values({ nik: data.nik, name: data.name, password, isActive: data.isActive ?? true })
			.returning();

		if (permissionIds.length) {
			await tx
				.insert(userPermissions)
				.values(permissionIds.map((permissionId) => ({ userId: row.id, permissionId })));
		}
		return row;
	});
}

export async function updateUser(id: string, body: unknown) {
	parseId(id);
	const data = parseBody(userUpdateSchema, body);

	const existing = await db.query.users.findFirst({
		where: (u, { eq }) => eq(u.id, id)
	});
	if (!existing) throw error(404, 'User tidak ditemukan.');

	if (data.nik && data.nik !== existing.nik) {
		const nik = data.nik;
		const dup = await db.query.users.findFirst({
			where: (u, { eq }) => eq(u.nik, nik)
		});
		if (dup) throw error(409, `NIK "${data.nik}" sudah digunakan.`);
	}

	const permissionIds = data.permissionIds
		? await validatePermissionIds(data.permissionIds)
		: undefined;

	return db.transaction(async (tx) => {
		const values: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
		if (data.nik !== undefined) values.nik = data.nik;
		if (data.name !== undefined) values.name = data.name;
		if (data.isActive !== undefined) values.isActive = data.isActive;
		if (data.password) values.password = await hashPassword(data.password);

		const [row] = await tx.update(users).set(values).where(eq(users.id, id)).returning();

		if (permissionIds) {
			await tx.delete(userPermissions).where(eq(userPermissions.userId, id));
			if (permissionIds.length) {
				await tx
					.insert(userPermissions)
					.values(permissionIds.map((permissionId) => ({ userId: id, permissionId })));
			}
		}
		return row;
	});
}
