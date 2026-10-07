import { and, count, desc, gte, lt, type SQL } from 'drizzle-orm';
import { db } from './db/index.js';
import { inspections } from './db/schema.js';
import {
	getCurrentOperationalDayRange,
	getOperationalDate,
	getOperationalDayRange
} from './shift.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_DAYS = 7;

export type StatusCounts = {
	ok: number;
	ng: number;
	total: number;
};

export type TrendPoint = {
	date: string;
	label: string;
	ok: number;
	ng: number;
	total: number;
};

export type LineStatusPoint = {
	lineCode: string;
	ok: number;
	ng: number;
	total: number;
	/** Waktu inspeksi terakhir di line ini; null = belum ada data. */
	lastInspectedAt: string | null;
	/** Status inspeksi TERAKHIR di line ini — menentukan warna kartu. */
	latestStatus: 'OK' | 'NG' | null;
};

export type DashboardStats = {
	totals: StatusCounts;
	today: StatusCounts;
	trend: TrendPoint[];
	/** Status per line untuk hari operasional berjalan (kartu "Status per line"). */
	lines: LineStatusPoint[];
};

const MONTHS_SHORT = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'Mei',
	'Jun',
	'Jul',
	'Agu',
	'Sep',
	'Okt',
	'Nov',
	'Des'
];

/** 'YYYY-MM-DD' → '3 Agt' (label ringkas untuk sumbu chart). */
function trendLabel(dateKey: string): string {
	const [, month, day] = dateKey.split('-').map(Number);
	return `${day} ${MONTHS_SHORT[(month ?? 1) - 1]}`;
}

/**
 * Status per line untuk satu rentang waktu.
 *
 * Warna kartu line ditentukan inspeksi TERAKHIR, bukan "pernah ada NG" —
 * kalau sebuah line sudah kembali OK setelah re-check, line itu tidak boleh
 * masih tampil merah. Urutan waktu ini sama dengan yang dipakai board.
 *
 * Memakai idx_inspection_line_code, jadi tidak menambah beban berarti.
 */
async function lineStatuses(where: SQL[]): Promise<LineStatusPoint[]> {
	const rows = await db
		.select({
			lineCode: inspections.lineCode,
			status: inspections.overallStatus,
			inspectedAt: inspections.inspectedAt
		})
		.from(inspections)
		.where(where.length ? and(...where) : undefined)
		.orderBy(desc(inspections.inspectedAt));

	const byLine = new Map<string, LineStatusPoint>();
	for (const row of rows) {
		const existing = byLine.get(row.lineCode);
		if (!existing) {
			// Baris pertama per line = inspeksi terbaru (sudah terurut desc).
			const isOk = row.status === 'OK';
			byLine.set(row.lineCode, {
				lineCode: row.lineCode,
				ok: isOk ? 1 : 0,
				ng: isOk ? 0 : 1,
				total: 1,
				lastInspectedAt: row.inspectedAt.toISOString(),
				latestStatus: row.status
			});
			continue;
		}
		if (row.status === 'OK') existing.ok += 1;
		else existing.ng += 1;
		existing.total += 1;
	}

	// Line paling aktif duluan — supervisor biasanya melihat line yang paling banyak bergerak.
	return [...byLine.values()].sort((a, b) => b.total - a.total);
}

async function countByStatus(where: SQL[]): Promise<StatusCounts> {
	const rows = await db
		.select({ status: inspections.overallStatus, value: count() })
		.from(inspections)
		.where(where.length ? and(...where) : undefined)
		.groupBy(inspections.overallStatus);
	const ok = rows.find((r) => r.status === 'OK')?.value ?? 0;
	const ng = rows.find((r) => r.status === 'NG')?.value ?? 0;
	return { ok, ng, total: ok + ng };
}

/**
 * Statistik dashboard: total sepanjang masa, ringkasan hari operasional berjalan,
 * dan tren 7 hari operasional terakhir. Semua pembagian hari memakai hari
 * operasional (07:30 WIB → 07:30 WIB), konsisten dengan board dan laporan.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
	const now = new Date();
	const { start, end } = getCurrentOperationalDayRange(now);

	const [totals, today, lines] = await Promise.all([
		countByStatus([]),
		countByStatus([gte(inspections.inspectedAt, start), lt(inspections.inspectedAt, end)]),
		lineStatuses([gte(inspections.inspectedAt, start), lt(inspections.inspectedAt, end)])
	]);

	const todayKey = getOperationalDate(now);
	const dates: string[] = [];
	for (let i = TREND_DAYS - 1; i >= 0; i--) {
		const ms = Date.parse(`${todayKey}T00:00:00.000Z`) - i * DAY_MS;
		dates.push(new Date(ms).toISOString().slice(0, 10));
	}

	const firstRange = getOperationalDayRange(dates[0]);
	const lastRange = getOperationalDayRange(dates[dates.length - 1]);

	const trendRows =
		firstRange && lastRange
			? await db
					.select({
						inspectedAt: inspections.inspectedAt,
						status: inspections.overallStatus
					})
					.from(inspections)
					.where(
						and(
							gte(inspections.inspectedAt, firstRange.start),
							lt(inspections.inspectedAt, lastRange.end)
						)
					)
			: [];

	const byDate = new Map<string, TrendPoint>();
	for (const date of dates) {
		byDate.set(date, { date, label: trendLabel(date), ok: 0, ng: 0, total: 0 });
	}
	for (const row of trendRows) {
		const point = byDate.get(getOperationalDate(row.inspectedAt));
		if (!point) continue;
		if (row.status === 'OK') point.ok += 1;
		else point.ng += 1;
		point.total += 1;
	}

	return { totals, today, trend: dates.map((date) => byDate.get(date)!), lines };
}

/** Inspeksi terbaru (snapshot kolom yang dipakai tabel dashboard). */
export async function getRecentInspections(limit = 5) {
	return db.query.inspections.findMany({
		columns: {
			id: true,
			partNo: true,
			lineCode: true,
			stage: true,
			shift: true,
			overallStatus: true,
			operatorName: true,
			inspectedAt: true
		},
		orderBy: [desc(inspections.inspectedAt)],
		limit
	});
}
