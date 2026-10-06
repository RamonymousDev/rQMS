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
 * Query `?date=YYYY-MM-DD` membatasi data ke satu hari operasional. Kalau tidak
 * diberikan, `date` dibiarkan null sehingga setiap refresh menghitung ulang hari
 * operasional berjalan — board yang dibiarkan terbuka melewati batas 07:30 WIB
 * ikut berpindah hari dengan sendirinya.
 *
 * Route ini PUBLIC — tidak butuh auth.
 */
export const GET: RequestHandler = async ({ params, request, url }) => {
	const { code } = params;
	const date = url.searchParams.get('date');

	// Validasi line exists dulu sebelum buka koneksi
	const initial = await getBoardData(code, date);
	if (!initial) {
		return new Response('Line not found', { status: 404 });
	}

	const channel = `board_${code}`;

	// State koneksi dipakai bersama `start` dan `cancel` agar cleanup idempoten —
	// klien yang putus bisa memicu keduanya (abort + cancel), dan tanpa guard
	// koneksi Postgres dedicated bisa bocor sampai max_connections habis.
	let sql: ReturnType<typeof postgres> | null = null;
	let heartbeat: ReturnType<typeof setInterval> | undefined;
	let closed = false;
	let controllerRef: ReadableStreamDefaultController<string> | null = null;

	const cleanup = async () => {
		if (closed) return;
		closed = true;
		if (heartbeat) clearInterval(heartbeat);
		try {
			await sql?.end({ timeout: 2 });
		} catch {
			// ignore
		}
		try {
			controllerRef?.close();
		} catch {
			// ignore
		}
	};

	const stream = new ReadableStream<string>({
		async start(controller) {
			controllerRef = controller;

			const send = (event: string, data: unknown) => {
				if (closed) return;
				try {
					controller.enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
				} catch {
					// Controller mungkin sudah closed
				}
			};

			// Kirim data awal
			send('init', initial);

			try {
				sql = postgres(env.DATABASE_URL!, { max: 1 });

				// LISTEN menggunakan subscribe API postgres.js
				await sql.listen(channel, async () => {
					try {
						const fresh = await getBoardData(code, date);
						if (fresh) send('update', fresh);
					} catch {
						// Jangan crash SSE karena query error sementara
					}
				});
			} catch {
				// Gagal setup LISTEN — kirim error ke client lalu tutup
				send('error', { message: 'Realtime unavailable' });
				await cleanup();
				return;
			}

			// Cleanup saat client disconnect — cukup end() koneksi,
			// postgres.js akan UNLISTEN otomatis saat koneksi ditutup.
			request.signal.addEventListener('abort', () => {
				void cleanup();
			});

			// Heartbeat komentar SSE tiap 25 detik: menjaga koneksi melewati
			// proxy/timeout dan membuat socket mati terdeteksi (enqueue gagal).
			heartbeat = setInterval(() => {
				try {
					controller.enqueue(': ping\n\n');
				} catch {
					void cleanup();
				}
			}, 25_000);
		},
		cancel() {
			// Dipanggil saat consumer membatalkan stream (jalur disconnect kedua,
			// tidak selalu diiringi abort).
			void cleanup();
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
