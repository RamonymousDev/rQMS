# AGENTS.md — Panduan Komprehensif Proyek RQMS

> Dokumen ini adalah sumber kebenaran tunggal untuk AI agent yang bekerja di repo ini.
> Baca seluruh file sebelum membuat perubahan apapun.

---

## 1. Gambaran Proyek

RQMS (Quality Management System) adalah aplikasi web untuk pencatatan dan monitoring inspeksi kualitas manufaktur. Operator mengisi form inspeksi di line produksi; admin mengelola master data dan memantau hasil. Ada juga **board publik** per-line yang menampilkan status inspeksi secara realtime.

**Domain utama:**

- **Master data**: Permission, Process, Line, Part, Hardware, User
- **Konfigurasi**: Part+Line Config (mendefinisikan standard inspeksi per kombinasi part-line)
- **Inspeksi**: Operator mengisi form dinamis → backend evaluasi → simpan snapshot
- **Board**: Halaman publik realtime via SSE (Postgres LISTEN/NOTIFY)
- **Auth**: JWT + Redis blacklist, rate limiting, audit log, password history

---

## 2. Stack & Tooling

| Komponen      | Detail                                                    |
| ------------- | --------------------------------------------------------- |
| Framework     | SvelteKit (Svelte 5, runes mode) + TypeScript             |
| Runtime/pkg   | Bun (gunakan `bun run <script>`, bukan `npm run`)         |
| DB ORM        | Drizzle ORM + postgres.js, database Postgres lokal `rqms` |
| Auth          | JWT HS256 via `jose`, argon2 untuk hash password          |
| Session store | Redis (ioredis) — blacklist JWT + rate limiting           |
| UI library    | shadcn-svelte (style `sera`), bits-ui, Tailwind CSS v4    |
| Icons         | `@lucide/svelte`                                          |
| Validation    | Zod v4                                                    |
| Realtime      | SSE + Postgres LISTEN/NOTIFY                              |
| QR            | html5-qrcode                                              |

**Lock file**: `bun.lock` di-commit. Jangan pakai `npm` atau `yarn`.

**SvelteKit config** ada di `vite.config.ts` (di dalam `sveltekit()` plugin). **Tidak ada** `svelte.config.js`.

**Runes mode dipaksa** untuk semua file kecuali `node_modules` via `vite.config.ts`:

```ts
compilerOptions: {
	runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true);
}
```

Selalu gunakan `$state`, `$props`, `$derived`, `$effect` — bukan legacy `export let` / `$:`.

---

## 3. Environment Variables

File `.env` (copy dari `.env.example`). Semua wajib ada sebelum server bisa jalan:

```env
DATABASE_URL="postgres://postgres:postgres@localhost:5432/rqms"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="change-me-to-a-random-32-byte-hex-string"
```

- `DATABASE_URL` dipakai Drizzle (`drizzle.config.ts`) dan DB client (`src/lib/server/db/index.ts`) — keduanya `throw` jika tidak ada.
- `REDIS_URL` dipakai `src/lib/server/redis.ts` — juga `throw` jika tidak ada.
- `JWT_SECRET` dipakai `src/lib/server/auth.ts` — juga `throw` jika tidak ada.
- Board SSE (`src/routes/api/board/[code]/stream/+server.ts`) juga mengakses `DATABASE_URL` langsung untuk membuka koneksi dedicated postgres.js untuk `LISTEN`.

---

## 4. Perintah Penting

```bash
bun run dev          # dev server (JANGAN dijalankan/dihentikan oleh agent — kasih ke user)
bun run build        # build production
bun run check        # typecheck via svelte-check
bun run lint         # prettier --check . && eslint .
bun run format       # prettier --write . (jalankan ini SEBELUM lint)
bun run db:push      # push schema ke DB (gunakan -- --force untuk non-interaktif)
bun run db:generate  # generate migration SQL
bun run db:migrate   # jalankan migration
bun run db:studio    # Drizzle Studio GUI
bun run db:seed      # seed data awal (scripts/seed.ts)
```

**Aturan agent:**

- **Jangan pernah** start/kill/restart dev server. Beri perintahnya ke user.
- Jika paket baru dipasang saat dev server sudah jalan, minta user: `rm -rf node_modules/.vite && bun run dev`
- Verifikasi UI: gunakan `curl` untuk cek HTML render (judul/tombol muncul), **bukan** hanya hit endpoint API. Error SSR tidak terlihat dari tes API.
- Selalu jalankan `bun run format` lalu `bun run check` setelah perubahan.
- `db:push` di lingkungan CI/non-TTY: `bun run db:push -- --force`

---

## 5. Struktur Direktori

```
src/
├── app.d.ts                    # App.Locals: { user: SessionUser | null }
├── app.html                    # Template HTML — inline script untuk dark mode
├── hooks.server.ts             # SvelteKit handle: verifikasi JWT, security headers, body limit
├── lib/
│   ├── index.ts                # Entry point library (bun pack)
│   ├── permissions.ts          # ADMIN_PERMISSION constant (CLIENT-SAFE)
│   ├── shift.ts                # getShift() versi client-safe (hanya getShift)
│   ├── utils.ts                # cn() helper (clsx + tailwind-merge)
│   ├── theme/                  # Theme switching utilities
│   ├── hooks/
│   │   └── is-mobile.svelte.ts # useMobile() hook
│   ├── components/
│   │   ├── app-sidebar.svelte  # Sidebar utama — import ADMIN_PERMISSION dari $lib/permissions.js
│   │   ├── admin/
│   │   │   └── crud-page.svelte  # Komponen CRUD generik untuk semua halaman admin master
│   │   └── ui/                 # shadcn-svelte components (lihat §9)
│   └── server/                 # SERVER-ONLY — tidak boleh di-import ke komponen browser
│       ├── auth.ts             # JWT sign/verify/revoke, session cookie helpers
│       ├── audit.ts            # logAction() — append-only audit log ke tabel audit_logs
│       ├── password.ts         # hashPassword, verifyPassword, validatePasswordStrength, isPasswordReused
│       ├── permissions.ts      # getUserWithPermissions, getUserPermissionIds, getUserPermissionCodes
│       ├── rate-limit.ts       # enforceRateLimit() — Redis sliding-window
│       ├── redis.ts            # Singleton Redis client (ioredis) + rateLimit()
│       ├── shift.ts            # getShift, getOperationalDate/DayRange (+ helper kalender legacy)
│       ├── board/
│       │   └── index.ts        # getBoardData, getInspectionHistory, resolveConfigId
│       ├── configs/
│       │   ├── index.ts        # listConfigs, getConfig, findActiveConfig, createConfig, updateConfig
│       │   └── types.ts        # configCreateSchema, configUpdateSchema, normalizeConfig
│       ├── db/
│       │   ├── index.ts        # DB client (postgres.js + drizzle), Transaction type
│       │   └── schema.ts       # Seluruh schema — 15 tabel + 3 enum (SATU FILE)
│       ├── inspections/
│       │   ├── index.ts        # listAccessibleLines, prepareInspection, submitInspection
│       │   ├── reports.ts      # listInspections, getInspection, countNgInspections
│       │   ├── guard.ts        # requireUser()
│       │   └── types.ts        # STAGES, prepareSchema, submitSchema, statusFor
│       └── master/
│           ├── admin.ts        # requireAdmin, parseId, parseBody — re-export ADMIN_PERMISSION
│           ├── index.ts        # masterServices registry: Record<entity, MasterService>
│           ├── types.ts        # Zod schemas semua entitas master
│           ├── permissions.ts  # listPermissions, createPermission, updatePermission
│           ├── processes.ts    # listProcesses, createProcess, updateProcess
│           ├── lines.ts        # listLines, createLine, updateLine
│           ├── parts.ts        # listParts, createPart, updatePart
│           ├── hardwares.ts    # listHardwares, createHardware, updateHardware
│           └── users.ts        # listUsers, createUser, updateUser (termasuk manajemen permissions)
├── routes/
│   ├── +layout.svelte          # Root layout — Sonner Toaster
│   ├── +page.server.ts         # Redirect / → /dashboard
│   ├── layout.css              # Tailwind CSS entry point
│   ├── login/
│   │   ├── +page.server.ts     # Form action: NIK + password → JWT cookie → redirect /dashboard
│   │   └── +page.svelte        # Halaman login
│   ├── board/[code]/
│   │   ├── +page.server.ts     # Load board data (PUBLIC, tanpa auth guard)
│   │   └── +page.svelte        # Board realtime — subscribe SSE, render status grid
│   ├── (app)/                  # Auth-protected group
│   │   ├── +layout.server.ts   # Guard: redirect ke /login jika tidak login; load permissionCodes + ngCount
│   │   ├── +layout.svelte      # Layout app: AppSidebar + SidebarInset
│   │   ├── dashboard/          # Halaman dashboard — ringkasan lines + inspeksi terakhir
│   │   ├── inspect/            # Form inspeksi operator (multi-step wizard)
│   │   └── admin/              # Admin-only pages
│   │       ├── +layout.server.ts  # Guard tambahan: requireAdmin
│   │       ├── permissions/    # CRUD Permission
│   │       ├── processes/      # CRUD Process
│   │       ├── lines/          # CRUD Line
│   │       ├── parts/          # CRUD Part
│   │       ├── hardwares/      # CRUD Hardware
│   │       ├── users/          # CRUD User
│   │       ├── configs/        # CRUD Part+Line Config
│   │       └── inspections/    # Monitoring hasil inspeksi (tabel + filter)
│   └── api/
│       ├── auth/
│       │   ├── logout/         # POST — revokeSession + clearCookie
│       │   └── change-password/# POST — verifikasi current, strength check, history check, update
│       ├── master/
│       │   ├── [entity]/       # GET list, POST create (admin guard + rate limit + audit)
│       │   └── [entity]/[id]/  # PATCH update (admin guard + rate limit + audit)
│       ├── configs/            # GET list, POST create
│       ├── configs/[id]/       # GET detail, PATCH update
│       ├── inspect/
│       │   ├── lines/          # GET — lines sesuai permission user
│       │   ├── prepare/        # POST — validasi + config + shift + recheck flag
│       │   └── submit/         # POST — evaluate + snapshot + simpan (rate limit + audit)
│       ├── inspections/        # GET list dengan filter + pagination
│       ├── inspections/[id]/   # GET detail lengkap
│       └── board/[code]/
│           ├── stream/         # GET SSE — LISTEN postgres, push update realtime (PUBLIC)
│           └── history/        # GET — riwayat inspeksi per configId+shift+stage
scripts/
└── seed.ts                     # Standalone bun script — seed master data + contoh config RSW
drizzle.config.ts               # Config Drizzle Kit
vite.config.ts                  # SvelteKit + Tailwind config (TIDAK ADA svelte.config.js)
eslint.config.js                # ESLint flat config
components.json                 # shadcn-svelte config (style: sera)
```

---

## 6. Database Schema

File tunggal: `src/lib/server/db/schema.ts`. Workflow dev: `bun run db:push` (bukan migrate).

### Enum

```
stage:  START | MIDDLE | END
shift:  DAY | NIGHT
ok_ng:  OK | NG
```

### Tabel Master (15 tabel total)

| Tabel              | PK   | Kolom kunci                                                                                   | Catatan                                            |
| ------------------ | ---- | --------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `permissions`      | uuid | `code` (unique), `name`, `isActive`                                                           | Admin bebas buat: `rsw_check`, `admin_access`, dll |
| `processes`        | uuid | `name` (unique), `isActive`                                                                   | Welding, Stamping, dll                             |
| `lines`            | uuid | `code` (unique), `name`, `processId`, `requiredPermissionId`, `isActive`                      | Line butuh 1 permission                            |
| `parts`            | uuid | `partNo` (unique), `partName`, `isActive`                                                     |                                                    |
| `hardwares`        | uuid | `hwNo` (unique), `hwName`, `isActive`                                                         | Identitas saja; standard di config                 |
| `users`            | uuid | `nik` (unique), `name`, `password` (hashed), `passwordHistory` (jsonb `string[]`), `isActive` | History max 5                                      |
| `user_permissions` | uuid | `userId`, `permissionId` (unique together)                                                    | M2M cascade delete                                 |

### Tabel Konfigurasi

| Tabel                 | PK   | Kolom kunci                                                                                                                      | Catatan                           |
| --------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `part_line_configs`   | uuid | `partId`, `lineId` (unique together), `hasSpot`, `spotStandard`, `hasPoint`, `hasHardware`, `hasLength`, `hasVisual`, `isActive` | Header config per part+line       |
| `part_line_points`    | uuid | `partLineConfigId`, `pointNo` (unique per config), `sequence`                                                                    | Detail: titik inspeksi            |
| `part_line_hardwares` | uuid | `partLineConfigId`, `hardwareId` (unique per config), `standardValue`, `unit`, `sequence`                                        | Standard di sini, bukan di master |
| `part_line_lengths`   | uuid | `partLineConfigId`, `lengthNo` (unique per config), `standardMm`, `sequence`                                                     |                                   |

### Tabel Transaksi

| Tabel                  | PK   | Kolom kunci                                                                                                                                                         | Catatan                                      |
| ---------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `inspections`          | uuid | `partLineConfigId`, snapshot: `partNo`, `lineCode`, `operatorName`, `stage`, `shift`, `overallStatus`, `spotActual`, `visualStatus`, `visualRemarks`, `inspectedAt` | Append-only, snapshot untuk akurasi historis |
| `inspection_points`    | uuid | `inspectionId`, `pointNo` (snapshot), `status`, `remarks`                                                                                                           | Cascade delete                               |
| `inspection_hardwares` | uuid | `inspectionId`, snapshot lengkap hw + `actualValue`, `status`, `remarks`                                                                                            | Cascade delete                               |
| `inspection_lengths`   | uuid | `inspectionId`, snapshot + `actualMm`, `status`, `remarks`                                                                                                          | Cascade delete                               |

### Tabel Sistem

| Tabel        | Kolom kunci                                                                            | Catatan                                            |
| ------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `audit_logs` | `actorId`, `actorNik`, `action`, `entity`, `entityId`, `metadata` (jsonb), `ipAddress` | Audit trail; failure tidak menghentikan alur utama |

### Konvensi Schema

- PK: `uuid` dengan `defaultRandom()`
- Timestamp: `timestamptz` (dengan timezone)
- Column: `snake_case`
- Enum: via `pgEnum`
- Snapshot di inspeksi: kolom `partNo`, `lineCode`, `operatorName`, dll disalin saat submit agar history tetap akurat meski master berubah

### Seed Data

```
bun run db:seed   # idempotent
```

Hasil seed:

- User `ADMIN001` (password: `password123`) — permission: `admin_access`, `rsw_check`
- User `OPR001` (password: `password123`) — permission: `rsw_check`
- Line `RSW` + Part `64300` + config lengkap (spot, point, hardware, length, visual)
- Trigger Postgres `notify_board_update` pada tabel `inspections` untuk SSE board

---

## 7. Autentikasi & Otorisasi

### Alur Login

```
POST /login (form action)
  → enforceRateLimit('login', ip)   # 5 req / 15 menit per IP
  → getUserWithPermissions(nik)
  → verifyPassword(hash, password)
  → signSession({ id, nik, name })  # JWT HS256, exp: 1d, jti: randomUUID
  → setSessionCookie(cookies, token) # httpOnly, sameSite: lax, secure di prod
  → logAction(user, 'login_success')
  → redirect 303 /dashboard
```

### Hooks Server (`src/hooks.server.ts`)

Setiap request:

1. Baca cookie `rqms_token`
2. `verifySession(token)` → parse JWT
3. `isSessionRevoked(jti)` → cek Redis key `rqms:revoked_jti:<jti>`
4. Jika valid & tidak di-revoke: set `event.locals.user`
5. Jika di-revoke: `clearSessionCookie`
6. Body limit: 1 MB untuk non-GET/HEAD
7. Security headers: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`

### Logout

```
POST /api/auth/logout
  → revokeSession(token)  # set Redis key dengan TTL sisa waktu token
  → clearSessionCookie
  → logAction('logout')
```

### Guard di Route

| Konteks                          | Guard | Implementasi                                                               |
| -------------------------------- | ----- | -------------------------------------------------------------------------- |
| Semua halaman `(app)/`           | Login | `(app)/+layout.server.ts` — redirect /login jika `!locals.user`            |
| Semua halaman `(app)/admin/`     | Admin | `(app)/admin/+layout.server.ts` — redirect jika tidak punya `admin_access` |
| API inspect                      | Login | `requireUser(locals.user)` dari `guard.ts`                                 |
| API master, configs, inspections | Admin | `requireAdmin(locals.user)` dari `master/admin.ts`                         |

### `App.Locals`

```ts
interface Locals {
	user: SessionUser | null; // { id, nik, name, jti }
}
```

### Password

- Hash: argon2 (via `argon2` package)
- Aturan kekuatan: min 8 karakter, huruf besar, huruf kecil, angka, simbol
- History: 5 password terakhir disimpan di kolom `passwordHistory` (jsonb array hash). Tidak bisa reuse.
- Change password endpoint: `POST /api/auth/change-password` (perlu login, rate limit `admin`)

### ADMIN_PERMISSION

Nilai konstanta `'admin_access'` ada di **`src/lib/permissions.ts`** (client-safe).

- Komponen UI (`app-sidebar.svelte`) **harus** import dari `$lib/permissions.js`
- `src/lib/server/master/admin.ts` me-re-export nilai yang sama
- **JANGAN** import nilai (bukan tipe) dari `$lib/server/**` ke komponen Svelte — akan gagal build dengan error "Cannot import ... into code that runs in the browser"
- `import type` dari `$lib/server/**` tetap aman

---

## 8. API Routes — Referensi Lengkap

Semua handler tipis — logika bisnis ada di `src/lib/server/<domain>/`.
Semua response JSON dibungkus: `{ data: ... }` untuk sukses, `{ message: string }` untuk error.

### Status Code Konsisten

| Kode | Makna                                                 |
| ---- | ----------------------------------------------------- |
| 400  | Payload invalid / UUID salah / password salah         |
| 401  | Belum login                                           |
| 403  | Permission kurang                                     |
| 404  | Entity tidak ditemukan                                |
| 409  | Duplikat (NIK, part+line) / re-check tanpa konfirmasi |
| 413  | Body > 1 MB                                           |
| 422  | Item wajib kosong / remarks NG kosong                 |
| 429  | Rate limit terlampaui                                 |

### Master Data

```
GET  /api/master/:entity          → list semua (admin)
POST /api/master/:entity          → buat baru (admin, audit log)
PATCH /api/master/:entity/:id     → update (admin, audit log)
```

`entity` valid: `permissions`, `processes`, `lines`, `parts`, `hardwares`, `users`

Semua endpoint master: admin guard + rate limit `admin` (60 req/60s) + audit log.

### Konfigurasi Part+Line

```
GET   /api/configs        → list semua config (admin)
POST  /api/configs        → buat config baru (admin, audit)
GET   /api/configs/:id    → detail config (admin)
PATCH /api/configs/:id    → update config (admin, audit)
```

`updateConfig` menerima dua bentuk payload:

- `{ isActive: boolean }` saja → toggle aktif/nonaktif (dari tombol switch di tabel)
- Payload penuh → update header + delete-then-insert semua child (points, hardwares, lengths)
- Payload penuh **tidak** menyertakan `partId`/`lineId` — kombinasi itu dikunci setelah dibuat (409 jika coba buat duplikat)

### Inspeksi (Operator)

```
GET  /api/inspect/lines    → lines yang bisa diakses user (sesuai permission)
POST /api/inspect/prepare  → { lineId, partNo, stage } → form spec + shift + recheck flag
POST /api/inspect/submit   → submit form (rate limit submit: 30 req/60s per user, audit)
```

Alur `prepare`:

1. Validasi akses user ke line (`requireLineAccess`)
2. Cari config aktif untuk part+line (`findActiveConfig`)
3. Hitung shift otomatis (`getShift()`)
4. Cek apakah ada inspeksi OK untuk stage+shift yang sama pada **hari operasional berjalan** (§15 — bukan hari kalender)
5. Return `formSpec` + `requiresRecheckConfirm: boolean`

Alur `submit`:

1. Validasi akses + config (sama seperti prepare)
2. Cek re-check: jika `last.overallStatus === 'OK'` dan `!confirmRecheck` → 409
3. `evaluate(config, data)`: iterasi **config** (bukan input), hitung status tiap item
4. Standard selalu dari DB — tidak bisa dipalsukan dari frontend
5. Insert header + detail dalam satu transaction
6. Return `{ id, overallStatus, shift, stage }`

Aturan bisnis di `evaluate()`:

- **Points**: status OK/NG manual dari operator
- **Spot**: `actual >= standard` → OK (dihitung backend)
- **Hardwares**: `actual >= standard` → OK (dihitung backend)
- **Lengths**: `actual >= standard` → OK (dihitung backend)
- **Visual**: OK/NG manual dari operator
- Satu item NG → `overallStatus = 'NG'`
- Remarks wajib diisi jika status NG

### Laporan Inspeksi (Admin)

```
GET /api/inspections              → list dengan filter + pagination
GET /api/inspections/:id          → detail lengkap dengan semua child
```

Filter yang didukung: `partNo`, `lineCode`, `stage`, `shift`, `status`, `operatorId`, `dateFrom`, `dateTo` (format YYYY-MM-DD, dianggap tanggal Jakarta)

Pagination: `page` (default 1), `pageSize` (default 25, max 100)

### Board (Publik)

```
GET /board/:code?date=            → halaman board (PUBLIC) — `date` = tanggal operasional
GET /api/board/:code/stream?date= → SSE stream realtime (PUBLIC, tanpa auth)
GET /api/board/:code/history      → riwayat inspeksi (configId, shift, stage, date)
```

Semua parameter `date` opsional, format `YYYY-MM-DD`, dan bermakna **tanggal operasional** (lihat §15). Nilai kosong/invalid **di-fallback ke hari operasional berjalan, bukan 400** — board adalah layar publik di line produksi yang tidak boleh menampilkan halaman error.

SSE events yang dikirim:

- `init`: data board awal (saat koneksi dibuka)
- `update`: data board terbaru (saat ada INSERT/UPDATE di `inspections` dengan `lineCode`)
- `error`: jika LISTEN gagal setup

Payload `init`/`update` berisi `{ line, parts, date, today }`. Saat melihat hari berjalan, client **tidak** mengirim `date` sehingga server menghitung ulang hari operasional pada setiap event — board yang menyala 24 jam berpindah hari sendiri saat melewati 07:30 WIB.

### Auth

```
POST /api/auth/logout           → revoke session + clear cookie
POST /api/auth/change-password  → { currentPassword, newPassword }
```

---

## 9. Server Modules — Referensi Fungsi

### `src/lib/server/auth.ts`

```ts
signSession(user); // → JWT string (HS256, exp 1d, random jti)
verifySession(token); // → SessionUser | null
revokeSession(token); // → void (set Redis key dengan TTL sisa token)
isSessionRevoked(jti); // → boolean (Redis lookup, fail-open jika Redis down)
setSessionCookie(cookies, tok); // httpOnly, sameSite lax, secure di prod
clearSessionCookie(cookies);
getSessionUser(cookies); // → SessionUser | null (baca + verify cookie)
SESSION_COOKIE = 'rqms_token';
```

### `src/lib/server/password.ts`

```ts
hashPassword(password); // → argon2 hash
verifyPassword(hash, password); // → boolean
validatePasswordStrength(password); // → { valid, message } — min 8, upper, lower, digit, symbol
isPasswordReused(newPass, history); // → boolean (cek terhadap semua hash historis)
```

### `src/lib/server/redis.ts`

```ts
redis; // singleton ioredis, keyPrefix 'rqms:', maxRetries 3
rateLimit({ key, limit, windowSeconds }); // sliding-window via sorted set
// → { allowed, limit, remaining, reset }
```

### `src/lib/server/rate-limit.ts`

```ts
RATE_LIMITS = {
	login: { limit: 5, windowSeconds: 900 }, // per IP
	submit: { limit: 30, windowSeconds: 60 }, // per user ID
	admin: { limit: 60, windowSeconds: 60 } // per IP
};
enforceRateLimit(preset, identifier); // throw 429 jika melampaui limit
```

### `src/lib/server/audit.ts`

```ts
logAction(user | null, { action, entity?, entityId?, metadata?, ipAddress? })
// Fire-and-forget, failure tidak menghentikan alur utama
```

### `src/lib/server/shift.ts` (server-only)

```ts
getShift(at?)                     // → 'DAY' | 'NIGHT'  (DAY: 07:30–19:59 WIB)

// --- Hari OPERASIONAL (pakai ini untuk apapun yang menyangkut shift) — lihat §15
getOperationalDate(at?)           // → 'YYYY-MM-DD'  tanggal operasional yang memuat `at`
getOperationalDayRange(dateKey)   // → { start, end } | null  — [07:30 WIB tgl N, 07:30 WIB tgl N+1)
                                  //   null kalau format dateKey invalid — pemanggil WAJIB menangani
getCurrentOperationalDayRange(at?)// → { start, end }  — rentang operasional yang sedang berjalan

// --- Hari KALENDER (legacy, tidak dipakai kode aplikasi — jangan pakai untuk kode baru)
getJakartaDayRange(at?)           // → { start, end }  — rentang hari kalender Jakarta sebagai UTC
getJakartaDateKey(at?)            // → 'YYYY-MM-DD'    — tanggal kalender
parseJakartaDate(value)           // → Date | null     — parse 'YYYY-MM-DD' ke awal hari UTC
```

### `src/lib/shift.ts` (client-safe)

```ts
getShift(at?) // → 'DAY' | 'NIGHT'
// Versi ringkas tanpa getJakartaDayRange — untuk dipakai di komponen
```

### `src/lib/server/permissions.ts`

```ts
getUserWithPermissions(nik); // → user + permissions[] | null
getUserPermissionIds(userId); // → string[]  (hanya permission aktif)
getUserPermissionCodes(userId); // → string[]  (kode permission aktif)
```

### `src/lib/server/configs/index.ts`

```ts
listConfigs(); // semua config + child, ordered desc createdAt
getConfig(id); // satu config + child, throw 404
findActiveConfig(partId, lineId); // config aktif untuk pair ini, null jika tidak ada
createConfig(body); // validasi + insert header + child dalam transaksi
updateConfig(id, body); // toggle isActive ATAU full update (delete-then-insert child)
```

### `src/lib/server/inspections/index.ts`

```ts
listAccessibleLines(user); // lines yang user bisa akses (filter by permission)
prepareInspection(user, body); // → formSpec + shift + requiresRecheckConfirm
submitInspection(user, body); // → { id, overallStatus, shift, stage }
```

### `src/lib/server/inspections/reports.ts`

```ts
listInspections(params); // filter + pagination → { rows, page, pageSize, total, totalPages }
getInspection(id); // detail + points + hardwares + lengths + operator
countNgInspections(); // → number (total NG, untuk badge di sidebar)
```

### `src/lib/server/board/index.ts`

```ts
getBoardData(lineCode, dateKey?) // → BoardData | null  ({ line, parts, date, today })
getInspectionHistory(configId, shift, stage, dateKey?, limit?) // → InspectionHistoryRow[]
resolveConfigId(lineCode, partNo) // → string | null
```

`dateKey` = tanggal operasional (§15); kosong/invalid → hari operasional berjalan. Keduanya memfilter `inspectedAt` ke rentang `[07:30 WIB tgl N, 07:30 WIB tgl N+1)`, jadi badge dan isi modal riwayat selalu konsisten.

Daftar part di board berasal dari **config aktif**, bukan dari inspeksi — tabel tetap tampil (dengan badge kosong `—`) pada tanggal yang belum ada datanya.

### `src/lib/server/master/admin.ts`

```ts
requireAdmin(user); // throw 401/403 jika bukan admin
parseId(value); // throw 400 jika bukan UUID valid
parseBody(schema, body); // Zod parse + throw 400 dengan pesan gabungan jika gagal
```

### `src/lib/server/master/index.ts`

```ts
masterServices: Record<entity, { list; create; update }>;
// entity: permissions | processes | lines | parts | hardwares | users
```

---

## 10. Halaman & Komponen Utama

### `(app)/+layout.server.ts`

Load function yang dijalankan untuk semua halaman `(app)/`:

- Redirect ke `/login` jika tidak login
- Return: `{ user, permissionCodes: string[], ngInspectionCount: number }`
- `ngInspectionCount` hanya dihitung untuk admin (untuk badge merah di sidebar)

### `(app)/admin/+layout.server.ts`

Guard tambahan: redirect jika user tidak punya `admin_access`.

### `(app)/inspect/+page.svelte` — Form Inspeksi Operator

Wizard 3 langkah:

1. **Pilih Line** — hanya line sesuai permission (dari `/api/inspect/lines`)
2. **Scan Part & Pilih Stage** — input manual atau QR scan, tombol START/MIDDLE/END memanggil `prepare`
3. **Form Inspeksi Dinamis** — render sesuai config (spot/point/hardware/length/visual)

State management penting:

- `isDirty` — menandai ada data yang belum disimpan
- `saveDraft()` / `restoreDraft()` — persist ke `localStorage` (key: `inspect-draft`)
- `beforeNavigate` + `<svelte:window on:beforeunload>` — cegah navigasi saat `isDirty`
- `recheckDialogOpen` + `recheckConfirmed` — alur konfirmasi re-check
- `progress` ($derived) — hitung persentase item terisi
- Sticky footer dengan progress bar + tombol submit

Alur re-check yang benar:

1. `prepare` return `requiresRecheckConfirm: true` → buka dialog konfirmasi
2. User klik "Ya, Re-check" → `recheckConfirmed = true` → panggil `validate()` → jika valid panggil `submit()`
3. Jika `submit` return 409 (karena race condition) → buka ulang dialog

### `admin/crud-page.svelte` — Komponen CRUD Generik

Dipakai oleh semua halaman admin master. Props:

```ts
{
  title: string
  description?: string
  endpoint: string          // URL API, mis. '/api/master/permissions'
  columns: CrudColumn[]     // kolom tabel
  fields: CrudField[]       // field form dialog
  searchKeys?: string[]     // kolom yang dicari
  toForm?: (row) => object  // transform row ke form saat edit
}
```

`CrudField.type` yang didukung: `text`, `password`, `select`, `checkbox`, `switch`, `checkbox-group`

**PENTING — `optionLabel`**: Untuk entitas tanpa kolom `code`/`name` (parts, hardwares), wajib berikan `optionLabel`:

```ts
optionLabel: (row) => `${row.partNo} — ${row.partName}`;
```

Tanpa ini semua `option.value` jadi `undefined` → error `each_key_duplicate`.

### `app-sidebar.svelte`

- Import `ADMIN_PERMISSION` dari `$lib/permissions.js` (BUKAN dari `$lib/server/**`)
- `isAdmin = $derived(permissionCodes.includes(ADMIN_PERMISSION))` — kontrol visibilitas menu admin
- `sidebar.isMobile` + `sidebar.setOpenMobile(false)` — auto-close di mobile saat klik link
- Badge merah di "Hasil Inspeksi" jika `ngInspectionCount > 0`

### Board (`routes/board/[code]/`)

- Route PUBLIC — tidak ada auth guard
- Data awal di-load di `+page.server.ts` via `getBoardData`
- `+page.svelte` membuka SSE ke `/api/board/[code]/stream` dan update reaktif saat menerima event
- SSE events: `init` (data awal redundan jika SSR sudah ada), `update` (data segar), `error`

---

## 11. shadcn-svelte & UI

### Komponen yang Tersedia

Semua ada di `src/lib/components/ui/`:

```
alert, avatar, badge, breadcrumb, button, card, checkbox, dialog,
dropdown-menu, empty, field, input, label, pagination, progress,
qr-scanner, select, separator, sheet, sidebar, skeleton, sonner,
switch, table, tabs, textarea, toggle, toggle-group, tooltip
```

### Menambah Komponen Baru

```bash
bunx shadcn-svelte@latest add <name>
```

### Import Pattern

```ts
import { Button } from '$lib/components/ui/button/index.js';
import * as Dialog from '$lib/components/ui/dialog/index.js';
import { cn } from '$lib/utils.js';
```

Alias yang tersedia: `$lib/components`, `$lib/components/ui`, `$lib/utils`

### Tailwind CSS

Entry point: `src/routes/layout.css`  
Config ada di `vite.config.ts` via `@tailwindcss/vite` plugin (Tailwind v4).  
Prettier tailwind plugin aktif — `bun run format` mengatur urutan kelas otomatis.

### Toast Notifications

Gunakan `svelte-sonner`:

```ts
import { toast } from 'svelte-sonner';
toast.success('Berhasil');
toast.error('Gagal: ...');
```

### Dark Mode

Tanpa `ModeWatcher` dari `mode-watcher` — akan bentrok dengan SvelteKit SSR.
Pendekatan manual:

- Inline script di `src/app.html` set class `dark` dari `localStorage` sebelum hydrate
- Toggle: `document.documentElement.classList.toggle('dark')` + `localStorage.setItem()`

---

## 12. Aturan Pengembangan Kritis

### A. Import: Server vs Client

```
src/lib/server/**  →  HANYA server-side
src/lib/**         →  Boleh di client (komponen Svelte, browser)
```

Jika komponen butuh fungsi dari `src/lib/server/**`:

1. Pindahkan fungsi ke `src/lib/<name>.ts` (buat versi client-safe)
2. ATAU kirim data via `+page.server.ts` load function / server actions

Contoh: `getShift()` ada di DUA tempat:

- `src/lib/server/shift.ts` — versi penuh (dengan `getOperationalDayRange`, dll) untuk server
- `src/lib/shift.ts` — versi ringkas hanya `getShift()` untuk komponen

Board **tidak** menghitung tanggal operasional di client: `date`/`today` dikirim server lewat load function dan payload SSE, sehingga tanggal selalu mengacu ke WIB, bukan timezone browser operator.

### B. Svelte 5 Runes

```svelte
<!-- BENAR -->
let count = $state(0) let doubled = $derived(count * 2) $effect(() => {console.log(count)})

<!-- SALAH — legacy syntax dilarang -->
export let count = 0 $: doubled = count * 2
```

### C. `$effect` Infinite Loop

Jangan panggil fungsi yang memodifikasi banyak `$state` dari dalam `$effect` yang juga membaca state tersebut:

```ts
// SALAH — menyebabkan effect_update_depth_exceeded
$effect(() => {
	if (inputMode) resetForm(); // resetForm mengubah spec, stage, pointAnswers, dll
});

// BENAR — gunakan event handler
function handleInputModeChange(mode) {
	inputMode = mode;
	resetForm();
}
```

`$effect` hanya untuk side effect murni: register listener, localStorage, DOM manipulation.

### D. SvelteKit Form Actions

```svelte
<!-- BENAR — default action -->
<form method="POST">

<!-- BENAR — named action -->
<form method="POST" action="?/login">

<!-- SALAH — action="?/" tidak valid, menghasilkan 404 -->
<form method="POST" action="?/">
```

### E. `each_key_duplicate` dengan `Array.from`

```ts
// SALAH — Svelte kadang evaluasi jadi [undefined, undefined, ...]
{#each Array.from({ length: 6 }, (_, i) => i) as idx (idx)}

// BENAR — gunakan array literal
{#each [0, 1, 2, 3, 4, 5] as idx (idx)}
```

### F. Nested `<button>` → Hydration Mismatch

bits-ui (`DropdownMenu.Trigger`, `Dialog.Trigger`, dll) render `<button>`. Jangan taruh komponen `<Button>` shadcn di dalamnya:

```svelte
<!-- SALAH -->
<Dialog.Trigger>
	<Button>Buka</Button>
</Dialog.Trigger>

<!-- BENAR — gunakan div styled atau asChild -->
<Dialog.Trigger>
	<div class="...">Buka</div>
</Dialog.Trigger>
```

### G. QR Scanner Lifecycle

```ts
// Urutan wajib — jangan balik
await scanner.stop();
await scanner.clear();
scanner = null; // cegah instance ganda
```

### H. Navigation Guard

```ts
import { beforeNavigate } from '$app/navigation';

beforeNavigate(({ cancel }) => {
	if (isDirty) {
		cancel(); // WAJIB cancel() sebelum logika lain
		// tampilkan konfirmasi
	}
});
```

Pastikan `cancel()` dipanggil sebelum modifikasi state apapun — jika tidak, bisa memicu navigasi loop.

### I. Keyboard Shortcut di Layout

```svelte
<!-- Di layout utama, bukan di setiap halaman -->
<svelte:window on:keydown={handleKeydown} />

function handleKeydown(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey) {  // cross-platform
    e.preventDefault()
    // ...
  }
}
```

### J. Form Persistence Pattern

```ts
// Simpan draft hanya jika ada perubahan
function saveDraft() {
	if (!isDirty) return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

// Restore setelah data server dimuat
onMount(async () => {
	const data = await fetchData();
	restoreDraft(); // setelah data server ada
});

// Clear setelah submit atau destroy
onDestroy(() => clearDraft());
```

### K. Sidebar Auto-Close di Mobile

```ts
const sidebar = useSidebar();

function handleNavClick() {
	if (sidebar.isMobile) {
		sidebar.setOpenMobile(false);
	}
}
```

### L. Relative Import Extensions

Import server relatif **wajib** menggunakan ekstensi `.js` (bukan `.ts`):

```ts
// BENAR
import { db } from '../db/index.js';
import type { SessionUser } from '../auth.js';

// SALAH
import { db } from '../db/index';
import { db } from '../db/index.ts';
```

SvelteKit me-rewrite `.js` → `.ts` di belakang layar (`rewriteRelativeImportExtensions`).

---

## 13. ESLint & Prettier

### Prettier (`.prettierrc` via `package.json`/config)

```
tabs: true
singleQuote: true
trailingComma: none
printWidth: 100
```

Selalu jalankan `bun run format` sebelum `bun run lint`.

### ESLint (`eslint.config.js`)

- `no-undef` dimatikan (TypeScript sudah handle)
- Rule `svelte/no-navigation-without-resolve` dimatikan untuk:
  - `src/lib/components/ui/**/*.svelte`
  - `src/lib/components/app-sidebar.svelte`
- Kode app (`src/routes/**`) harus gunakan `resolve()` dari `$app/paths`

---

## 14. Realtime Board (SSE + Postgres LISTEN/NOTIFY)

### Arsitektur

```
DB INSERT/UPDATE inspections
  → trigger trg_notify_board
  → pg_notify('board_<lineCode>', lineCode)
  → koneksi dedicated postgres.js di SSE handler
  → sql.listen(channel, callback)
  → callback: getBoardData(code) → send SSE event 'update'
  → client browser update tampilan
```

### SSE Endpoint

`GET /api/board/[code]/stream` — PUBLIC (tanpa auth)

- Validasi line exists sebelum buka koneksi Postgres
- Buka koneksi dedicated (`max: 1`) — tidak bisa pakai pool untuk `LISTEN`
- Kirim event `init` dengan data awal
- Cleanup saat client disconnect: `await sql.end({ timeout: 2 })` → `controller.close()`
- Header: `X-Accel-Buffering: no` untuk disable Nginx buffering

### Trigger SQL

Trigger ini dibuat oleh `bun run db:seed`. Jika DB di-reset, jalankan ulang seed:

```sql
CREATE OR REPLACE FUNCTION notify_board_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('board_' || NEW.line_code, NEW.line_code);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_notify_board
AFTER INSERT OR UPDATE ON inspections
FOR EACH ROW EXECUTE FUNCTION notify_board_update();
```

---

## 15. Timezone & Shift Logic

Semua waktu operasional dihitung dalam **Asia/Jakarta (WIB, UTC+7)**.
Jangan gunakan `new Date().getHours()` — waktu server bisa berbeda timezone.

```
DAY   shift: 07:30 – 19:59 WIB
NIGHT shift: 20:00 – 07:29 WIB
```

### Hari Operasional ≠ Hari Kalender

**Aturan inti**: night shift **milik tanggal saat shift itu dimulai**, bukan tanggal kalender saat jamnya berjalan.

```
Hari operasional tgl N = [07:30 WIB tgl N, 07:30 WIB tgl N+1)
  ├─ Day   shift tgl N : 07:30 – 19:59 WIB tgl N
  └─ Night shift tgl N : 20:00 WIB tgl N – 07:29 WIB tgl N+1
```

Konsekuensi yang paling sering keliru:

| Waktu WIB        | Shift | Tanggal operasional                 |
| ---------------- | ----- | ----------------------------------- |
| 9 Agt 07:29      | NIGHT | **8 Agt** (ekor night shift tgl 8)  |
| 9 Agt 07:30      | DAY   | 9 Agt                               |
| 9 Agt 21:00      | NIGHT | 9 Agt                               |
| **10 Agt 01:00** | NIGHT | **9 Agt** ← masih night shift tgl 9 |
| 10 Agt 07:29     | NIGHT | **9 Agt**                           |
| 10 Agt 07:30     | DAY   | 10 Agt                              |

**JANGAN** pakai `getJakartaDayRange()` untuk scope "hari ini" pada apapun yang berhubungan dengan shift — rentang kalender (00:00–23:59) memotong night shift di tengah, sehingga inspeksi jam 21:00 dan jam 01:00 dalam shift yang sama dianggap beda hari. Pakai `getCurrentOperationalDayRange()`.

Yang sudah memakai hari operasional:

| Konsumen                                  | Fungsi                                                     |
| ----------------------------------------- | ---------------------------------------------------------- |
| Rule re-check (`findLastInspectionToday`) | `getCurrentOperationalDayRange()`                          |
| Board — status badge & riwayat            | `getOperationalDate()` + `getOperationalDayRange(dateKey)` |
| Filter `dateFrom`/`dateTo` laporan admin  | `getOperationalDayRange(dateKey)`                          |

`getJakartaDayRange`, `getJakartaDateKey`, dan `parseJakartaDate` masih ada di `shift.ts` tapi **tidak dipakai lagi** oleh kode aplikasi. Jangan pakai untuk kode baru yang menyangkut shift.

---

## 16. Alur Kerja Tipikal AI Agent

### Menambah Endpoint API Baru

1. Buat logika di `src/lib/server/<domain>/index.ts`
2. Buat route handler di `src/routes/api/<path>/+server.ts` (tipis — hanya guard + call)
3. Tambahkan guard yang sesuai (`requireAdmin` atau `requireUser`)
4. Tambahkan `enforceRateLimit` dan `logAction` jika relevan
5. Jalankan: `bun run format && bun run check`

### Menambah Halaman Admin Baru

1. Buat `src/routes/(app)/admin/<entity>/+page.svelte`
2. Gunakan komponen `CrudPage` dengan config yang sesuai
3. Untuk entitas tanpa `code`/`name`, sertakan `optionLabel` di semua field `select`/`checkbox-group`
4. Tambahkan link di `app-sidebar.svelte`
5. Jalankan: `bun run format && bun run check`

### Mengubah Schema Database

1. Edit `src/lib/server/db/schema.ts`
2. Jalankan: `bun run db:push -- --force`
3. Update seed jika perlu: `bun run db:seed`
4. Jalankan: `bun run format && bun run check`

### Menulis Komponen Svelte

1. Selalu gunakan Svelte 5 runes
2. Gunakan `svelte-autofixer` (MCP tool) untuk validasi
3. Cek import: nilai dari `$lib/server/**` tidak boleh masuk komponen
4. Jalankan: `bun run format && bun run check`

---

## 17. Dependensi Kunci

| Package         | Versi    | Kegunaan                                     |
| --------------- | -------- | -------------------------------------------- |
| `svelte`        | ^5.56.1  | Framework utama (runes mode)                 |
| `@sveltejs/kit` | ^2.63.0  | SSR, routing, form actions                   |
| `drizzle-orm`   | ^0.45.2  | ORM type-safe                                |
| `postgres`      | ^3.4.9   | Driver Postgres (postgres.js)                |
| `jose`          | ^6.2.8   | JWT sign/verify                              |
| `argon2`        | ^0.45.1  | Password hashing                             |
| `ioredis`       | ^6.0.0   | Redis client (session blacklist, rate limit) |
| `zod`           | ^4.4.3   | Validasi schema                              |
| `bits-ui`       | ^2.16.3  | Primitive UI (Radix-like)                    |
| `shadcn-svelte` | ^1.5.0   | UI components                                |
| `tailwindcss`   | ^4.3.0   | Styling                                      |
| `svelte-sonner` | ^1.1.0   | Toast notifications                          |
| `html5-qrcode`  | ^2.3.8   | QR scanner di browser                        |
| `drizzle-kit`   | ^0.31.10 | Migrasi & introspeksi DB                     |
