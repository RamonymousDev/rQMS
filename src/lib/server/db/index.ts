import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = postgres(env.DATABASE_URL);

export const db = drizzle(client, { schema });

/** Handle transaksi, untuk helper yang menerima `tx` dari `db.transaction()`. */
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
