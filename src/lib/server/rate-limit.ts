import { error } from '@sveltejs/kit';
import { rateLimit } from './redis.js';

export type RateLimitPreset = {
	key: string;
	limit: number;
	windowSeconds: number;
};

export const RATE_LIMITS = {
	login: { limit: 5, windowSeconds: 60 * 15 },
	submit: { limit: 30, windowSeconds: 60 },
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
