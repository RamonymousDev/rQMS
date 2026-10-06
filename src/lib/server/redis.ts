import { env } from '$env/dynamic/private';
import { Redis } from 'ioredis';

if (!env.REDIS_URL) {
	throw new Error('REDIS_URL is not set');
}

export const redis = new Redis(env.REDIS_URL, {
	keyPrefix: 'rqms:',
	maxRetriesPerRequest: 3,
	enableReadyCheck: true
});

export type RateLimitOptions = {
	key: string;
	limit: number;
	windowSeconds: number;
};

export async function rateLimit({ key, limit, windowSeconds }: RateLimitOptions) {
	const now = Date.now();
	const windowMs = windowSeconds * 1000;
	const redisKey = `ratelimit:${key}`;

	const data = await redis
		.pipeline([
			['zremrangebyscore', redisKey, 0, now - windowMs],
			['zadd', redisKey, now, `${now}-${Math.random()}`],
			['zcard', redisKey],
			['expire', redisKey, windowSeconds]
		])
		.exec();

	const count = (
		data as unknown as [[number, number], [number, number], [number, number], [number, number]]
	)[2][1];

	return {
		allowed: count <= limit,
		limit,
		remaining: Math.max(0, limit - count),
		reset: Math.ceil((now + windowMs) / 1000)
	};
}

export type RateLimitStatus = {
	allowed: boolean;
	limit: number;
	remaining: number;
	/** Detik sampai slot gagal paling lama kedaluwarsa (0 jika masih di bawah limit). */
	retryAfterSeconds: number;
};

/**
 * Baca status limit TANPA mencatat percobaan baru.
 * Dipakai untuk alur "hitung hanya percobaan gagal": cek dulu, catat belakangan.
 */
export async function checkRateLimit({
	key,
	limit,
	windowSeconds
}: RateLimitOptions): Promise<RateLimitStatus> {
	const now = Date.now();
	const windowMs = windowSeconds * 1000;
	const redisKey = `ratelimit:${key}`;

	const results = await redis
		.pipeline([
			['zremrangebyscore', redisKey, 0, now - windowMs],
			['zcard', redisKey],
			['zrange', redisKey, 0, 0, 'WITHSCORES']
		])
		.exec();

	const count = Number(results?.[1]?.[1] ?? 0);
	const oldest = results?.[2]?.[1] as string[] | null;
	const oldestMs = oldest?.[1] ? Number(oldest[1]) : 0;
	const retryAfterSeconds =
		count >= limit && oldestMs > 0 ? Math.max(1, Math.ceil((oldestMs + windowMs - now) / 1000)) : 0;

	return {
		allowed: count < limit,
		limit,
		remaining: Math.max(0, limit - count),
		retryAfterSeconds
	};
}

/** Catat satu percobaan ke window (khusus alur yang hanya mencatat kegagalan). */
export async function recordRateLimit(key: string, windowSeconds: number): Promise<void> {
	const now = Date.now();
	const redisKey = `ratelimit:${key}`;
	await redis
		.pipeline([
			['zadd', redisKey, now, `${now}-${Math.random().toString(36).slice(2)}`],
			['expire', redisKey, windowSeconds]
		])
		.exec();
}

/** Kosongkan counter (mis. setelah login sukses, agar user tidak terkunci). */
export async function resetRateLimit(key: string): Promise<void> {
	await redis.del(`ratelimit:${key}`);
}
