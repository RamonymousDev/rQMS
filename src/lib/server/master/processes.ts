import { desc, eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { db } from '../db/index.js';
import { processes } from '../db/schema.js';
import { parseBody, parseId } from './admin.js';
import { processSchema } from './types.js';

export async function listProcesses() {
	return db.select().from(processes).orderBy(desc(processes.createdAt));
}

export async function createProcess(body: unknown) {
	const data = parseBody(processSchema, body);

	const existing = await db.query.processes.findFirst({
		where: eq(processes.name, data.name)
	});
	if (existing) throw error(409, `Process "${data.name}" sudah ada.`);

	const [row] = await db
		.insert(processes)
		.values({ name: data.name, isActive: data.isActive ?? true })
		.returning();
	return row;
}

export async function updateProcess(id: string, body: unknown) {
	parseId(id);
	const data = parseBody(processSchema.partial(), body);

	const existing = await db.query.processes.findFirst({
		where: (p, { eq }) => eq(p.id, id)
	});
	if (!existing) throw error(404, 'Process tidak ditemukan.');

	if (data.name && data.name !== existing.name) {
		const name = data.name;
		const dup = await db.query.processes.findFirst({
			where: (p, { eq }) => eq(p.name, name)
		});
		if (dup) throw error(409, `Process "${data.name}" sudah ada.`);
	}

	const [row] = await db
		.update(processes)
		.set({ ...data, updatedAt: new Date() })
		.where(eq(processes.id, id))
		.returning();
	return row;
}
