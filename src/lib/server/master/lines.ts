import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { db } from '../db/index.js';
import { lines } from '../db/schema.js';
import { parseBody, parseId } from './admin.js';
import { lineSchema } from './types.js';

export async function listLines() {
	return db.query.lines.findMany({
		with: { process: true, requiredPermission: true },
		orderBy: (l, { asc }) => [asc(l.code)]
	});
}

async function ensureProcessExists(processId: string) {
	const process = await db.query.processes.findFirst({
		where: (p, { eq }) => eq(p.id, processId)
	});
	if (!process) throw error(400, 'Process tidak ditemukan.');
	return process;
}

async function ensurePermissionExists(permissionId: string) {
	const permission = await db.query.permissions.findFirst({
		where: (p, { eq }) => eq(p.id, permissionId)
	});
	if (!permission) throw error(400, 'Permission tidak ditemukan.');
	return permission;
}

export async function createLine(body: unknown) {
	const data = parseBody(lineSchema, body);

	await ensureProcessExists(data.processId);
	await ensurePermissionExists(data.requiredPermissionId);

	const existing = await db.query.lines.findFirst({
		where: (l, { eq }) => eq(l.code, data.code)
	});
	if (existing) throw error(409, `Code "${data.code}" sudah digunakan.`);

	const [row] = await db
		.insert(lines)
		.values({
			processId: data.processId,
			code: data.code,
			name: data.name,
			requiredPermissionId: data.requiredPermissionId,
			isActive: data.isActive ?? true
		})
		.returning();
	return row;
}

export async function updateLine(id: string, body: unknown) {
	parseId(id);
	const data = parseBody(lineSchema.partial(), body);

	const existing = await db.query.lines.findFirst({
		where: (l, { eq }) => eq(l.id, id)
	});
	if (!existing) throw error(404, 'Line tidak ditemukan.');

	if (data.processId && data.processId !== existing.processId) {
		await ensureProcessExists(data.processId);
	}
	if (data.requiredPermissionId && data.requiredPermissionId !== existing.requiredPermissionId) {
		await ensurePermissionExists(data.requiredPermissionId);
	}

	if (data.code && data.code !== existing.code) {
		const code = data.code;
		const dup = await db.query.lines.findFirst({
			where: (l, { eq }) => eq(l.code, code)
		});
		if (dup) throw error(409, `Code "${data.code}" sudah digunakan.`);
	}

	const [row] = await db
		.update(lines)
		.set({ ...data, updatedAt: new Date() })
		.where(eq(lines.id, id))
		.returning();
	return row;
}
