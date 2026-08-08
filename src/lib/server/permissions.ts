import { and, eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { permissions, userPermissions } from './db/schema.js';

export async function getUserWithPermissions(nik: string) {
	const user = await db.query.users.findFirst({
		where: (u, { eq }) => eq(u.nik, nik),
		with: {
			userPermissions: {
				with: { permission: true }
			}
		}
	});

	if (!user) return null;

	return {
		id: user.id,
		nik: user.nik,
		name: user.name,
		password: user.password,
		isActive: user.isActive,
		permissions: user.userPermissions.map((up) => up.permission)
	};
}

export async function getUserPermissionIds(userId: string): Promise<string[]> {
	const rows = await db
		.select({ id: permissions.id })
		.from(userPermissions)
		.innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
		.where(and(eq(userPermissions.userId, userId), eq(permissions.isActive, true)));

	return rows.map((row) => row.id);
}

export async function getUserPermissionCodes(userId: string): Promise<string[]> {
	const rows = await db
		.select({ code: permissions.code })
		.from(userPermissions)
		.innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
		.where(and(eq(userPermissions.userId, userId), eq(permissions.isActive, true)));

	return rows.map((row) => row.code);
}
