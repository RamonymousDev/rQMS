import { listPermissions, createPermission, updatePermission } from './permissions.js';
import { listProcesses, createProcess, updateProcess } from './processes.js';
import { listLines, createLine, updateLine } from './lines.js';
import { listParts, createPart, updatePart } from './parts.js';
import { listHardwares, createHardware, updateHardware } from './hardwares.js';
import { listUsers, createUser, updateUser } from './users.js';

export type MasterService = {
	list: () => Promise<unknown[]>;
	create: (body: unknown) => Promise<unknown>;
	update: (id: string, body: unknown) => Promise<unknown>;
};

export const masterServices: Record<string, MasterService> = {
	permissions: { list: listPermissions, create: createPermission, update: updatePermission },
	processes: { list: listProcesses, create: createProcess, update: updateProcess },
	lines: { list: listLines, create: createLine, update: updateLine },
	parts: { list: listParts, create: createPart, update: updatePart },
	hardwares: { list: listHardwares, create: createHardware, update: updateHardware },
	users: { list: listUsers, create: createUser, update: updateUser }
};
