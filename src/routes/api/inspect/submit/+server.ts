import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireUser } from '$lib/server/inspections/guard.js';
import { submitInspection } from '$lib/server/inspections/index.js';
import { enforceRateLimit } from '$lib/server/rate-limit.js';
import { logAction } from '$lib/server/audit.js';

export const POST: RequestHandler = async (event) => {
	const user = requireUser(event.locals.user);
	await enforceRateLimit('submit', user.id);
	const payload = await event.request.json();
	const data = await submitInspection(user, payload);
	await logAction(user, {
		action: 'submit_inspection',
		entity: 'inspections',
		entityId: data.id,
		metadata: {
			partNo: payload.partNo,
			lineId: payload.lineId,
			stage: payload.stage,
			shift: data.shift,
			overallStatus: data.overallStatus
		},
		ipAddress: event.getClientAddress()
	});
	return json({ data }, { status: 201 });
};
