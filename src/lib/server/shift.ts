/**
 * Waktu operasional dihitung di zona Asia/Jakarta (UTC+7, tanpa DST).
 * Jangan pakai `new Date().getHours()` — waktu server bisa berada di TZ lain.
 */
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 07:30 dalam menit sejak tengah malam. */
const DAY_SHIFT_START = 7 * 60 + 30;
/** 20:00 dalam menit sejak tengah malam. */
const DAY_SHIFT_END = 20 * 60;

export type Shift = 'DAY' | 'NIGHT';

/** Geser epoch sehingga getUTC* membaca jam dinding Jakarta. */
function toJakarta(at: Date): Date {
	return new Date(at.getTime() + JAKARTA_OFFSET_MS);
}

/**
 * DAY  : 07:30 – 19:59 (Asia/Jakarta)
 * NIGHT: 20:00 – 07:29 (Asia/Jakarta)
 */
export function getShift(at: Date = new Date()): Shift {
	const jakarta = toJakarta(at);
	const minutes = jakarta.getUTCHours() * 60 + jakarta.getUTCMinutes();
	return minutes >= DAY_SHIFT_START && minutes < DAY_SHIFT_END ? 'DAY' : 'NIGHT';
}

/**
 * Rentang [start, end) satu hari kalender Jakarta yang memuat `at`,
 * dikembalikan sebagai instant UTC agar bisa langsung dipakai membandingkan
 * kolom timestamptz. Dipakai untuk query re-check "hari ini".
 */
export function getJakartaDayRange(at: Date = new Date()): { start: Date; end: Date } {
	const jakarta = toJakarta(at);
	const startOfDayUtc = Date.UTC(
		jakarta.getUTCFullYear(),
		jakarta.getUTCMonth(),
		jakarta.getUTCDate()
	);
	const start = new Date(startOfDayUtc - JAKARTA_OFFSET_MS);
	return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** Tanggal kalender Jakarta dalam format YYYY-MM-DD. */
export function getJakartaDateKey(at: Date = new Date()): string {
	return toJakarta(at).toISOString().slice(0, 10);
}

/** Parse "YYYY-MM-DD" (dianggap tanggal Jakarta) menjadi instant awal hari UTC. */
export function parseJakartaDate(value: string): Date | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	const ms = Date.parse(`${value}T00:00:00.000Z`);
	if (Number.isNaN(ms)) return null;
	return new Date(ms - JAKARTA_OFFSET_MS);
}
