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

export type DashboardStats = {
	totals: StatusCounts;
	today: StatusCounts;
	trend: TrendPoint[];
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

	const [totals, today] = await Promise.all([
		countByStatus([]),
		countByStatus([gte(inspections.inspectedAt, start), lt(inspections.inspectedAt, end)])
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

	return { totals, today, trend: dates.map((date) => byDate.get(date)!) };
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
