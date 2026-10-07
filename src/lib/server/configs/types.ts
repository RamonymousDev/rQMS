import { z } from 'zod';

const pointSchema = z.object({
	pointNo: z
		.string()
		.trim()
		.min(1, 'Point No wajib diisi')
		.max(30, 'Point No maksimal 30 karakter'),
	sequence: z.number().int().min(0).optional()
});

const hardwareSchema = z.object({
	hardwareId: z.uuid('Hardware tidak valid'),
	checkType: z.enum(['TORQUE', 'HAMMER'], { message: 'Tipe pengecekan hanya TORQUE / HAMMER.' }),
	qty: z
		.number()
		.int('QTY harus bilangan bulat')
		.min(1, 'QTY minimal 1')
		.max(20, 'QTY maksimal 20'),
	standardValue: z
		.number()
		.int('Standard value harus bilangan bulat')
		.min(0, 'Standard value minimal 0'),
	unit: z.string().trim().min(1, 'Unit wajib diisi').max(20, 'Unit maksimal 20 karakter'),
	sequence: z.number().int().min(0).optional()
});

const lengthSchema = z.object({
	lengthNo: z
		.string()
		.trim()
		.min(1, 'Length No wajib diisi')
		.max(30, 'Length No maksimal 30 karakter'),
	standardMm: z.number().int('Standard mm harus bilangan bulat').min(0, 'Standard mm minimal 0'),
	sequence: z.number().int().min(0).optional()
});

const configBase = z.object({
	partId: z.uuid('Part tidak valid'),
	lineId: z.uuid('Line tidak valid'),

	hasSpot: z.boolean().default(false),
	spotStandard: z.number().int('Spot standard harus bilangan bulat').min(0).nullable().optional(),

	hasPoint: z.boolean().default(false),
	hasHardware: z.boolean().default(false),
	hasLength: z.boolean().default(false),
	hasVisual: z.boolean().default(false),

	points: z.array(pointSchema).default([]),
	hardwares: z.array(hardwareSchema).default([]),
	lengths: z.array(lengthSchema).default([]),

	isActive: z.boolean().optional()
});

/**
 * Bagian payload yang dipakai validasi flag & normalisasi — sengaja tanpa
 * partId/lineId agar dipakai bersama oleh skema create maupun update
 * (update meng-omit keduanya karena part+line dikunci setelah dibuat).
 */
type ConfigItems = Omit<z.infer<typeof configBase>, 'partId' | 'lineId'>;

function duplicates(values: string[]): string[] {
	const seen = new Set<string>();
	const dupes = new Set<string>();
	for (const value of values) {
		const key = value.toLowerCase();
		if (seen.has(key)) dupes.add(value);
		seen.add(key);
	}
	return [...dupes];
}

/**
 * Konsistensi flag vs detail. Flag aktif wajib punya detail; flag nonaktif
 * membuang detailnya (dinormalisasi di `normalizeConfig`) agar tidak ada data
 * yatim yang ikut ter-render di form operator.
 */
function checkFlagConsistency(data: ConfigItems, ctx: z.RefinementCtx) {
	if (data.hasSpot && (data.spotStandard === null || data.spotStandard === undefined)) {
		ctx.addIssue({ code: 'custom', message: 'Spot standard wajib diisi jika Spot aktif.' });
	}
	if (data.hasPoint && data.points.length === 0) {
		ctx.addIssue({ code: 'custom', message: 'Minimal 1 Point wajib diisi jika Point aktif.' });
	}
	if (data.hasHardware && data.hardwares.length === 0) {
		ctx.addIssue({
			code: 'custom',
			message: 'Minimal 1 Hardware wajib diisi jika Hardware aktif.'
		});
	}
	if (data.hasLength && data.lengths.length === 0) {
		ctx.addIssue({ code: 'custom', message: 'Minimal 1 Length wajib diisi jika Length aktif.' });
	}

	if (!data.hasSpot && !data.hasPoint && !data.hasHardware && !data.hasLength && !data.hasVisual) {
		ctx.addIssue({ code: 'custom', message: 'Minimal satu item inspeksi harus diaktifkan.' });
	}

	const dupPoints = duplicates(data.points.map((p) => p.pointNo));
	if (dupPoints.length) {
		ctx.addIssue({ code: 'custom', message: `Point No duplikat: ${dupPoints.join(', ')}.` });
	}

	const dupHardwares = duplicates(data.hardwares.map((h) => h.hardwareId));
	if (dupHardwares.length) {
		ctx.addIssue({ code: 'custom', message: 'Terdapat hardware yang dipilih lebih dari sekali.' });
	}

	const dupLengths = duplicates(data.lengths.map((l) => l.lengthNo));
	if (dupLengths.length) {
		ctx.addIssue({ code: 'custom', message: `Length No duplikat: ${dupLengths.join(', ')}.` });
	}
}

export const configCreateSchema = configBase.superRefine(checkFlagConsistency);

/** Update mengirim ulang seluruh payload kecuali part/line yang dikunci. */
export const configUpdateSchema = configBase
	.omit({ partId: true, lineId: true })
	.superRefine(checkFlagConsistency);

export type ConfigCreateInput = z.infer<typeof configCreateSchema>;
export type ConfigUpdateInput = z.infer<typeof configUpdateSchema>;

/** Buang detail milik flag yang nonaktif dan beri sequence stabil. */
export function normalizeConfig(data: ConfigItems) {
	return {
		hasSpot: data.hasSpot,
		spotStandard: data.hasSpot ? (data.spotStandard ?? null) : null,
		hasPoint: data.hasPoint,
		hasHardware: data.hasHardware,
		hasLength: data.hasLength,
		hasVisual: data.hasVisual,
		isActive: data.isActive,
		points: data.hasPoint
			? data.points.map((p, i) => ({ pointNo: p.pointNo, sequence: p.sequence ?? i }))
			: [],
		hardwares: data.hasHardware
			? data.hardwares.map((h, i) => ({
					hardwareId: h.hardwareId,
					checkType: h.checkType,
					qty: h.qty,
					standardValue: h.standardValue,
					unit: h.unit,
					sequence: h.sequence ?? i
				}))
			: [],
		lengths: data.hasLength
			? data.lengths.map((l, i) => ({
					lengthNo: l.lengthNo,
					standardMm: l.standardMm,
					sequence: l.sequence ?? i
				}))
			: []
	};
}
