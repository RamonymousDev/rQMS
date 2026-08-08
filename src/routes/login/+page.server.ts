import { fail, redirect } from '@sveltejs/kit';
import { setSessionCookie, signSession } from '$lib/server/auth.js';
import { getUserWithPermissions } from '$lib/server/permissions.js';
import { verifyPassword } from '$lib/server/password.js';

export const actions = {
	default: async ({ request, cookies }) => {
		const formData = await request.formData();
		const nik = String(formData.get('nik') ?? '').trim();
		const password = String(formData.get('password') ?? '');

		if (!nik || !password) {
			return fail(400, { nik, message: 'NIK dan password wajib diisi.' });
		}

		const user = await getUserWithPermissions(nik);

		if (!user || !user.isActive) {
			return fail(401, { nik, message: 'NIK atau password salah.' });
		}

		const valid = await verifyPassword(user.password, password);

		if (!valid) {
			return fail(401, { nik, message: 'NIK atau password salah.' });
		}

		const token = await signSession({ id: user.id, nik: user.nik, name: user.name });
		setSessionCookie(cookies, token);

		redirect(303, '/dashboard');
	}
};
