import { NextRequest, NextResponse } from 'next/server';
import { query, FriendshipRow } from '@/lib/db';
import { runMigrations } from '@/lib/migrate';

export async function POST(request: NextRequest) {
  try {
    await runMigrations();

    const { requestId, action, currentUserId } = await request.json();

    if (!requestId || !action || !currentUserId) {
      return NextResponse.json(
        { error: 'Missing requestId, action, or currentUserId' },
        { status: 400 }
      );
    }

    if (action !== 'ACCEPT' && action !== 'DECLINE') {
      return NextResponse.json(
        { error: 'action must be ACCEPT or DECLINE' },
        { status: 400 }
      );
    }

    const existing = await query(
      `SELECT * FROM friendships WHERE id = $1 AND status = 'PENDING'`,
      [requestId]
    );

    if (existing.rows.length === 0) {
      return NextResponse.json(
        { error: 'No pending request found' },
        { status: 404 }
      );
    }

    const row = existing.rows[0];
    if (row.friend_id !== currentUserId) {
      return NextResponse.json(
        { error: 'This request is not addressed to you' },
        { status: 403 }
      );
    }

    const newStatus = action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
    const result = await query(
      `UPDATE friendships SET status = $1 WHERE id = $2
       RETURNING *`,
      [newStatus, requestId]
    );

    const friendship: FriendshipRow = {
      id: result.rows[0].id,
      user_id: result.rows[0].user_id,
      friend_id: result.rows[0].friend_id,
      status: result.rows[0].status,
      created_at: result.rows[0].created_at,
    };

    return NextResponse.json({ success: true, friendship });
  } catch (err) {
    console.error('[API friends/respond]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
