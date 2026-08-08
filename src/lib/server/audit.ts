import { error } from '@sveltejs/kit';
import { db } from './db/index.js';
import { auditLogs } from './db/schema.js';
import type { SessionUser } from './auth.js';

type AuditOptions = {
	action: string;
	entity?: string;
	entityId?: string;
	metadata?: Record<string, unknown>;
	ipAddress?: string;
};

export async function logAction(user: SessionUser | null, opts: AuditOptions) {
	try {
		await db.insert(auditLogs).values({
			actorId: user?.id ?? null,
			actorNik: user?.nik ?? null,
			action: opts.action,
			entity: opts.entity ?? null,
			entityId: opts.entityId ?? null,
			metadata: opts.metadata ?? {},
			ipAddress: opts.ipAddress ?? null
		});
	} catch {
		// Audit log failure should not break the main flow.
	}
}

export async function requireActor(user: SessionUser | null): Promise<SessionUser> {
	if (!user) throw error(401, 'Tidak terautentikasi.');
	return user;
}
