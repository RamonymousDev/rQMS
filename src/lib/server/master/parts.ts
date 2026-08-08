import { desc, eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { db } from '../db/index.js';
import { parts } from '../db/schema.js';
import { parseBody, parseId } from './admin.js';
import { partSchema } from './types.js';

export async function listParts() {
	return db.select().from(parts).orderBy(desc(parts.createdAt));
}

export async function createPart(body: unknown) {
	const data = parseBody(partSchema, body);

	const existing = await db.query.parts.findFirst({
		where: (p, { eq }) => eq(p.partNo, data.partNo)
	});
	if (existing) throw error(409, `Part No "${data.partNo}" sudah digunakan.`);

	const [row] = await db
		.insert(parts)
		.values({ partNo: data.partNo, partName: data.partName, isActive: data.isActive ?? true })
		.returning();
	return row;
}

export async function updatePart(id: string, body: unknown) {
	parseId(id);
	const data = parseBody(partSchema.partial(), body);

	const existing = await db.query.parts.findFirst({
		where: (p, { eq }) => eq(p.id, id)
	});
	if (!existing) throw error(404, 'Part tidak ditemukan.');

	if (data.partNo && data.partNo !== existing.partNo) {
		const partNo = data.partNo;
		const dup = await db.query.parts.findFirst({
			where: (p, { eq }) => eq(p.partNo, partNo)
		});
		if (dup) throw error(409, `Part No "${data.partNo}" sudah digunakan.`);
	}

	const [row] = await db
		.update(parts)
		.set({ ...data, updatedAt: new Date() })
		.where(eq(parts.id, id))
		.returning();
	return row;
}
