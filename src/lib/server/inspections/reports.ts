import { and, asc, count, desc, eq, gte, lt, type SQL } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { db } from '../db/index.js';
import { inspections } from '../db/schema.js';
import { parseId } from '../master/admin.js';
import { getOperationalDayRange } from '../shift.js';
import { STAGES } from './types.js';

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 1) return fallback;
	return Math.min(parsed, max);
}

/**
 * Filter monitoring. Tanggal diperlakukan sebagai tanggal *operasional*
 * (07:30 WIB → 07:30 WIB keesokan harinya), lalu dikonversi ke rentang instant
 * UTC agar cocok dengan timestamptz. Konsisten dengan board dan rule re-check:
 * inspeksi night shift jam 01:00 tgl 10 masuk ke tanggal 9.
 */
function buildFilters(params: URLSearchParams): SQL[] {
	const filters: SQL[] = [];

	const partNo = params.get('partNo')?.trim();
	if (partNo) filters.push(eq(inspections.partNo, partNo));

	const lineCode = params.get('lineCode')?.trim();
	if (lineCode) filters.push(eq(inspections.lineCode, lineCode));

	const stage = params.get('stage')?.trim();
	if (stage) {
		if (!STAGES.includes(stage as (typeof STAGES)[number])) {
			throw error(400, 'Stage tidak valid.');
		}
		filters.push(eq(inspections.stage, stage as (typeof STAGES)[number]));
	}

	const shift = params.get('shift')?.trim();
	if (shift) {
		if (shift !== 'DAY' && shift !== 'NIGHT') throw error(400, 'Shift tidak valid.');
		filters.push(eq(inspections.shift, shift));
	}

	const status = params.get('status')?.trim();
	if (status) {
		if (status !== 'OK' && status !== 'NG') throw error(400, 'Status tidak valid.');
		filters.push(eq(inspections.overallStatus, status));
	}

	const operatorId = params.get('operatorId')?.trim();
	if (operatorId) filters.push(eq(inspections.operatorId, parseId(operatorId)));

	const dateFrom = params.get('dateFrom')?.trim();
	if (dateFrom) {
		const range = getOperationalDayRange(dateFrom);
		if (!range) throw error(400, 'Format dateFrom harus YYYY-MM-DD.');
		filters.push(gte(inspections.inspectedAt, range.start));
	}

	const dateTo = params.get('dateTo')?.trim();
	if (dateTo) {
		const range = getOperationalDayRange(dateTo);
		if (!range) throw error(400, 'Format dateTo harus YYYY-MM-DD.');
		// Inklusif: ambil sampai akhir hari operasional tersebut (07:30 WIB besoknya).
		filters.push(lt(inspections.inspectedAt, range.end));
	}

	return filters;
}

export async function listInspections(params: URLSearchParams) {
	const filters = buildFilters(params);
	const where = filters.length ? and(...filters) : undefined;

	const page = parsePositiveInt(params.get('page'), 1, Number.MAX_SAFE_INTEGER);
	const pageSize = parsePositiveInt(params.get('pageSize'), PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX);

	const [rows, [total], statusCounts] = await Promise.all([
		db.query.inspections.findMany({
			where,
			orderBy: [desc(inspections.inspectedAt)],
			limit: pageSize,
			offset: (page - 1) * pageSize
		}),
		db.select({ value: count() }).from(inspections).where(where),
		db
			.select({ status: inspections.overallStatus, value: count() })
			.from(inspections)
			.where(where)
			.groupBy(inspections.overallStatus)
	]);

	const ok = statusCounts.find((s) => s.status === 'OK')?.value ?? 0;
	const ng = statusCounts.find((s) => s.status === 'NG')?.value ?? 0;

	return {
		rows,
		page,
		pageSize,
		total: total.value,
		totalPages: Math.max(1, Math.ceil(total.value / pageSize)),
		ok,
		ng
	};
}

/** Detail inspeksi lengkap dengan seluruh snapshot child. */
export async function getInspection(id: string) {
	parseId(id);
	const row = await db.query.inspections.findFirst({
		where: (i, { eq }) => eq(i.id, id),
		with: {
			points: { orderBy: (p) => [asc(p.pointNo)] },
			hardwares: { orderBy: (h) => [asc(h.hwNo)] },
			lengths: { orderBy: (l) => [asc(l.lengthNo)] },
			operator: { columns: { id: true, nik: true, name: true } }
		}
	});
	if (!row) throw error(404, 'Inspeksi tidak ditemukan.');
	return row;
}

export async function countNgInspections() {
	const [result] = await db
		.select({ value: count() })
		.from(inspections)
		.where(eq(inspections.overallStatus, 'NG'));
	return result.value;
}
