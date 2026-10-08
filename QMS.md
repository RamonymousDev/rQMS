# Inline Quality Check (QC) System

## Comprehensive Implementation Flow

Dokumen ini menjelaskan **seluruh alur sistem** secara sistematis, dari master data hingga transaksi inspeksi. Gunakan sebagai acuan implementasi backend, frontend, dan business logic.

---

## 1. Project Overview

**Nama Sistem:** Inline Quality Check (QC)

**Tujuan:**

- Operator melakukan inspeksi kualitas langsung di line produksi (inline).
- Spesifikasi inspeksi dikonfigurasi penuh oleh Admin per kombinasi **Part + Line**.
- Inspeksi dilakukan pada 3 stage: `START` | `MIDDLE` | `END`.
- Semua hasil tercatat lengkap (siapa, kapan, hasil apa).

**Teknologi kunci:**

- Stack: SvelteKit 5 (SvelteKit server routes) + TypeScript + bun
- Auth: Custom JWT (identifier = NIK) via `jose`
- Password: hashed (`argon2`)
- Timezone: Asia/Jakarta
- Database: PostgreSQL + Drizzle ORM
- Soft delete: menggunakan flag `is_active` (bukan hard delete)

---

## 2. Roles & Permission Model

### 2.1 Konsep Permission

Permission **bukan enum**. Admin bebas membuat permission code (contoh: `rsw_check`, `stamping_check`, `painting_line_1`).

Setiap **Line** memiliki `requiredPermissionId`.  
User hanya boleh mengakses Line jika dia memiliki permission tersebut.

### 2.2 Contoh

| Permission Code  | Digunakan oleh Line     |
| ---------------- | ----------------------- |
| `rsw_check`      | Line RSW                |
| `stamping_check` | Line STAMP-01           |
| `painting_check` | Line PAINT-01           |
| `admin_access`   | (opsional, full access) |

### 2.3 Aturan Akses

- User login → sistem load semua permission yang dia miliki.
- Saat memilih Line → cek apakah `line.requiredPermissionId` ada di permission user.
- Jika tidak punya → tolak akses (403).

---

## 3. Data Model Ringkas

### 3.1 Master Data

| Table              | Isi Utama                                      | Keterangan                                 |
| ------------------ | ---------------------------------------------- | ------------------------------------------ |
| `permissions`      | code, name                                     | Dibuat admin, bebas                        |
| `processes`        | name                                           | Welding, Stamping, Painting, ...           |
| `lines`            | process_id, code, name, required_permission_id | Child dari Process                         |
| `parts`            | part_no, part_name                             |                                            |
| `hardwares`        | hw_no, hw_name                                 | Hanya identitas. Standard **tidak** disini |
| `users`            | nik, name, password                            |                                            |
| `user_permissions` | user_id + permission_id                        | Many-to-many                               |

### 3.2 Konfigurasi Part + Line

| Table                 | Isi Utama                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| `part_line_configs`   | part_id, line_id, has_spot, spot_standard, has_point, has_hardware, has_length, has_visual                    |
| `part_line_points`    | part_line_config_id, point_no, sequence                                                                       |
| `part_line_hardwares` | part_line_config_id, hardware_id, **check_type** (TORQUE/HAMMER), **qty**, **standard_value**, unit, sequence |
| `part_line_lengths`   | part_line_config_id, length_no, standard_mm, sequence                                                         |

> **Penting:** Standard hardware dan length ditentukan di level **Part + Line Config**, bukan di master Hardware.

### 3.3 Transaksi (Snapshot)

| Table                  | Isi Utama                                                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `inspections`          | part_line_config_id, part_no, line_code, stage, shift, overall_status, spot_actual, spot_status, visual_status, visual_remarks, operator_id, operator_name, inspected_at |
| `inspection_points`    | inspection_id, point_no, status, remarks                                                                                                                                 |
| `inspection_hardwares` | inspection_id, hw_no, hw_name, check_type, check_no, standard_value, unit, actual_value, status, remarks                                                                 |
| `inspection_lengths`   | inspection_id, length_no, standard_mm, actual_mm, status, remarks                                                                                                        |
| `inspection_repairs`   | inspection_id, item_type (POINT/HARDWARE/LENGTH/SPOT/VISUAL), item_id, action, actor_id, actor_name, created_at, reverted_at                                             |

Semua nilai penting di transaksi disimpan sebagai **snapshot** agar history tetap akurat meski master berubah.

---

## 4. Admin Flow (Sistematis)

### 4.1 Login Admin

1. Input NIK + Password.
2. Sistem verifikasi credentials.
3. Return JWT + data user + daftar permission.

### 4.2 Manajemen Permission

1. Admin membuat permission baru (`code` + `name`).
2. Permission bisa diaktifkan/nonaktifkan (`is_active`).

### 4.3 Manajemen Process

1. Admin membuat Process (hanya `name`).
2. Contoh: Welding, Stamping, Painting.

### 4.4 Manajemen Line

1. Admin memilih Process.
2. Mengisi `code`, `name`.
3. Memilih **Permission** yang dibutuhkan untuk mengakses Line tersebut.
4. Line tersimpan sebagai child dari Process.

### 4.5 Manajemen Part

1. Admin input `part_no` + `part_name`.
2. Part bersifat global (bisa dipakai di banyak Line).

### 4.6 Manajemen Hardware

1. Admin input `hw_no` + `hw_name` saja.
2. Tidak ada standard di sini.

### 4.7 Manajemen User

1. Admin membuat user (`nik`, `name`, `password`).
2. Admin assign satu atau lebih Permission ke user tersebut.
3. User dengan permission tertentu otomatis bisa akses Line yang membutuhkan permission itu.

### 4.8 Konfigurasi Part + Line (Inti Sistem)

Ini adalah langkah paling penting.

**Langkah:**

1. Pilih **Line**.
2. Pilih **Part**.
3. Sistem cek apakah kombinasi Part + Line sudah ada (unique).
4. Admin mengatur flag dan detail:

| Flag           | Jika Aktif (true)                                                      | Jika Nonaktif (false) |
| -------------- | ---------------------------------------------------------------------- | --------------------- |
| `has_spot`     | Wajib isi `spot_standard` (qty)                                        | Abaikan               |
| `has_point`    | Tambah daftar Point (`point_no` + sequence)                            | Abaikan               |
| `has_hardware` | Tambah Hardware + **check_type** + **qty** + **standard_value** + unit | Abaikan               |
| `has_length`   | Tambah Length (bisa 1 atau lebih) + `standard_mm`                      | Abaikan               |
| `has_visual`   | Hanya flag (hasil nanti OK/NG)                                         | Abaikan               |

5. Simpan konfigurasi.
6. Konfigurasi siap dipakai Operator.

**Contoh Konfigurasi:**

```
Part : 64300
Line : RSW
has_spot : true → spot_standard = 12
has_point : true → Point 1, 2, 3
has_hardware : true

- 12911 (Bolt M8 Torque) → standard 50 kgf
- 13900 (Nugget) → standard 5 mm
  has_length : true
- Length 1 → 120 mm
- Length 2 → 85 mm
  has_visual : true
```

---

## 5. Operator Flow (Sistematis)

### 5.1 Login Operator

1. Input NIK + Password.
2. Sistem return JWT + permission yang dimiliki user.

### 5.2 Pilih Line

1. Sistem menampilkan **hanya Line** yang `requiredPermissionId`-nya dimiliki oleh user.
2. Operator memilih Line (contoh: RSW).

### 5.3 Scan / Pilih Part

1. Operator scan atau ketik `part_no`.
2. Sistem mencari `part_line_configs` aktif untuk kombinasi `part_id` + `line_id`.
3. **Jika tidak ditemukan** → tampilkan error: "Part tidak dikonfigurasi di Line ini".
4. **Jika ditemukan** → lanjut ke pemilihan Stage.

### 5.4 Pilih Stage

Operator memilih salah satu:

- `START`
- `MIDDLE`
- `END`

### 5.5 Hitung Shift (Otomatis)

Sistem menentukan Shift berdasarkan waktu server (Asia/Jakarta):

| Waktu         | Shift   |
| ------------- | ------- |
| 07:30 – 19:59 | `DAY`   |
| 20:00 – 07:29 | `NIGHT` |

### 5.6 Cek Re-check Rule

Sistem query inspection terakhir untuk kombinasi:
`part_line_config_id` + `stage` + `shift` + tanggal hari ini.

**Aturan:**

- Jika **belum ada** inspection → lanjut.
- Jika inspection terakhir = **NG** → lanjut (boleh re-check tanpa konfirmasi khusus).
- Jika inspection terakhir = **OK** → tampilkan **dialog konfirmasi**:
  > "Inspection untuk Stage ini sudah OK. Apakah anda yakin ingin melakukan re-check?"

### 5.7 Render Form Inspeksi (Dinamis)

Form dibangun berdasarkan konfigurasi `part_line_configs`:

#### A. Points (jika `has_point = true`)

Untuk setiap point:

- Tampilkan `point_no`
- Input: `OK` / `NG`
- Jika pilih `NG` → **wajib** munculkan field Remarks

#### B. Spot (jika `has_spot = true`)

- Tampilkan Standard: `spot_standard`
- Input: `spot_actual` (integer)
- Sistem otomatis tentukan status: `actual === standard` → OK, else NG (wajib exact)

#### C. Hardwares (jika `has_hardware = true`)

Untuk setiap hardware di config:

- Tampilkan `hw_no`, `hw_name`, `check_type` (Torque/Hammer), `standard_value`, `unit`
- Satu hardware punya `qty` titik pengecekan (`check_no` 1..qty); semua titik memakai `standard_value` + `unit` yang sama
- Input: `actual_value` (integer) per titik — label `hw_no (hw_name) Tipe #check_no`
- Sistem otomatis tentukan status per titik: `actual >= standard` → OK, else NG
- Jika ada titik NG → **wajib** Remarks untuk titik tersebut

#### D. Lengths (jika `has_length = true`)

Untuk setiap length:

- Tampilkan `length_no` + `standard_mm`
- Input: `actual_mm`
- Sistem otomatis tentukan status: `actual >= standard` → OK, else NG
- Jika NG → **wajib** Remarks

#### E. Visual (jika `has_visual = true`)

- Input: `OK` / `NG`
- Jika NG → **wajib** Remarks

### 5.8 Hitung Overall Status

**Aturan mutlak:**

- Jika **minimal 1 item** berstatus `NG` → `overallStatus = "NG"`
- Jika **semua item** `OK` → `overallStatus = "OK"`

Item yang dihitung:

- Semua Point
- Spot (jika ada)
- Semua Hardware
- Semua Length
- Visual (jika ada)

### 5.9 Submit Inspection

1. Validasi semua field wajib.
2. Validasi Remarks wajib diisi untuk setiap item NG.
3. Buat record `inspections` (header) dengan snapshot:
   - `part_no`, `line_code`
   - `operator_id`, `operator_name`
   - `stage`, `shift`, `overall_status`
   - `spot_actual`, `spot_status`, `visual_status`, `visual_remarks`
4. Insert detail:
   - `inspection_points`
   - `inspection_hardwares` (snapshot `hw_no`, `hw_name`, `check_type`, `check_no`, `standard_value`, `unit`)
   - `inspection_lengths` (snapshot `length_no`, `standard_mm`)
5. Return sukses.

### 5.10 Repair (Admin)

Item yang NG dapat ditandai **REPAIR** oleh admin (permission `admin_access`), dengan **Action wajib** (string tindakan perbaikan):

1. Item yang bisa di-repair: Point, Hardware, Length, Spot, Visual — hanya yang berstatus `NG`.
2. Isi `action` (wajib) → status item menjadi `REPAIR`; baris `inspection_repairs` mencatat action + admin + waktu.
3. Overall dihitung ulang: ada `NG` → NG; sisanya `REPAIR` → REPAIR; else OK. Inspeksi yang sudah di-repair tidak lagi dihitung sebagai NG di badge sidebar/dashboard.
4. Repair dapat **dibatalkan** (kembali `NG`); baris repair lama ditandai `reverted_at` sehingga histori tetap utuh.
5. Semua aksi masuk audit log (`repair_inspection` / `revert_inspection_repair`).

---

## 6. Business Rules Ringkas (Harus Diimplementasikan)

| No  | Rule                                                                                                   | Lokasi Enforce       |
| --- | ------------------------------------------------------------------------------------------------------ | -------------------- |
| 1   | Remarks mandatory jika status = NG                                                                     | Backend + Frontend   |
| 2   | Overall = NG jika ada minimal 1 item NG                                                                | Backend              |
| 3   | Re-check: jika sudah OK → wajib konfirmasi                                                             | Backend + Frontend   |
| 4   | Shift dihitung otomatis dari waktu server                                                              | Backend              |
| 5   | User hanya boleh akses Line sesuai permission                                                          | Backend (middleware) |
| 6   | Part harus sudah dikonfigurasi di Line sebelum bisa diinspeksi                                         | Backend              |
| 7   | Standard hardware & length diambil dari Part+Line Config                                               | Backend              |
| 8   | Semua nilai penting di transaksi disimpan sebagai snapshot                                             | Backend              |
| 9   | Actual >= Standard → OK (Hardware, Length); Spot wajib exact                                           | Backend              |
| 10  | Stage hanya: START / MIDDLE / END                                                                      | Backend + Frontend   |
| 11  | Admin: item NG → REPAIR (wajib action) / revert REPAIR → NG; overall dihitung ulang (NG > REPAIR > OK) | Backend + Frontend   |

---

## 7. Urutan Implementasi yang Disarankan

### Fase 1 – Foundation

1. Schema Drizzle + push (sudah ada di `src/lib/server/db/schema.ts`, di-push via `bun run db:push`)
2. Seed data dasar
3. Auth (login JWT via `jose` + password hash `argon2`)
4. Permission check (SvelteKit server hooks / helper di `src/lib/server`)

### Fase 2 – Master Data (Admin)

1. CRUD Permissions
2. CRUD Processes
3. CRUD Lines (termasuk pilih required permission)
4. CRUD Parts
5. CRUD Hardwares
6. CRUD Users + assign permissions

### Fase 3 – Konfigurasi Part + Line

1. Create / Update Part+Line Config
2. Manage Points, Hardwares (tipe pengecekan + qty + standard), Lengths
3. Validasi flag vs detail (contoh: `has_point = true` harus punya minimal 1 point)

### Fase 4 – Operator Inspection

1. List Line yang boleh diakses user
2. Scan/Pilih Part + validasi config
3. Pilih Stage
4. Logic Re-check
5. Dynamic form rendering
6. Submit inspection + snapshot + overall status calculation

### Fase 5 – Monitoring & Reporting

1. List inspection results (filter: part, line, stage, shift, date, status, operator)
2. Detail inspection (tampilkan semua snapshot)

---

## 8. Contoh Alur Lengkap (End-to-End)

**Admin:**

1. Buat permission `rsw_check`
2. Buat process `Welding`
3. Buat line `RSW` → process Welding → required permission `rsw_check`
4. Buat part `64300`
5. Buat hardware `12911` dan `13900`
6. Buat user `OPR001` → assign permission `rsw_check`
7. Konfigurasi Part `64300` + Line `RSW`:
   - Spot standard 12
   - Point 1, 2, 3
   - Hardware 12911 Torque qty 1 (50 kgf), 13900 Hammer qty 1 (5 mm)
   - Length 1 (120 mm), Length 2 (85 mm)
   - Visual aktif

**Operator (OPR001):**

1. Login
2. Pilih Line RSW (karena punya `rsw_check`)
3. Scan Part 64300 → valid
4. Pilih Stage `START`
5. Sistem tentukan Shift = `DAY` (misal jam 10:00)
6. Cek re-check → belum ada → lanjut
7. Isi form:
   - Point 1 = OK
   - Point 2 = NG → isi remarks "retak"
   - Point 3 = OK
   - Spot actual = 12 → OK
   - Hardware 12911 actual = 52 → OK
   - Hardware 13900 actual = 4 → NG → remarks "kurang"
   - Length 1 actual = 121 → OK
   - Length 2 actual = 80 → NG → remarks "pendek"
   - Visual = OK
8. Overall Status dihitung = **NG**
9. Submit → data tersimpan dengan snapshot lengkap

---

## 9. Catatan Teknis Penting untuk Implementasi

- **Jangan** percaya data standard dari frontend. Selalu ambil ulang dari database saat submit.
- **Jangan** update record inspeksi yang sudah ada (append-only). Re-check = insert baru.
- Semua timestamp gunakan `timestamptz` dan timezone Asia/Jakarta.
- Saat create inspection, **wajib** copy snapshot (`part_no`, `line_code`, `hw_no`, `hw_name`, `standard_value`, `operator_name`, dll).
- Validasi Remarks di backend, jangan hanya di frontend.
- Index yang sudah ada di schema cukup untuk query re-check dan reporting.
- Desain endpoint API (SvelteKit server routes) dan halaman UI **dirancang sendiri dari dokumen ini** — tidak ada dokumen referensi terpisah saat ini.
- Env server dibaca via `$env/dynamic/private`; import relatif di kode server butuh ekstensi `.js` (moduleResolution NodeNext, di-rewrite ke `.ts` oleh `rewriteRelativeImportExtensions`).
- Semua kode server-only diletakkan di `src/lib/server`.

---

## 10. Gotchas / Pitfalls (Dari Implementasi)

Catatan praktis yang sudah terbukti di codebase ini. **Baca sebelum menulis/refactor kode backend.**

### 10.1 Drizzle: jangan pakai `&&` untuk menggabungkan kondisi SQL

```ts
// ❌ SALAH — JS `&&` short-circuit, hanya mengembalikan operand kanan (filter kiri DIBUANG)
where: inArray(lines.requiredPermissionId, ids) && eq(lines.isActive, true);

// ✅ BENAR
where: and(inArray(lines.requiredPermissionId, ids), eq(lines.isActive, true));
```

Berkaca: bug filter permission bocor (OPR001 melihat semua Line) yang harus diperbaiki.

### 10.2 Style repo (jangan dilanggar)

- Prettier: tabs, single quotes, tanpa trailing comma, printWidth 100.
- Jalankan `bun run format` daripada format manual; verifikasi dengan `bun run lint` (prettier --check + eslint) dan `bun run check` (svelte-check).

### 10.3 Environment & Timezone

- `JWT_SECRET` wajib ada di `.env`/`.env.example`; dibaca via `$env/dynamic/private` (pola yang sama dengan `src/lib/server/db/index.ts`).
- Jangan pakai `new Date().getHours()` langsung untuk shift — waktu server bisa beda TZ. Gunakan helper `getShift()` dan `getJakartaDayRange()` di `src/lib/server/shift.ts` (offset manual UTC+7, tanpa DST).
- Query "inspeksi hari ini" (re-check) harus pakai `getJakartaDayRange()`, bukan `today()` SQL.

### 10.4 Aturan data yang wajib dijaga

- **Append-only inspections**: jangan pernah update/delete record inspeksi. Re-check = insert baru.
- **Jangan percaya standard dari frontend**: selalu ambil ulang `part_line_configs` (+ children) dari DB saat submit.
- **Soft delete** (`is_active = false`), bukan hard delete.
- Validasi remarks saat NG wajib di backend, bukan hanya frontend.

### 10.5 Smoke test cepat

- Seed password semua user = `password123`.
- Alur cek: login → GET daftar line (filter permission) → POST prepare part di line (404 jika part belum dikonfigurasi) → POST inspection (422 NG tanpa remarks, 409 re-check tanpa konfirmasi).
- Nama route API mengikuti SvelteKit server routes (`src/routes/api/**`) — ditentukan saat implementasi.

---

## 11. Checklist Implementasi

### Backend

- [x] Schema Drizzle + push (selesai — 15 tabel + 3 enum di DB `rqms`)
- [x] Seed data (`scripts/seed.ts`)
- [x] Auth (jose JWT + argon2)
- [x] Permission check (server hooks/helper)
- [x] CRUD Master (Permission, Process, Line, Part, Hardware, User)
- [x] Part + Line Config (termasuk child Points/Hardwares/Lengths)
- [x] Operator: List accessible lines
- [x] Operator: Validate part di line
- [x] Operator: Stage + Shift
- [x] Operator: Re-check logic
- [x] Operator: Submit + snapshot + overall status
- [x] Admin: Monitoring API (list filter + pagination, detail snapshot)

### Frontend

Desain halaman UI dan alur frontend dirancang sendiri dari dokumen ini (SvelteKit + shadcn-svelte).

- [x] Auth UI (login / logout / protected route guard)
- [x] Admin: CRUD master (Permission, Process, Line, Part, Hardware, User)
- [x] Admin: Part + Line Config (flags + dynamic children)
- [x] Admin: Monitoring UI hasil inspeksi (list + detail snapshot)
- [x] Operator: List Line sesuai permission
- [x] Operator: Flow inspeksi multi-step (scan part → stage → re-check → dynamic form → submit)
- [x] Operator: Dynamic form (Point, Spot, Hardware, Length, Visual) + remarks saat NG
- [x] Empty state, loading state, toast feedback

---

**Dokumen ini adalah sumber kebenaran (source of truth) untuk implementasi.**  
Semua keputusan desain (permission fleksibel, standard di config, snapshot, re-check, dll) sudah digambarkan secara sistematis di atas.
