import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface SearchResult {
  id: string;
  username: string;
  avatar_url: string | null;
  elo_rating: number;
  isFriend: boolean;
  isPending: boolean;
  isStranger: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const q = (request.nextUrl.searchParams.get('query') || '').trim();
    const currentUserId = request.nextUrl.searchParams.get('currentUserId') || '';

    if (!q || q.length < 1) {
      return NextResponse.json({ users: [] });
    }

    const result = await query(
      `SELECT
         p.id, p.username, p.avatar_url, p.elo_rating,
         f.status AS f_status,
         f.user_id AS f_sender
       FROM profiles p
       LEFT JOIN friendships f ON (
         (f.user_id = $2 AND f.friend_id = p.id)
         OR (f.user_id = p.id AND f.friend_id = $2)
       )
       WHERE p.username ILIKE $1 AND p.id != $2
       LIMIT 10`,
      [`%${q}%`, currentUserId],
    );

    const users: SearchResult[] = result.rows.map((r) => {
      const status = r.f_status as string | null;
      const isSender = r.f_sender === currentUserId;
      return {
        id: r.id as string,
        username: r.username as string,
        avatar_url: (r.avatar_url as string) || null,
        elo_rating: (r.elo_rating as number) || 1200,
        isFriend: status === 'ACCEPTED',
        isPending: status === 'PENDING' && !isSender,
        isStranger: !status,
      };
    });

    return NextResponse.json({ users });
  } catch (err) {
    console.error('[API social/search]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
