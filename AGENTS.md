## Project Configuration

- **Stack**: SvelteKit (Svelte 5) + TypeScript, scaffolded with the `sv` library template. Use `bun run <script>` for all commands (`bun.lock` committed, `.npmrc` has `engine-strict=true`).
- **Library scaffold layout**: `src/lib` is the published library (entry: `src/lib/index.ts`), `src/routes` is the showcase app. `bun pack` builds the library; `bun run build` builds the app.
- **SvelteKit config lives in `vite.config.ts`** (inside the `sveltekit()` plugin). There is no `svelte.config.js`.
- **Runes mode is forced** for all project code (everything except `node_modules`) via `vite.config.ts`. Use Svelte 5 runes (`$state`, `$props`, `$effect`), not legacy component syntax.
- Svelte MCP server tools (list-sections, get-documentation, svelte-autofixer) are available via the `@sveltejs/opencode` plugin. Use `svelte-autofixer` when writing Svelte components.

## Working rules

- Never start, kill, or restart the dev server (`bun run dev`). If the server needs to be started/restarted, give the user the exact command to run instead.
- Verifikasi UI harus benar-benar merender halaman (mis. `curl` halaman lalu cek judul/tombol muncul), bukan hanya menembak endpoint API. Error SSR seperti komponen gagal dimuat tidak akan terlihat dari tes API.
- Jika dev server sudah jalan **sebelum** paket baru dipasang, module graph-nya basi dan SSR bisa gagal dengan `ERR_UNKNOWN_FILE_EXTENSION ".svelte"`. Perbaikannya: minta user menjalankan `rm -rf node_modules/.vite && bun run dev` (restart biasa bisa memakai cache lama).

## Commands

- `bun run dev` — dev server
- `bun run check` — typecheck via `svelte-check`
- `bun run lint` — `prettier --check .` then `eslint .`
- `bun run format` — `prettier --write .` (fixes the prettier half of lint)
- DB (Drizzle + postgres.js): `bun run db:push`, `db:generate`, `db:migrate`, `db:studio`, `db:seed`. All require `DATABASE_URL` in `.env` (copy from `.env.example`); `drizzle.config.ts` and `src/lib/server/db/index.ts` throw without it.
- `bun run db:push` prompts for confirmation via TTY — when run non-interactively (e.g. by an agent) it fails with "Interactive prompts require a TTY"; pass `-- --force` to auto-approve (safe here since pushes are additive).
- `bun run check` and `bun run lint` pass on the current baseline (verified after Fase 3–5); run them after making changes. `bun run format` first — lint checks prettier. Relative server imports need an explicit `.js` extension (rewritten to `.ts` by `rewriteRelativeImportExtensions`). `svelte/no-navigation-without-resolve` is off for reusable components (`src/lib/components/ui/**`, `app-sidebar.svelte`) via `eslint.config.js`; app code should use `resolve()` from `$app/paths`.
- **SvelteKit form actions gotcha**: `action="?/"` is NOT valid for the default action — it resolves to a POST with query `?/`, which SvelteKit parses as action name `''` → 404 `No action with name '' found`. For the default action use `<form method="POST">` (no `action` attribute) or `<form method="POST" action="/path">`. Only use `action="?/name"` for named actions (`actions.name`). Never write `action="?/"`.

## Database

- Schema is a single file: `src/lib/server/db/schema.ts`. Server-only code must live in `src/lib/server` (DB client in `src/lib/server/db/index.ts`).
- Dev database is local Postgres `rqms` (default creds `postgres`/`postgres`) — already created and pushed: 15 tables + 3 enums (`stage`, `shift`, `ok_ng`). Seed via `bun run db:seed` (`scripts/seed.ts`, standalone bun script — uses `process.env`, not `$env`; idempotent; seeded: ADMIN001 & OPR001, password `password123`, plus konfigurasi contoh QMS.md §8 — Part 64300 @ Line RSW lengkap dengan spot/point/hardware/length/visual — sehingga alur operator langsung bisa dicoba).
- No migrations exist yet (`drizzle/` doesn't exist); the dev workflow is `bun run db:push`. `drizzle/` output is prettier-ignored.
- Conventions in schema: snake_case column names, `uuid` PKs with `defaultRandom()`, timestamptz, enum via `pgEnum`.

## Auth

Real session auth (no longer a stub):

- JWT (HS256) via `jose` in `src/lib/server/auth.ts`; password hashed with `argon2` (`src/lib/server/password.ts`). Requires `JWT_SECRET` in `.env` (`.env.example` has a placeholder).
- `src/hooks.server.ts` verifies the `rqms_token` cookie (httpOnly) and sets `event.locals.user` (`App.Locals`, see `src/app.d.ts`).
- Login is a server action on `src/routes/login/+page.server.ts` (NIK + password → cookie → redirect `/dashboard`); protected routes live under `(app)` guarded by `+layout.server.ts` (redirects to `/login`); logout is `POST /api/auth/logout`.
- `src/lib/server/permissions.ts` loads user permissions (`getUserWithPermissions`, `getUserPermissionIds`).
- Seed users: `ADMIN001` (admin_access + rsw_check), `OPR001` (rsw_check).
- `ADMIN_PERMISSION` lives in **`src/lib/permissions.ts`** (client-safe), re-exported by `server/master/admin.ts`. Komponen UI (mis. `app-sidebar.svelte`) harus mengimpor dari `$lib/permissions.js` — mengimpor nilai dari `$lib/server/**` ke komponen membuat SvelteKit gagal build: _"Cannot import ... into code that runs in the browser"_. Import bertipe saja (`import type`) tetap aman.

## API routes & domain modules

Semua handler tipis — logic ada di `src/lib/server/<domain>/`.

| Route                                       | Method           | Guard | Modul                                                                   |
| ------------------------------------------- | ---------------- | ----- | ----------------------------------------------------------------------- |
| `/api/master/[entity]`                      | GET, POST        | admin | `server/master/` (registry di `index.ts`)                               |
| `/api/master/[entity]/[id]`                 | PATCH            | admin | idem (`entity`: permissions, processes, lines, parts, hardwares, users) |
| `/api/configs`, `/api/configs/[id]`         | GET, POST, PATCH | admin | `server/configs/`                                                       |
| `/api/inspect/lines`                        | GET              | login | `server/inspections/` — line sesuai permission                          |
| `/api/inspect/prepare`                      | POST             | login | validasi part+line, shift, flag re-check                                |
| `/api/inspect/submit`                       | POST             | login | evaluasi + snapshot + overall status                                    |
| `/api/inspections`, `/api/inspections/[id]` | GET              | admin | `server/inspections/reports.ts`                                         |

Kode status yang dipakai konsisten: 400 payload invalid, 401 belum login, 403 permission kurang, 404 line/part/config tidak ada, 409 duplikat & re-check tanpa konfirmasi, 422 item wajib kosong / remarks NG kosong.

Catatan implementasi yang gampang keliru:

- `updateConfig` menerima dua bentuk payload: `{ isActive }` saja (toggle dari tabel) atau payload penuh (child ditulis ulang delete-then-insert). Payload penuh tidak menyertakan `partId`/`lineId` — kombinasi itu dikunci setelah dibuat.
- `evaluate()` di `server/inspections/index.ts` meng-iterate **config**, bukan input operator, sehingga item yang tidak dikirim terdeteksi sebagai 422 dan standard tak bisa dipalsukan dari frontend.
- Frontend ikut menghitung status OK/NG hanya untuk umpan balik langsung; backend selalu menghitung ulang.
- `crud-page.svelte` memetakan baris `optionsSource` menjadi `{ value: row.id, label }` sebelum dirender. Untuk entitas tanpa `code`/`name` (parts, hardwares) berikan `optionLabel` eksplisit, mis. `optionLabel: (row) => \`${row.partNo} — ${row.partName}\``. Melewatkan pemetaan ini membuat semua `option.value`undefined → runtime error`each_key_duplicate` dan dropdown tampil kosong.
- **Svelte 5 `$effect` infinite loop**: jangan panggil fungsi yang memodifikasi banyak reactive state (`$state`) dari dalam `$effect` yang juga mendeteksi perubahan state tersebut. Contoh: `$effect(() => { if (inputMode) resetForm(); })` dimana `resetForm()` mengubah `spec`, `stage`, `pointAnswers`, dst akan menyebabkan `effect_update_depth_exceeded`. Gunakan event handler atau `$effect` hanya untuk side effect yang murni (register listener, localStorage, dll).
- **`each_key_duplicate` dengan `Array.from`**: Svelte kadang tidak mengevaluasi mapping function pada compile time, sehingga `Array.from({ length: 6 }, (_, i) => i)` menjadi `[undefined, undefined, ...]` dan semua item punya key `undefined`. Solusi: gunakan array literal `[0, 1, 2, 3, 4, 5]` atau pastikan key eksplisit yang valid.
- **Nested `<button>` menyebabkan `hydration_mismatch`**: bits-ui (`DropdownMenu.Trigger`, `Dialog.Trigger`, dll) menggunakan `floating-layer-anchor` yang merender `<button>`. Jangan taruh komponen `Button` shadcn di dalam trigger — gunakan `<div>` styled sebagai button atau pakai `asChild` jika tersedia.
- **Server-only module tidak boleh di-import ke komponen client**: file di `src/lib/server/**` bisa memakai `$env/dynamic/private` atau DB client. Jika komponen Svelte di-bundle ke browser membutuhkan fungsi tersebut, pindahkan ke `src/lib/<name>.ts` (client-safe) atau buat wrapper terpisah. Contoh: `getShift()` dipindah dari `src/lib/server/shift.ts` ke `src/lib/shift.ts` untuk dipakai dashboard.
- **QR scanner lifecycle**: `Html5Qrcode.stop()` dan `scanner.clear()` harus di-`await` berurutan. Jangan panggil `clear()` sebelum `stop()` selesai, atau akan muncul error `Cannot clear while scan is ongoing`. Set `scanner = null` setelah cleanup untuk mencegah instance ganda.
- **Theme switching tanpa SSR hydration mismatch**: jangan gunakan `ModeWatcher` dari `mode-watcher` yang injeksi `<script>` ke `<head>` — akan bentrok dengan SvelteKit SSR. Gunakan pendekatan manual: inline script di `src/app.html` untuk set class `dark` sesuai `localStorage` sebelum hydrate, lalu toggle dengan `document.documentElement.classList.toggle('dark')` + `localStorage.setItem()`.
- **Navigation guard pada inspect page**: kombinasi `beforeNavigate` dari `$app/navigation` + `<svelte:window on:beforeunload>` untuk mencegah user kehilangan data belum disimpan. Pastikan callback `beforeNavigate` tidak memanggil fungsi yang mengubah state tanpa `cancel()` terlebih dahulu, agar tidak memicu navigasi loop.
- **Keyboard shortcut di layout**: gunakan `<svelte:window on:keydown>` di layout utama, bukan di setiap halaman. Cek `e.metaKey || e.ctrlKey` untuk cross-platform. Jangan lupa `e.preventDefault()` jika shortcut tidak ingin memicu native browser behavior.
- **Form persistence pattern**: simpan draft ke `localStorage` hanya ketika `isDirty === true`. Restore di `onMount` setelah data server dimuat. Clear draft pada `onDestroy` atau setelah submit sukses. Jangan simpan nilai kosong yang bisa menimpa data valid.
- **Re-check confirmation flow**: jika `requiresRecheckConfirm === true`, jangan langsung submit setelah user klik konfirmasi — panggil `validate()` dulu, baru `submit()`. Jika validasi gagal, batalkan re-check dan tunjukkan error.
- **Sidebar auto-close di mobile**: gunakan `useSidebar()` dari `sidebar/context.svelte.js`, cek `sidebar.isMobile`, lalu panggil `sidebar.setOpenMobile(false)` pada `onclick` link navigasi. Tidak perlu bind `open` ke layout jika ingin managed sepenuhnya oleh komponen sidebar.

## shadcn-svelte

- Components live in `src/lib/components/ui` (style `sera`, lucide icons). Aliases: `$lib/components`, `$lib/components/ui`, `$lib/utils` (`cn`).
- Add components with `bunx shadcn-svelte@latest add <name>` (see `components.json`).
- Reference docs: https://shadcn-svelte.com/llms.txt
- Tailwind CSS entry is `src/routes/layout.css` (also wired into the prettier tailwind plugin).

## Style

- Prettier: tabs, single quotes, no trailing commas, printWidth 100. Run `bun run format` rather than hand-formatting.
