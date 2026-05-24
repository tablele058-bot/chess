import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
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

    const result = await query(
      `INSERT INTO profiles (id, username, avatar_url)
       VALUES ($1, $2, $3)
       ON CONFLICT (id)
       DO UPDATE SET
         username = EXCLUDED.username,
         avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url)
       RETURNING id, username, avatar_url, elo_rating, games_played, is_provisional, created_at`,
      [targetUserId, username, avatarUrl],
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
