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

/**
 * Tanggal *operasional* dalam format YYYY-MM-DD.
 *
 * Night shift "milik" tanggal di mana shift tersebut DIMULAI (20:00 WIB),
 * bukan tanggal kalender saat jam itu terjadi. Contoh:
 *   - Tgl 9 jam 20:00–23:59 → night shift tgl 9
 *   - Tgl 10 jam 00:00–07:29 → night shift tgl 9  ← masih tgl 9 operasional
 *   - Tgl 10 jam 07:30–19:59 → day shift tgl 10
 *
 * Rumusnya: jika jam WIB < 07:30 (masih "ekor" night shift kemarin),
 * mundurkan tanggal operasional satu hari.
 */
export function getOperationalDate(at: Date = new Date()): string {
	const jakarta = toJakarta(at);
	const minutes = jakarta.getUTCHours() * 60 + jakarta.getUTCMinutes();
	// Sebelum 07:30 WIB → masih night shift hari sebelumnya
	const adjusted = minutes < DAY_SHIFT_START ? new Date(jakarta.getTime() - DAY_MS) : jakarta;
	return adjusted.toISOString().slice(0, 10);
}

/** Hitung rentang operasional tanpa validasi — `dateKey` diasumsikan sudah valid. */
function operationalRangeFor(dateKey: string): { start: Date; end: Date } {
	// Awal hari kalender Jakarta dalam UTC, lalu geser ke 07:30 WIB.
	const calendarStartMs = Date.parse(`${dateKey}T00:00:00.000Z`) - JAKARTA_OFFSET_MS;
	const start = new Date(calendarStartMs + DAY_SHIFT_START * 60 * 1000);
	return { start, end: new Date(start.getTime() + DAY_MS) };
}

/**
 * Rentang waktu UTC yang mencakup seluruh hari operasional `dateKey` (YYYY-MM-DD).
 *
 * Satu hari operasional = Day shift + Night shift pada tanggal tersebut:
 *   - Day  : 07:30 WIB tgl N  → 19:59 WIB tgl N
 *   - Night: 20:00 WIB tgl N  → 07:29 WIB tgl N+1
 *
 * Jadi rentangnya: [07:30 WIB tgl N, 07:30 WIB tgl N+1)
 * Return null kalau format `dateKey` tidak valid — pemanggil wajib menanganinya.
 */
export function getOperationalDayRange(dateKey: string): { start: Date; end: Date } | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
	if (Number.isNaN(Date.parse(`${dateKey}T00:00:00.000Z`))) return null;
	return operationalRangeFor(dateKey);
}

/**
 * Rentang hari operasional yang sedang berjalan pada instant `at`.
 * Ini yang dipakai untuk scope "hari ini" pada rule re-check — bukan hari
 * kalender, agar night shift yang melewati tengah malam tetap satu kesatuan.
 */
export function getCurrentOperationalDayRange(at: Date = new Date()): { start: Date; end: Date } {
	return operationalRangeFor(getOperationalDate(at));
}

/** Parse "YYYY-MM-DD" (dianggap tanggal Jakarta) menjadi instant awal hari UTC. */
export function parseJakartaDate(value: string): Date | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	const ms = Date.parse(`${value}T00:00:00.000Z`);
	if (Number.isNaN(ms)) return null;
	return new Date(ms - JAKARTA_OFFSET_MS);
}
