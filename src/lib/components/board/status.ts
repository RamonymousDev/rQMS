import type { BoardPart, ShiftKey, StageKey, StageStatus } from '$lib/server/board/index.js';

const STAGES: StageKey[] = ['START', 'MIDDLE', 'END'];
const SHIFTS: ShiftKey[] = ['DAY', 'NIGHT'];

function latestOf(stages: Record<StageKey, StageStatus>): StageStatus | null {
	let latest: StageStatus | null = null;
	let latestAt = '';
	for (const stage of STAGES) {
		const s = stages[stage];
		if (!s.latestInspectedAt) continue;
		if (!latest || s.latestInspectedAt > latestAt) {
			latest = s;
			latestAt = s.latestInspectedAt;
		}
	}
	return latest;
}

/**
 * Hasil inspeksi terakhir pada satu shift — dipakai untuk menandai baris shift
 * merah. "Hasil akhir" sebuah part ditentukan oleh inspeksi paling terbaru,
 * bukan oleh keberadaan satu pun inspeksi NG (S NG lalu M OK → hasil OK).
 */
export function latestInShift(part: BoardPart, shift: ShiftKey): StageStatus | null {
	return latestOf(part.status[shift]);
}

/**
 * Hasil inspeksi terakhir pada seluruh data yang ditampilkan (kedua shift).
 * `null` kalau belum ada inspeksi sama sekali di hari operasional itu.
 */
export function latestOverall(part: BoardPart): StageStatus | null {
	let latest: StageStatus | null = null;
	let latestAt = '';
	for (const shift of SHIFTS) {
		const s = latestInShift(part, shift);
		if (!s) continue;
		if (!latest || s.latestInspectedAt! > latestAt) {
			latest = s;
			latestAt = s.latestInspectedAt!;
		}
	}
	return latest;
}
