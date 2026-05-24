import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { runMigrations } from '@/lib/migrate';

export async function POST(request: NextRequest) {
  try {
    await runMigrations();

    const { userId, username, avatarUrl } = await request.json();

    if (!userId || !username) {
      return NextResponse.json({ error: 'Missing userId or username' }, { status: 400 });
    }

    await query(
      `INSERT INTO profiles (id, username, avatar_url)
       VALUES ($1, $2, $3)
       ON CONFLICT (id)
       DO UPDATE SET
         username = COALESCE(NULLIF(profiles.username, ''), EXCLUDED.username),
         avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url)`,
      [userId, username, avatarUrl || null]
    );

    const result = await query(
      `SELECT id, username, avatar_url, elo_rating, games_played, is_provisional
       FROM profiles WHERE id = $1`,
      [userId]
    );

    return NextResponse.json({
      success: true,
      profile: result.rows[0] || null,
    });
  } catch (err) {
    console.error('[API profile/sync]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
