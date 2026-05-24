'use client';

import { useState, useRef, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useSocial, ProfileResult } from '@/hooks/useSocial';
import {
  Search, UserPlus, UserCheck, UserX, X, Users,
  Bell, ChevronDown, Loader2,
} from 'lucide-react';

export function SocialSidebar() {
  const { user } = useUser();
  const {
    friends,
    pendingRequests,
    searchUsers,
    sendFriendRequest,
    respondToFriendRequest,
    removeFriend,
  } = useSocial(user?.id);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProfileResult[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searching, setSearching] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const searchTimer = useRef<number>(0);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(async () => {
      const results = await searchUsers(searchQuery.trim());
      setSearchResults(results);
      setSearching(false);
    }, 300);
    return () => window.clearTimeout(searchTimer.current);
  }, [searchQuery, searchUsers]);

  const getActionButton = (p: ProfileResult) => {
    if (p.isFriend) {
      return (
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-emerald-400 font-bold px-1">Friends</span>
          <button
            onClick={(e) => { e.stopPropagation(); removeFriend(p.id); }}
            className="p-1 rounded hover:bg-red-600/20 transition-colors"
            title="Remove friend"
          >
            <UserX size={12} className="text-[#bababa] hover:text-red-400" />
          </button>
        </div>
      );
    }

    if (p.isPending) {
      return (
        <span className="text-[10px] text-amber-400 font-bold px-1">Pending</span>
      );
    }

    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          sendFriendRequest(p.id);
        }}
        className="p-1 rounded hover:bg-emerald-600/20 transition-colors"
        title="Add friend"
      >
        <UserPlus size={12} className="text-[#bababa] hover:text-emerald-400" />
      </button>
    );
  };

  if (collapsed) {
    return (
      <div className="bg-[#211f1c] border border-[#2d2b27] rounded-lg shadow-md overflow-hidden">
        <button
          onClick={() => setCollapsed(false)}
          className="w-full flex items-center justify-center p-3 text-[#615e59] hover:text-white transition-colors"
        >
          <Users size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#211f1c] border border-[#2d2b27] rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(true)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#1b1a18] border-b border-[#2d2b27] hover:bg-[#262421] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users size={15} className="text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-widest text-white">Social</span>
          <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {friends.length}
          </span>
        </div>
        <ChevronDown size={14} className="text-[#615e59]" />
      </button>

      {/* Search */}
      <div className="px-3 py-2 border-b border-[#2d2b27]">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#615e59]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search players..."
            className="w-full bg-[#161513] border border-[#3c3934] rounded text-xs text-[#e4e4e4] pl-7 pr-2 py-1.5 placeholder-[#615e59] focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
          {searching && <Loader2 size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-400 animate-spin" />}
        </div>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="border-b border-[#2d2b27] bg-[#161513]">
          <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-[#615e59]">
            Search Results ({searchResults.length})
          </div>
          {searchResults.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-3 py-2 hover:bg-[#1b1a18]/40 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-[9px] font-bold text-white shrink-0 uppercase">
                  {p.username.slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-[#e4e4e4] truncate">{p.username}</div>
                  <div className="text-[9px] text-[#615e59] font-mono">{p.elo_rating || 1200} ELO</div>
                </div>
              </div>
              {getActionButton(p)}
            </div>
          ))}
        </div>
      )}

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="border-b border-[#2d2b27]">
          <div className="px-3 py-1.5 flex items-center gap-1.5">
            <Bell size={11} className="text-amber-400" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400">
              Requests ({pendingRequests.length})
            </span>
          </div>
          {pendingRequests.map((req) => (
            <div key={req.id} className="flex items-center justify-between px-3 py-2 bg-[#161513]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded bg-gradient-to-tr from-amber-600 to-red-500 flex items-center justify-center text-[9px] font-bold text-white shrink-0 uppercase">
                  {req.username.slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-[#e4e4e4] truncate">{req.username}</div>
                  <div className="text-[9px] text-[#615e59] font-mono">{req.elo_rating} ELO</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => respondToFriendRequest(req.id, 'ACCEPT')}
                  className="p-1.5 bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/30 rounded transition-all"
                >
                  <UserCheck size={11} className="text-emerald-400" />
                </button>
                <button
                  onClick={() => respondToFriendRequest(req.id, 'DECLINE')}
                  className="p-1.5 bg-red-600/20 hover:bg-red-600 border border-red-500/30 rounded transition-all"
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
          {searchQuery.trim() ? 'No results found' : 'No friends yet'}
        </div>
      ) : (
        <div className="max-h-48 overflow-y-auto">
          {friends.map((f) => (
            <div key={f.id} className="flex items-center justify-between px-3 py-2 hover:bg-[#1b1a18]/40 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-[9px] font-bold text-white shrink-0 uppercase">
                  {f.username.slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-[#e4e4e4] truncate">{f.username}</div>
                  <div className="text-[9px] text-emerald-400 font-mono font-bold">{f.elo_rating || 1200} ELO</div>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeFriend(f.id); }}
                className="p-1 rounded hover:bg-red-600/20 transition-colors"
              >
                <UserX size={11} className="text-[#615e59] hover:text-red-400" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
