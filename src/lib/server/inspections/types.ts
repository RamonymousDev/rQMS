import { z } from 'zod';

export const STAGES = ['START', 'MIDDLE', 'END'] as const;
export type Stage = (typeof STAGES)[number];

export const stageSchema = z.enum(STAGES, { message: 'Stage hanya START / MIDDLE / END.' });
export const okNgSchema = z.enum(['OK', 'NG'], { message: 'Status hanya OK / NG.' });

export const prepareSchema = z.object({
	lineId: z.uuid('Line tidak valid'),
	partNo: z.string().trim().min(1, 'Part No wajib diisi'),
	stage: stageSchema
});

/**
 * Payload submit sengaja hanya berisi nilai *actual* — semua standard dan
 * status dihitung ulang di backend dari part_line_configs.
 */
export const submitSchema = z.object({
	lineId: z.uuid('Line tidak valid'),
	partNo: z.string().trim().min(1, 'Part No wajib diisi'),
	stage: stageSchema,

	/** Wajib true untuk melanjutkan re-check saat inspeksi terakhir sudah OK. */
	confirmRecheck: z.boolean().default(false),

	spotActual: z.number().int('Spot actual harus bilangan bulat').min(0).nullable().optional(),

	points: z
		.array(
			z.object({
				pointNo: z.string().trim().min(1, 'Point No wajib diisi'),
				status: okNgSchema,
				remarks: z.string().trim().nullable().optional()
			})
		)
		.default([]),

	hardwares: z
		.array(
			z.object({
				hardwareId: z.uuid('Hardware tidak valid'),
				actualValue: z.number().int('Actual value harus bilangan bulat').min(0),
				remarks: z.string().trim().nullable().optional()
			})
		)
		.default([]),

	lengths: z
		.array(
			z.object({
				lengthNo: z.string().trim().min(1, 'Length No wajib diisi'),
				actualMm: z.number().int('Actual mm harus bilangan bulat').min(0),
				remarks: z.string().trim().nullable().optional()
			})
		)
		.default([]),

	visualStatus: okNgSchema.nullable().optional(),
	visualRemarks: z.string().trim().nullable().optional()
});

export type SubmitInput = z.infer<typeof submitSchema>;

/** Rule #9: actual >= standard → OK. Berlaku untuk Spot, Hardware, Length. */
export function statusFor(actual: number, standard: number): 'OK' | 'NG' {
	return actual >= standard ? 'OK' : 'NG';
}
