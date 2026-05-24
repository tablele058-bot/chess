import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { runMigrations } from '@/lib/migrate';

export async function POST(request: NextRequest) {
  try {
    await runMigrations();

    const { targetUserId, currentUserId } = await request.json();

    if (!targetUserId || !currentUserId) {
      return NextResponse.json(
        { error: 'Missing targetUserId or currentUserId' },
        { status: 400 }
      );
    }

    if (targetUserId === currentUserId) {
      return NextResponse.json(
        { error: 'Cannot friend yourself' },
        { status: 409 }
      );
    }

    const existing = await query(
      `SELECT status FROM friendships
       WHERE (user_id = $1 AND friend_id = $2)
          OR (user_id = $2 AND friend_id = $1)
       LIMIT 1`,
      [currentUserId, targetUserId]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      if (row.status === 'ACCEPTED') {
        return NextResponse.json(
          { error: 'Already friends' },
          { status: 409 }
        );
      }
      if (row.status === 'PENDING') {
        return NextResponse.json(
          { error: 'Friend request already pending' },
          { status: 409 }
        );
      }
      if (row.status === 'REJECTED') {
        await query(
          `UPDATE friendships
           SET status = 'PENDING', created_at = clock_timestamp()
           WHERE (user_id = $1 AND friend_id = $2)
              OR (user_id = $2 AND friend_id = $1)`,
          [currentUserId, targetUserId]
        );
        return NextResponse.json({ success: true, reissued: true });
      }
    }

    await query(
      `INSERT INTO friendships (user_id, friend_id, status)
       VALUES ($1, $2, 'PENDING')`,
      [currentUserId, targetUserId]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API friends/request]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
