import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAdmin } from '$lib/server/master/admin.js';
import { logAction } from '$lib/server/audit.js';
import { enforceUserRateLimit } from '$lib/server/rate-limit.js';
import { revertInspectionRepair } from '$lib/server/inspections/repairs.js';

/** Admin membatalkan repair: status item kembali NG. */
export const POST: RequestHandler = async (event) => {
	const user = await requireAdmin(event.locals.user);
	await enforceUserRateLimit('admin', user.id);
	const payload = await event.request.json();
	const result = await revertInspectionRepair(event.params.id, payload);

	await logAction(user, {
		action: 'revert_inspection_repair',
		entity: 'inspections',
		entityId: event.params.id,
		metadata: {
			itemType: payload?.itemType,
			itemId: payload?.itemId ?? null,
			overallStatus: result.overallStatus
		},
		ipAddress: event.getClientAddress()
	});

	return json({ data: { overallStatus: result.overallStatus } });
};
