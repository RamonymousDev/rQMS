import { error, isHttpError } from '@sveltejs/kit';
import { checkRateLimit, rateLimit, recordRateLimit, resetRateLimit } from './redis.js';

export type RateLimitPreset = {
	key: string;
	limit: number;
	windowSeconds: number;
};

export const RATE_LIMITS = {
	login: { limit: 5, windowSeconds: 60 * 15 },
	submit: { limit: 30, windowSeconds: 60 },
	/** Per user (bukan per IP) — lihat enforceUserRateLimit. */
	admin: { limit: 60, windowSeconds: 60 }
} as const satisfies Record<string, { limit: number; windowSeconds: number }>;

export async function enforceRateLimit(preset: keyof typeof RATE_LIMITS, identifier: string) {
	const config = RATE_LIMITS[preset];
	const result = await rateLimit({
		key: `${preset}:${identifier}`,
		limit: config.limit,
		windowSeconds: config.windowSeconds
	});

	if (!result.allowed) {
		throw error(429, `Terlalu banyak permintaan. Coba lagi dalam ${result.reset} detik.`);
	}

	return result;
}

/**
 * Rate limit untuk endpoint yang sudah terautentikasi — key memakai user id,
 * bukan IP. Kuota per-IP membuat seluruh user di jaringan NAT pabrik saling
 * memakan jatah (polling dashboard 30 detik saja bisa menghabiskan 60/menit),
 * padahal identitas pemanggil sudah pasti dari sesi.
 */
export async function enforceUserRateLimit(
	preset: keyof typeof RATE_LIMITS,
	userId: string
): Promise<void> {
	await enforceRateLimit(preset, `user:${userId}`);
}

/**
 * Rate limit login dua lapis yang HANYA menghitung percobaan GAGAL:
 *
 * - per akun : 5 gagal / 15 menit  → anti brute-force yang menyasar satu akun
 * - per IP   : 50 gagal / 15 menit → anti spraying banyak akun dari satu host
 *
 * Kenapa tidak menghitung semua percobaan seperti sebelumnya: pabrik biasanya
 * berbagi satu IP publik (NAT) dan login bersamaan saat pergantian shift.
 * Kalau login sukses ikut dihitung dalam kuota per-IP, 5 pergantian user saja
 * sudah mengunci SEMUA orang selama 15 menit (insiden "semua akun tidak bisa
 * login"). Login sukses kini tidak pernah menambah counter, dan sukses
 * mengosongkan counter akun yang bersangkutan.
 *
 * Fail-open saat Redis down: kredensial tetap diverifikasi ke DB, sehingga
 * gangguan Redis tidak mematikan login seluruh pabrik.
 */
export const LOGIN_LIMITS = {
	account: { limit: 5, windowSeconds: 15 * 60 },
	ip: { limit: 50, windowSeconds: 15 * 60 }
} as const;

const accountKey = (nik: string) => `login:acct:${nik.trim().toLowerCase()}`;
const ipKey = (ip: string) => `login:ip:${ip}`;

function formatWait(seconds: number): string {
	return seconds < 60 ? `${seconds} detik` : `${Math.ceil(seconds / 60)} menit`;
}

/** Cek limit sebelum verifikasi kredensial. Throw 429 jika terlampaui. */
export async function enforceLoginRateLimit(nik: string, ip: string): Promise<void> {
	try {
		const [account, byIp] = await Promise.all([
			checkRateLimit({ key: accountKey(nik), ...LOGIN_LIMITS.account }),
			checkRateLimit({ key: ipKey(ip), ...LOGIN_LIMITS.ip })
		]);

		if (!account.allowed) {
			throw error(
				429,
				`Terlalu banyak percobaan gagal untuk akun ini. Coba lagi dalam ${formatWait(account.retryAfterSeconds)}.`
			);
		}
		if (!byIp.allowed) {
			throw error(
				429,
				`Terlalu banyak percobaan login gagal dari jaringan ini. Coba lagi dalam ${formatWait(byIp.retryAfterSeconds)}.`
			);
		}
	} catch (err) {
		// 429 buatan sendiri harus tetap dilempar; error Redis lain = fail-open.
		if (isHttpError(err, 429)) throw err;
		console.warn('[rate-limit] Redis tidak tersedia, rate limit login dilewati:', err);
	}
}

/** Catat percobaan gagal ke kedua window. */
export async function recordLoginFailure(nik: string, ip: string): Promise<void> {
	try {
		await Promise.all([
			recordRateLimit(accountKey(nik), LOGIN_LIMITS.account.windowSeconds),
			recordRateLimit(ipKey(ip), LOGIN_LIMITS.ip.windowSeconds)
		]);
	} catch (err) {
		console.warn('[rate-limit] Gagal mencatat login failure:', err);
	}
}

/** Kosongkan counter akun setelah login sukses. */
export async function clearLoginFailures(nik: string): Promise<void> {
	try {
		await resetRateLimit(accountKey(nik));
	} catch (err) {
		console.warn('[rate-limit] Gagal mereset counter login:', err);
	}
}
