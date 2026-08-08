import { fail, redirect } from '@sveltejs/kit';
import { setSessionCookie, signSession } from '$lib/server/auth.js';
import { getUserWithPermissions } from '$lib/server/permissions.js';
import { verifyPassword } from '$lib/server/password.js';
import { enforceRateLimit } from '$lib/server/rate-limit.js';
import { logAction } from '$lib/server/audit.js';

export const actions = {
	default: async (event) => {
		const { request, cookies } = event;
		const formData = await request.formData();
		const nik = String(formData.get('nik') ?? '').trim();
		const password = String(formData.get('password') ?? '');

		if (!nik || !password) {
			return fail(400, { nik, message: 'NIK dan password wajib diisi.' });
		}

		const ip = event.getClientAddress();
		await enforceRateLimit('login', ip);

		const user = await getUserWithPermissions(nik);

		if (!user || !user.isActive) {
			await logAction(null, {
				action: 'login_failed',
				entity: 'auth',
				metadata: { nik, reason: 'user_not_found_or_inactive' },
				ipAddress: ip
			});
			return fail(401, { nik, message: 'NIK atau password salah.' });
		}

		const valid = await verifyPassword(user.password, password);

		if (!valid) {
			await logAction(null, {
				action: 'login_failed',
				entity: 'auth',
				metadata: { userId: user.id, nik: user.nik, reason: 'invalid_password' },
				ipAddress: ip
			});
			return fail(401, { nik, message: 'NIK atau password salah.' });
		}

		const token = await signSession({ id: user.id, nik: user.nik, name: user.name });
		setSessionCookie(cookies, token);

		await logAction(user, {
			action: 'login_success',
			entity: 'auth',
			ipAddress: ip
		});

		redirect(303, '/dashboard');
	}
};
