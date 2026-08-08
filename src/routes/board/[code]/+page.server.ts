import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import { getBoardData } from '$lib/server/board/index.js';

/**
 * Route PUBLIC — tidak ada auth guard.
 * hooks.server.ts hanya set locals.user, tidak redirect kalau user null,
 * sehingga halaman ini aman diakses tanpa login.
 */
export const load: PageServerLoad = async ({ params }) => {
	const data = await getBoardData(params.code);

	if (!data) {
		error(404, `Line "${params.code}" tidak ditemukan.`);
	}

	return {
		line: data.line,
		parts: data.parts
	};
};
