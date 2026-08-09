import type { PageServerLoad } from './$types.js';
import type { RequestEvent } from '@sveltejs/kit';
import { getDashboardStats, getRecentInspections } from '$lib/server/dashboard.js';

export const load: PageServerLoad = async (event: RequestEvent) => {
	const { fetch, locals } = event;
	const user = locals.user ?? null;

	const [stats, inspections, linesRes] = await Promise.all([
		getDashboardStats(),
		getRecentInspections(5),
		fetch('/api/inspect/lines')
	]);

	const linesJson = linesRes.ok ? await linesRes.json() : { data: [] };
	const lines = (linesJson.data ?? []) as Array<{
		id: string;
		code: string;
		name: string;
		process?: { name: string };
	}>;

	return { user, lines, inspections, stats };
};
