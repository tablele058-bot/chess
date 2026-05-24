'use client';

import { useRef, useEffect, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { useLesson } from '@/hooks/useLesson';
import { LESSONS } from '@/data/lessons';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, ChevronLeft, BookOpen, Target, Award,
  RotateCcw, Play, SkipForward, BookmarkCheck, Sparkles,
  GraduationCap, Swords, Tv, ExternalLink, Clock, Layers,
  ChevronDown, Trophy,
} from 'lucide-react';

const SECTION_ICONS: Record<string, typeof BookOpen> = {
  openings: BookOpen,
  tactics: Target,
  endgames: Award,
};

type Mode = 'lessons' | 'academy';
type AcademyTab = 'puzzles' | 'watch' | 'studies';

interface StudyItem {
  id: string;
  title: string;
  description: string;
  url: string;
  topics: string[];
  duration: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
}

const STUDIES: StudyItem[] = [
  {
    id: 'basic-101',
    title: 'Basic Tactics 101',
    description: 'Forks, pins, skewers, and discovered attacks — the four fundamental tactical patterns every player must master.',
    url: 'https://lichess.org/study/erBQTN58',
    topics: ['Fork', 'Pin', 'Skewer', 'Discovered Attack'],
    duration: '45 min',
    level: 'Beginner',
  },
  {
    id: 'checkmate-patterns',
    title: 'Classical Checkmate Patterns',
    description: 'Back-rank mate, smothered mate, Anastasia\'s mate, and other timeless checkmating patterns.',
    url: 'https://lichess.org/study/UoEKVFGn',
    topics: ['Back Rank', 'Smothered', 'Anastasia', 'Boden\'s'],
    duration: '60 min',
    level: 'Intermediate',
  },
  {
    id: 'endgame-fundamentals',
    title: 'Endgame Fundamentals',
    description: 'King and pawn endings, opposition, zugzwang, and the Lucena and Philidor positions.',
    url: 'https://lichess.org/study/IhENJzMv',
    topics: ['Opposition', 'Zugzwang', 'Lucena', 'Philidor'],
    duration: '90 min',
    level: 'Intermediate',
  },
  {
    id: 'openings-explained',
    title: 'Opening Repertoire Builder',
    description: 'Walk through the main lines of the Italian, Sicilian, Queen\'s Gambit, and King\'s Indian.',
    url: 'https://lichess.org/study/XPKir2QC',
    topics: ['Italian', 'Sicilian', 'Queen\'s Gambit', 'King\'s Indian'],
    duration: '120 min',
    level: 'Advanced',
  },
  {
    id: 'positional-play',
    title: 'Positional Chess Mastery',
    description: 'Learn about pawn structures, outposts, open files, and the art of prophylaxis.',
    url: 'https://lichess.org/study/vXGQoZXl',
    topics: ['Pawn Structure', 'Outposts', 'Open Files', 'Prophylaxis'],
    duration: '75 min',
    level: 'Advanced',
  },
  {
    id: 'tactical-grind',
    title: 'Tactical Grind — 200 Puzzles',
    description: 'A curated collection of 200 tactical puzzles from grandmaster games, sorted by theme.',
    url: 'https://lichess.org/study/4zR6Yj1E',
    topics: ['Mixed Tactics', 'Calculation', 'Visualization'],
    duration: 'Self-paced',
    level: 'Intermediate',
  },
];

const ACADEMY_TABS: { key: AcademyTab; label: string; icon: typeof BookOpen }[] = [
  { key: 'puzzles', label: 'Puzzles', icon: Target },
  { key: 'watch', label: 'Live Matches', icon: Tv },
  { key: 'studies', label: 'Study Curriculum', icon: BookOpen },
];

const ACADEMY_COACH: Record<AcademyTab, { title: string; lines: string[] }> = {
  puzzles: {
    title: 'Tactical Coach',
    lines: [
      'Solve interactive tactical puzzles powered by Lichess\'s database of millions of games.',
      'Each puzzle tests your ability to find the best move — forks, pins, sacrifices, and more.',
      'Try to solve each puzzle within 60 seconds before peeking at the solution.',
      'Puzzles are sorted by difficulty — start with the easier ones to build confidence.',
    ],
  },
  watch: {
    title: 'Grandmaster Broadcaster',
    lines: [
      'Watch live grandmaster games streaming from Lichess TV in real time.',
      'Top-tier professionals battle across global server shards — you\'re seeing moves as they happen.',
      'Use the study curriculum tab to review archived grandmaster games at your own pace.',
      'No account needed — just sit back and learn from the best.',
    ],
  },
  studies: {
    title: 'Curriculum Guide',
    lines: [
      'A curated directory of Lichess studies covering everything from basic tactics to advanced positional play.',
      'Each study includes annotated games, interactive puzzles, and prose explanations.',
      'Click any study to open it in a new tab — no login required, completely free.',
      'Follow the order (101 + Checkmates + Endgames + Openings + Positional) for a structured learning path.',
    ],
  },
};

const LEVEL_COLORS: Record<string, string> = {
  Beginner: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  Intermediate: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  Advanced: 'text-red-400 bg-red-500/10 border-red-500/20',
};

export default function LearnPage() {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const {
    lessonIndex, currentLesson, phase, fen, selectedSquare, optionSquares,
    puzzleState, demoStep, message, completedLessons,
    goToLesson, instruction, startDemo, advanceDemo, playAllDemo, resetDemo,
    startPuzzle, startSparring, onSquareClick, retryPuzzle, onSparringSquareClick,
    prevLesson, nextLesson, resetBoard, totalLessons,
  } = useLesson();

  const [mode, setMode] = useState<Mode>('lessons');
  const [academyTab, setAcademyTab] = useState<AcademyTab>('puzzles');
  const [expandedStudy, setExpandedStudy] = useState<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [lessonIndex]);

  const sections = [
    { key: 'openings', label: 'Openings Vault', lessons: LESSONS.filter((l) => l.section === 'openings') },
    { key: 'tactics', label: 'Tactics Academy', lessons: LESSONS.filter((l) => l.section === 'tactics') },
    { key: 'endgames', label: 'Endgame Blueprint', lessons: LESSONS.filter((l) => l.section === 'endgames') },
  ];

  const squareStyles: Record<string, React.CSSProperties> = { ...optionSquares };

  const iframeSrc = academyTab === 'puzzles'
    ? 'https://lichess.org/training/frame?theme=green&bg=dark'
    : academyTab === 'watch'
    ? 'https://lichess.org/tv/frame?theme=brown&bg=dark'
    : null;

  return (
    <main className="min-h-screen bg-[#161513] text-[#e4e4e4] flex flex-col antialiased select-none">
      <header className="flex items-center justify-between px-6 py-3 bg-[#211f1c] border-b border-[#2d2b27] shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')} className="text-[#bababa] hover:text-white transition-colors p-1">
            <ChevronLeft size={20} />
          </button>
          <div className="bg-emerald-600 p-1.5 rounded-md flex items-center justify-center text-white font-black tracking-tighter text-sm">
            <GraduationCap size={16} />
          </div>
          <span className="font-sans font-black tracking-tight text-md text-[#ffffff]">
            {mode === 'lessons' ? (
              <>LEARN<span className="text-emerald-500">.CHESS</span></>
            ) : (
              <>SUJANA CHESS <span className="text-emerald-500">ARENA</span></>
            )}
            <span className="font-light text-xs uppercase tracking-widest text-[#bababa] ml-2">
              {mode === 'lessons' ? 'Pro Academy' : 'Academy'}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {mode === 'lessons' && (
            <div className="text-[10px] text-[#615e59] font-mono font-bold">
              {lessonIndex + 1} / {totalLessons}
            </div>
          )}
        </div>
      </header>

      {/* Mode Toggle */}
      <div className="bg-[#1b1a18] border-b border-[#2d2b27] px-6">
        <div className="max-w-6xl mx-auto flex items-center gap-1">
          <button
            onClick={() => setMode('lessons')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              mode === 'lessons'
                ? 'text-emerald-400 border-emerald-500 bg-emerald-500/5'
                : 'text-[#615e59] border-transparent hover:text-[#bababa] hover:border-[#3c3934]'
            }`}
          >
            <GraduationCap size={14} /> Lessons
          </button>
          <button
            onClick={() => setMode('academy')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              mode === 'academy'
                ? 'text-emerald-400 border-emerald-500 bg-emerald-500/5'
                : 'text-[#615e59] border-transparent hover:text-[#bababa] hover:border-[#3c3934]'
            }`}
          >
            <BookOpen size={14} /> Academy
          </button>
        </div>
      </div>

      {mode === 'lessons' ? (

        <div className="flex-1 flex overflow-hidden">
          <aside className="w-64 shrink-0 bg-[#1b1a18] border-r border-[#2d2b27] overflow-y-auto hidden lg:block">
            <div className="p-3 space-y-4">
              {sections.map((section) => {
                const SectionIcon = SECTION_ICONS[section.key];
                const sectionStartIdx = LESSONS.findIndex((l) => l.section === section.key);
                return (
                  <div key={section.key}>
                    <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#615e59]">
                      <SectionIcon size={12} />
                      {section.label}
                    </div>
                    <div className="space-y-0.5 mt-1">
                      {section.lessons.map((lesson, i) => {
                        const idx = sectionStartIdx + i;
                        const isActive = idx === lessonIndex;
                        const isComplete = completedLessons.has(lesson.id);
                        return (
                          <button
                            key={lesson.id}
                            onClick={() => goToLesson(idx)}
                            className={`w-full text-left px-3 py-2 rounded text-xs font-semibold transition-all flex items-center gap-2 ${
                              isActive
                                ? 'bg-amber-500/15 text-amber-400 border-l-2 border-amber-400'
                                : 'text-[#bababa] hover:bg-[#262421] hover:text-white border-l-2 border-transparent'
                            }`}
                          >
                            {isComplete ? (
                              <BookmarkCheck size={12} className="text-emerald-400 shrink-0" />
                            ) : (
                              <span className="w-3 text-center text-[10px] text-[#4a4640] shrink-0">{idx + 1}</span>
                            )}
                            <span className="truncate">{lesson.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 border-t border-[#2d2b27] mt-2">
              <div className="text-[10px] text-[#615e59] font-mono text-center">
                {completedLessons.size} / {totalLessons} completed
              </div>
              <div className="w-full bg-[#262421] h-1 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${(completedLessons.size / totalLessons) * 100}%` }}
                />
              </div>
            </div>
          </aside>

          <div className="flex-1 overflow-y-auto" ref={scrollRef}>
            <div className="max-w-5xl mx-auto p-4 lg:p-8 space-y-6">

              <div className="bg-[#211f1c] border border-[#2d2b27] rounded-xl p-5 shadow-lg">
                <div className="flex items-center gap-2 text-[10px] text-[#615e59] font-bold uppercase tracking-widest mb-2">
                  <GraduationCap size={12} />
                  {currentLesson.sectionLabel}
                  {completedLessons.has(currentLesson.id) && (
                    <span className="text-emerald-400 flex items-center gap-1 ml-auto">
                      <BookmarkCheck size={12} /> Completed
                    </span>
                  )}
                </div>
                <h1 className="text-xl font-black text-white tracking-tight">{currentLesson.title}</h1>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3 space-y-4">
                  <div className="bg-[#262421] border border-[#2d2b27] rounded-xl overflow-hidden shadow-lg">
                    <div className="aspect-square w-full max-w-[500px] mx-auto relative">
                      <Chessboard options={{
                        position: fen,
                        onSquareClick: (phase === 'puzzle') ? ({ square }) => onSquareClick(square) : undefined,
                        squareStyles,
                        darkSquareStyle: { backgroundColor: '#769656' },
                        lightSquareStyle: { backgroundColor: '#eeeed2' },
                        allowDragging: false,
                      }} />
                    </div>
                  </div>

                  {phase === 'puzzle' && puzzleState === 'none' && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-400 text-center font-semibold">
                      {message}
                    </div>
                  )}

                  {phase === 'demo' && (
                    <div className="flex items-center justify-center gap-2">
                      <div className="bg-[#211f1c] border border-[#2d2b27] rounded-lg p-2 flex items-center gap-2">
                        <button onClick={resetDemo} className="p-2 bg-[#262421] hover:bg-[#363431] rounded text-[#bababa] transition-colors" title="Reset">
                          <RotateCcw size={14} />
                        </button>
                        <button onClick={playAllDemo} className="p-2 bg-emerald-600 hover:bg-emerald-500 rounded text-white transition-colors" title="Play All">
                          <Play size={14} />
                        </button>
                        <button onClick={advanceDemo} disabled={demoStep >= currentLesson.demoMoves.length} className="p-2 bg-[#262421] hover:bg-[#363431] rounded text-[#bababa] disabled:opacity-20 transition-colors" title="Next Move">
                          <SkipForward size={14} />
                        </button>
                        <span className="text-[10px] font-mono text-[#615e59] px-2">
                          {demoStep} / {currentLesson.demoMoves.length}
                        </span>
                      </div>
                    </div>
                  )}

                  {phase === 'puzzle' && puzzleState === 'success' && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 text-center space-y-2">
                      <div className="text-emerald-400 font-black text-lg flex items-center justify-center gap-2">
                        <Sparkles size={18} /> Correct!
                      </div>
                      <p className="text-xs text-[#bababa]">{message}</p>
                    </div>
                  )}

                  {phase === 'puzzle' && puzzleState === 'fail' && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center space-y-2">
                      <p className="text-xs text-red-400">{message}</p>
                      <button onClick={retryPuzzle} className="px-4 py-1.5 bg-[#262421] hover:bg-[#363431] text-xs font-bold rounded border border-[#3c3934] transition-colors">
                        Try Again
                      </button>
                    </div>
                  )}

                  {phase === 'sparring' && message && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-400 text-center font-semibold">
                      {message}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-[#211f1c] border border-[#2d2b27] rounded-xl p-4 shadow">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-[#615e59] flex items-center gap-1.5 mb-3">
                      <BookOpen size={12} /> Lesson
                    </h2>
                    <p className="text-xs text-[#bababa] leading-relaxed">
                      {currentLesson.instructionalText}
                    </p>
                  </div>

                  <div className="bg-[#211f1c] border border-[#2d2b27] rounded-xl p-4 shadow space-y-2">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-[#615e59] flex items-center gap-1.5">
                      <Target size={12} /> Explore
                    </h2>
                    <button onClick={instruction} className={`w-full text-left px-3 py-2 rounded text-xs font-semibold transition-all flex items-center gap-2 ${phase === 'instruction' ? 'bg-amber-500/15 text-amber-400' : 'text-[#bababa] hover:bg-[#262421]'}`}>
                      <GraduationCap size={14} /> Instructional Overview
                    </button>
                    <button onClick={startDemo} className={`w-full text-left px-3 py-2 rounded text-xs font-semibold transition-all flex items-center gap-2 ${phase === 'demo' ? 'bg-amber-500/15 text-amber-400' : 'text-[#bababa] hover:bg-[#262421]'}`}>
                      <Play size={14} /> Visual Auto-Demo
                    </button>
                    <button onClick={startPuzzle} className={`w-full text-left px-3 py-2 rounded text-xs font-semibold transition-all flex items-center gap-2 ${phase === 'puzzle' ? 'bg-amber-500/15 text-amber-400' : 'text-[#bababa] hover:bg-[#262421]'}`}>
                      <Target size={14} /> Position Puzzle
                    </button>
                    {(currentLesson.sparringFen || currentLesson.section === 'endgames') && (
                      <button onClick={startSparring} className={`w-full text-left px-3 py-2 rounded text-xs font-semibold transition-all flex items-center gap-2 ${phase === 'sparring' ? 'bg-amber-500/15 text-amber-400' : 'text-[#bababa] hover:bg-[#262421]'}`}>
                        <Swords size={14} /> AI Sparring
                      </button>
                    )}
                  </div>

                  {currentLesson.instructionalText && (
                    <div className="bg-[#211f1c] border border-[#2d2b27] rounded-xl p-4 shadow">
                      <h2 className="text-xs font-bold uppercase tracking-widest text-[#615e59] flex items-center gap-1.5 mb-3">
                        <Award size={12} /> Coach Tip
                      </h2>
                      <p className="text-xs text-amber-400/80 italic leading-relaxed">
                        &ldquo;{currentLesson.coachText}&rdquo;
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 bg-[#211f1c] border border-[#2d2b27] rounded-xl p-3">
                <button onClick={prevLesson} disabled={lessonIndex === 0} className="flex items-center gap-1.5 px-4 py-2 bg-[#262421] hover:bg-[#363431] disabled:opacity-20 text-white text-xs font-bold rounded transition-colors border border-[#3c3934]">
                  <ArrowLeft size={14} /> Previous
                </button>
                <button onClick={resetBoard} className="px-4 py-2 bg-[#262421] hover:bg-[#363431] text-[#bababa] text-xs font-bold rounded transition-colors border border-[#3c3934]">
                  <RotateCcw size={14} className="inline mr-1" /> Reset
                </button>
                <button onClick={nextLesson} disabled={lessonIndex >= totalLessons - 1} className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-20 text-white text-xs font-bold rounded transition-colors shadow">
                  Next <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#1b1a18] border-t border-[#2d2b27] px-2 py-1.5 flex overflow-x-auto gap-1 z-30">
            {LESSONS.map((lesson, i) => (
              <button
                key={lesson.id}
                onClick={() => goToLesson(i)}
                className={`shrink-0 px-2.5 py-1.5 rounded text-[10px] font-bold transition-all ${
                  i === lessonIndex
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : completedLessons.has(lesson.id)
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-[#262421] text-[#615e59] border border-[#3c3934]'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>

      ) : (

        /* -------- ACADEMY MODE -------- */
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5">

            {/* Academy Sub-Tabs */}
            <div className="lg:col-span-12 bg-[#1b1a18] border border-[#2d2b27] rounded-xl overflow-hidden">
              <div className="flex items-center gap-1 px-2">
                {ACADEMY_TABS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setAcademyTab(key)}
                    className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                      academyTab === key
                        ? 'text-emerald-400 border-emerald-500 bg-emerald-500/5'
                        : 'text-[#615e59] border-transparent hover:text-[#bababa] hover:border-[#3c3934]'
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Left Column — 8 cols */}
            <div className="lg:col-span-8 space-y-4">
              {iframeSrc && (
                <div className="bg-[#211f1c] border border-[#2d2b27] rounded-xl shadow-md overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#2d2b27] bg-[#1b1a18] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {academyTab === 'puzzles' ? (
                        <Target size={14} className="text-emerald-400" />
                      ) : (
                        <Tv size={14} className="text-emerald-400" />
                      )}
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white">
                        {academyTab === 'puzzles' ? 'Interactive Puzzle Grid' : 'Grandmaster Live Feed'}
                      </span>
                    </div>
                    <span className="text-[9px] text-[#615e59] font-mono uppercase tracking-wider">
                      {academyTab === 'puzzles' ? `${STUDIES.length} themes` : 'LIVE'}
                    </span>
                  </div>
                  <div className="relative" style={{ height: '620px' }}>
                    <iframe
                      src={iframeSrc}
                      className="w-full h-full border-0"
                      title={academyTab === 'puzzles' ? 'Lichess Puzzles' : 'Lichess TV'}
                      allow="clipboard-read; clipboard-write"
                    />
                  </div>
                </div>
              )}

              {/* Studies tab */}
              {academyTab === 'studies' && (
                <div className="bg-[#211f1c] border border-[#2d2b27] rounded-xl shadow-md overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#2d2b27] bg-[#1b1a18] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen size={14} className="text-emerald-400" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white">
                        Open Study Curriculum
                      </span>
                    </div>
                    <span className="text-[9px] text-[#615e59] font-mono">{STUDIES.length} studies</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div className="bg-[#161513] border border-[#2d2b27] rounded-lg p-3">
                        <div className="text-[18px] font-black text-emerald-400 font-mono">{STUDIES.length}</div>
                        <div className="text-[9px] text-[#615e59] font-bold uppercase tracking-widest mt-0.5">Total Studies</div>
                      </div>
                      <div className="bg-[#161513] border border-[#2d2b27] rounded-lg p-3 flex items-center">
                        <Trophy size={14} className="text-amber-400 shrink-0 mr-2" />
                        <span className="text-[11px] text-[#bababa] font-semibold">Structured learning path from beginner to advanced</span>
                      </div>
                    </div>
                    {STUDIES.map((study) => (
                      <div key={study.id} className="bg-[#1b1a18] border border-[#2d2b27] rounded-lg overflow-hidden transition-all hover:border-emerald-500/20">
                        <button
                          onClick={() => setExpandedStudy(expandedStudy === study.id ? null : study.id)}
                          className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h3 className="text-sm font-bold text-white truncate">{study.title}</h3>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${LEVEL_COLORS[study.level]}`}>
                                {study.level}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-[#615e59] font-mono">
                              <span className="flex items-center gap-1"><Clock size={10} /> {study.duration}</span>
                              <span className="flex items-center gap-1"><Layers size={10} /> {study.topics.length} topics</span>
                            </div>
                          </div>
                          <ChevronDown size={14} className={`text-[#615e59] shrink-0 transition-transform ${expandedStudy === study.id ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedStudy === study.id && (
                          <div className="px-4 pb-4 space-y-3 border-t border-[#2d2b27] pt-3">
                            <p className="text-[11px] text-[#bababa] leading-relaxed">{study.description}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {study.topics.map((topic) => (
                                <span key={topic} className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  {topic}
                                </span>
                              ))}
                            </div>
                            <a
                              href={study.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors"
                            >
                              <ExternalLink size={11} /> Open Study
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column — 4 cols — Coach Panel */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-[#211f1c] border border-[#2d2b27] rounded-xl p-5 shadow-md">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center">
                    <Sparkles size={13} className="text-white" />
                  </div>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-white">{ACADEMY_COACH[academyTab].title}</h2>
                </div>
                <ul className="space-y-3">
                  {ACADEMY_COACH[academyTab].lines.map((line, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <span className="text-[11px] text-[#bababa] leading-relaxed">{line}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-[#211f1c] border border-[#2d2b27] rounded-xl p-5 shadow-md">
                <div className="flex items-center gap-2 mb-3">
                  <GraduationCap size={13} className="text-emerald-400" />
                  <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#615e59]">Quick Stats</h2>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#615e59]">Active Sessions</span>
                    <span className="text-emerald-400 font-bold font-mono">1,247</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#615e59]">Global Puzzles Solved</span>
                    <span className="text-emerald-400 font-bold font-mono">2.1M</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#615e59]">GMs Streaming Now</span>
                    <span className="text-emerald-400 font-bold font-mono">14</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#615e59]">Available Studies</span>
                    <span className="text-emerald-400 font-bold font-mono">{STUDIES.length}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      <style>{`
        .minimal-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .minimal-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .minimal-scrollbar::-webkit-scrollbar-thumb { background: #3c3934; border-radius: 2px; }
        .minimal-scrollbar::-webkit-scrollbar-thumb:hover { background: #4a4640; }
      `}</style>
    </main>
  );
}
