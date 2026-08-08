import { z } from 'zod';

export const permissionSchema = z.object({
	code: z.string().trim().min(1, 'Code wajib diisi').max(50, 'Code maksimal 50 karakter'),
	name: z.string().trim().min(1, 'Name wajib diisi').max(100, 'Name maksimal 100 karakter'),
	isActive: z.boolean().optional()
});

export const processSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, 'Nama process wajib diisi')
		.max(100, 'Nama process maksimal 100 karakter'),
	isActive: z.boolean().optional()
});

export const lineSchema = z.object({
	processId: z.uuid('Process tidak valid'),
	code: z.string().trim().min(1, 'Code wajib diisi').max(50, 'Code maksimal 50 karakter'),
	name: z
		.string()
		.trim()
		.min(1, 'Nama line wajib diisi')
		.max(100, 'Nama line maksimal 100 karakter'),
	requiredPermissionId: z.uuid('Permission tidak valid'),
	isActive: z.boolean().optional()
});

export const partSchema = z.object({
	partNo: z.string().trim().min(1, 'Part No wajib diisi').max(50, 'Part No maksimal 50 karakter'),
	partName: z
		.string()
		.trim()
		.min(1, 'Part Name wajib diisi')
		.max(150, 'Part Name maksimal 150 karakter'),
	isActive: z.boolean().optional()
});

export const hardwareSchema = z.object({
	hwNo: z.string().trim().min(1, 'HW No wajib diisi').max(50, 'HW No maksimal 50 karakter'),
	hwName: z.string().trim().min(1, 'HW Name wajib diisi').max(100, 'HW Name maksimal 100 karakter'),
	isActive: z.boolean().optional()
});

export const userSchema = z.object({
	nik: z.string().trim().min(1, 'NIK wajib diisi').max(20, 'NIK maksimal 20 karakter'),
	name: z.string().trim().min(1, 'Nama wajib diisi').max(100, 'Nama maksimal 100 karakter'),
	password: z.string().min(6, 'Password minimal 6 karakter'),
	permissionIds: z.array(z.uuid('Permission tidak valid')).default([]),
	isActive: z.boolean().optional()
});

export const userUpdateSchema = z.object({
	nik: z.string().trim().min(1, 'NIK wajib diisi').max(20, 'NIK maksimal 20 karakter').optional(),
	name: z
		.string()
		.trim()
		.min(1, 'Nama wajib diisi')
		.max(100, 'Nama maksimal 100 karakter')
		.optional(),
	password: z.string().min(6, 'Password minimal 6 karakter').optional(),
	permissionIds: z.array(z.uuid('Permission tidak valid')).optional(),
	isActive: z.boolean().optional()
});
