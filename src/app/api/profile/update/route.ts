import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { runMigrations } from '@/lib/migrate';

export async function POST(request: NextRequest) {
  try {
    await runMigrations();

    const body = await request.json();
    const targetUserId = body.userId;
    if (!targetUserId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const username = ((body.username as string) || '').trim();
    const avatarUrl = ((body.avatarUrl as string) || '').trim() || null;

    if (username.length < 2 || username.length > 50) {
      return NextResponse.json({ error: 'Username must be 2-50 characters' }, { status: 400 });
    }

    const existing = await query(
      `SELECT id FROM profiles WHERE LOWER(username) = LOWER($1) AND id != $2 LIMIT 1`,
      [username, targetUserId]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }

    await query(
      `INSERT INTO profiles (id, username, avatar_url)
       VALUES ($1, $2, $3)
       ON CONFLICT (id)
       DO UPDATE SET
         username = EXCLUDED.username,
         avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url)`,
      [targetUserId, username, avatarUrl],
    );

    const result = await query(
      `SELECT id, username, avatar_url, elo_rating, created_at FROM profiles WHERE id = $1`,
      [targetUserId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    return NextResponse.json({ success: true, profile: result.rows[0] });
  } catch (err) {
    console.error('[API profile/update]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
