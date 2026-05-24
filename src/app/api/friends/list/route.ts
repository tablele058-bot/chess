import { NextRequest, NextResponse } from 'next/server';
import { query, ProfileRow } from '@/lib/db';
import { runMigrations } from '@/lib/migrate';

export async function GET(request: NextRequest) {
  try {
    await runMigrations();

    const userId = request.nextUrl.searchParams.get('userId') || '';
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const [friendsResult, pendingResult, sentResult] = await Promise.all([
      query(
        `SELECT p.id, p.username, p.avatar_url, p.elo_rating
         FROM friendships f
         JOIN profiles p ON p.id = CASE
           WHEN f.user_id = $1 THEN f.friend_id
           ELSE f.user_id
         END
         WHERE (f.user_id = $1 OR f.friend_id = $1)
           AND f.status = 'ACCEPTED'
         ORDER BY p.elo_rating DESC`,
        [userId]
      ),
      query(
        `SELECT f.id, f.user_id, p.username, p.elo_rating
         FROM friendships f
         JOIN profiles p ON p.id = f.user_id
         WHERE f.friend_id = $1 AND f.status = 'PENDING'
         ORDER BY f.created_at DESC`,
        [userId]
      ),
      query(
        `SELECT f.id, f.friend_id AS user_id, p.username, p.elo_rating
         FROM friendships f
         JOIN profiles p ON p.id = f.friend_id
         WHERE f.user_id = $1 AND f.status = 'PENDING'
         ORDER BY f.created_at DESC`,
        [userId]
      ),
    ]);

    return NextResponse.json({
      friends: friendsResult.rows,
      pending: pendingResult.rows,
      sent: sentResult.rows,
    });
  } catch (err) {
    console.error('[API friends/list]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
