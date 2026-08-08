import argon2 from 'argon2';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/lib/server/db/schema.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	console.error('DATABASE_URL is not set');
	process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql, { schema });

const {
	hardwares,
	lines,
	partLineConfigs,
	partLineHardwares,
	partLineLengths,
	partLinePoints,
	parts,
	permissions,
	processes,
	userPermissions,
	users
} = schema;

async function getOrCreatePermission(code: string, name: string) {
	const existing = await db.query.permissions.findFirst({
		where: (p, { eq }) => eq(p.code, code)
	});
	if (existing) return existing;
	const [created] = await db.insert(permissions).values({ code, name }).returning();
	return created;
}

async function getOrCreateProcess(name: string) {
	const existing = await db.query.processes.findFirst({
		where: (p, { eq }) => eq(p.name, name)
	});
	if (existing) return existing;
	const [created] = await db.insert(processes).values({ name }).returning();
	return created;
}

async function getOrCreateLine(
	code: string,
	name: string,
	processId: string,
	permissionId: string
) {
	const existing = await db.query.lines.findFirst({
		where: (l, { eq }) => eq(l.code, code)
	});
	if (existing) return existing;
	const [created] = await db
		.insert(lines)
		.values({ code, name, processId, requiredPermissionId: permissionId })
		.returning();
	return created;
}

async function getOrCreatePart(partNo: string, partName: string) {
	const existing = await db.query.parts.findFirst({
		where: (p, { eq }) => eq(p.partNo, partNo)
	});
	if (existing) return existing;
	const [created] = await db.insert(parts).values({ partNo, partName }).returning();
	return created;
}

async function getOrCreateHardware(hwNo: string, hwName: string) {
	const existing = await db.query.hardwares.findFirst({
		where: (h, { eq }) => eq(h.hwNo, hwNo)
	});
	if (existing) return existing;
	const [created] = await db.insert(hardwares).values({ hwNo, hwName }).returning();
	return created;
}

async function getOrCreateUser(nik: string, name: string, password: string) {
	const existing = await db.query.users.findFirst({
		where: (u, { eq }) => eq(u.nik, nik)
	});
	if (existing) return existing;
	const hashed = await argon2.hash(password);
	const [created] = await db.insert(users).values({ nik, name, password: hashed }).returning();
	return created;
}

async function assignPermissions(userId: string, permissionIds: string[]) {
	for (const permissionId of permissionIds) {
		await db.insert(userPermissions).values({ userId, permissionId }).onConflictDoNothing();
	}
}

/**
 * Konfigurasi contoh dari QMS.md §8 (Part 64300 di Line RSW) supaya alur
 * operator langsung bisa dicoba setelah seed. Idempoten: kalau kombinasi
 * part+line sudah ada, konfigurasi dibiarkan apa adanya.
 */
async function getOrCreateConfig(
	partId: string,
	lineId: string,
	hardwareStandards: { hardwareId: string; standardValue: number; unit: string }[]
) {
	const existing = await db.query.partLineConfigs.findFirst({
		where: (c, { and, eq }) => and(eq(c.partId, partId), eq(c.lineId, lineId))
	});
	if (existing) return { config: existing, created: false };

	const [config] = await db
		.insert(partLineConfigs)
		.values({
			partId,
			lineId,
			hasSpot: true,
			spotStandard: 12,
			hasPoint: true,
			hasHardware: true,
			hasLength: true,
			hasVisual: true
		})
		.returning();

	await db.insert(partLinePoints).values(
		['Point 1', 'Point 2', 'Point 3'].map((pointNo, sequence) => ({
			partLineConfigId: config.id,
			pointNo,
			sequence
		}))
	);
	await db.insert(partLineHardwares).values(
		hardwareStandards.map((hw, sequence) => ({
			partLineConfigId: config.id,
			...hw,
			sequence
		}))
	);
	await db.insert(partLineLengths).values(
		[
			{ lengthNo: 'Length 1', standardMm: 120 },
			{ lengthNo: 'Length 2', standardMm: 85 }
		].map((len, sequence) => ({ partLineConfigId: config.id, ...len, sequence }))
	);

	return { config, created: true };
}

const seedPassword = 'password123';

const permissionRswCheck = await getOrCreatePermission('rsw_check', 'RSW Check');
const permissionAdmin = await getOrCreatePermission('admin_access', 'Admin Access');

const processWelding = await getOrCreateProcess('Welding');
const lineRsw = await getOrCreateLine(
	'RSW',
	'Resistance Spot Welding',
	processWelding.id,
	permissionRswCheck.id
);

const part64300 = await getOrCreatePart('64300', 'Part 64300');
const hardwareBolt = await getOrCreateHardware('12911', 'Bolt M8 Torque');
const hardwareNugget = await getOrCreateHardware('13900', 'Nugget');

const userAdmin = await getOrCreateUser('ADMIN001', 'Admin System', seedPassword);
const userOpr = await getOrCreateUser('OPR001', 'Operator 1', seedPassword);

await assignPermissions(userAdmin.id, [permissionAdmin.id, permissionRswCheck.id]);
await assignPermissions(userOpr.id, [permissionRswCheck.id]);

const { created: configCreated } = await getOrCreateConfig(part64300.id, lineRsw.id, [
	{ hardwareId: hardwareBolt.id, standardValue: 50, unit: 'kgf' },
	{ hardwareId: hardwareNugget.id, standardValue: 5, unit: 'mm' }
]);

console.log('Seed selesai:');
console.log(`  permissions : ${permissionRswCheck.code}, ${permissionAdmin.code}`);
console.log(`  process     : ${processWelding.name}`);
console.log(`  line        : ${lineRsw.code} (${lineRsw.name})`);
console.log(`  users       : ${userAdmin.nik}, ${userOpr.nik} (password: ${seedPassword})`);
console.log(
	`  config      : ${part64300.partNo} @ ${lineRsw.code} ${configCreated ? '(dibuat)' : '(sudah ada)'}`
);

// Trigger realtime board (CREATE OR REPLACE — aman dijalankan berulang)
await sql`
  CREATE OR REPLACE FUNCTION notify_board_update()
  RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    PERFORM pg_notify('board_' || NEW.line_code, NEW.line_code);
    RETURN NEW;
  END;
  $$
`;
await sql`
  CREATE OR REPLACE TRIGGER trg_notify_board
  AFTER INSERT OR UPDATE ON inspections
  FOR EACH ROW EXECUTE FUNCTION notify_board_update()
`;
console.log('  trigger     : trg_notify_board (board realtime)');

await sql.end();
