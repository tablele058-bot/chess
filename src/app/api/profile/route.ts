import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { runMigrations } from '@/lib/migrate';

export async function PATCH(request: NextRequest) {
  try {
    await runMigrations();

    const { userId, username, avatarUrl } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    if (username !== undefined) {
      const trimmed = (username || '').trim();
      if (trimmed.length < 2 || trimmed.length > 30) {
        return NextResponse.json(
          { error: 'Username must be between 2 and 30 characters' },
          { status: 400 }
        );
      }

      const existing = await query(
        `SELECT id FROM profiles WHERE LOWER(username) = LOWER($1) AND id != $2 LIMIT 1`,
        [trimmed, userId]
      );
      if (existing.rows.length > 0) {
        return NextResponse.json(
          { error: 'Username already taken' },
          { status: 409 }
        );
      }

      await query(
        `UPDATE profiles SET username = $1 WHERE id = $2`,
        [trimmed, userId]
      );
    }

    if (avatarUrl !== undefined) {
      await query(
        `UPDATE profiles SET avatar_url = $1 WHERE id = $2`,
        [avatarUrl || null, userId]
      );
    }

    const result = await query(
      `SELECT id, username, avatar_url, elo_rating FROM profiles WHERE id = $1`,
      [userId]
    );

    return NextResponse.json({
      success: true,
      profile: result.rows[0] || null,
    });
  } catch (err) {
    console.error('[API profile PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
