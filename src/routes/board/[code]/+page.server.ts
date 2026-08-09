import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import { getBoardData } from '$lib/server/board/index.js';

/**
 * Route PUBLIC — tidak ada auth guard.
 * hooks.server.ts hanya set locals.user, tidak redirect kalau user null,
 * sehingga halaman ini aman diakses tanpa login.
 */
export const load: PageServerLoad = async ({ params, url }) => {
	// `?date=YYYY-MM-DD` memilih hari operasional; kosong/invalid → hari berjalan.
	const data = await getBoardData(params.code, url.searchParams.get('date'));

	if (!data) {
		error(404, `Line "${params.code}" tidak ditemukan.`);
	}

	return {
		line: data.line,
		parts: data.parts,
		date: data.date,
		today: data.today,
		currentShift: data.currentShift
	};
};
