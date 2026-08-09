import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { inspections, lines, partLineConfigs, parts } from '../db/schema.js';
import type { Stage } from '../inspections/types.js';
import { getOperationalDate, getOperationalDayRange, getShift } from '../shift.js';

export type ShiftKey = 'DAY' | 'NIGHT';
export type StageKey = Stage;
export type StatusValue = 'OK' | 'NG' | null;

export interface StageStatus {
	status: StatusValue;
	/** id inspeksi terbaru, null kalau belum ada data */
	latestInspectionId: string | null;
	/** jumlah inspeksi pada kombinasi ini di hari operasional yang ditampilkan */
	count: number;
	/** timestamp (ISO) inspeksi terbaru, null kalau belum ada data */
	latestInspectedAt: string | null;
}

export interface PartShiftStatus {
	DAY: Record<StageKey, StageStatus>;
	NIGHT: Record<StageKey, StageStatus>;
}

export interface BoardPart {
	partId: string;
	partNo: string;
	partName: string;
	configId: string;
	status: PartShiftStatus;
}

export interface BoardLine {
	id: string;
	code: string;
	name: string;
}

export interface BoardData {
	line: BoardLine;
	parts: BoardPart[];
	/** Tanggal operasional yang sedang ditampilkan (YYYY-MM-DD). */
	date: string;
	/** Tanggal operasional yang sedang berjalan sekarang — batas atas date picker. */
	today: string;
	/** Shift yang sedang berjalan (dihitung server, zona WIB). */
	currentShift: ShiftKey;
}

const STAGES: StageKey[] = ['START', 'MIDDLE', 'END'];
const SHIFTS: ShiftKey[] = ['DAY', 'NIGHT'];

function emptyShiftStatus(): PartShiftStatus {
	const makeStages = (): Record<StageKey, StageStatus> =>
		Object.fromEntries(
			STAGES.map((s) => [
				s,
				{ status: null, latestInspectionId: null, count: 0, latestInspectedAt: null }
			])
		) as Record<StageKey, StageStatus>;
	return { DAY: makeStages(), NIGHT: makeStages() };
}

/**
 * Normalisasi tanggal operasional yang diminta.
 *
 * Board adalah layar publik di line produksi — `dateKey` yang tidak valid
 * di-fallback ke hari operasional berjalan, bukan dilempar sebagai error,
 * agar layar tidak pernah menampilkan halaman error.
 */
function resolveBoardDate(dateKey?: string | null): {
	date: string;
	today: string;
	range: { start: Date; end: Date };
} {
	const today = getOperationalDate();
	const requested = dateKey?.trim();
	const range = requested ? getOperationalDayRange(requested) : null;
	if (!requested || !range) {
		return { date: today, today, range: getOperationalDayRange(today)! };
	}
	return { date: requested, today, range };
}

/**
 * Ambil data board untuk sebuah line berdasarkan code, dibatasi ke satu hari
 * operasional (default: hari operasional berjalan).
 *
 * Hari operasional = 07:30 WIB tgl N s/d 07:30 WIB tgl N+1, sehingga night
 * shift yang melewati tengah malam tetap masuk ke tanggal shift itu dimulai.
 *
 * Return null kalau line tidak ditemukan.
 */
export async function getBoardData(
	lineCode: string,
	dateKey?: string | null
): Promise<BoardData | null> {
	// 1. Resolve line
	const line = await db.query.lines.findFirst({
		where: (l, { eq }) => eq(l.code, lineCode),
		columns: { id: true, code: true, name: true }
	});
	if (!line) return null;

	const { date, today, range } = resolveBoardDate(dateKey);
	const currentShift = getShift();

	// 2. Ambil semua part yang terkonfigurasi di line ini (aktif)
	const configs = await db.query.partLineConfigs.findMany({
		where: (c, { and, eq }) => and(eq(c.lineId, line.id), eq(c.isActive, true)),
		with: {
			part: { columns: { id: true, partNo: true, partName: true } }
		},
		columns: { id: true }
	});

	if (configs.length === 0) return { line, parts: [], date, today, currentShift };

	// 3. Untuk tiap kombinasi (configId, shift, stage), ambil inspeksi terbaru.
	//    Satu query per kombinasi terlalu banyak round-trips; kita ambil semua
	//    inspeksi relevan lalu group di memory.
	//    DISTINCT ON tidak tersedia di Drizzle ORM, jadi kita query semua lalu
	//    dedupe di JS — jumlah baris terbatas (parts × 6 kombinasi × beberapa history).
	const rows = await db
		.select({
			id: inspections.id,
			partLineConfigId: inspections.partLineConfigId,
			shift: inspections.shift,
			stage: inspections.stage,
			overallStatus: inspections.overallStatus,
			inspectedAt: inspections.inspectedAt
		})
		.from(inspections)
		.where(
			and(
				// lineCode adalah kolom snapshot di inspections — cukup untuk memfilter
				// ke line ini tanpa join ke partLineConfigs.
				eq(inspections.lineCode, lineCode),
				gte(inspections.inspectedAt, range.start),
				lt(inspections.inspectedAt, range.end)
			)
		)
		.orderBy(desc(inspections.inspectedAt));

	// 4. Group: configId → shift → stage → inspeksi terbaru (sudah sorted desc),
	//    sekaligus hitung jumlah inspeksi per kombinasi untuk hari tersebut.
	type InspRow = (typeof rows)[number];
	const latestMap = new Map<string, InspRow>(); // key: `${configId}:${shift}:${stage}`
	const countMap = new Map<string, number>();

	for (const row of rows) {
		const key = `${row.partLineConfigId}:${row.shift}:${row.stage}`;
		countMap.set(key, (countMap.get(key) ?? 0) + 1);
		if (!latestMap.has(key)) {
			latestMap.set(key, row);
		}
	}

	// 5. Susun hasil
	const boardParts: BoardPart[] = configs.map((cfg) => {
		const status = emptyShiftStatus();
		for (const shift of SHIFTS) {
			for (const stage of STAGES) {
				const key = `${cfg.id}:${shift}:${stage}`;
				const latest = latestMap.get(key);
				if (latest) {
					status[shift][stage] = {
						status: latest.overallStatus,
						latestInspectionId: latest.id,
						count: countMap.get(key) ?? 0,
						latestInspectedAt: latest.inspectedAt.toISOString()
					};
				}
			}
		}
		return {
			partId: cfg.part.id,
			partNo: cfg.part.partNo,
			partName: cfg.part.partName,
			configId: cfg.id,
			status
		};
	});

	// Sort by partNo ascending
	boardParts.sort((a, b) => a.partNo.localeCompare(b.partNo));

	return { line, parts: boardParts, date, today, currentShift };
}

/**
 * Ambil riwayat inspeksi lengkap (termasuk points, hardwares, lengths)
 * untuk kombinasi (configId, shift, stage) pada satu hari operasional.
 *
 * Dibatasi ke hari operasional yang sama dengan badge yang diklik agar isi
 * modal selalu konsisten dengan status yang ditampilkan badge tersebut.
 */
export async function getInspectionHistory(
	configId: string,
	shift: ShiftKey,
	stage: StageKey,
	dateKey?: string | null,
	limit = 20
) {
	const { range } = resolveBoardDate(dateKey);
	return db.query.inspections.findMany({
		where: (i, { and, eq, gte, lt }) =>
			and(
				eq(i.partLineConfigId, configId),
				eq(i.shift, shift),
				eq(i.stage, stage),
				gte(i.inspectedAt, range.start),
				lt(i.inspectedAt, range.end)
			),
		orderBy: (i, { desc }) => [desc(i.inspectedAt)],
		limit,
		columns: {
			id: true,
			partNo: true,
			lineCode: true,
			stage: true,
			shift: true,
			overallStatus: true,
			inspectedAt: true,
			operatorName: true,
			spotActual: true,
			visualStatus: true,
			visualRemarks: true
		},
		with: {
			operator: { columns: { nik: true } },
			points: { columns: { pointNo: true, status: true, remarks: true } },
			hardwares: {
				columns: {
					hwNo: true,
					hwName: true,
					standardValue: true,
					unit: true,
					actualValue: true,
					status: true,
					remarks: true
				}
			},
			lengths: {
				columns: {
					lengthNo: true,
					standardMm: true,
					actualMm: true,
					status: true,
					remarks: true
				}
			}
		}
	});
}

export type InspectionHistoryRow = Awaited<ReturnType<typeof getInspectionHistory>>[number];

/** Resolve configId dari (lineCode, partNo). Dipakai SSE history endpoint. */
export async function resolveConfigId(lineCode: string, partNo: string): Promise<string | null> {
	const row = await db
		.select({ id: partLineConfigs.id })
		.from(partLineConfigs)
		.innerJoin(lines, eq(partLineConfigs.lineId, lines.id))
		.innerJoin(parts, eq(partLineConfigs.partId, parts.id))
		.where(and(eq(lines.code, lineCode), eq(parts.partNo, partNo)))
		.limit(1);
	return row[0]?.id ?? null;
}
