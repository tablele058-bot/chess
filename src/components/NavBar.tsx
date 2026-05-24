'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useUser, SignInButton, UserButton } from '@clerk/nextjs';
import { GraduationCap, Users, Search } from 'lucide-react';
import { useState, useEffect } from 'react';

export function NavBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isSignedIn } = useUser();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const activeClass = mounted ? '' : 'text-[#bababa] hover:text-white hover:bg-[#312e2b]';
  const isPlayPage = mounted && pathname === '/play' && searchParams.get('mode') !== 'local';
  const isLearnPage = mounted && pathname === '/learn';
  const isTwoPlayer = mounted && pathname === '/play' && searchParams.get('mode') === 'local';

  return (
    <nav className="flex items-center justify-between px-4 py-2.5 bg-[#262421] border-b border-[#3c3934] select-none">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-2xl leading-none">♚</span>
          <span className="text-lg font-bold text-[#e4e4e4] group-hover:text-emerald-400 transition-colors">
            Chess
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <Link
            href="/play"
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              isPlayPage
                ? 'bg-emerald-600 text-white'
                : 'text-[#bababa] hover:text-white hover:bg-[#312e2b]'
            }`}
          >
            Play
          </Link>
          <Link
            href="/play?mode=local"
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors flex items-center gap-1 ${
              isTwoPlayer
                ? 'bg-violet-600 text-white'
                : 'text-[#bababa] hover:text-white hover:bg-[#312e2b]'
            }`}
          >
            <Users size={14} /> 2-Player
          </Link>
          <Link
            href="/learn"
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors flex items-center gap-1 ${
              isLearnPage
                ? 'bg-amber-600 text-white'
                : 'text-[#bababa] hover:text-white hover:bg-[#312e2b]'
            }`}
          >
            <GraduationCap size={14} /> Learn
          </Link>
          {isSignedIn && (
            <>
            <Link
              href="/profile"
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                mounted && pathname === '/profile'
                  ? 'bg-emerald-600 text-white'
                  : 'text-[#bababa] hover:text-white hover:bg-[#312e2b]'
              }`}
            >
              Profile
            </Link>
            <Link
              href="/profile"
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors flex items-center gap-1 ${
                mounted && pathname === '/profile'
                  ? 'bg-emerald-600 text-white'
                  : 'text-[#bababa] hover:text-white hover:bg-[#312e2b]'
              }`}
            >
              <Search size={14} /> Social
            </Link>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {!isSignedIn ? (
          <SignInButton mode="modal">
            <button className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold px-4 py-1.5 rounded transition-colors">
              Sign In
            </button>
          </SignInButton>
        ) : (
          <UserButton
            appearance={{
              elements: {
                avatarBox: 'w-8 h-8',
                userButtonTrigger: 'focus:shadow-none',
              },
            }}
          />
        )}
      </div>
    </nav>
  );
}
