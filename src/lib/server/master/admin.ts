import { error } from '@sveltejs/kit';
import type { z } from 'zod';
import type { SessionUser } from '../auth.js';
import { getUserPermissionCodes } from '../permissions.js';
import { ADMIN_PERMISSION } from '../../permissions.js';

export { ADMIN_PERMISSION };

export async function requireAdmin(user: SessionUser | null): Promise<SessionUser> {
	if (!user) throw error(401, 'Tidak terautentikasi.');

	const codes = await getUserPermissionCodes(user.id);
	if (!codes.includes(ADMIN_PERMISSION)) {
		throw error(403, 'Akses ditolak. Diperlukan permission admin_access.');
	}

	return user;
}

export function parseId(value: string): string {
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
		throw error(400, 'ID tidak valid.');
	}
	return value;
}

export function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
	const result = schema.safeParse(body);
	if (!result.success) {
		throw error(400, result.error.issues.map((i) => i.message).join('; '));
	}
	return result.data;
}
