import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { db } from '../db/index.js';
import {
	inspectionHardwares,
	inspectionLengths,
	inspectionPoints,
	inspections,
	lines
} from '../db/schema.js';
import type { SessionUser } from '../auth.js';
import { findActiveConfig, type ActiveConfig } from '../configs/index.js';
import { getUserPermissionIds } from '../permissions.js';
import { getCurrentOperationalDayRange, getShift } from '../shift.js';
import { parseBody } from '../master/admin.js';
import { prepareSchema, statusFor, submitSchema, type Stage, type SubmitInput } from './types.js';

/** Rule #5: user hanya melihat Line yang permission-nya dia miliki. */
export async function listAccessibleLines(user: SessionUser) {
	const permissionIds = await getUserPermissionIds(user.id);
	if (!permissionIds.length) return [];

	return db.query.lines.findMany({
		where: (l, { and, eq, inArray }) =>
			and(inArray(l.requiredPermissionId, permissionIds), eq(l.isActive, true)),
		with: { process: true },
		orderBy: (l, { asc }) => [asc(l.code)]
	});
}

/** Rule #5 dienforce ulang di setiap operasi, bukan hanya saat listing. */
async function requireLineAccess(user: SessionUser, lineId: string) {
	const line = await db.query.lines.findFirst({
		where: and(eq(lines.id, lineId), eq(lines.isActive, true))
	});
	if (!line) throw error(404, 'Line tidak ditemukan.');

	const permissionIds = await getUserPermissionIds(user.id);
	if (!permissionIds.includes(line.requiredPermissionId)) {
		throw error(403, 'Anda tidak memiliki akses ke Line ini.');
	}
	return line;
}

/** Rule #6: part wajib sudah dikonfigurasi di line sebelum bisa diinspeksi. */
async function requireConfig(partNo: string, lineId: string): Promise<ActiveConfig> {
	const part = await db.query.parts.findFirst({
		where: (p, { and, eq }) => and(eq(p.partNo, partNo), eq(p.isActive, true))
	});
	if (!part) throw error(404, 'Part tidak dikonfigurasi di Line ini.');

	const config = await findActiveConfig(part.id, lineId);
	if (!config) throw error(404, 'Part tidak dikonfigurasi di Line ini.');
	return config;
}

/**
 * Inspeksi terakhir untuk kombinasi config+stage+shift pada hari *operasional*
 * yang sedang berjalan. Dipakai untuk rule re-check.
 *
 * Sengaja hari operasional, bukan hari kalender: night shift berjalan dari
 * 20:00 sampai 07:29 keesokan harinya. Kalau pakai hari kalender, inspeksi
 * jam 21:00 dan jam 01:00 dalam shift yang sama dianggap beda hari sehingga
 * konfirmasi re-check tidak muncul.
 */
async function findLastInspectionToday(configId: string, stage: Stage, shift: 'DAY' | 'NIGHT') {
	const { start, end } = getCurrentOperationalDayRange();
	return db.query.inspections.findFirst({
		where: and(
			eq(inspections.partLineConfigId, configId),
			eq(inspections.stage, stage),
			eq(inspections.shift, shift),
			gte(inspections.inspectedAt, start),
			lt(inspections.inspectedAt, end)
		),
		orderBy: [desc(inspections.inspectedAt)]
	});
}

/** Bentuk config yang dikirim ke frontend untuk merender form dinamis. */
function toFormSpec(config: ActiveConfig) {
	return {
		configId: config.id,
		partNo: config.part.partNo,
		partName: config.part.partName,
		lineCode: config.line.code,
		lineName: config.line.name,
		hasSpot: config.hasSpot,
		spotStandard: config.spotStandard,
		hasPoint: config.hasPoint,
		points: config.points.map((p) => ({ pointNo: p.pointNo })),
		hasHardware: config.hasHardware,
		hardwares: config.hardwares.map((h) => ({
			hardwareId: h.hardwareId,
			hwNo: h.hardware.hwNo,
			hwName: h.hardware.hwName,
			standardValue: h.standardValue,
			unit: h.unit
		})),
		hasLength: config.hasLength,
		lengths: config.lengths.map((l) => ({ lengthNo: l.lengthNo, standardMm: l.standardMm })),
		hasVisual: config.hasVisual
	};
}

/**
 * Menyiapkan form inspeksi: validasi akses + config, hitung shift, dan
 * laporkan apakah operator perlu mengonfirmasi re-check.
 */
export async function prepareInspection(user: SessionUser, body: unknown) {
	const data = parseBody(prepareSchema, body);
	await requireLineAccess(user, data.lineId);

	const config = await requireConfig(data.partNo, data.lineId);
	const shift = getShift();
	const last = await findLastInspectionToday(config.id, data.stage, shift);

	return {
		...toFormSpec(config),
		stage: data.stage,
		shift,
		// Rule #3: hanya inspeksi terakhir yang OK yang butuh konfirmasi.
		requiresRecheckConfirm: last?.overallStatus === 'OK',
		lastInspection: last
			? {
					id: last.id,
					overallStatus: last.overallStatus,
					operatorName: last.operatorName,
					inspectedAt: last.inspectedAt
				}
			: null
	};
}

type EvaluatedItem = { status: 'OK' | 'NG'; remarks: string | null };

/** Rule #1: remarks wajib diisi setiap kali status NG. */
function requireRemarks(status: 'OK' | 'NG', remarks: string | null | undefined, label: string) {
	if (status === 'NG' && !remarks?.trim()) {
		throw error(422, `Remarks wajib diisi untuk ${label} yang NG.`);
	}
	return status === 'NG' ? (remarks as string).trim() : (remarks?.trim() ?? null);
}

/**
 * Mencocokkan input operator dengan config dan menghitung status tiap item.
 * Standard selalu diambil dari `config` (DB), tidak pernah dari payload.
 */
function evaluate(config: ActiveConfig, data: SubmitInput) {
	const items: EvaluatedItem[] = [];

	// --- Points: status berasal langsung dari operator (OK/NG manual).
	const points = config.hasPoint
		? config.points.map((configured) => {
				const input = data.points.find((p) => p.pointNo === configured.pointNo);
				if (!input) throw error(422, `Point "${configured.pointNo}" wajib diisi.`);
				const remarks = requireRemarks(
					input.status,
					input.remarks,
					`Point "${configured.pointNo}"`
				);
				items.push({ status: input.status, remarks });
				return { pointNo: configured.pointNo, status: input.status, remarks };
			})
		: [];

	// --- Spot: status dihitung dari actual vs standard.
	let spotActual: number | null = null;
	if (config.hasSpot) {
		if (data.spotActual === null || data.spotActual === undefined) {
			throw error(422, 'Spot actual wajib diisi.');
		}
		spotActual = data.spotActual;
		items.push({ status: statusFor(spotActual, config.spotStandard ?? 0), remarks: null });
	}

	// --- Hardwares: status dihitung, remarks wajib saat NG.
	const hardwares = config.hasHardware
		? config.hardwares.map((configured) => {
				const input = data.hardwares.find((h) => h.hardwareId === configured.hardwareId);
				if (!input) throw error(422, `Hardware "${configured.hardware.hwNo}" wajib diisi.`);
				const status = statusFor(input.actualValue, configured.standardValue);
				const remarks = requireRemarks(
					status,
					input.remarks,
					`Hardware "${configured.hardware.hwNo}"`
				);
				items.push({ status, remarks });
				return {
					hwNo: configured.hardware.hwNo,
					hwName: configured.hardware.hwName,
					standardValue: configured.standardValue,
					unit: configured.unit,
					actualValue: input.actualValue,
					status,
					remarks
				};
			})
		: [];

	// --- Lengths: idem hardware.
	const lengths = config.hasLength
		? config.lengths.map((configured) => {
				const input = data.lengths.find((l) => l.lengthNo === configured.lengthNo);
				if (!input) throw error(422, `Length "${configured.lengthNo}" wajib diisi.`);
				const status = statusFor(input.actualMm, configured.standardMm);
				const remarks = requireRemarks(status, input.remarks, `Length "${configured.lengthNo}"`);
				items.push({ status, remarks });
				return {
					lengthNo: configured.lengthNo,
					standardMm: configured.standardMm,
					actualMm: input.actualMm,
					status,
					remarks
				};
			})
		: [];

	// --- Visual: OK/NG manual.
	let visualStatus: 'OK' | 'NG' | null = null;
	let visualRemarks: string | null = null;
	if (config.hasVisual) {
		if (!data.visualStatus) throw error(422, 'Visual status wajib diisi.');
		visualStatus = data.visualStatus;
		visualRemarks = requireRemarks(visualStatus, data.visualRemarks, 'Visual');
		items.push({ status: visualStatus, remarks: visualRemarks });
	}

	// Rule #2: satu saja NG → overall NG.
	const overallStatus: 'OK' | 'NG' = items.some((item) => item.status === 'NG') ? 'NG' : 'OK';

	return { points, spotActual, hardwares, lengths, visualStatus, visualRemarks, overallStatus };
}

/**
 * Submit inspeksi. Append-only: re-check selalu menghasilkan record baru,
 * tidak pernah meng-update record lama.
 */
export async function submitInspection(user: SessionUser, body: unknown) {
	const data = parseBody(submitSchema, body);
	await requireLineAccess(user, data.lineId);

	const config = await requireConfig(data.partNo, data.lineId);
	const shift = getShift();

	// Rule #3: blokir re-check atas hasil OK sampai operator mengonfirmasi.
	const last = await findLastInspectionToday(config.id, data.stage, shift);
	if (last?.overallStatus === 'OK' && !data.confirmRecheck) {
		throw error(409, 'Inspection untuk Stage ini sudah OK. Konfirmasi diperlukan untuk re-check.');
	}

	const result = evaluate(config, data);

	const id = await db.transaction(async (tx) => {
		const [header] = await tx
			.insert(inspections)
			.values({
				partLineConfigId: config.id,
				// Snapshot (rule #8) — history tetap akurat meski master berubah.
				partNo: config.part.partNo,
				lineCode: config.line.code,
				stage: data.stage,
				shift,
				overallStatus: result.overallStatus,
				spotActual: result.spotActual,
				visualStatus: result.visualStatus,
				visualRemarks: result.visualRemarks,
				operatorId: user.id,
				operatorName: user.name
			})
			.returning({ id: inspections.id });

		if (result.points.length) {
			await tx
				.insert(inspectionPoints)
				.values(result.points.map((p) => ({ ...p, inspectionId: header.id })));
		}
		if (result.hardwares.length) {
			await tx
				.insert(inspectionHardwares)
				.values(result.hardwares.map((h) => ({ ...h, inspectionId: header.id })));
		}
		if (result.lengths.length) {
			await tx
				.insert(inspectionLengths)
				.values(result.lengths.map((l) => ({ ...l, inspectionId: header.id })));
		}
		return header.id;
	});

	return { id, overallStatus: result.overallStatus, shift, stage: data.stage };
}
