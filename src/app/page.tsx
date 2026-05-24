'use client';

import Link from 'next/link';
import { useUser, SignInButton } from '@clerk/nextjs';
import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { GraduationCap, Swords, BookOpen, Target, Award } from 'lucide-react';

function HomePageInner() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reviewGameId = searchParams.get('reviewGameId');

  useEffect(() => {
    if (reviewGameId) {
      router.push(`/play?reviewGameId=${reviewGameId}`);
    }
  }, [reviewGameId, router]);

  if (reviewGameId) {
    return (
      <div className="min-h-dvh bg-[#161513] flex items-center justify-center">
        <div className="text-emerald-400 text-xs font-mono font-bold uppercase tracking-widest animate-pulse">
          Loading review match...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#302e2c] text-[#e4e4e4] flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-3xl mx-auto text-center space-y-10">
          <div className="space-y-4">
            <div className="text-6xl mb-2">♚</div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              Play Chess
            </h1>
            <p className="text-[#bababa] text-lg max-w-md mx-auto">
              Challenge the AI, learn openings &amp; tactics, and improve your game.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 flex-wrap">
            <Link
              href="/play"
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-bold px-8 py-3.5 rounded-lg transition-colors shadow-lg shadow-emerald-900/30 w-full sm:w-auto"
            >
              <Swords size={18} className="inline mr-2" /> Play Computer
            </Link>
            <Link
              href="/learn"
              className="bg-amber-600 hover:bg-amber-500 text-white text-lg font-bold px-8 py-3.5 rounded-lg transition-colors shadow-lg shadow-amber-900/30 w-full sm:w-auto"
            >
              <GraduationCap size={18} className="inline mr-2" /> Learn Mode
            </Link>

            {!isLoaded ? (
              <button disabled className="bg-[#363431] text-[#615e59] text-lg font-bold px-8 py-3.5 rounded-lg border border-[#4a4640] w-full sm:w-auto cursor-not-allowed">
                Loading...
              </button>
            ) : isSignedIn ? (
              <Link
                href="/play?mode=online"
                className="bg-[#363431] hover:bg-[#45423e] text-[#e4e4e4] text-lg font-bold px-8 py-3.5 rounded-lg border border-[#4a4640] transition-colors w-full sm:w-auto"
              >
                Play Online
              </Link>
            ) : (
              <SignInButton mode="modal">
                <button className="bg-[#363431] hover:bg-[#45423e] text-[#e4e4e4] text-lg font-bold px-8 py-3.5 rounded-lg border border-[#4a4640] transition-colors w-full sm:w-auto">
                  Sign In to Play Online
                </button>
              </SignInButton>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-8">
            <div className="bg-[#262421] rounded-lg p-4 border border-[#3c3934] text-left">
              <div className="text-emerald-400 mb-2"><Swords size={20} /></div>
              <h3 className="font-bold text-sm mb-1">Stockfish AI</h3>
              <p className="text-xs text-[#bababa]">Adjustable 400–2600 ELO. Grandmaster-level NNUE engine.</p>
            </div>
            <div className="bg-[#262421] rounded-lg p-4 border border-[#3c3934] text-left">
              <div className="text-amber-400 mb-2"><GraduationCap size={20} /></div>
              <h3 className="font-bold text-sm mb-1">Learn Mode</h3>
              <p className="text-xs text-[#bababa]">9 interactive lessons — openings, tactics, endgames.</p>
            </div>
            <div className="bg-[#262421] rounded-lg p-4 border border-[#3c3934] text-left">
              <div className="text-emerald-400 mb-2"><Target size={20} /></div>
              <h3 className="font-bold text-sm mb-1">Puzzles</h3>
              <p className="text-xs text-[#bababa]">Position-based challenges with instant coach feedback.</p>
            </div>
            <div className="bg-[#262421] rounded-lg p-4 border border-[#3c3934] text-left">
              <div className="text-emerald-400 mb-2"><Award size={20} /></div>
              <h3 className="font-bold text-sm mb-1">Move Coach</h3>
              <p className="text-xs text-[#bababa]">Real-time evaluation with quality classification per move.</p>
            </div>
          </div>

          {isSignedIn && (
            <div className="pt-4">
              <Link
                href="/profile"
                className="text-sm text-[#bababa] hover:text-emerald-400 underline underline-offset-2 transition-colors"
              >
                View your profile &rarr;
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh bg-[#161513] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <HomePageInner />
    </Suspense>
  );
}
