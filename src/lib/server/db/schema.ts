import {
	pgTable,
	pgEnum,
	uuid,
	varchar,
	boolean,
	integer,
	timestamp,
	text,
	jsonb,
	uniqueIndex,
	index
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ======================
// ENUMS
// Hanya nilai yang benar-benar fixed oleh business process
// ======================
export const stageEnum = pgEnum('stage', ['START', 'MIDDLE', 'END']);
export const shiftEnum = pgEnum('shift', ['DAY', 'NIGHT']);
/** Status item & overall. REPAIR = NG yang sudah ditangani admin (wajib action). */
export const okNgEnum = pgEnum('ok_ng', ['OK', 'NG', 'REPAIR']);
/** Tipe item yang bisa ditandai repair oleh admin. */
export const repairItemEnum = pgEnum('repair_item', [
	'POINT',
	'HARDWARE',
	'LENGTH',
	'SPOT',
	'VISUAL'
]);
/** Tipe pengecekan hardware — keduanya numerik dengan aturan actual >= standard. */
export const checkTypeEnum = pgEnum('check_type', ['TORQUE', 'HAMMER']);

// ======================
// MASTER: PERMISSIONS
// Admin bebas membuat: rsw_check, stamping_line_a, painting_1, dll
// ======================
export const permissions = pgTable('permissions', {
	id: uuid('id').defaultRandom().primaryKey(),
	code: varchar('code', { length: 50 }).notNull().unique(),
	name: varchar('name', { length: 100 }).notNull(),
	isActive: boolean('is_active').default(true).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// ======================
// MASTER: PROCESSES
// ======================
export const processes = pgTable('processes', {
	id: uuid('id').defaultRandom().primaryKey(),
	name: varchar('name', { length: 100 }).notNull().unique(), // "Welding", "Stamping", "Painting"
	isActive: boolean('is_active').default(true).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// ======================
// MASTER: LINES (child of Process)
// ======================
export const lines = pgTable(
	'lines',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		processId: uuid('process_id')
			.notNull()
			.references(() => processes.id),
		code: varchar('code', { length: 50 }).notNull().unique(), // "RSW"
		name: varchar('name', { length: 100 }).notNull(),
		requiredPermissionId: uuid('required_permission_id')
			.notNull()
			.references(() => permissions.id),
		isActive: boolean('is_active').default(true).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		index('idx_lines_process').on(table.processId),
		index('idx_lines_permission').on(table.requiredPermissionId)
	]
);

// ======================
// MASTER: PARTS
// ======================
export const parts = pgTable('parts', {
	id: uuid('id').defaultRandom().primaryKey(),
	partNo: varchar('part_no', { length: 50 }).notNull().unique(),
	partName: varchar('part_name', { length: 150 }).notNull(),
	isActive: boolean('is_active').default(true).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// ======================
// MASTER: HARDWARES
// Hanya identitas. Standard ditentukan di Part+Line Config.
// ======================
export const hardwares = pgTable('hardwares', {
	id: uuid('id').defaultRandom().primaryKey(),
	hwNo: varchar('hw_no', { length: 50 }).notNull().unique(),
	hwName: varchar('hw_name', { length: 100 }).notNull(),
	isActive: boolean('is_active').default(true).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// ======================
// USERS
// ======================
export const users = pgTable('users', {
	id: uuid('id').defaultRandom().primaryKey(),
	nik: varchar('nik', { length: 20 }).notNull().unique(),
	name: varchar('name', { length: 100 }).notNull(),
	password: varchar('password', { length: 255 }).notNull(), // hashed
	passwordHistory: jsonb('password_history').$type<string[]>().default([]).notNull(),
	isActive: boolean('is_active').default(true).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// ======================
// USER ↔ PERMISSIONS
// ======================
export const userPermissions = pgTable(
	'user_permissions',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		permissionId: uuid('permission_id')
			.notNull()
			.references(() => permissions.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		uniqueIndex('uq_user_permission').on(table.userId, table.permissionId),
		index('idx_user_permissions_user').on(table.userId)
	]
);

// ======================
// PART + LINE CONFIG (Header)
// ======================
export const partLineConfigs = pgTable(
	'part_line_configs',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		partId: uuid('part_id')
			.notNull()
			.references(() => parts.id),
		lineId: uuid('line_id')
			.notNull()
			.references(() => lines.id),

		hasSpot: boolean('has_spot').default(false).notNull(),
		spotStandard: integer('spot_standard'), // hanya dipakai jika hasSpot = true

		hasPoint: boolean('has_point').default(false).notNull(),
		hasHardware: boolean('has_hardware').default(false).notNull(),
		hasLength: boolean('has_length').default(false).notNull(),
		hasVisual: boolean('has_visual').default(false).notNull(),

		isActive: boolean('is_active').default(true).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		uniqueIndex('uq_part_line').on(table.partId, table.lineId),
		index('idx_part_line_configs_part').on(table.partId),
		index('idx_part_line_configs_line').on(table.lineId)
	]
);

// ======================
// CONFIG DETAIL: POINTS
// ======================
export const partLinePoints = pgTable(
	'part_line_points',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		partLineConfigId: uuid('part_line_config_id')
			.notNull()
			.references(() => partLineConfigs.id, { onDelete: 'cascade' }),
		pointNo: varchar('point_no', { length: 30 }).notNull(),
		sequence: integer('sequence').default(0).notNull()
	},
	(table) => [
		uniqueIndex('uq_point_per_config').on(table.partLineConfigId, table.pointNo),
		index('idx_part_line_points_config').on(table.partLineConfigId)
	]
);

// ======================
// CONFIG DETAIL: HARDWARES
// Standard ditentukan di sini (bukan di master hardware)
// ======================
export const partLineHardwares = pgTable(
	'part_line_hardwares',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		partLineConfigId: uuid('part_line_config_id')
			.notNull()
			.references(() => partLineConfigs.id, { onDelete: 'cascade' }),
		hardwareId: uuid('hardware_id')
			.notNull()
			.references(() => hardwares.id),
		// Tipe pengecekan + jumlah titik yang diperiksa dengan hardware ini.
		// Standard & unit dipakai bersama oleh semua titik (qty).
		checkType: checkTypeEnum('check_type').notNull().default('TORQUE'),
		qty: integer('qty').default(1).notNull(),
		standardValue: integer('standard_value').notNull(),
		unit: varchar('unit', { length: 20 }).notNull(), // "kgf", "mm", dll (bebas)
		sequence: integer('sequence').default(0).notNull()
	},
	(table) => [
		uniqueIndex('uq_hardware_per_config').on(table.partLineConfigId, table.hardwareId),
		index('idx_part_line_hardwares_config').on(table.partLineConfigId)
	]
);

// ======================
// CONFIG DETAIL: LENGTHS (bisa 1 atau lebih)
// ======================
export const partLineLengths = pgTable(
	'part_line_lengths',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		partLineConfigId: uuid('part_line_config_id')
			.notNull()
			.references(() => partLineConfigs.id, { onDelete: 'cascade' }),
		lengthNo: varchar('length_no', { length: 30 }).notNull(),
		standardMm: integer('standard_mm').notNull(),
		sequence: integer('sequence').default(0).notNull()
	},
	(table) => [
		uniqueIndex('uq_length_per_config').on(table.partLineConfigId, table.lengthNo),
		index('idx_part_line_lengths_config').on(table.partLineConfigId)
	]
);

// ======================
// TRANSAKSI: INSPECTION HEADER
// ======================
export const inspections = pgTable(
	'inspections',
	{
		id: uuid('id').defaultRandom().primaryKey(),

		partLineConfigId: uuid('part_line_config_id')
			.notNull()
			.references(() => partLineConfigs.id),

		// Snapshot untuk historical accuracy + kemudahan reporting
		partNo: varchar('part_no', { length: 50 }).notNull(),
		lineCode: varchar('line_code', { length: 50 }).notNull(),

		stage: stageEnum('stage').notNull(),
		shift: shiftEnum('shift').notNull(),

		overallStatus: okNgEnum('overall_status').notNull(),

		spotActual: integer('spot_actual'),
		// Snapshot status spot saat submit (rule exact). Null untuk inspeksi lama.
		spotStatus: okNgEnum('spot_status'),
		visualStatus: okNgEnum('visual_status'),
		visualRemarks: text('visual_remarks'),

		operatorId: uuid('operator_id')
			.notNull()
			.references(() => users.id),
		operatorName: varchar('operator_name', { length: 100 }).notNull(), // snapshot

		inspectedAt: timestamp('inspected_at', { withTimezone: true }).defaultNow().notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		// Index untuk cek re-check (part+line+stage+shift) dan reporting
		index('idx_inspection_config_stage_shift').on(
			table.partLineConfigId,
			table.stage,
			table.shift,
			table.inspectedAt
		),
		index('idx_inspection_operator').on(table.operatorId),
		index('idx_inspection_part_no').on(table.partNo),
		index('idx_inspection_line_code').on(table.lineCode)
	]
);

// ======================
// TRANSAKSI DETAIL: POINTS
// ======================
export const inspectionPoints = pgTable(
	'inspection_points',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		inspectionId: uuid('inspection_id')
			.notNull()
			.references(() => inspections.id, { onDelete: 'cascade' }),
		pointNo: varchar('point_no', { length: 30 }).notNull(), // snapshot
		status: okNgEnum('status').notNull(),
		remarks: text('remarks')
	},
	(table) => [index('idx_inspection_points_inspection').on(table.inspectionId)]
);

// ======================
// TRANSAKSI DETAIL: HARDWARES
// ======================
export const inspectionHardwares = pgTable(
	'inspection_hardwares',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		inspectionId: uuid('inspection_id')
			.notNull()
			.references(() => inspections.id, { onDelete: 'cascade' }),
		hwNo: varchar('hw_no', { length: 50 }).notNull(), // snapshot
		hwName: varchar('hw_name', { length: 100 }).notNull(), // snapshot
		// Snapshot tipe & nomor titik. checkType null untuk inspeksi lama
		// (sebelum fitur tipe pengecekan) — jangan dipalsukan saat menampilkan.
		checkType: checkTypeEnum('check_type'),
		checkNo: integer('check_no').default(1).notNull(),
		standardValue: integer('standard_value').notNull(), // snapshot
		unit: varchar('unit', { length: 20 }).notNull(),
		actualValue: integer('actual_value').notNull(),
		status: okNgEnum('status').notNull(),
		remarks: text('remarks')
	},
	(table) => [index('idx_inspection_hardwares_inspection').on(table.inspectionId)]
);

// ======================
// TRANSAKSI DETAIL: LENGTHS
// ======================
export const inspectionLengths = pgTable(
	'inspection_lengths',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		inspectionId: uuid('inspection_id')
			.notNull()
			.references(() => inspections.id, { onDelete: 'cascade' }),
		lengthNo: varchar('length_no', { length: 30 }).notNull(), // snapshot
		standardMm: integer('standard_mm').notNull(), // snapshot
		actualMm: integer('actual_mm').notNull(),
		status: okNgEnum('status').notNull(),
		remarks: text('remarks')
	},
	(table) => [index('idx_inspection_lengths_inspection').on(table.inspectionId)]
);

// ======================
// TRANSAKSI: REPAIR (admin menandai item NG sudah diperbaiki)
// Append-only: revert mengisi revertedAt pada baris aktif, bukan menghapus.
// ======================
export const inspectionRepairs = pgTable(
	'inspection_repairs',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		inspectionId: uuid('inspection_id')
			.notNull()
			.references(() => inspections.id, { onDelete: 'cascade' }),
		/** Spot & Visual tidak punya baris child; itemId null untuk keduanya. */
		itemType: repairItemEnum('item_type').notNull(),
		itemId: uuid('item_id'),
		action: text('action').notNull(),
		actorId: uuid('actor_id')
			.notNull()
			.references(() => users.id),
		actorName: varchar('actor_name', { length: 100 }).notNull(), // snapshot
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		revertedAt: timestamp('reverted_at', { withTimezone: true })
	},
	(table) => [index('idx_inspection_repairs_inspection').on(table.inspectionId)]
);

// ======================
// RELATIONS
// ======================
export const permissionsRelations = relations(permissions, ({ many }) => ({
	lines: many(lines),
	userPermissions: many(userPermissions)
}));

export const processesRelations = relations(processes, ({ many }) => ({
	lines: many(lines)
}));

export const linesRelations = relations(lines, ({ one, many }) => ({
	process: one(processes, {
		fields: [lines.processId],
		references: [processes.id]
	}),
	requiredPermission: one(permissions, {
		fields: [lines.requiredPermissionId],
		references: [permissions.id]
	}),
	partLineConfigs: many(partLineConfigs)
}));

export const partsRelations = relations(parts, ({ many }) => ({
	partLineConfigs: many(partLineConfigs)
}));

export const hardwaresRelations = relations(hardwares, ({ many }) => ({
	partLineHardwares: many(partLineHardwares)
}));

export const usersRelations = relations(users, ({ many }) => ({
	userPermissions: many(userPermissions),
	inspections: many(inspections)
}));

export const userPermissionsRelations = relations(userPermissions, ({ one }) => ({
	user: one(users, {
		fields: [userPermissions.userId],
		references: [users.id]
	}),
	permission: one(permissions, {
		fields: [userPermissions.permissionId],
		references: [permissions.id]
	})
}));

export const partLineConfigsRelations = relations(partLineConfigs, ({ one, many }) => ({
	part: one(parts, {
		fields: [partLineConfigs.partId],
		references: [parts.id]
	}),
	line: one(lines, {
		fields: [partLineConfigs.lineId],
		references: [lines.id]
	}),
	points: many(partLinePoints),
	hardwares: many(partLineHardwares),
	lengths: many(partLineLengths),
	inspections: many(inspections)
}));

export const partLinePointsRelations = relations(partLinePoints, ({ one }) => ({
	partLineConfig: one(partLineConfigs, {
		fields: [partLinePoints.partLineConfigId],
		references: [partLineConfigs.id]
	})
}));

export const partLineHardwaresRelations = relations(partLineHardwares, ({ one }) => ({
	partLineConfig: one(partLineConfigs, {
		fields: [partLineHardwares.partLineConfigId],
		references: [partLineConfigs.id]
	}),
	hardware: one(hardwares, {
		fields: [partLineHardwares.hardwareId],
		references: [hardwares.id]
	})
}));

export const partLineLengthsRelations = relations(partLineLengths, ({ one }) => ({
	partLineConfig: one(partLineConfigs, {
		fields: [partLineLengths.partLineConfigId],
		references: [partLineConfigs.id]
	})
}));

export const inspectionsRelations = relations(inspections, ({ one, many }) => ({
	partLineConfig: one(partLineConfigs, {
		fields: [inspections.partLineConfigId],
		references: [partLineConfigs.id]
	}),
	operator: one(users, {
		fields: [inspections.operatorId],
		references: [users.id]
	}),
	points: many(inspectionPoints),
	hardwares: many(inspectionHardwares),
	lengths: many(inspectionLengths),
	repairs: many(inspectionRepairs)
}));

export const inspectionRepairsRelations = relations(inspectionRepairs, ({ one }) => ({
	inspection: one(inspections, {
		fields: [inspectionRepairs.inspectionId],
		references: [inspections.id]
	}),
	actor: one(users, {
		fields: [inspectionRepairs.actorId],
		references: [users.id]
	})
}));

export const inspectionPointsRelations = relations(inspectionPoints, ({ one }) => ({
	inspection: one(inspections, {
		fields: [inspectionPoints.inspectionId],
		references: [inspections.id]
	})
}));

export const inspectionHardwaresRelations = relations(inspectionHardwares, ({ one }) => ({
	inspection: one(inspections, {
		fields: [inspectionHardwares.inspectionId],
		references: [inspections.id]
	})
}));

export const inspectionLengthsRelations = relations(inspectionLengths, ({ one }) => ({
	inspection: one(inspections, {
		fields: [inspectionLengths.inspectionId],
		references: [inspections.id]
	})
}));

// ======================
// AUDIT LOGS
// ======================
export const auditLogs = pgTable('audit_logs', {
	id: uuid('id').defaultRandom().primaryKey(),
	actorId: uuid('actor_id').references(() => users.id),
	actorNik: varchar('actor_nik', { length: 20 }),
	action: varchar('action', { length: 100 }).notNull(),
	entity: varchar('entity', { length: 100 }),
	entityId: varchar('entity_id', { length: 100 }),
	metadata: jsonb('metadata').default({}),
	ipAddress: varchar('ip_address', { length: 45 }),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
	actor: one(users, {
		fields: [auditLogs.actorId],
		references: [users.id]
	})
}));
