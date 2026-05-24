'use client';

import { useUser } from '@clerk/nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import {
  Trophy, Shield, ShieldAlert, Award, Calendar,
  Mail, Swords, Play, BarChart3, Clock, Eye, Trash2,
  User, Zap, Users, UserPlus, UserCheck, UserX,
  Bell, Pencil, Check, X, BookOpen,
  Loader2, Save, Flag, Handshake,
} from 'lucide-react';
import { SocialSidebar } from '@/components/SocialSidebar';
import { useSocial, ProfileResult, AcceptedChallenge } from '@/hooks/useSocial';

interface GameRecord {
  id: string;
  opponent: string;
  result: string;
  playedAt: string;
  isBot: boolean;
}

interface ProfileData {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  elo: number;
  gamesPlayed: number;
  isProvisional: boolean;
  createdAt: string;
  games: GameRecord[];
  stats: {
    wins: number;
    losses: number;
    draws: number;
    total: number;
  };
}

const STORAGE_KEY = 'sujana_tech_chess_history';

function StatCard({ label, value, color, icon }: { label: string; value: string | number; color?: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-[#211f1c] border border-[#2d2b27] rounded-lg p-4 shadow-sm flex items-center justify-between hover:border-[#3c3934] transition-all">
      <div className="space-y-1 min-w-0">
        <div className="text-[10px] text-[#615e59] uppercase tracking-widest font-bold font-mono truncate">{label}</div>
        <div className={`text-xl font-black font-mono tracking-tight ${color || 'text-white'}`}>{value}</div>
      </div>
      {icon && <div className="w-8 h-8 rounded-lg bg-[#161513] border border-[#2d2b27] flex items-center justify-center text-[#615e59]">{icon}</div>}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#161513] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ProfilePageContent />
    </Suspense>
  );
}

function ProfilePageContent() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const { friends, pendingRequests, incomingChallenges, acceptedChallenges, searchUsers, sendFriendRequest, respondToFriendRequest, removeFriend, sendChallenge, respondToChallenge, dismissChallenge } = useSocial(user?.id);
  const [showFriendsList, setShowFriendsList] = useState(false);
  const [viewFriend, setViewFriend] = useState<ProfileResult | null>(null);
  const [challengeTarget, setChallengeTarget] = useState<ProfileResult | null>(null);
  const [challengeColor, setChallengeColor] = useState<'random' | 'white' | 'black'>('random');
  const [challengeTime, setChallengeTime] = useState<'BULLET' | 'BLITZ' | 'RAPID' | 'DAILY'>('BLITZ');
  const [challengeSending, setChallengeSending] = useState(false);
  const [challengeError, setChallengeError] = useState('');

  const [acceptingIds, setAcceptingIds] = useState<Set<string>>(new Set());
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  useEffect(() => {
    const raw = searchParams.get('viewUserId');
    setViewUserId((prev) => prev === raw ? prev : raw);
  }, [searchParams]);
  const isViewingOther = !!viewUserId && viewUserId !== user?.id;

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const getDefaultName = useCallback(() => {
    if (!user) return 'Player';
    return user.username
      || user.fullName
      || user.primaryEmailAddress?.emailAddress?.split('@')[0]
      || `user_${user.id.slice(-6)}`;
  }, [user]);

  // Sync profile to DB on mount
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    setSyncing(true);
    fetch('/api/profile/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        username: getDefaultName(),
        avatarUrl: user.imageUrl || null,
      }),
    }).catch(() => {});
  }, [isLoaded, isSignedIn, user, getDefaultName]);

  const loadFromLocal = () => {
    if (!user) return;
    const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const wins = cached.filter((g: any) => g.result === 'Won').length;
    const losses = cached.filter((g: any) => g.result === 'Lost').length;
    const draws = cached.filter((g: any) => g.result === 'Draw').length;
    setProfile({
      id: user.id,
      username: getDefaultName(),
      email: user.primaryEmailAddress?.emailAddress || '',
      avatar_url: user.imageUrl || null,
      elo: wins > losses ? 1200 + (wins * 15) : Math.max(400, 1200 - (losses * 10)),
      gamesPlayed: cached.length,
      isProvisional: cached.length <= 15,
      createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
      games: cached,
      stats: { wins, losses, draws, total: cached.length },
    });
    setLoading(false);
  };

  const currentUserId = user?.id;

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in');
      return;
    }

    const targetUserId = viewUserId || currentUserId;
    if (!targetUserId) return;

    const isOwn = !viewUserId || viewUserId === currentUserId;

    const controller = new AbortController();

    fetch(`/api/users/profile?userId=${encodeURIComponent(targetUserId)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        const p = data.profile || {};
        const apiGames = (data.games || []).map((g: any) => ({
          id: g.id,
          opponent: g.opponent || 'Unknown',
          result: g.result || 'Finished',
          playedAt: g.played_at || g.playedAt || new Date().toISOString(),
          isBot: !!g.is_bot,
        }));
        const local = isOwn ? JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') : [];
        const localMap = new Map(local.map((g: any) => [g.id, g]));
        const merged = apiGames.slice();
        for (const lg of local) {
          if (!merged.some((g: any) => g.id === lg.id)) {
            merged.push({
              id: lg.id,
              opponent: lg.opponent || 'Unknown',
              result: lg.result || 'Finished',
              playedAt: lg.playedAt || new Date().toISOString(),
              isBot: true,
            });
          }
        }
        merged.sort((a: any, b: any) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());
        const wins = merged.filter((g: any) => g.result === 'Won').length;
        const losses = merged.filter((g: any) => g.result === 'Lost').length;
        const draws = merged.filter((g: any) => g.result === 'Draw').length;
        setProfile({
          id: p.id || targetUserId,
          username: p.username || (isOwn ? getDefaultName() : `user_${targetUserId.slice(-6)}`),
          email: p.email || '',
          avatar_url: p.avatar_url || null,
          elo: p.elo || 1200,
          gamesPlayed: p.gamesPlayed || merged.length,
          isProvisional: p.isProvisional ?? (merged.length <= 15),
          createdAt: p.createdAt || new Date().toISOString(),
          games: merged,
          stats: data.stats || { wins, losses, draws, total: merged.length },
        });
        setLoading(false);
      })
      .catch(() => {
        if (isOwn) {
          loadFromLocal();
        } else {
          setProfile(null);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [isLoaded, isSignedIn, currentUserId, viewUserId, router]);

  const handleRecordDeletion = (gameId: string) => {
    if (!profile) return;
    const filtered = profile.games.filter((g) => g.id !== gameId);
    const wins = filtered.filter((g) => g.result === 'Won').length;
    const losses = filtered.filter((g) => g.result === 'Lost').length;
    const draws = filtered.filter((g) => g.result === 'Draw').length;

    setProfile({
      ...profile,
      games: filtered,
      stats: { wins, losses, draws, total: filtered.length },
    });

    const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached.filter((g: any) => g.id !== gameId)));
  };

  const startEditing = () => {
    if (!profile) return;
    setEditUsername(profile.username);
    setEditAvatarUrl(profile.avatar_url || '');
    setSaveError('');
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setSaveError('');
  };

  const saveProfile = async () => {
    if (!user || !profile) return;
    const trimmed = editUsername.trim();
    if (trimmed.length < 2 || trimmed.length > 50) {
      setSaveError('Username must be 2-50 characters');
      return;
    }
    setSaving(true);
    setSaveError('');

    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          username: trimmed,
          avatarUrl: editAvatarUrl.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error || 'Failed to save');
        setSaving(false);
        return;
      }

      if (data.profile) {
        setProfile({
          ...profile,
          username: data.profile.username,
          avatar_url: data.profile.avatar_url || null,
        });
      } else {
        setProfile({
          ...profile,
          username: trimmed,
          avatar_url: editAvatarUrl.trim() || null,
        });
      }
      setEditing(false);
    } catch {
      setSaveError('Network error');
    }
    setSaving(false);
  };

  const TIME_PRESETS: { key: 'BULLET' | 'BLITZ' | 'RAPID' | 'DAILY'; label: string; base: number; inc: number }[] = [
    { key: 'BULLET', label: 'Bullet 1+0', base: 1, inc: 0 },
    { key: 'BLITZ', label: 'Blitz 3+2', base: 3, inc: 2 },
    { key: 'RAPID', label: 'Rapid 10+5', base: 10, inc: 5 },
    { key: 'DAILY', label: 'Daily 1d', base: 1440, inc: 0 },
  ];

  const openChallenge = (target: ProfileResult) => {
    setChallengeTarget(target);
    setChallengeColor('random');
    setChallengeTime('BLITZ');
    setChallengeError('');
  };

  const sendChallengeRequest = async () => {
    if (!challengeTarget) return;
    setChallengeSending(true);
    setChallengeError('');
    const preset = TIME_PRESETS.find((t) => t.key === challengeTime)!;
    const result = await sendChallenge({
      targetUserId: challengeTarget.id,
      timeControlType: challengeTime === 'DAILY' ? 'CUSTOM' : challengeTime,
      baseMinutes: preset.base,
      incrementSeconds: preset.inc,
    });
    if (result.success) {
      setChallengeTarget(null);
    } else {
      setChallengeError(result.error || 'Failed to send challenge');
    }
    setChallengeSending(false);
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-[#161513] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-emerald-400 text-xs font-mono font-bold uppercase tracking-widest animate-pulse">
          Loading distributed tables...
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#161513] flex flex-col items-center justify-center gap-4">
        <div className="text-[#bababa] text-sm">Profile not found</div>
        <button onClick={() => router.push('/profile')} className="text-xs font-bold uppercase tracking-wider text-white bg-emerald-600 px-4 py-2 rounded-lg">
          Back to Profile
        </button>
      </div>
    );
  }

  const winRate = profile!.stats.total > 0 ? Math.round((profile!.stats.wins / profile!.stats.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#161513] text-[#e4e4e4] flex flex-col antialiased select-none">
      <header className="h-[56px] min-h-[56px] flex items-center justify-between px-6 bg-[#211f1c] border-b border-[#2d2b27] shadow-md z-30">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 p-1.5 rounded-md flex items-center justify-center text-white font-black tracking-tighter text-sm">W</div>
          <span className="font-sans font-black tracking-tight text-md text-[#ffffff]">
            CHESS<span className="text-emerald-500">.COM</span> <span className="font-light text-xs uppercase tracking-widest text-[#bababa] ml-1">Profile</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/academy')}
            className="text-xs font-bold uppercase tracking-wider text-[#bababa] hover:text-emerald-400 bg-[#262421] px-3 py-1.5 rounded border border-[#3c3934] transition-colors"
          >
            <span className="flex items-center gap-1.5"><BookOpen size={12} /> Academy</span>
          </button>
          <button
            onClick={() => router.push('/play')}
            className="text-xs font-bold uppercase tracking-wider text-[#bababa] hover:text-white bg-[#262421] px-3 py-1.5 rounded border border-[#3c3934] transition-colors"
          >
            <span className="flex items-center gap-1.5"><Play size={12} /> Play</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-5">

        <div className="lg:col-span-2 space-y-5">

          {/* Accepted Challenge — auto-navigate challenger to arena */}
          {acceptedChallenges.length > 0 && (
            <NavigateToArena matchId={acceptedChallenges[0].match_id} />
          )}

          {/* Incoming Challenge Notifications */}
          {incomingChallenges.map((challenge) => (
            <div key={challenge.id} className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-2">
                <Swords size={14} /> {challenge.challenger_username} ({challenge.challenger_elo} ELO) challenges you — {challenge.time_control_type} {challenge.base_minutes}+{challenge.increment_seconds}
              </span>
              <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (acceptingIds.has(challenge.id)) return;
                  setAcceptingIds((prev) => new Set(prev).add(challenge.id));
                  try {
                    const res = await respondToChallenge(challenge.id, 'accept');
                    if (res.success && res.arenaUrl) {
                      router.push(res.arenaUrl);
                    }
                  } finally {
                    setAcceptingIds((prev) => { const next = new Set(prev); next.delete(challenge.id); return next; });
                  }
                }}
                disabled={acceptingIds.has(challenge.id)}
                className={`text-xs font-bold px-3 py-1.5 rounded transition-colors ${
                  acceptingIds.has(challenge.id)
                    ? 'bg-gray-600/10 text-gray-400 cursor-not-allowed'
                    : 'text-white bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                {acceptingIds.has(challenge.id) ? 'Accepting...' : 'Accept'}
              </button>
                <button
                  onClick={() => respondToChallenge(challenge.id, 'decline')}
                  className="text-xs font-bold text-[#bababa] bg-[#363431] hover:bg-[#45423e] px-3 py-1.5 rounded transition-colors"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}

          {/* Viewing banner */}
          {isViewingOther && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2.5 flex items-center justify-between">
              <span className="text-xs text-amber-400 font-bold flex items-center gap-2">
                <Eye size={14} /> Viewing {profile?.username || 'player'}'s profile
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => viewUserId && openChallenge({ id: viewUserId, username: profile?.username || 'Player', avatar_url: null, elo_rating: profile?.elo || 1200 })}
                  className="text-[10px] font-bold uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded transition-all flex items-center gap-1"
                >
                  <Swords size={12} /> Challenge
                </button>
                <button
                  onClick={() => router.push('/profile')}
                  className="text-[10px] font-bold uppercase tracking-wider text-white bg-[#262421] hover:bg-emerald-600 px-3 py-1.5 rounded border border-[#3c3934] hover:border-emerald-500 transition-all"
                >
                  Back to my profile
                </button>
              </div>
            </div>
          )}

          {/* Profile Header with Edit */}
          <div className="bg-[#211f1c] border border-[#2d2b27] rounded-lg p-5 shadow-md flex flex-col sm:flex-row items-center gap-5 relative">
            {!editing ? (
              <>
                <div className="relative group">
                  <div className="w-14 h-14 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-xl font-black text-white shrink-0 border border-emerald-400/20 uppercase overflow-hidden">
                    {profile!.avatar_url ? (
                      <img src={profile!.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      profile!.username.slice(0, 2)
                    )}
                  </div>
                  <button
                    onClick={startEditing}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-600 hover:bg-emerald-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    title="Edit profile"
                  >
                    <Pencil size={10} className="text-white" />
                  </button>
                </div>
                <div className="flex-1 text-center sm:text-left min-w-0">
                  <h1 className="text-lg font-black text-white tracking-tight truncate">{profile!.username}</h1>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-[#615e59] font-mono">
                      {profile!.gamesPlayed} game{profile!.gamesPlayed !== 1 ? 's' : ''}
                    </span>
                    {profile!.isProvisional && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 leading-none">
                        PROVISIONAL
                      </span>
                    )}
                  </div>
                </div>
                {!isViewingOther && (
                  <button
                    onClick={startEditing}
                    className="text-[10px] font-bold uppercase tracking-wider text-[#bababa] hover:text-emerald-400 bg-[#262421] hover:bg-[#363431] px-3 py-1.5 rounded border border-[#3c3934] transition-all flex items-center gap-1.5 shrink-0"
                  >
                    <Pencil size={11} /> Edit
                  </button>
                )}
              </>
            ) : (
              /* Edit Mode */
              <div className="w-full space-y-4 py-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Pencil size={14} className="text-emerald-400" /> Edit Profile
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveProfile}
                      disabled={saving}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors flex items-center gap-1.5"
                    >
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      Save
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="bg-[#363431] hover:bg-[#45423e] text-[#bababa] text-xs font-bold px-3 py-1.5 rounded border border-[#4a4640] transition-colors flex items-center gap-1.5"
                    >
                      <X size={12} /> Cancel
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#615e59]">Username</label>
                    <input
                      type="text"
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      maxLength={30}
                      className="w-full bg-[#161513] border border-[#3c3934] rounded text-sm text-[#e4e4e4] px-3 py-2 placeholder-[#615e59] focus:outline-none focus:border-emerald-500/50 transition-colors"
                      placeholder="Your username"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#615e59]">Avatar URL</label>
                    <input
                      type="text"
                      value={editAvatarUrl}
                      onChange={(e) => setEditAvatarUrl(e.target.value)}
                      className="w-full bg-[#161513] border border-[#3c3934] rounded text-sm text-[#e4e4e4] px-3 py-2 placeholder-[#615e59] focus:outline-none focus:border-emerald-500/50 transition-colors"
                      placeholder="https://example.com/avatar.png"
                    />
                  </div>
                </div>

                {saveError && (
                  <div className="text-[11px] text-red-400 font-bold flex items-center gap-1.5 bg-red-500/10 px-3 py-2 rounded border border-red-500/20">
                    <X size={12} /> {saveError}
                  </div>
                )}
              </div>
            )}

            <div className="bg-[#161513] border border-[#2d2b27] px-5 py-2.5 rounded-lg text-center shadow-inner shrink-0">
              <div className="text-[8px] uppercase font-mono tracking-widest font-black text-[#615e59]">ELO</div>
              <div className="text-2xl font-black text-emerald-400 font-mono tracking-tighter">{profile!.elo}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Matches" value={profile!.stats.total} icon={<Swords size={15} />} />
            <StatCard label="Wins" value={profile!.stats.wins} color="text-emerald-400" icon={<Award size={15} />} />
            <StatCard label="Losses" value={profile!.stats.losses} color="text-red-400" icon={<ShieldAlert size={15} />} />
            <StatCard label="Win Rate" value={`${winRate}%`} color="text-teal-400" icon={<BarChart3 size={15} />} />
          </div>

          <div className="bg-[#211f1c] border border-[#2d2b27] rounded-lg overflow-hidden shadow-md">
            <div className="px-4 py-3 border-b border-[#2d2b27] bg-[#1b1a18] flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2">
                <Clock size={13} className="text-emerald-500" /> Match History
              </h2>
              <span className="text-[10px] text-[#615e59] font-mono">{profile!.stats.total} records</span>
            </div>

            {profile!.games.length === 0 ? (
              <div className="p-12 text-center text-sm text-[#bababa] space-y-3">
                <div className="w-10 h-10 bg-[#161513] rounded-lg flex items-center justify-center mx-auto text-[#615e59] border border-[#2d2b27]">
                  <Swords size={18} />
                </div>
                <p className="font-bold text-white text-xs">No matches recorded</p>
                <p className="text-[10px] text-[#615e59] max-w-xs mx-auto">Play a game against Stockfish to see your history here</p>
              </div>
            ) : (
              <div className="overflow-x-auto minimal-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] text-[#615e59] uppercase font-bold tracking-widest border-b border-[#2d2b27] bg-[#1b1a18]/40">
                      <th className="px-4 py-2.5 font-mono">Opponent</th>
                      <th className="px-4 py-2.5 font-mono">Result</th>
                      <th className="px-4 py-2.5 text-right font-mono">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d2b27]/50 font-mono text-xs">
                    {profile!.games.map((g) => (
                      <tr key={g.id} className="hover:bg-[#1b1a18]/40 transition-all group">
                        <td className="px-4 py-3 text-[#e4e4e4] font-sans font-semibold group-hover:text-emerald-400 transition-colors">
                          {g.opponent}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                            g.result === 'Won'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : g.result === 'Draw'
                              ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                              : 'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}>
                            {g.result}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => router.push(`/?reviewGameId=${g.id}`)}
                              className="bg-[#262421] border border-[#3c3934] text-emerald-400 hover:text-white hover:bg-emerald-600 hover:border-emerald-500 font-sans font-bold text-[10px] uppercase tracking-wider px-2.5 py-1.5 rounded transition-all flex items-center gap-1.5 shadow-sm"
                            >
                              <Eye size={12} /> Review
                            </button>
                            {!isViewingOther && (
                              <button
                                onClick={() => handleRecordDeletion(g.id)}
                                className="bg-[#262421] border border-[#3c3934] text-[#bababa] hover:text-white hover:bg-red-600/90 hover:border-red-500 p-1.5 rounded transition-all shadow-sm"
                                title="Delete record"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        <div className="lg:col-span-1 space-y-5">
          {/* Friends Card */}
          <div className="bg-[#211f1c] border border-[#2d2b27] rounded-lg shadow-md overflow-hidden">
            <button
              onClick={() => setShowFriendsList(!showFriendsList)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#1b1a18] border-b border-[#2d2b27] hover:bg-[#262421] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Users size={15} className="text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-white">Friends</span>
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {friends.length}
                </span>
                {pendingRequests.length > 0 && (
                  <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                    {pendingRequests.length}
                  </span>
                )}
              </div>
              <Users size={14} className={`text-[#615e59] transition-transform ${showFriendsList ? 'rotate-180' : ''}`} />
            </button>

            {showFriendsList && (
              <div className="divide-y divide-[#2d2b27]">
                {/* Pending Requests */}
                {pendingRequests.length > 0 && (
                  <div className="px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Bell size={12} className="text-amber-400" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                        Requests ({pendingRequests.length})
                      </span>
                    </div>
                    {pendingRequests.map((req) => (
                      <div key={req.id} className="flex items-center justify-between bg-[#161513] rounded px-2.5 py-2 border border-[#2d2b27] mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded bg-gradient-to-tr from-amber-600 to-red-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                            {req.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-[#e4e4e4] truncate">{req.username}</div>
                            <div className="text-[10px] text-[#615e59] font-mono">{req.elo_rating} ELO</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => respondToFriendRequest(req.id, 'ACCEPT')}
                            className="p-1.5 bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/30 hover:border-emerald-500 rounded transition-all"
                            title="Accept"
                          >
                            <UserCheck size={11} className="text-emerald-400" />
                          </button>
                          <button
                            onClick={() => respondToFriendRequest(req.id, 'DECLINE')}
                            className="p-1.5 bg-red-600/20 hover:bg-red-600 border border-red-500/30 hover:border-red-500 rounded transition-all"
                            title="Decline"
                          >
                            <UserX size={11} className="text-red-400" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Friends List */}
                {friends.length === 0 ? (
                  <div className="text-[10px] text-[#615e59] text-center py-6">
                    No friends yet. Search and add friends to get started.
                  </div>
                ) : (
                  <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
                    {friends.map((f) => (
                      <div
                        key={f.id}
                        onClick={() => setViewFriend(f)}
                        className="flex items-center justify-between bg-[#161513] rounded px-2.5 py-2 border border-[#2d2b27] hover:border-emerald-500/20 hover:bg-[#1b1a18] transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                            {f.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-[#e4e4e4] truncate">{f.username}</div>
                            <div className="text-[10px] text-emerald-400 font-mono font-bold">{f.elo_rating} ELO</div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFriend(f.id); }}
                          className="p-1.5 bg-[#262421] hover:bg-red-600 border border-[#3c3934] hover:border-red-500 rounded transition-all"
                          title="Remove friend"
                        >
                          <UserX size={10} className="text-[#bababa] hover:text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <SocialSidebar />
        </div>

        {/* Friend Profile Modal */}
        {viewFriend && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setViewFriend(null)}>
            <div className="bg-[#211f1c] border border-[#2d2b27] rounded-xl p-6 shadow-2xl max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white">Player Profile</h3>
                <button onClick={() => setViewFriend(null)} className="text-[#615e59] hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-2xl font-black text-white border border-emerald-400/20 uppercase">
                  {viewFriend.username.slice(0, 2)}
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">{viewFriend.username}</h2>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <span className="text-[10px] font-mono font-bold text-emerald-400">{viewFriend.elo_rating} ELO</span>
                    <span className="text-[#615e59]">•</span>
                    <span className="text-[10px] font-mono text-[#bababa]">ID: {viewFriend.id.slice(0, 8)}...</span>
                  </div>
                </div>
                <div className="flex flex-col w-full gap-2">
                  <button
                    onClick={() => {
                      setViewFriend(null);
                      openChallenge(viewFriend);
                    }}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Swords size={14} /> Challenge
                  </button>
                  <button
                    onClick={() => {
                      setViewFriend(null);
                      router.push(`/profile?viewUserId=${viewFriend.id}`);
                    }}
                    className="w-full py-2.5 bg-[#363431] hover:bg-[#45423e] text-[#bababa] font-bold text-xs rounded-lg border border-[#4a4640] transition-colors"
                  >
                    View Full Profile
                  </button>
                  <button
                    onClick={() => { setViewFriend(null); }}
                    className="w-full py-2 bg-[#262421] hover:bg-[#363431] text-[#615e59] font-bold text-xs rounded-lg border border-[#3c3934] transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Challenge Modal */}
        {challengeTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => { if (!challengeSending) setChallengeTarget(null); }}>
            <div className="bg-[#211f1c] border border-[#2d2b27] rounded-xl p-6 shadow-2xl max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Swords size={16} className="text-emerald-400" /> Challenge {challengeTarget.username}
                </h3>
                <button onClick={() => setChallengeTarget(null)} disabled={challengeSending} className="text-[#615e59] hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Color Selection */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#615e59] block mb-2">Play as</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['random', 'white', 'black'] as const).map((c) => (
                      <button
                        key={c}
                        onClick={() => setChallengeColor(c)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${
                          challengeColor === c
                            ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                            : 'bg-[#161513] border-[#3c3934] text-[#bababa] hover:border-[#4a4640]'
                        }`}
                      >
                        {c === 'random' ? 'Random' : c === 'white' ? 'White' : 'Black'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time Control Selection */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#615e59] block mb-2">Time Control</label>
                  <div className="grid grid-cols-2 gap-2">
                    {TIME_PRESETS.map((t) => (
                      <button
                        key={t.key}
                        onClick={() => setChallengeTime(t.key)}
                        className={`px-3 py-2.5 rounded-lg text-xs font-bold border transition-all ${
                          challengeTime === t.key
                            ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                            : 'bg-[#161513] border-[#3c3934] text-[#bababa] hover:border-[#4a4640]'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {challengeError && (
                  <div className="text-[11px] text-red-400 font-bold flex items-center gap-1.5 bg-red-500/10 px-3 py-2 rounded border border-red-500/20">
                    <X size={12} /> {challengeError}
                  </div>
                )}

                <button
                  onClick={sendChallengeRequest}
                  disabled={challengeSending}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {challengeSending ? <Loader2 size={14} className="animate-spin" /> : <Swords size={14} />}
                  {challengeSending ? 'Sending...' : `Send Challenge`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>

      <style>{`
        .minimal-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .minimal-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .minimal-scrollbar::-webkit-scrollbar-thumb { background: #3c3934; border-radius: 2px; }
        .minimal-scrollbar::-webkit-scrollbar-thumb:hover { background: #4a4640; }
      `}</style>
    </div>
  );
}

function NavigateToArena({ matchId }: { matchId: string }) {
  const router = useRouter();
  useEffect(() => {
    router.push(`/arena/live/${matchId}`);
  }, [matchId, router]);
  return null;
}
