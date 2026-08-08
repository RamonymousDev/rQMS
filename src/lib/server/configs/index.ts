import { and, asc, eq, inArray } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { db, type Transaction } from '../db/index.js';
import {
	hardwares,
	partLineConfigs,
	partLineHardwares,
	partLineLengths,
	partLinePoints
} from '../db/schema.js';
import { parseBody, parseId } from '../master/admin.js';
import { configCreateSchema, configUpdateSchema, normalizeConfig } from './types.js';

/**
 * Child selalu diurutkan sesuai sequence agar form operator konsisten.
 * Ditulis inline di tiap query karena drizzle mengetik callback `orderBy`
 * secara kontekstual — mengekstraknya ke const membuang inferensi itu.
 */
export async function listConfigs() {
	return db.query.partLineConfigs.findMany({
		with: {
			part: true,
			line: true,
			points: { orderBy: (p) => [asc(p.sequence)] },
			hardwares: { with: { hardware: true }, orderBy: (h) => [asc(h.sequence)] },
			lengths: { orderBy: (l) => [asc(l.sequence)] }
		},
		orderBy: (c, { desc }) => [desc(c.createdAt)]
	});
}

export async function getConfig(id: string) {
	parseId(id);
	const row = await db.query.partLineConfigs.findFirst({
		where: (c, { eq }) => eq(c.id, id),
		with: {
			part: true,
			line: true,
			points: { orderBy: (p) => [asc(p.sequence)] },
			hardwares: { with: { hardware: true }, orderBy: (h) => [asc(h.sequence)] },
			lengths: { orderBy: (l) => [asc(l.sequence)] }
		}
	});
	if (!row) throw error(404, 'Konfigurasi tidak ditemukan.');
	return row;
}

/**
 * Config aktif untuk kombinasi part+line, lengkap dengan child.
 * Dipakai operator saat menyiapkan form dan saat submit — jangan percaya
 * standard dari frontend, selalu ambil ulang lewat fungsi ini.
 */
export async function findActiveConfig(partId: string, lineId: string) {
	return db.query.partLineConfigs.findFirst({
		where: and(
			eq(partLineConfigs.partId, partId),
			eq(partLineConfigs.lineId, lineId),
			eq(partLineConfigs.isActive, true)
		),
		with: {
			part: true,
			line: true,
			points: { orderBy: (p) => [asc(p.sequence)] },
			hardwares: { with: { hardware: true }, orderBy: (h) => [asc(h.sequence)] },
			lengths: { orderBy: (l) => [asc(l.sequence)] }
		}
	});
}

export type ActiveConfig = NonNullable<Awaited<ReturnType<typeof findActiveConfig>>>;

async function ensurePartExists(partId: string) {
	const part = await db.query.parts.findFirst({ where: (p, { eq }) => eq(p.id, partId) });
	if (!part) throw error(400, 'Part tidak ditemukan.');
	return part;
}

async function ensureLineExists(lineId: string) {
	const line = await db.query.lines.findFirst({ where: (l, { eq }) => eq(l.id, lineId) });
	if (!line) throw error(400, 'Line tidak ditemukan.');
	return line;
}

async function ensureHardwaresExist(ids: string[]) {
	if (!ids.length) return;
	const unique = [...new Set(ids)];
	const found = await db
		.select({ id: hardwares.id })
		.from(hardwares)
		.where(inArray(hardwares.id, unique));
	if (found.length !== unique.length) {
		throw error(400, 'Terdapat hardware yang tidak valid.');
	}
}

/** Child ditulis ulang penuh (delete-then-insert) agar sequence tetap rapat. */
async function replaceChildren(
	tx: Transaction,
	configId: string,
	data: ReturnType<typeof normalizeConfig>
) {
	await tx.delete(partLinePoints).where(eq(partLinePoints.partLineConfigId, configId));
	await tx.delete(partLineHardwares).where(eq(partLineHardwares.partLineConfigId, configId));
	await tx.delete(partLineLengths).where(eq(partLineLengths.partLineConfigId, configId));

	if (data.points.length) {
		await tx
			.insert(partLinePoints)
			.values(data.points.map((p) => ({ ...p, partLineConfigId: configId })));
	}
	if (data.hardwares.length) {
		await tx
			.insert(partLineHardwares)
			.values(data.hardwares.map((h) => ({ ...h, partLineConfigId: configId })));
	}
	if (data.lengths.length) {
		await tx
			.insert(partLineLengths)
			.values(data.lengths.map((l) => ({ ...l, partLineConfigId: configId })));
	}
}

export async function createConfig(body: unknown) {
	const data = parseBody(configCreateSchema, body);
	const normalized = normalizeConfig(data);

	await ensurePartExists(data.partId);
	await ensureLineExists(data.lineId);
	await ensureHardwaresExist(normalized.hardwares.map((h) => h.hardwareId));

	const existing = await db.query.partLineConfigs.findFirst({
		where: (c, { eq, and }) => and(eq(c.partId, data.partId), eq(c.lineId, data.lineId))
	});
	if (existing) throw error(409, 'Kombinasi Part + Line ini sudah dikonfigurasi.');

	const id = await db.transaction(async (tx) => {
		const [row] = await tx
			.insert(partLineConfigs)
			.values({
				partId: data.partId,
				lineId: data.lineId,
				hasSpot: normalized.hasSpot,
				spotStandard: normalized.spotStandard,
				hasPoint: normalized.hasPoint,
				hasHardware: normalized.hasHardware,
				hasLength: normalized.hasLength,
				hasVisual: normalized.hasVisual,
				isActive: normalized.isActive ?? true
			})
			.returning({ id: partLineConfigs.id });

		await replaceChildren(tx, row.id, normalized);
		return row.id;
	});

	return getConfig(id);
}

/** Toggle aktif dari tabel list hanya mengirim `{ isActive }`, tanpa detail. */
function isActiveOnlyPayload(body: unknown): body is { isActive: boolean } {
	if (typeof body !== 'object' || body === null) return false;
	const keys = Object.keys(body);
	return (
		keys.length === 1 &&
		keys[0] === 'isActive' &&
		typeof Reflect.get(body, 'isActive') === 'boolean'
	);
}

export async function updateConfig(id: string, body: unknown) {
	parseId(id);

	const existing = await db.query.partLineConfigs.findFirst({
		where: (c, { eq }) => eq(c.id, id)
	});
	if (!existing) throw error(404, 'Konfigurasi tidak ditemukan.');

	if (isActiveOnlyPayload(body)) {
		await db
			.update(partLineConfigs)
			.set({ isActive: body.isActive, updatedAt: new Date() })
			.where(eq(partLineConfigs.id, id));
		return getConfig(id);
	}

	const data = parseBody(configUpdateSchema, body);
	const normalized = normalizeConfig(data);
	await ensureHardwaresExist(normalized.hardwares.map((h) => h.hardwareId));

	await db.transaction(async (tx) => {
		await tx
			.update(partLineConfigs)
			.set({
				hasSpot: normalized.hasSpot,
				spotStandard: normalized.spotStandard,
				hasPoint: normalized.hasPoint,
				hasHardware: normalized.hasHardware,
				hasLength: normalized.hasLength,
				hasVisual: normalized.hasVisual,
				isActive: normalized.isActive ?? existing.isActive,
				updatedAt: new Date()
			})
			.where(eq(partLineConfigs.id, id));

		await replaceChildren(tx, id, normalized);
	});

	return getConfig(id);
}
