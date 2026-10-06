# Panduan Deployment RQMS (Production)

Dokumen ini menjelaskan cara men-deploy RQMS ke server produksi, dari nol sampai ops/troubleshooting. Ditulis berdasarkan setup produksi yang dipakai (VPS + Apache + Cloudflare), tapi berlaku umum untuk Nginx juga.

```

Arsitektur:

  Browser ──≥ Cloudflare (proxy + TLS publik)
              └─≥ Apache/Nginx (TLS origin, reverse proxy)
                   └─≥ Node adapter-node 127.0.0.1:3000
                        ├─≥ PostgreSQL (localhost)
                        └─≥ Redis (localhost)

```

---

## 1. Prasyarat

| Kebutuhan    | Versi minimal                   | Catatan                                  |
| ------------ | ------------------------------- | ---------------------------------------- |
| Node.js      | 20.19+ / 22.12+ (atau Bun 1.1+) | Untuk menjalankan build adapter-node     |
| Bun          | 1.1+                            | Untuk install dependency, build, db:seed |
| PostgreSQL   | 15+                             | Database utama                           |
| Redis        | 7+                              | Session blacklist + rate limit           |
| Apache/Nginx | —                               | Reverse proxy, TLS termination           |

---

## 2. Ambil kode & install

```bash
git clone <repo-url> /opt/rqms
cd /opt/rqms
bun install
```

---

## 3. Environment (`.env`)

> **PENTING:** dev server (Vite) memuat `.env` **secara otomatis**, tetapi
> `adapter-node` di production **TIDAK** memuat `.env`. Kamu harus memberikan
> variabel env lewat salah satu cara:
>
> - `node --env-file=.env build/index.js` ← paling simpel
> - systemd `EnvironmentFile=/opt/rqms/.env`
> - pm2: export di shell / `env:` pada ecosystem file

### Variabel wajib

```env
DATABASE_URL="postgres://rqms:passwordkuat@localhost:5432/rqms"
REDIS_URL="redis://:passwordredis@localhost:6379"
JWT_SECRET="<hasil: openssl rand -hex 32>"
```

### Variabel production (adapter-node)

```env
HOST="127.0.0.1"          # Node hanya listen lokal — Apache yang menghadap publik
PORT="3000"

# --- Wajib saat di balik reverse proxy ---
ORIGIN="https://qms.devmoon.net"
ADDRESS_HEADER="x-forwarded-for"
XFF_DEPTH="2"              # jumlah proxy di depan Node (Cloudflare + Apache = 2)
PROTOCOL_HEADER="x-forwarded-proto"

# Opsional
# BODY_SIZE_LIMIT="1M"     # default adapter-node 512K; hooks.server.ts membatasi 1MB
# HOST_HEADER="x-forwarded-host"   # tidak perlu kalau proxy memakai ProxyPreserveHost On
```

Catatan:

- `XFF_DEPTH` = **jumlah proxy tepercaya** yang menambahkan entri `X-Forwarded-For`.
  Tanpa Cloudflare (hanya Apache) → `1`. Dengan Cloudflare → `2`.
- **Jangan set `ADDRESS_HEADER`** kalau ada request yang menembak Node langsung tanpa
  lewat proxy (mis. health check) — adapter-node akan error karena header absen.
  Kalau butuh health check lokal, sertakan header: `curl -H "X-Forwarded-For: 127.0.0.1" ...`.
- Perubahan `.env` cukup restart app, **tidak perlu rebuild**.

---

## 4. Database

Sekali saja saat setup (atau saat schema berubah):

```bash
# Push schema (dev/staging). Untuk production pertimbangkan db:migrate.
bun run db:push -- --force

# Seed data awal + trigger SSE (idempoten, aman diulang)
bun run db:seed
```

Seed membuat: permission `rsw_check` + `admin_access`, line `RSW`, part `64300`,
user **ADMIN001 / OPR001** (password: `password123`), dan trigger `trg_notify_board`.

### ⚠️ Ganti password seed segera

1. Login `ADMIN001` → menu settings → **Ganti Password**.
2. Buat user admin pribadi (NIK baru + permission `admin_access`).
3. Nonaktifkan (jangan hapus — FK audit log) user seed lewat menu User.

### Trigger SSE manual (kalau perlu)

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

## 5. Build & jalankan

```bash
cd /opt/rqms
bun run build
node --env-file=.env build/index.js
```

### systemd (disarankan)

`/etc/systemd/system/rqms.service`:

```ini
[Unit]
Description=RQMS (Quality Management System)
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
User=rqms
WorkingDirectory=/opt/rqms
ExecStart=/usr/bin/node --env-file=.env build/index.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now rqms
```

### pm2 (alternatif)

```bash
pm2 start build/index.js --name rqms --node-args="--env-file=.env"
pm2 save
```

---

## 6. Reverse proxy

### 6a. Apache (contoh produksi)

```apache
<VirtualHost *:443>
    ServerName qms.devmoon.net

    SSLEngine On
    SSLCertificateFile /etc/ssl/cloudflare/cert.pem
    SSLCertificateKeyFile /etc/ssl/cloudflare/key.pem

    ProxyPreserveHost On
    ProxyRequests Off

    # Hindari stale connection ke backend
    SetEnv proxy-nokeepalive 1
    SetEnv proxy-sendchunked 1

    # SSE board: jangan buffer, biarkan mengalir, timeout panjang
    <Location /api/board/>
        ProxyPass http://127.0.0.1:3000/api/board/ flushpackets=on retry=0 timeout=3600
        ProxyPassReverse http://127.0.0.1:3000/api/board/
    </Location>

    ProxyPass / http://127.0.0.1:3000/ retry=0 timeout=60
    ProxyPassReverse / http://127.0.0.1:3000/

    # Paksa skema https (jangan pakai setifempty — ini mencegah spoof)
    RequestHeader set X-Forwarded-Proto "https"

    ErrorLog ${APACHE_LOG_DIR}/rqms-error.log
    CustomLog ${APACHE_LOG_DIR}/rqms-access.log combined
</VirtualHost>
```

Catatan:

- `X-Forwarded-For` **tidak perlu ditulis manual** — mod_proxy menambahkannya otomatis (append).
  Pastikan `ProxyAddHeaders` tidak dimatikan.
- Blok rewrite WebSocket tidak diperlukan (app hanya memakai SSE, bukan WebSocket).
- SSE awalnya bisa putus tiap 60 detik karena `timeout`; app sekarang mengirim
  heartbeat 25 detik, jadi aman — `timeout=3600` di atas hanya jaga-jaga.

### 6b. Nginx (alternatif)

```nginx
server {
    listen 443 ssl;
    server_name qms.devmoon.net;

    ssl_certificate     /etc/ssl/cloudflare/cert.pem;
    ssl_certificate_key /etc/ssl/cloudflare/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # SSE board — matikan buffering supaya realtime
    location /api/board/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
    }
}
```

---

## 7. Cloudflare & pengamanan origin

- Gunakan mode SSL/TLS **Full (strict)** dengan origin certificate.
- **Firewall origin**: hanya izinkan IP Cloudflare mengakses port 443, dan pastikan
  port **3000 tidak terbuka ke publik**. Ini bukan hanya soal keamanan umum —
  kalau orang bisa menembak Apache langsung (bypass Cloudflare), entri
  `X-Forwarded-For` palsu bisa dipakai memalsukan IP (bypass rate limit).
- `XFF_DEPTH=2` mengasumsikan Cloudflare + Apache sama-sama menambahkan entri XFF.
  Verifikasi lewat langkah §9; kalau ternyata hanya 1 entri, ubah ke `1`.

---

## 8. Checklist keamanan sebelum go-live

- [ ] `JWT_SECRET` acak: `openssl rand -hex 32` (jangan pakai contoh).
- [ ] Password user seed (`password123`) sudah diganti / user dinonaktifkan.
- [ ] PostgreSQL: password kuat, listen `localhost` saja.
- [ ] Redis: `requirepass` + bind `127.0.0.1`.
- [ ] `ORIGIN` sesuai domain HTTPS; aplikasi hanya diakses via HTTPS
      (cookie sesi `Secure` — akses HTTP akan membuat login selalu kembali ke /login).
- [ ] Firewall: 443 hanya dari Cloudflare; 3000/5432/6379 tertutup.
- [ ] Backup harian: `pg_dump` + cron, simpan di luar server.
- [ ] Log rotate untuk log app/Apache.

Contoh cron backup:

```cron
15 1 * * * pg_dump -Fc rqms > /var/backups/rqms-$(date +\%F).dump
```

---

## 9. Verifikasi pasca-deploy

1. **Login normal berhasil** (ADMIN001 atau user buatan sendiri).
2. **Rate limit benar**: coba 6x password salah di akun fiktif → ke-6 harus muncul
   pesan "Terlalu banyak percobaan **untuk akun ini**"; sambil terkunci, login user
   lain **tetap bisa** (ini inti perbaikan — kegagalan satu akun tidak mengunci semua).
3. **IP asli terbaca** (bukan 127.0.0.1 / IP Cloudflare):

   ```bash
   redis-cli -a <password> --scan --pattern 'rqms:ratelimit:login:ip:*'
   # key harus memuat IP publik pengguna
   psql rqms -c "SELECT ip_address, action, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 5;"
   ```

4. **Board realtime**:

   ```bash
   curl -N -H "Accept: text/event-stream" http://127.0.0.1:3000/api/board/RSW/stream
   # harus terlihat event: init, lalu ": ping" tiap 25 detik
   ```

5. **Koneksi DB tidak menumpuk**:

   ```bash
   psql rqms -c "SELECT count(*) FROM pg_stat_activity WHERE datname='rqms';"
   # buka-tutup board, angka harus kembali ke baseline
   ```

---

## 10. Update / redeploy

```bash
cd /opt/rqms
git pull
bun install            # kalau ada dependency baru
bun run build
systemctl restart rqms # atau: pm2 restart rqms
```

- `db:push` / `db:migrate` hanya jika ada perubahan schema.
- Sesi user tidak perlu login ulang saat deploy (JWT tetap valid), kecuali
  `JWT_SECRET` diganti.

---

## 11. Troubleshooting

### Semua user tiba-tiba tidak bisa login

Cek status code `POST /login` di DevTools → Network:

| Status                  | Penyebab                              | Solusi                                                                                            |
| ----------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **429**                 | Rate limit (aktif)                    | Buka paksa: `redis-cli --scan --pattern 'rqms:ratelimit:login:*' \| xargs -r redis-cli del`       |
| **403** + "Cross-site"  | Origin salah (ORIGIN/PROTOCOL_HEADER) | Set `ORIGIN` di env, restart                                                                      |
| **500** (+ log warning) | Redis/DB down                         | `redis-cli ping`, cek status postgres; app fail-open untuk rate limit tapi butuh Redis untuk sesi |
| **303 → balik /login**  | Cookie `Secure` di-drop (akses HTTP)  | Pastikan user lewat HTTPS                                                                         |

Rate limit produksi saat ini: **per akun 5 gagal / 15 menit** dan **per IP 50 gagal / 15 menit**.
Login sukses tidak pernah memakan kuota. Kegagalan tercatat di `audit_logs`
(`login_failed` dengan reason) — cek:

```sql
SELECT action, count(*), min(created_at), max(created_at)
FROM audit_logs
WHERE action LIKE 'login%' AND created_at > now() - interval '1 day'
GROUP BY action;
```

### Board realtime mati / tidak update

1. Pastikan trigger ada: `SELECT tgname FROM pg_trigger WHERE tgname='trg_notify_board';`
   (kalau tidak ada → `bun run db:seed`).
2. Cek koneksi Postgres tidak penuh (lihat §9 langkah 5).
3. Cek proxy: `flushpackets=on` (Apache) / `proxy_buffering off` (Nginx).

### Logout / nonaktif akun tapi token lama masih bisa

- Logout → token masuk blacklist Redis (`revoked_jti:*`), TTL sampai token expired.
- Ganti password / NIK berubah / akun dinonaktifkan → semua sesi user direvoke
  (`user_revoked_at:*`).
- Sesi juga dicek `isActive` langsung ke DB di setiap request.
- Kalau Redis di-restart tanpa persistence, marker revoke bisa hilang — sesi lama
  yang sudah di-logout bisa "hidup" kembali sampai expired (maks 1 hari). Aktifkan
  AOF/persistence Redis untuk produksi.

---

## 12. Catatan operasional

| Hal          | Detail                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------ |
| Timezone     | Semua logika shift/hari operasional dihitung **WIB manual (UTC+7)** — TZ server bebas (UTC ok)               |
| Sesi         | JWT 1 hari, cookie `rqms_token` (httpOnly, secure). Revoke otomatis saat password/nonaktif/NIK               |
| Rate limit   | Login: 5 gagal/15mnt per akun + 50 gagal/15mnt per IP · Submit: 30/60s per user · API admin: 60/60s per user |
| Export Excel | Maks 50.000 baris per export (dibatasi di server)                                                            |
| Audit log    | Append-only; user tidak bisa dihapus permanen selama masih punya audit log (nonaktifkan saja)                |
| Password     | Min 8 karakter, besar+kecil+angka+simbol, tidak boleh sama dengan 5 password terakhir                        |
