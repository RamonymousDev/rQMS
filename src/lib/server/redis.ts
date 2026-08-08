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
