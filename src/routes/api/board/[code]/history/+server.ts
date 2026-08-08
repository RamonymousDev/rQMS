import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getInspectionHistory } from '$lib/server/board/index.js';
import type { ShiftKey, StageKey } from '$lib/server/board/index.js';

const VALID_SHIFTS: ShiftKey[] = ['DAY', 'NIGHT'];
const VALID_STAGES: StageKey[] = ['START', 'MIDDLE', 'END'];

/**
 * GET /api/board/[code]/history?configId=…&shift=DAY&stage=START
 * Route PUBLIC — tanpa auth.
 */
export const GET: RequestHandler = async ({ url }) => {
	const configId = url.searchParams.get('configId')?.trim();
	const shift = url.searchParams.get('shift')?.trim() as ShiftKey | undefined;
	const stage = url.searchParams.get('stage')?.trim() as StageKey | undefined;

	if (!configId || !shift || !stage) {
		error(400, 'Parameter configId, shift, dan stage wajib diisi.');
	}

	if (!VALID_SHIFTS.includes(shift)) error(400, 'Shift tidak valid.');
	if (!VALID_STAGES.includes(stage)) error(400, 'Stage tidak valid.');

	const rows = await getInspectionHistory(configId, shift, stage);
	return json(rows);
};
