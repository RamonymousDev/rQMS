/**
 * Konstanta permission yang dipakai bersama oleh server dan komponen UI.
 * Tinggal di luar `$lib/server` karena sidebar perlu tahu kode admin untuk
 * memutuskan menu apa yang dirender — nilainya sendiri bukan rahasia.
 * Enforcement tetap sepenuhnya di server (lihat `requireAdmin`).
 */
export const ADMIN_PERMISSION = 'admin_access';
