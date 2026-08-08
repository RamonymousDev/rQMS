import { desc, eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { db } from '../db/index.js';
import { permissions } from '../db/schema.js';
import { parseBody, parseId } from './admin.js';
import { permissionSchema } from './types.js';

export async function listPermissions() {
	return db.select().from(permissions).orderBy(desc(permissions.createdAt));
}

export async function createPermission(body: unknown) {
	const data = parseBody(permissionSchema, body);

	const existing = await db.query.permissions.findFirst({
		where: eq(permissions.code, data.code)
	});
	if (existing) throw error(409, `Code "${data.code}" sudah digunakan.`);

	const [row] = await db
		.insert(permissions)
		.values({ code: data.code, name: data.name, isActive: data.isActive ?? true })
		.returning();
	return row;
}

export async function updatePermission(id: string, body: unknown) {
	parseId(id);
	const data = parseBody(permissionSchema.partial(), body);

	const existing = await db.query.permissions.findFirst({
		where: eq(permissions.id, id)
	});
	if (!existing) throw error(404, 'Permission tidak ditemukan.');

	if (data.code && data.code !== existing.code) {
		const dup = await db.query.permissions.findFirst({
			where: eq(permissions.code, data.code)
		});
		if (dup) throw error(409, `Code "${data.code}" sudah digunakan.`);
	}

	const [row] = await db
		.update(permissions)
		.set({ ...data, updatedAt: new Date() })
		.where(eq(permissions.id, id))
		.returning();
	return row;
}
