import type { PageServerLoad } from './$types.js';
import type { RequestEvent } from '@sveltejs/kit';

export const load: PageServerLoad = async (event: RequestEvent) => {
	const { fetch, locals } = event;
	const user = locals.user ?? null;

	const linesRes = await fetch('/api/inspect/lines');
	const linesJson = linesRes.ok ? await linesRes.json() : { data: [] };
	const lines = (linesJson.data ?? []) as Array<{
		id: string;
		code: string;
		name: string;
		process?: { name: string };
	}>;

	const insRes = await fetch('/api/inspections?limit=5&pageSize=5');
	const insJson = insRes.ok ? await insRes.json() : { data: { rows: [] } };
	const inspections = (insJson.data?.rows ?? []) as Array<{
		id: string;
		partNo: string;
		lineCode: string;
		stage: string;
		overallStatus: string;
		inspectedAt: string;
	}>;

	const okCount = inspections.filter((i) => i.overallStatus === 'OK').length;
	const ngCount = inspections.filter((i) => i.overallStatus === 'NG').length;

	return { user, lines, inspections, okCount, ngCount };
};
