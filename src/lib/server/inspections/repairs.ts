import { and, eq, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { db, type Transaction } from '../db/index.js';
import {
	inspectionHardwares,
	inspectionLengths,
	inspectionPoints,
	inspectionRepairs,
	inspections
} from '../db/schema.js';
import type { SessionUser } from '../auth.js';
import { parseBody, parseId } from '../master/admin.js';

/**
 * Status item & overall. Operator hanya menghasilkan OK/NG; REPAIR hanya bisa
 * diset admin lewat flow repair (wajib action).
 */
export type ItemStatus = 'OK' | 'NG' | 'REPAIR';

export const REPAIR_ITEM_TYPES = ['POINT', 'HARDWARE', 'LENGTH', 'SPOT', 'VISUAL'] as const;
export type RepairItemType = (typeof REPAIR_ITEM_TYPES)[number];

const itemTypeSchema = z.enum(REPAIR_ITEM_TYPES, { message: 'Tipe item repair tidak valid.' });

export const repairSchema = z.object({
	itemType: itemTypeSchema,
	/** Wajib untuk POINT/HARDWARE/LENGTH; SPOT/VISUAL tidak punya baris child. */
	itemId: z.uuid('Item tidak valid').nullable().optional(),
	action: z.string().trim().min(1, 'Action wajib diisi').max(500, 'Action maksimal 500 karakter')
});

export const revertSchema = z.object({
	itemType: itemTypeSchema,
	itemId: z.uuid('Item tidak valid').nullable().optional()
});

/** ItemId hanya relevan untuk baris child; SPOT & VISUAL selalu null. */
function normalizeItemId(
	itemType: RepairItemType,
	itemId: string | null | undefined
): string | null {
	const needsId = itemType === 'POINT' || itemType === 'HARDWARE' || itemType === 'LENGTH';
	if (needsId) {
		if (!itemId) throw error(400, `Item id wajib untuk tipe ${itemType}.`);
		return itemId;
	}
	return null;
}

/**
 * Status item saat ini.
 * - `undefined` = baris inspeksi/item tidak ditemukan (invalid request)
 * - `null` = item ada tapi belum punya status (inspeksi lama, mis. spot pra-fitur)
 */
async function currentItemStatus(
	tx: Transaction,
	inspectionId: string,
	itemType: RepairItemType,
	itemId: string | null
): Promise<ItemStatus | null | undefined> {
	switch (itemType) {
		case 'POINT': {
			const row = await tx.query.inspectionPoints.findFirst({
				where: and(
					eq(inspectionPoints.id, itemId as string),
					eq(inspectionPoints.inspectionId, inspectionId)
				),
				columns: { status: true }
			});
			return row ? row.status : undefined;
		}
		case 'HARDWARE': {
			const row = await tx.query.inspectionHardwares.findFirst({
				where: and(
					eq(inspectionHardwares.id, itemId as string),
					eq(inspectionHardwares.inspectionId, inspectionId)
				),
				columns: { status: true }
			});
			return row ? row.status : undefined;
		}
		case 'LENGTH': {
			const row = await tx.query.inspectionLengths.findFirst({
				where: and(
					eq(inspectionLengths.id, itemId as string),
					eq(inspectionLengths.inspectionId, inspectionId)
				),
				columns: { status: true }
			});
			return row ? row.status : undefined;
		}
		case 'SPOT': {
			const row = await tx.query.inspections.findFirst({
				where: eq(inspections.id, inspectionId),
				columns: { spotStatus: true }
			});
			return row ? row.spotStatus : undefined;
		}
		case 'VISUAL': {
			const row = await tx.query.inspections.findFirst({
				where: eq(inspections.id, inspectionId),
				columns: { visualStatus: true }
			});
			return row ? row.visualStatus : undefined;
		}
	}
}

/**
 * Transisi status item secara atomik `from` → `to`.
 * Return false kalau tidak ada baris yang cocok (item tidak ada / status beda),
 * sehingga dua admin yang klik bersamaan tidak bisa double-repair.
 */
async function transitionItemStatus(
	tx: Transaction,
	inspectionId: string,
	itemType: RepairItemType,
	itemId: string | null,
	from: ItemStatus,
	to: ItemStatus
): Promise<boolean> {
	switch (itemType) {
		case 'POINT': {
			const rows = await tx
				.update(inspectionPoints)
				.set({ status: to })
				.where(
					and(
						eq(inspectionPoints.id, itemId as string),
						eq(inspectionPoints.inspectionId, inspectionId),
						eq(inspectionPoints.status, from)
					)
				)
				.returning({ id: inspectionPoints.id });
			return rows.length > 0;
		}
		case 'HARDWARE': {
			const rows = await tx
				.update(inspectionHardwares)
				.set({ status: to })
				.where(
					and(
						eq(inspectionHardwares.id, itemId as string),
						eq(inspectionHardwares.inspectionId, inspectionId),
						eq(inspectionHardwares.status, from)
					)
				)
				.returning({ id: inspectionHardwares.id });
			return rows.length > 0;
		}
		case 'LENGTH': {
			const rows = await tx
				.update(inspectionLengths)
				.set({ status: to })
				.where(
					and(
						eq(inspectionLengths.id, itemId as string),
						eq(inspectionLengths.inspectionId, inspectionId),
						eq(inspectionLengths.status, from)
					)
				)
				.returning({ id: inspectionLengths.id });
			return rows.length > 0;
		}
		case 'SPOT': {
			const rows = await tx
				.update(inspections)
				.set({ spotStatus: to })
				.where(and(eq(inspections.id, inspectionId), eq(inspections.spotStatus, from)))
				.returning({ id: inspections.id });
			return rows.length > 0;
		}
		case 'VISUAL': {
			const rows = await tx
				.update(inspections)
				.set({ visualStatus: to })
				.where(and(eq(inspections.id, inspectionId), eq(inspections.visualStatus, from)))
				.returning({ id: inspections.id });
			return rows.length > 0;
		}
	}
}

/**
 * Overall = NG kalau masih ada item NG; REPAIR kalau sisanya sudah di-repair;
 * OK kalau semuanya OK. Karena itu "sudah di-repair semua" tidak lagi dihitung NG
 * di badge sidebar / dashboard / board.
 */
async function recomputeOverallStatus(tx: Transaction, inspectionId: string): Promise<ItemStatus> {
	const row = await tx.query.inspections.findFirst({
		where: eq(inspections.id, inspectionId),
		columns: { spotStatus: true, visualStatus: true },
		with: {
			points: { columns: { status: true } },
			hardwares: { columns: { status: true } },
			lengths: { columns: { status: true } }
		}
	});
	if (!row) throw error(404, 'Inspeksi tidak ditemukan.');

	const statuses: ItemStatus[] = [
		...row.points.map((p) => p.status),
		...row.hardwares.map((h) => h.status),
		...row.lengths.map((l) => l.status)
	];
	if (row.spotStatus) statuses.push(row.spotStatus);
	if (row.visualStatus) statuses.push(row.visualStatus);

	if (statuses.includes('NG')) return 'NG';
	if (statuses.includes('REPAIR')) return 'REPAIR';
	return 'OK';
}

/** Admin menandai item NG sebagai REPAIR + action wajib. Item OK tidak bisa diubah. */
export async function repairInspectionItem(user: SessionUser, inspectionId: string, body: unknown) {
	parseId(inspectionId);
	const data = parseBody(repairSchema, body);
	const itemId = normalizeItemId(data.itemType, data.itemId);

	return db.transaction(async (tx) => {
		const moved = await transitionItemStatus(
			tx,
			inspectionId,
			data.itemType,
			itemId,
			'NG',
			'REPAIR'
		);
		if (!moved) {
			const current = await currentItemStatus(tx, inspectionId, data.itemType, itemId);
			if (current === undefined) throw error(404, 'Item inspeksi tidak ditemukan.');
			if (current === null) {
				throw error(409, 'Item ini tidak punya status inspeksi (data lama).');
			}
			throw error(409, `Item berstatus ${current} — hanya item NG yang bisa di-repair.`);
		}

		const [repair] = await tx
			.insert(inspectionRepairs)
			.values({
				inspectionId,
				itemType: data.itemType,
				itemId,
				action: data.action,
				actorId: user.id,
				actorName: user.name
			})
			.returning();

		const overallStatus = await recomputeOverallStatus(tx, inspectionId);
		await tx.update(inspections).set({ overallStatus }).where(eq(inspections.id, inspectionId));

		return { repair, overallStatus };
	});
}

/** Batalkan repair: status kembali NG, baris repair ditandai `revertedAt` (histori tetap utuh). */
export async function revertInspectionRepair(inspectionId: string, body: unknown) {
	parseId(inspectionId);
	const data = parseBody(revertSchema, body);
	const itemId = normalizeItemId(data.itemType, data.itemId);

	return db.transaction(async (tx) => {
		const moved = await transitionItemStatus(
			tx,
			inspectionId,
			data.itemType,
			itemId,
			'REPAIR',
			'NG'
		);
		if (!moved) {
			const current = await currentItemStatus(tx, inspectionId, data.itemType, itemId);
			if (current === undefined) throw error(404, 'Item inspeksi tidak ditemukan.');
			if (current === null) {
				throw error(409, 'Item ini tidak punya status inspeksi (data lama).');
			}
			throw error(409, `Item berstatus ${current} — hanya item REPAIR yang bisa dibatalkan.`);
		}

		const reverted = await tx
			.update(inspectionRepairs)
			.set({ revertedAt: new Date() })
			.where(
				and(
					eq(inspectionRepairs.inspectionId, inspectionId),
					eq(inspectionRepairs.itemType, data.itemType),
					itemId === null ? isNull(inspectionRepairs.itemId) : eq(inspectionRepairs.itemId, itemId),
					isNull(inspectionRepairs.revertedAt)
				)
			)
			.returning({ id: inspectionRepairs.id });
		if (!reverted.length) throw error(409, 'Data repair aktif tidak ditemukan.');

		const overallStatus = await recomputeOverallStatus(tx, inspectionId);
		await tx.update(inspections).set({ overallStatus }).where(eq(inspections.id, inspectionId));

		return { overallStatus };
	});
}
