import { requireAdmin } from '$lib/server/master/admin.js';
import { enforceRateLimit } from '$lib/server/rate-limit.js';
import { logAction } from '$lib/server/audit.js';
import { exportInspectionsXlsx } from '$lib/server/inspections/export.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async (event) => {
	const user = await requireAdmin(event.locals.user);
	await enforceRateLimit('admin', event.getClientAddress());

	const { buffer, filename, total } = await exportInspectionsXlsx(event.url.searchParams);

	logAction(user, {
		action: 'export_inspections',
		entity: 'inspections',
		metadata: { total, query: Object.fromEntries(event.url.searchParams.entries()) }
	});

	return new Response(buffer, {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="${filename}"`,
			'Content-Length': String(buffer.byteLength)
		}
	});
};
