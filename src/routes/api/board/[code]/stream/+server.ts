import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types.js';
import { getBoardData } from '$lib/server/board/index.js';
import postgres from 'postgres';

/**
 * SSE endpoint: GET /api/board/[code]/stream
 *
 * Strategi:
 * - Buka koneksi Postgres dedicated (tidak bisa pakai pool untuk LISTEN).
 * - LISTEN ke channel `board_<code>` — pg_notify dikirim oleh trigger DB saat
 *   ada INSERT/UPDATE di tabel `inspections` dengan lineCode = code.
 * - Saat menerima notifikasi, query ulang getBoardData lalu push ke client sebagai
 *   SSE event `update`.
 * - Saat client disconnect (request.signal abort), cleanup UNLISTEN + tutup koneksi.
 *
 * Trigger SQL (harus dijalankan manual / migration):
 *   CREATE OR REPLACE FUNCTION notify_board_update()
 *   RETURNS trigger LANGUAGE plpgsql AS $$
 *   BEGIN
 *     PERFORM pg_notify('board_' || NEW.line_code, NEW.line_code);
 *     RETURN NEW;
 *   END;
 *   $$;
 *
 *   CREATE OR REPLACE TRIGGER trg_notify_board
 *   AFTER INSERT OR UPDATE ON inspections
 *   FOR EACH ROW EXECUTE FUNCTION notify_board_update();
 *
 * Route ini PUBLIC — tidak butuh auth.
 */
export const GET: RequestHandler = async ({ params, request }) => {
	const { code } = params;

	// Validasi line exists dulu sebelum buka koneksi
	const initial = await getBoardData(code);
	if (!initial) {
		return new Response('Line not found', { status: 404 });
	}

	const channel = `board_${code}`;

	const stream = new ReadableStream({
		async start(controller) {
			const send = (event: string, data: unknown) => {
				try {
					controller.enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
				} catch {
					// Controller mungkin sudah closed
				}
			};

			// Kirim data awal
			send('init', initial);

			let sql: ReturnType<typeof postgres> | null = null;

			try {
				sql = postgres(env.DATABASE_URL!, { max: 1 });

				// LISTEN menggunakan subscribe API postgres.js
				await sql.listen(channel, async () => {
					try {
						const fresh = await getBoardData(code);
						if (fresh) send('update', fresh);
					} catch {
						// Jangan crash SSE karena query error sementara
					}
				});

				// Cleanup saat client disconnect — cukup end() koneksi,
				// postgres.js akan UNLISTEN otomatis saat koneksi ditutup.
				request.signal.addEventListener('abort', async () => {
					try {
						await sql!.end({ timeout: 2 });
					} catch {
						// ignore
					}
					try {
						controller.close();
					} catch {
						// ignore
					}
				});
			} catch {
				// Gagal setup LISTEN — kirim error ke client lalu tutup
				send('error', { message: 'Realtime unavailable' });
				try {
					await sql?.end({ timeout: 2 });
				} catch {
					// ignore
				}
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no' // disable Nginx buffering
		}
	});
};
