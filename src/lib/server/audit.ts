import { error } from '@sveltejs/kit';
import { and, count, desc, eq, gte, lt, type SQL } from 'drizzle-orm';
import { db } from './db/index.js';
import { auditLogs } from './db/schema.js';
import { parseJakartaDate } from './shift.js';

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 1) return fallback;
	return Math.min(parsed, max);
}

/** Filter audit log. Rentang tanggal memakai hari kalender Jakarta (bukan shift). */
export async function listAuditLogs(params: URLSearchParams) {
	const filters: SQL[] = [];

	const action = params.get('action')?.trim();
	if (action) filters.push(eq(auditLogs.action, action));

	const entity = params.get('entity')?.trim();
	if (entity) filters.push(eq(auditLogs.entity, entity));

	const actorNik = params.get('actorNik')?.trim();
	if (actorNik) filters.push(eq(auditLogs.actorNik, actorNik));

	const dateFrom = params.get('dateFrom')?.trim();
	if (dateFrom) {
		const start = parseJakartaDate(dateFrom);
		if (!start) throw error(400, 'Format dateFrom harus YYYY-MM-DD.');
		filters.push(gte(auditLogs.createdAt, start));
	}

	const dateTo = params.get('dateTo')?.trim();
	if (dateTo) {
		const start = parseJakartaDate(dateTo);
		if (!start) throw error(400, 'Format dateTo harus YYYY-MM-DD.');
		filters.push(lt(auditLogs.createdAt, new Date(start.getTime() + DAY_MS)));
	}

	const where = filters.length ? and(...filters) : undefined;
	const page = parsePositiveInt(params.get('page'), 1, Number.MAX_SAFE_INTEGER);
	const pageSize = parsePositiveInt(params.get('pageSize'), PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX);

	const [rows, [total]] = await Promise.all([
		db.query.auditLogs.findMany({
			where,
			orderBy: [desc(auditLogs.createdAt)],
			limit: pageSize,
			offset: (page - 1) * pageSize
		}),
		db.select({ value: count() }).from(auditLogs).where(where)
	]);

	return {
		rows,
		page,
		pageSize,
		total: total.value,
		totalPages: Math.max(1, Math.ceil(total.value / pageSize))
	};
}

type AuditActor = {
	id: string;
	nik: string;
	name: string;
};

type AuditOptions = {
	action: string;
	entity?: string;
	entityId?: string;
	metadata?: Record<string, unknown>;
	ipAddress?: string;
};

export async function logAction(user: AuditActor | null, opts: AuditOptions) {
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

export async function requireActor(user: AuditActor | null): Promise<AuditActor> {
	if (!user) throw error(401, 'Tidak terautentikasi.');
	return user;
}
