'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ProfileResult {
  id: string;
  username: string;
  avatar_url: string | null;
  elo_rating: number;
  isFriend?: boolean;
  isPending?: boolean;
  isStranger?: boolean;
}

export interface FriendRequestItem {
  id: string;
  user_id: string;
  username: string;
  elo_rating: number;
}

export interface ChallengeReceived {
  id: string;
  challenger_id: string;
  challenger_username: string;
  challenger_elo: number;
  time_control_type: string;
  base_minutes: number;
  increment_seconds: number;
  status: string;
  created_at: string;
}

export interface AcceptedChallenge {
  id: string;
  challenger_id: string;
  challengee_id: string;
  challengee_username: string;
  challengee_elo: number;
  match_id: string;
  time_control_type: string;
  base_minutes: number;
  increment_seconds: number;
  created_at: string;
}

export function useSocial(userId?: string) {
  const [friends, setFriends] = useState<ProfileResult[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequestItem[]>([]);
  const [incomingChallenges, setIncomingChallenges] = useState<ChallengeReceived[]>([]);
  const [acceptedChallenges, setAcceptedChallenges] = useState<AcceptedChallenge[]>([]);
  const loadingRef = useRef(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchFriends = useCallback(async () => {
    if (!userId) return;
    loadingRef.current = true;
    try {
      const res = await fetch(`/api/friends/list?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (data.friends) setFriends(data.friends);
      if (data.pending) setPendingRequests(data.pending);
    } catch {
      /* ignore */
    } finally {
      loadingRef.current = false;
    }
  }, [userId]);

  const fetchChallenges = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/challenges/pending?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (data.challenges) setIncomingChallenges(data.challenges);
      if (data.accepted) setAcceptedChallenges(data.accepted);
    } catch {
      /* ignore */
    }
  }, [userId]);

  useEffect(() => {
    fetchFriends();
    fetchChallenges();

    pollingRef.current = setInterval(() => {
      fetchChallenges();
    }, 5000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchFriends, fetchChallenges]);

  const searchUsers = useCallback(
    (query: string): Promise<ProfileResult[]> => {
      return new Promise((resolve) => {
        const q = encodeURIComponent(query);
        const uid = userId || '';
        fetch(`/api/social/search?query=${q}&currentUserId=${uid}`)
          .then((r) => r.json())
          .then((data) => resolve(data.users || []))
          .catch(() => resolve([]));
      });
    },
    [userId],
  );

  const sendFriendRequest = useCallback(
    (targetUserId: string): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        fetch('/api/friends/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentUserId: userId, targetUserId }),
        })
          .then(async (r) => {
            const data = await r.json();
            if (!r.ok) return { success: false, error: data.error };
            return { success: true };
          })
          .then((result) => {
            fetchFriends();
            resolve(result);
          })
          .catch(() => resolve({ success: false, error: 'Network error' }));
      });
    },
    [userId, fetchFriends],
  );

  const respondToFriendRequest = useCallback(
    (requestId: string, action: 'ACCEPT' | 'DECLINE'): Promise<boolean> => {
      return new Promise((resolve) => {
        fetch('/api/social/friends/respond', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId, action }),
        })
          .then((r) => r.json())
          .then((data) => {
            fetchFriends();
            resolve(!!data.success);
          })
          .catch(() => resolve(false));
      });
    },
    [fetchFriends],
  );

  const removeFriend = useCallback(
    (targetUserId: string): Promise<boolean> => {
      return new Promise((resolve) => {
        fetch('/api/friends/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentUserId: userId, targetUserId }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.success) {
              setFriends((prev) => prev.filter((f) => f.id !== targetUserId));
            }
            resolve(!!data.success);
          })
          .catch(() => resolve(false));
      });
    },
    [userId],
  );

  const sendChallenge = useCallback(
    (payload: {
      targetUserId: string;
      timeControlType?: string;
      baseMinutes?: number;
      incrementSeconds?: number;
    }): Promise<{ success: boolean; error?: string; challengeId?: string }> => {
      return new Promise((resolve) => {
        fetch('/api/challenges/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            challengerId: userId,
            targetUserId: payload.targetUserId,
            timeControlType: payload.timeControlType || 'BLITZ',
            baseMinutes: payload.baseMinutes ?? 3,
            incrementSeconds: payload.incrementSeconds ?? 2,
          }),
        })
          .then(async (r) => {
            const data = await r.json();
            if (!r.ok) return { success: false, error: data.error };
            return { success: true, challengeId: data.challenge?.id };
          })
          .then(resolve)
          .catch(() => resolve({ success: false, error: 'Network error' }));
      });
    },
    [userId],
  );

  const respondToChallenge = useCallback(
    (challengeId: string, action: 'accept' | 'decline'): Promise<{ success: boolean; arenaUrl?: string }> => {
      return new Promise((resolve) => {
        fetch('/api/challenges/respond', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeId, action, userId }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.success) {
              setIncomingChallenges((prev) => prev.filter((c) => c.id !== challengeId));
              resolve({ success: true, arenaUrl: data.arenaUrl });
            } else {
              resolve({ success: false });
            }
          })
          .catch(() => resolve({ success: false }));
      });
    },
    [userId],
  );

  const dismissChallenge = useCallback(
    (challengeId: string) => {
      setIncomingChallenges((prev) => prev.filter((c) => c.id !== challengeId));
    },
    [],
  );

  return {
    friends,
    pendingRequests,
    incomingChallenges,
    acceptedChallenges,
    searchUsers,
    sendFriendRequest,
    respondToFriendRequest,
    removeFriend,
    sendChallenge,
    respondToChallenge,
    dismissChallenge,
  };
}
