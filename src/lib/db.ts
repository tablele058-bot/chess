import pg from 'pg';

const { Pool } = pg;

interface ExtendedGlobal {
  __chessDbPool?: pg.Pool;
  __chessDbWarned?: boolean;
}

function getPool(): pg.Pool | null {
  const g = globalThis as ExtendedGlobal;

  if (g.__chessDbPool) return g.__chessDbPool;

  const host = process.env.DATABASE_HOST || 'localhost';
  const port = parseInt(process.env.DATABASE_PORT || '5433', 10);
  const user = process.env.DATABASE_USER || 'yugabyte';
  const password = process.env.DATABASE_PASSWORD || '';
  const database = process.env.DATABASE_NAME || 'chess_grandmaster_db';
  const max = parseInt(process.env.DATABASE_MAX_CONNECTIONS || '15', 10);

  const missing: string[] = [];
  if (!host) missing.push('DATABASE_HOST');
  if (!password) missing.push('DATABASE_PASSWORD');
  if (!database) missing.push('DATABASE_NAME');
  if (missing.length > 0) {
    if (!g.__chessDbWarned) {
      console.warn(`[DB] Missing: ${missing.join(', ')} — running without persistence`);
      g.__chessDbWarned = true;
    }
    return null;
  }

  try {
    const p = new Pool({
      host,
      port,
      user,
      password,
      database,
      max,
      idleTimeoutMillis: 15000,
      connectionTimeoutMillis: 5000,
      ssl: { rejectUnauthorized: false },
    });

    p.on('error', (err) => console.error('[DB] Pool error:', err.message));

    g.__chessDbPool = p;
    console.log(`[DB] Global pool ready (host=${host} db=${database} max=${max})`);
    return p;
  } catch (err) {
    console.warn('[DB] Pool creation failed:', err);
    return null;
  }
}

export async function query(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult> {
  const p = getPool();
  if (!p) {
    return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
  }

  let client: pg.PoolClient;
  try {
    client = await p.connect();
  } catch (err) {
    console.error('[DB] Connect error:', (err as Error)?.message || err);
    return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
  }
  try {
    const result = await client.query(text, params);
    return result;
  } catch (err) {
    console.error('[DB] Query error:', (err as Error)?.message || err);
    return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
  } finally {
    client.release();
  }
}

export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T | null> {
  const p = getPool();
  if (!p) return null;

  let client: pg.PoolClient;
  try {
    client = await p.connect();
  } catch (err) {
    console.error('[DB] Transaction connect error:', (err as Error)?.message || err);
    return null;
  }
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[DB] Transaction error:', (err as Error)?.message || err);
    return null;
  } finally {
    client.release();
  }
}

// ─── Shared types for API routes ─────────────────────────────────────

export interface ProfileRow {
  id: string;
  username: string;
  avatar_url: string | null;
  elo_rating: number;
}

export interface FriendshipRow {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  created_at: string;
}

export interface ChallengeRow {
  id: string;
  challenger_id: string;
  challengee_id: string;
  time_control_type: 'BULLET' | 'BLITZ' | 'RAPID' | 'CUSTOM';
  base_minutes: number;
  increment_seconds: number;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  created_at: string;
}

export type FriendshipStatus = 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'ACCEPTED' | 'REJECTED';
