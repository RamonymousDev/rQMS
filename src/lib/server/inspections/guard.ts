import { error } from '@sveltejs/kit';
import type { SessionUser } from '../auth.js';

export function requireUser(user: SessionUser | null): SessionUser {
	if (!user) throw error(401, 'Tidak terautentikasi.');
	return user;
}
