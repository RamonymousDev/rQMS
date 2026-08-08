import { desc, eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { db } from '../db/index.js';
import { hardwares } from '../db/schema.js';
import { parseBody, parseId } from './admin.js';
import { hardwareSchema } from './types.js';

export async function listHardwares() {
	return db.select().from(hardwares).orderBy(desc(hardwares.createdAt));
}

export async function createHardware(body: unknown) {
	const data = parseBody(hardwareSchema, body);

	const existing = await db.query.hardwares.findFirst({
		where: (h, { eq }) => eq(h.hwNo, data.hwNo)
	});
	if (existing) throw error(409, `HW No "${data.hwNo}" sudah digunakan.`);

	const [row] = await db
		.insert(hardwares)
		.values({ hwNo: data.hwNo, hwName: data.hwName, isActive: data.isActive ?? true })
		.returning();
	return row;
}

export async function updateHardware(id: string, body: unknown) {
	parseId(id);
	const data = parseBody(hardwareSchema.partial(), body);

	const existing = await db.query.hardwares.findFirst({
		where: (h, { eq }) => eq(h.id, id)
	});
	if (!existing) throw error(404, 'Hardware tidak ditemukan.');

	if (data.hwNo && data.hwNo !== existing.hwNo) {
		const hwNo = data.hwNo;
		const dup = await db.query.hardwares.findFirst({
			where: (h, { eq }) => eq(h.hwNo, hwNo)
		});
		if (dup) throw error(409, `HW No "${data.hwNo}" sudah digunakan.`);
	}

	const [row] = await db
		.update(hardwares)
		.set({ ...data, updatedAt: new Date() })
		.where(eq(hardwares.id, id))
		.returning();
	return row;
}
