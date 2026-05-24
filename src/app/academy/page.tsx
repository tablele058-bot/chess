'use client';

import { useState } from 'react';
import {
  BookOpen, Tv, Puzzle, ArrowLeft, Clock, Shield, Swords, Castle,
  Film, Target, Brain, Library, Zap, ExternalLink, Star,
  ChevronRight, GraduationCap, Layers, BookMarked, BarChart3,
  Play, Sparkles, Users, Database, Gamepad2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

type Panel = 'tactics' | 'openings' | 'endgames' | 'videos' | 'strategy' | 'tools' | 'books' | 'practice';

interface ResourceLink {
  title: string;
  url: string;
  description: string;
  icon: React.ReactNode;
}

interface VideoChannel {
  name: string;
  url: string;
  description: string;
  topics: string[];
  level: string;
}

interface BookEntry {
  title: string;
  author: string;
  description: string;
  level: string;
}

const RESOURCE_LINKS: Record<string, ResourceLink[]> = {
  tactics: [
    { title: 'Lichess Tactics Trainer', url: 'https://lichess.org/training', description: 'Thousands of puzzles grouped by theme, from easy to master', icon: <Brain size={16} /> },
    { title: 'Lichess Puzzle Themes', url: 'https://lichess.org/practice', description: 'Practice specific tactical motifs: forks, pins, skewers, discovered attacks', icon: <Target size={16} /> },
    { title: 'Chess.com Puzzles', url: 'https://www.chess.com/puzzles', description: 'Daily puzzles and ranked puzzle rush with rating progression', icon: <Zap size={16} /> },
    { title: 'ChessTempo', url: 'https://chesstempo.com', description: 'Advanced tactics trainer with spaced repetition and custom problem sets', icon: <BarChart3 size={16} /> },
    { title: 'Lichess Coordinate Training', url: 'https://lichess.org/training/coordinate', description: 'Practice square recognition to improve board vision', icon: <Target size={16} /> },
  ],
  openings: [
    { title: 'Lichess Opening Explorer', url: 'https://lichess.org/opening', description: 'Master database with 5M+ games, filter by rating, year, and player', icon: <Database size={16} /> },
    { title: 'Chess.com Opening Explorer', url: 'https://www.chess.com/explorer', description: 'Opening explorer with master games and engine evaluations', icon: <BookMarked size={16} /> },
    { title: 'ChessTempo Opening Trainer', url: 'https://chesstempo.com/opening-training', description: 'Repertoire builder with spaced repetition and move-by-move training', icon: <GraduationCap size={16} /> },
    { title: 'Lichess Opening Studies', url: 'https://lichess.org/study', description: 'Community-created opening repertoires and annotated master games', icon: <Library size={16} /> },
    { title: 'Chess24 Opening Database', url: 'https://www.chess.com/openings', description: 'Encyclopedia of openings with variations, stats, and model games', icon: <Layers size={16} /> },
  ],
  endgames: [
    { title: 'Lichess Endgame Trainer', url: 'https://lichess.org/practice/endgame', description: 'Interactive endgame positions organized by material and theme', icon: <Castle size={16} /> },
    { title: 'Syzygy Tablebase', url: 'https://lichess.org/analysis', description: 'Perfect play for 7-piece positions — every move is proven optimal', icon: <Database size={16} /> },
    { title: 'Chess.com Endgame Lessons', url: 'https://www.chess.com/lessons/endgame', description: 'Structured endgame curriculum from basic mates to complex rook endgames', icon: <BookOpen size={16} /> },
    { title: 'Chess Endgame Studies Database', url: 'https://www.chess.com/endgames', description: 'Classic endgame studies composed by masters throughout history', icon: <Star size={16} /> },
  ],
  strategy: [
    { title: 'Lichess Practice: Strategy', url: 'https://lichess.org/practice/strategy', description: 'Strategic themes: pawn structures, piece placement, space advantage', icon: <Layers size={16} /> },
    { title: 'Chess.com Lessons', url: 'https://www.chess.com/lessons', description: 'Full curriculum from beginner to advanced with interactive exercises', icon: <GraduationCap size={16} /> },
    { title: 'Lichess Positional Training', url: 'https://lichess.org/practice/positional', description: 'Learn positional concepts: outposts, weak squares, prophylaxis', icon: <Shield size={16} /> },
    { title: 'Chess.com Strategy Articles', url: 'https://www.chess.com/articles/strategy', description: 'In-depth articles on positional play and strategic planning', icon: <BookMarked size={16} /> },
  ],
  tools: [
    { title: 'Lichess Analysis Board', url: 'https://lichess.org/analysis', description: 'Full analysis with Stockfish 16, multiple lines, position setup, and shareable PGN', icon: <BarChart3 size={16} /> },
    { title: 'Chess.com Analysis', url: 'https://www.chess.com/analysis', description: 'Cloud analysis with computer evaluation and mistake detection', icon: <BarChart3 size={16} /> },
    { title: 'Lichess Studies', url: 'https://lichess.org/study', description: 'Create and explore interactive lessons with annotations, variations, and comments', icon: <Library size={16} /> },
    { title: 'Lichess Import Game', url: 'https://lichess.org/import', description: 'Import PGN to analyze any game with computer evaluation', icon: <Gamepad2 size={16} /> },
    { title: 'OpeningTree', url: 'https://www.openingtree.com', description: 'Visualize your own opening repertoire from your Lichess/Chess.com games', icon: <Database size={16} /> },
  ],
  practice: [
    { title: 'Lichess vs. Computer', url: 'https://lichess.org/?ai', description: 'Play against Stockfish at any strength level from 200 to 3200', icon: <Swords size={16} /> },
    { title: 'Lichess Simul', url: 'https://lichess.org/simul', description: 'Join simultaneous exhibitions hosted by titled players', icon: <Users size={16} /> },
    { title: 'Chess.com Play Computer', url: 'https://www.chess.com/play/computer', description: 'Practice against adaptive AI with adjustable difficulty', icon: <Gamepad2 size={16} /> },
    { title: 'Lichess Puzzle Streak', url: 'https://lichess.org/training/streak', description: 'Solve as many puzzles as possible in a row under time pressure', icon: <Zap size={16} /> },
  ],
};

const VIDEO_CHANNELS: VideoChannel[] = [
  {
    name: 'GothamChess (Levy Rozman)',
    url: 'https://www.youtube.com/@GothamChess',
    description: 'Opening guides, game analysis, speedruns, and entertaining chess content for all levels. Levy\'s "How to Win at Chess" series is gold for beginners.',
    topics: ['Openings', 'Tactics', 'Game Analysis', 'Speedruns'],
    level: 'Beginner → Intermediate',
  },
  {
    name: 'Daniel Naroditsky',
    url: 'https://www.youtube.com/@DanielNaroditskyGM',
    description: 'World-class speedrun series explaining every decision from a GM\'s perspective. Best for understanding positional chess and long-term planning.',
    topics: ['Strategy', 'Endgames', 'Speedruns', 'Positional Play'],
    level: 'Intermediate → Advanced',
  },
  {
    name: 'Hanging Pawns',
    url: 'https://www.youtube.com/@HangingPawns',
    description: 'Deep-dive opening theory videos with complete repertoires. Covers sidelines, transpositions, and the ideas behind every move.',
    topics: ['Openings', 'Repertoire Building', 'Theory'],
    level: 'Intermediate → Advanced',
  },
  {
    name: 'John Bartholomew',
    url: 'https://www.youtube.com/@JohnBartholomew',
    description: 'The definitive Chess Fundamentals series. Covers basic endgames, tactics, and decision-making frameworks that every player must know.',
    topics: ['Fundamentals', 'Endgames', 'Tactics', 'Strategy'],
    level: 'Beginner → Intermediate',
  },
  {
    name: 'ChessNetwork (Jerry)',
    url: 'https://www.youtube.com/@ChessNetwork',
    description: 'Classic chess instruction with clear explanations. Jerry\'s beginner tutorials and endgame lessons are timeless resources.',
    topics: ['Basics', 'Endgames', 'Openings', 'Game Analysis'],
    level: 'Beginner → Intermediate',
  },
  {
    name: 'GM Hikaru Nakamura',
    url: 'https://www.youtube.com/@GMHikaru',
    description: 'Top GM shares real-time thinking during games. Watch a 2800+ player calculate, evaluate, and decide in complex positions.',
    topics: ['Game Analysis', 'Tactics', 'Blitz', 'Commentary'],
    level: 'All Levels',
  },
  {
    name: 'Agadmator (Antonio Radić)',
    url: 'https://www.youtube.com/@agadmator',
    description: 'Daily annotated master games with clear narration. The best way to absorb classical and modern chess history.',
    topics: ['Game Analysis', 'History', 'Classical Games', 'Annotations'],
    level: 'All Levels',
  },
  {
    name: 'Eric Rosen',
    url: 'https://www.youtube.com/@EricRosen',
    description: 'IM with a focus on practical play, trick openings, and endgame technique. Entertaining and instructive blitz games.',
    topics: ['Openings', 'Endgames', 'Blitz', 'Practical Play'],
    level: 'Intermediate',
  },
  {
    name: 'St. Louis Chess Club',
    url: 'https://www.youtube.com/@STLChessClub',
    description: 'Lecture series by top GMs (Yasser Seirawan, Ben Finegold, Maurice Ashley). World-class instruction on every aspect of chess.',
    topics: ['Strategy', 'Endgames', 'Openings', 'Lectures'],
    level: 'Intermediate → Advanced',
  },
  {
    name: 'Remote Chess Academy',
    url: 'https://www.youtube.com/@RemoteChessAcademy',
    description: 'GM Igor Smirnov\'s methodical approach to chess improvement. Focus on thinking systems and decision-making frameworks.',
    topics: ['Strategy', 'Decision Making', 'Psychology', 'Calculation'],
    level: 'Intermediate → Advanced',
  },
  {
    name: 'PowerPlayChess (Daniel King)',
    url: 'https://www.youtube.com/@PowerPlayChess',
    description: 'GM Daniel King analyzes the best games from top tournaments with deep positional and tactical insights.',
    topics: ['Game Analysis', 'Tournaments', 'Strategy', 'Tactics'],
    level: 'Intermediate → Advanced',
  },
  {
    name: 'Chess Vibes',
    url: 'https://www.youtube.com/@ChessVibesOfficial',
    description: 'Puzzle challenges, opening tutorials, and chess history. Great mix of entertainment and learning.',
    topics: ['Puzzles', 'Openings', 'History', 'Entertainment'],
    level: 'All Levels',
  },
  {
    name: 'Anna Cramling',
    url: 'https://www.youtube.com/@AnnaCramling',
    description: 'WGM shares insights from tournament play, opening ideas, and tactical patterns in an accessible format.',
    topics: ['Openings', 'Tactics', 'Tournament Play', 'Strategy'],
    level: 'All Levels',
  },
  {
    name: 'Kingscrusher',
    url: 'https://www.youtube.com/@kingscrusher',
    description: 'Huge library of annotated games, puzzles, and opening analysis. Thousands of videos covering every aspect of chess.',
    topics: ['Openings', 'Tactics', 'Game Analysis', 'Endgames'],
    level: 'All Levels',
  },
  {
    name: 'ChessDojo',
    url: 'https://www.youtube.com/@ChessDojo',
    description: 'Structured training program with coaches covering specific rating ranges. Game analysis and improvement plans.',
    topics: ['Training', 'Game Analysis', 'Improvement', 'Strategy'],
    level: 'Intermediate → Advanced',
  },
];

const BOOKS: BookEntry[] = [
  { title: 'My System', author: 'Aron Nimzowitsch', description: 'The foundational text of modern positional chess. Covers prophylaxis, overprotection, and blockading.', level: 'Advanced' },
  { title: 'Logical Chess: Move By Move', author: 'Irving Chernev', description: 'Every move explained in plain English. The best starting point for understanding chess strategy.', level: 'Beginner' },
  { title: 'The Amateur\'s Mind', author: 'Jeremy Silman', description: 'Learn to think like a master by correcting the typical thought processes of amateur players.', level: 'Intermediate' },
  { title: 'Silman\'s Complete Endgame Course', author: 'Jeremy Silman', description: 'Endgame knowledge organized by rating level. Learn exactly what you need for your skill bracket.', level: 'All Levels' },
  { title: 'Winning Chess Tactics', author: 'Seirawan & Silman', description: 'Systematic coverage of every tactical motif with hundreds of practice positions.', level: 'Beginner → Intermediate' },
  { title: 'How to Reassess Your Chess', author: 'Jeremy Silman', description: 'Master the art of positional evaluation and learn to create plans based on imbalances.', level: 'Intermediate → Advanced' },
  { title: 'Dvoretsky\'s Endgame Manual', author: 'Mark Dvoretsky', description: 'The definitive endgame reference. Essential for serious tournament players aiming for master level.', level: 'Advanced' },
  { title: 'Think Like a Grandmaster', author: 'Alexander Kotov', description: 'The classic guide to calculation, candidate moves, and the tree of analysis.', level: 'Advanced' },
  { title: 'Chess Fundamentals', author: 'José Raúl Capablanca', description: 'Timeless principles from a former World Champion. Endgames, strategy, and positional play.', level: 'All Levels' },
  { title: 'The Art of Attack in Chess', author: 'Vuković', description: 'The definitive guide to attacking play: king hunts, sacrifices, and mating patterns.', level: 'Intermediate → Advanced' },
  { title: 'Play Winning Chess', author: 'Yasser Seirawan', description: 'Clear introduction to tactical and strategic concepts with practical examples.', level: 'Beginner' },
  { title: '100 Endgames You Must Know', author: 'Jesus de la Villa', description: 'The essential endgame positions every player should know cold. Practical and well-organized.', level: 'Intermediate → Advanced' },
];

export default function AcademyPage() {
  const router = useRouter();
  const [activePanel, setActivePanel] = useState<Panel>('tactics');

  const tabs: { key: Panel; label: string; icon: React.ReactNode }[] = [
    { key: 'tactics', label: 'Tactics', icon: <Puzzle size={14} /> },
    { key: 'openings', label: 'Openings', icon: <BookMarked size={14} /> },
    { key: 'endgames', label: 'Endgames', icon: <Castle size={14} /> },
    { key: 'strategy', label: 'Strategy', icon: <Layers size={14} /> },
    { key: 'videos', label: 'Video Lessons', icon: <Film size={14} /> },
    { key: 'tools', label: 'Study Tools', icon: <BarChart3 size={14} /> },
    { key: 'books', label: 'Books', icon: <BookOpen size={14} /> },
    { key: 'practice', label: 'Practice', icon: <Gamepad2 size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-[#161513] text-[#e4e4e4] flex flex-col antialiased">
      <header className="h-[56px] min-h-[56px] flex items-center justify-between px-6 bg-[#211f1c] border-b border-[#2d2b27] shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/profile')} className="text-[#bababa] hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="bg-emerald-600 p-1.5 rounded-md flex items-center justify-center text-white font-black tracking-tighter text-sm">
            W
          </div>
          <span className="font-sans font-black tracking-tight text-md text-white">
            CHESS <span className="text-emerald-500">ACADEMY</span>
          </span>
        </div>
      </header>

      <div className="overflow-x-auto border-b border-[#2d2b27] bg-[#1b1a18] minimal-scrollbar">
        <div className="flex px-2 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActivePanel(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
                activePanel === tab.key
                  ? 'text-emerald-400 border-emerald-500 bg-emerald-500/5'
                  : 'text-[#615e59] border-transparent hover:text-[#bababa] hover:border-[#3c3934]'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {/* TACTICS */}
        {activePanel === 'tactics' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="bg-[#211f1c] border border-[#2d2b27] rounded-lg p-4">
              <h2 className="text-sm font-bold text-white mb-1 flex items-center gap-2"><Brain size={16} className="text-emerald-400" /> Tactics & Puzzles</h2>
              <p className="text-xs text-[#615e59]">Master every tactical motif. Solve puzzles from real games — forks, pins, skewers, sacrifices, and checkmates.</p>
            </div>
            <TacticsSection />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {RESOURCE_LINKS.tactics.map((r) => (
                <a key={r.title} href={r.url} target="_blank" rel="noopener noreferrer"
                  className="bg-[#211f1c] border border-[#2d2b27] rounded-lg p-4 hover:border-emerald-500/30 transition-all group">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-emerald-400">{r.icon}</span>
                    <h3 className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">{r.title}</h3>
                    <ExternalLink size={12} className="text-[#615e59] ml-auto shrink-0" />
                  </div>
                  <p className="text-[11px] text-[#bababa] leading-relaxed">{r.description}</p>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* OPENINGS */}
        {activePanel === 'openings' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="bg-[#211f1c] border border-[#2d2b27] rounded-lg p-4">
              <h2 className="text-sm font-bold text-white mb-1 flex items-center gap-2"><BookMarked size={16} className="text-emerald-400" /> Openings</h2>
              <p className="text-xs text-[#615e59]">Build your repertoire. Explore master databases, study opening theory, and practice your lines.</p>
            </div>
            <OpeningsSection />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {RESOURCE_LINKS.openings.map((r) => (
                <a key={r.title} href={r.url} target="_blank" rel="noopener noreferrer"
                  className="bg-[#211f1c] border border-[#2d2b27] rounded-lg p-4 hover:border-emerald-500/30 transition-all group">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-emerald-400">{r.icon}</span>
                    <h3 className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">{r.title}</h3>
                    <ExternalLink size={12} className="text-[#615e59] ml-auto shrink-0" />
                  </div>
                  <p className="text-[11px] text-[#bababa] leading-relaxed">{r.description}</p>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ENDGAMES */}
        {activePanel === 'endgames' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="bg-[#211f1c] border border-[#2d2b27] rounded-lg p-4">
              <h2 className="text-sm font-bold text-white mb-1 flex items-center gap-2"><Castle size={16} className="text-emerald-400" /> Endgames</h2>
              <p className="text-xs text-[#615e59]">Convert winning positions and save draws. From basic mates to complex rook endgames and tablebase-perfect play.</p>
            </div>
            <EndgameSection />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {RESOURCE_LINKS.endgames.map((r) => (
                <a key={r.title} href={r.url} target="_blank" rel="noopener noreferrer"
                  className="bg-[#211f1c] border border-[#2d2b27] rounded-lg p-4 hover:border-emerald-500/30 transition-all group">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-emerald-400">{r.icon}</span>
                    <h3 className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">{r.title}</h3>
                    <ExternalLink size={12} className="text-[#615e59] ml-auto shrink-0" />
                  </div>
                  <p className="text-[11px] text-[#bababa] leading-relaxed">{r.description}</p>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* STRATEGY */}
        {activePanel === 'strategy' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="bg-[#211f1c] border border-[#2d2b27] rounded-lg p-4">
              <h2 className="text-sm font-bold text-white mb-1 flex items-center gap-2"><Layers size={16} className="text-emerald-400" /> Strategy & Middlegame</h2>
              <p className="text-xs text-[#615e59]">Positional understanding, pawn structures, piece play, and long-term planning. The art of outplaying your opponent.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {RESOURCE_LINKS.strategy.map((r) => (
                <a key={r.title} href={r.url} target="_blank" rel="noopener noreferrer"
                  className="bg-[#211f1c] border border-[#2d2b27] rounded-lg p-4 hover:border-emerald-500/30 transition-all group">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-emerald-400">{r.icon}</span>
                    <h3 className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">{r.title}</h3>
                    <ExternalLink size={12} className="text-[#615e59] ml-auto shrink-0" />
                  </div>
                  <p className="text-[11px] text-[#bababa] leading-relaxed">{r.description}</p>
                </a>
              ))}
            </div>
            <StrategyVideos />
          </div>
        )}

        {/* VIDEOS */}
        {activePanel === 'videos' && (
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="bg-[#211f1c] border border-[#2d2b27] rounded-lg p-4">
              <h2 className="text-sm font-bold text-white mb-1 flex items-center gap-2"><Film size={16} className="text-red-400" /> Video Lessons</h2>
              <p className="text-xs text-[#615e59]">Learn from the best chess educators on YouTube. Organized by channel, topic, and skill level.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {VIDEO_CHANNELS.map((ch) => (
                <a key={ch.name} href={ch.url} target="_blank" rel="noopener noreferrer"
                  className="bg-[#211f1c] border border-[#2d2b27] rounded-lg p-4 hover:border-red-500/30 transition-all group">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-400">
                      <Play size={13} />
                    </div>
                    <h3 className="text-xs font-bold text-white group-hover:text-red-400 transition-colors">{ch.name}</h3>
                    <ExternalLink size={12} className="text-[#615e59] ml-auto shrink-0" />
                  </div>
                  <p className="text-[11px] text-[#bababa] leading-relaxed mb-2">{ch.description}</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {ch.topics.map((t) => (
                      <span key={t} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#1b1a18] text-[#615e59] border border-[#2d2b27]">{t}</span>
                    ))}
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400">{ch.level}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* TOOLS */}
        {activePanel === 'tools' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="bg-[#211f1c] border border-[#2d2b27] rounded-lg p-4">
              <h2 className="text-sm font-bold text-white mb-1 flex items-center gap-2"><BarChart3 size={16} className="text-emerald-400" /> Study Tools</h2>
              <p className="text-xs text-[#615e59]">Analysis boards, game databases, study creation, and repertoire trackers.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {RESOURCE_LINKS.tools.map((r) => (
                <a key={r.title} href={r.url} target="_blank" rel="noopener noreferrer"
                  className="bg-[#211f1c] border border-[#2d2b27] rounded-lg p-4 hover:border-emerald-500/30 transition-all group">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-emerald-400">{r.icon}</span>
                    <h3 className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">{r.title}</h3>
                    <ExternalLink size={12} className="text-[#615e59] ml-auto shrink-0" />
                  </div>
                  <p className="text-[11px] text-[#bababa] leading-relaxed">{r.description}</p>
                </a>
              ))}
            </div>
            <ToolsVideos />
          </div>
        )}

        {/* BOOKS */}
        {activePanel === 'books' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="bg-[#211f1c] border border-[#2d2b27] rounded-lg p-4">
              <h2 className="text-sm font-bold text-white mb-1 flex items-center gap-2"><BookOpen size={16} className="text-emerald-400" /> Recommended Books</h2>
              <p className="text-xs text-[#615e59]">The essential chess library. Classic texts every serious player should study.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {BOOKS.map((b) => (
                <div key={b.title}
                  className="bg-[#211f1c] border border-[#2d2b27] rounded-lg p-4 hover:border-emerald-500/30 transition-all group">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                      <BookOpen size={15} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">{b.title}</h3>
                      <p className="text-[10px] text-[#615e59] font-mono mb-1">by {b.author}</p>
                      <p className="text-[11px] text-[#bababa] leading-relaxed">{b.description}</p>
                      <span className={`inline-block mt-1.5 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                        b.level === 'Beginner' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        b.level === 'All Levels' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        b.level === 'Intermediate' || b.level === 'Beginner → Intermediate' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                        'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {b.level}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PRACTICE */}
        {activePanel === 'practice' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="bg-[#211f1c] border border-[#2d2b27] rounded-lg p-4">
              <h2 className="text-sm font-bold text-white mb-1 flex items-center gap-2"><Gamepad2 size={16} className="text-emerald-400" /> Practice & Play</h2>
              <p className="text-xs text-[#615e59]">Test your skills. Play against engines, solve puzzles on a streak, or analyze your games.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {RESOURCE_LINKS.practice.map((r) => (
                <a key={r.title} href={r.url} target="_blank" rel="noopener noreferrer"
                  className="bg-[#211f1c] border border-[#2d2b27] rounded-lg p-4 hover:border-emerald-500/30 transition-all group">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-emerald-400">{r.icon}</span>
                    <h3 className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">{r.title}</h3>
                    <ExternalLink size={12} className="text-[#615e59] ml-auto shrink-0" />
                  </div>
                  <p className="text-[11px] text-[#bababa] leading-relaxed">{r.description}</p>
                </a>
              ))}
            </div>
          </div>
        )}
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

function TacticsSection() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="bg-[#211f1c] border border-[#2d2b27] rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#2d2b27] bg-[#1b1a18] flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white flex items-center gap-1.5">
            <Brain size={12} className="text-emerald-400" /> Lichess Puzzles
          </span>
          <a href="https://lichess.org/training" target="_blank" rel="noopener noreferrer" className="text-[9px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
            Open <ExternalLink size={9} />
          </a>
        </div>
        <iframe
          src="https://lichess.org/training/frame?theme=green&bg=dark"
          title="Lichess Tactics Trainer"
          className="w-full h-[500px] border-0"
          loading="lazy"
          allowFullScreen
        />
      </div>
      <div className="bg-[#211f1c] border border-[#2d2b27] rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#2d2b27] bg-[#1b1a18] flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white flex items-center gap-1.5">
            <Target size={12} className="text-emerald-400" /> Practice Themes
          </span>
          <a href="https://lichess.org/practice" target="_blank" rel="noopener noreferrer" className="text-[9px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
            Open <ExternalLink size={9} />
          </a>
        </div>
        <iframe
          src="https://lichess.org/practice/frame?theme=green&bg=dark"
          title="Lichess Practice Themes"
          className="w-full h-[500px] border-0"
          loading="lazy"
          allowFullScreen
        />
      </div>
    </div>
  );
}

function OpeningsSection() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="bg-[#211f1c] border border-[#2d2b27] rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#2d2b27] bg-[#1b1a18] flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white flex items-center gap-1.5">
            <Database size={12} className="text-emerald-400" /> Lichess Opening Explorer
          </span>
          <a href="https://lichess.org/opening" target="_blank" rel="noopener noreferrer" className="text-[9px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
            Open <ExternalLink size={9} />
          </a>
        </div>
        <iframe
          src="https://lichess.org/opening/frame?theme=green&bg=dark"
          title="Lichess Opening Explorer"
          className="w-full h-[500px] border-0"
          loading="lazy"
          allowFullScreen
        />
      </div>
      <div className="bg-[#211f1c] border border-[#2d2b27] rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#2d2b27] bg-[#1b1a18] flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white flex items-center gap-1.5">
            <Library size={12} className="text-emerald-400" /> Lichess Studies
          </span>
          <a href="https://lichess.org/study" target="_blank" rel="noopener noreferrer" className="text-[9px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
            Open <ExternalLink size={9} />
          </a>
        </div>
        <iframe
          src="https://lichess.org/study/frame?theme=green&bg=dark"
          title="Lichess Studies"
          className="w-full h-[500px] border-0"
          loading="lazy"
          allowFullScreen
        />
      </div>
    </div>
  );
}

function EndgameSection() {
  return (
    <div className="bg-[#211f1c] border border-[#2d2b27] rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[#2d2b27] bg-[#1b1a18] flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white flex items-center gap-1.5">
          <Castle size={12} className="text-emerald-400" /> Lichess Endgame Trainer
        </span>
        <a href="https://lichess.org/practice/endgame" target="_blank" rel="noopener noreferrer" className="text-[9px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
          Open <ExternalLink size={9} />
        </a>
      </div>
      <iframe
        src="https://lichess.org/practice/endgame/frame?theme=green&bg=dark"
        title="Lichess Endgame Trainer"
        className="w-full h-[500px] border-0"
        loading="lazy"
        allowFullScreen
      />
    </div>
  );
}

function StrategyVideos() {
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-white flex items-center gap-2">
        <Film size={13} className="text-red-400" /> Strategy Video Lessons
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <a href="https://www.youtube.com/results?search_query=chess+positional+strategy+lesson" target="_blank" rel="noopener noreferrer"
          className="bg-[#211f1c] border border-[#2d2b27] rounded-lg p-4 hover:border-red-500/30 transition-all group">
          <div className="flex items-center gap-2 mb-1.5">
            <Play size={13} className="text-red-400" />
            <h3 className="text-xs font-bold text-white group-hover:text-red-400 transition-colors">Positional Strategy Tutorials</h3>
            <ExternalLink size={12} className="text-[#615e59] ml-auto shrink-0" />
          </div>
          <p className="text-[11px] text-[#bababa]">Curated YouTube search: pawn structures, piece placement, space advantage, prophylaxis</p>
        </a>
        <a href="https://www.youtube.com/results?search_query=chess+pawn+structures+strategy" target="_blank" rel="noopener noreferrer"
          className="bg-[#211f1c] border border-[#2d2b27] rounded-lg p-4 hover:border-red-500/30 transition-all group">
          <div className="flex items-center gap-2 mb-1.5">
            <Play size={13} className="text-red-400" />
            <h3 className="text-xs font-bold text-white group-hover:text-red-400 transition-colors">Pawn Structure Deep Dives</h3>
            <ExternalLink size={12} className="text-[#615e59] ml-auto shrink-0" />
          </div>
          <p className="text-[11px] text-[#bababa]">Carlsbad, Hedgehog, Isolated Queen Pawn, Hanging Pawns — master every formation</p>
        </a>
      </div>
    </div>
  );
}

function ToolsVideos() {
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-white flex items-center gap-2">
        <Film size={13} className="text-red-400" /> Analysis & Improvement Videos
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <a href="https://www.youtube.com/results?search_query=how+to+analyze+your+chess+games" target="_blank" rel="noopener noreferrer"
          className="bg-[#211f1c] border border-[#2d2b27] rounded-lg p-4 hover:border-red-500/30 transition-all group">
          <div className="flex items-center gap-2 mb-1.5">
            <Play size={13} className="text-red-400" />
            <h3 className="text-xs font-bold text-white group-hover:text-red-400 transition-colors">Game Analysis Tutorials</h3>
            <ExternalLink size={12} className="text-[#615e59] ml-auto shrink-0" />
          </div>
          <p className="text-[11px] text-[#bababa]">Learn how to analyze your own games effectively and build a training plan</p>
        </a>
        <a href="https://www.youtube.com/results?search_query=chess+calculation+training+exercises" target="_blank" rel="noopener noreferrer"
          className="bg-[#211f1c] border border-[#2d2b27] rounded-lg p-4 hover:border-red-500/30 transition-all group">
          <div className="flex items-center gap-2 mb-1.5">
            <Play size={13} className="text-red-400" />
            <h3 className="text-xs font-bold text-white group-hover:text-red-400 transition-colors">Calculation Training</h3>
            <ExternalLink size={12} className="text-[#615e59] ml-auto shrink-0" />
          </div>
          <p className="text-[11px] text-[#bababa]">Exercises to improve calculation depth, visualization, and candidate move selection</p>
        </a>
      </div>
    </div>
  );
}
