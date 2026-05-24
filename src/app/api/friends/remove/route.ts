import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { runMigrations } from '@/lib/migrate';

export async function POST(request: NextRequest) {
  try {
    await runMigrations();

    const { currentUserId, targetUserId } = await request.json();

    if (!currentUserId || !targetUserId) {
      return NextResponse.json(
        { error: 'Missing currentUserId or targetUserId' },
        { status: 400 }
      );
    }

    await query(
      `DELETE FROM friendships
       WHERE (user_id = $1 AND friend_id = $2)
          OR (user_id = $2 AND friend_id = $1)`,
      [currentUserId, targetUserId]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API friends/remove]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
