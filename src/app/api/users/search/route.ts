import { NextRequest, NextResponse } from 'next/server';
import { query, ProfileRow, FriendshipStatus } from '@/lib/db';
import { runMigrations } from '@/lib/migrate';

interface ProfileWithStatus extends ProfileRow {
  friendship_status: FriendshipStatus;
}

export async function GET(request: NextRequest) {
  try {
    await runMigrations();

    const q = request.nextUrl.searchParams.get('q') || '';
    const currentUserId = request.nextUrl.searchParams.get('currentUserId') || '';

    if (!q.trim()) {
      return NextResponse.json({ users: [] });
    }

    const result = await query(
      `SELECT
         p.id, p.username, p.avatar_url, p.elo_rating,
         CASE
           WHEN f.id IS NULL THEN 'NONE'
           WHEN f.status = 'ACCEPTED' THEN 'ACCEPTED'
           WHEN f.status = 'REJECTED' THEN 'REJECTED'
           WHEN f.user_id = $2 THEN 'PENDING_SENT'
           ELSE 'PENDING_RECEIVED'
         END AS friendship_status
       FROM profiles p
       LEFT JOIN friendships f ON (
         (f.user_id = $2 AND f.friend_id = p.id)
         OR (f.user_id = p.id AND f.friend_id = $2)
       )
       WHERE p.username ILIKE $1 AND p.id != $2
       LIMIT 10`,
      [`%${q}%`, currentUserId]
    );

    const users: ProfileWithStatus[] = result.rows.map((r) => ({
      id: r.id,
      username: r.username,
      avatar_url: r.avatar_url,
      elo_rating: r.elo_rating,
      friendship_status: r.friendship_status as FriendshipStatus,
    }));

    return NextResponse.json({ users });
  } catch (err) {
    console.error('[API users/search]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
