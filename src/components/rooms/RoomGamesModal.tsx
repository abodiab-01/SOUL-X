import React, { useState, useEffect } from 'react';
import { X, Gamepad2, Trophy, Play, SkipForward, Square, Clock, Send, HelpCircle, CheckCircle2 } from 'lucide-react';
import { Language, RoomGameState, RoomMiniGameType } from '../../types';

interface RoomGamesModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  game: RoomGameState;
  canManageGames: boolean;
  myUserId: string;
  onStartGame: (gameType: RoomMiniGameType) => void;
  onAnswer: (answer: string) => void;
  onNextRound: () => void;
  onEndGame: () => void;
}

const MINI_GAMES_LIST: Array<{ id: RoomMiniGameType; ar: string; en: string; descAr: string; descEn: string }> = [
  { id: 'quiz', ar: 'أسئلة عامة', en: 'General Quiz', descAr: 'اختر الإجابة الصحيحة بأسرع وقت', descEn: 'Pick the correct answer fast' },
  { id: 'true_false', ar: 'صح أو خطأ', en: 'True or False', descAr: 'تحدي المعلومات السريع', descEn: 'Fast facts challenge' },
  { id: 'word_guess', ar: 'تخمين الكلمة', en: 'Word Guess', descAr: 'اكتشف الكلمة المخفية من التلميح', descEn: 'Guess the hidden word from hints' },
  { id: 'who_am_i', ar: 'من أنا؟', en: 'Who Am I?', descAr: 'ألغاز ذكية تفاعلية للغرفة', descEn: 'Interactive riddles for everyone' },
  { id: 'speed_challenge', ar: 'تحدي سرعة الإجابة', en: 'Speed Challenge', descAr: 'أول من يجيب يحسم الجولة', descEn: 'First correct answer wins the round' },
];

export const RoomGamesModal: React.FC<RoomGamesModalProps> = ({
  isOpen,
  onClose,
  lang,
  game,
  canManageGames,
  myUserId,
  onStartGame,
  onAnswer,
  onNextRound,
  onEndGame,
}) => {
  const isAr = lang === 'ar';
  const [textAnswer, setTextAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    setTextAnswer('');
  }, [game.roundNumber, game.gameId]);

  useEffect(() => {
    if (game.status !== 'active' || !game.roundStartedAtMs) {
      setTimeLeft(0);
      return;
    }
    const update = () => {
      const elapsed = (Date.now() - game.roundStartedAtMs) / 1000;
      setTimeLeft(Math.max(0, Math.ceil(game.roundDurationSec - elapsed)));
    };
    update();
    const t = setInterval(update, 400);
    return () => clearInterval(t);
  }, [game.status, game.roundStartedAtMs, game.roundDurationSec]);

  if (!isOpen) return null;

  const hasAnswered = game.answeredUserIds.includes(myUserId);
  const options = isAr ? game.question?.optionsAr : game.question?.optionsEn;

  return (
    <div
      className="fixed inset-0 z-[115] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-neutral-950/70 backdrop-blur-md animate-in fade-in duration-200"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="w-full sm:max-w-lg max-h-[88dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden">
        <div className="px-4 py-3.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-cyan-500" />
            <h3 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white">
              {isAr ? 'ألعاب الغرفة التفاعلية' : 'Room Mini-Games'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {game.status === 'idle' ? (
            <div className="space-y-3">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                {canManageGames
                  ? (isAr ? 'اختر لعبة لبدء المنافسة دون انقطاع الصوت:' : 'Choose a game to play without interrupting voice audio:')
                  : (isAr ? 'بانتظار قيام الإدارة أو المضيف بتشغيل لعبة داخل الغرفة' : 'Waiting for host/moderators to start a game')}
              </p>
              <div className="grid grid-cols-1 gap-2">
                {MINI_GAMES_LIST.map((mg) => (
                  <div
                    key={mg.id}
                    className="p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-black text-neutral-900 dark:text-white">
                        {isAr ? mg.ar : mg.en}
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        {isAr ? mg.descAr : mg.descEn}
                      </div>
                    </div>
                    {canManageGames && (
                      <button
                        type="button"
                        onClick={() => onStartGame(mg.id)}
                        className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-neutral-950 text-xs font-black flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>{isAr ? 'بدء' : 'Start'}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Round Status Header */}
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="px-2.5 py-1 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                  {isAr ? `الجولة ${game.roundNumber} / ${game.totalRounds}` : `Round ${game.roundNumber} / ${game.totalRounds}`}
                </span>
                {game.status === 'active' && (
                  <span className="flex items-center gap-1 font-mono text-amber-600 dark:text-amber-400">
                    <Clock className="w-3.5 h-3.5" />
                    {timeLeft}s
                  </span>
                )}
              </div>

              {/* Active Question */}
              {game.question && (game.status === 'active' || game.status === 'round_result') && (
                <div className="p-4 rounded-2xl bg-neutral-100 dark:bg-neutral-800/70 border border-neutral-200 dark:border-neutral-700 space-y-3">
                  <p className="text-sm sm:text-base font-black text-neutral-900 dark:text-white leading-relaxed">
                    {isAr ? game.question.promptAr : game.question.promptEn}
                  </p>
                  {(game.question.hintAr || game.question.hintEn) && (
                    <p className="text-xs text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>{isAr ? `تلميح: ${game.question.hintAr}` : `Hint: ${game.question.hintEn}`}</span>
                    </p>
                  )}

                  {game.status === 'round_result' ? (
                    <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-black flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>
                        {isAr ? `الإجابة الصحيحة: ${game.correctAnswerAr}` : `Correct answer: ${game.correctAnswerEn}`}
                      </span>
                    </div>
                  ) : options && options.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {options.map((opt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          disabled={hasAnswered}
                          onClick={() => onAnswer(opt)}
                          className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 hover:border-cyan-500 text-xs sm:text-sm font-bold text-neutral-900 dark:text-white disabled:opacity-55 cursor-pointer transition-all"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!hasAnswered && textAnswer.trim()) {
                          onAnswer(textAnswer.trim());
                          setTextAnswer('');
                        }
                      }}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        disabled={hasAnswered}
                        value={textAnswer}
                        onChange={(e) => setTextAnswer(e.target.value)}
                        placeholder={hasAnswered ? (isAr ? 'تم إرسال إجابتك' : 'Answer submitted') : (isAr ? 'اكتب إجابتك هنا...' : 'Type your answer...')}
                        className="flex-1 px-3 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                      <button
                        type="submit"
                        disabled={hasAnswered || !textAnswer.trim()}
                        className="px-4 py-2.5 rounded-xl bg-cyan-500 text-neutral-950 font-black text-xs disabled:opacity-50 cursor-pointer flex items-center gap-1"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{isAr ? 'إرسال' : 'Send'}</span>
                      </button>
                    </form>
                  )}

                  {hasAnswered && game.status === 'active' && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                      {isAr ? 'تم تسجيل إجابتك لهذه الجولة!' : 'Your answer was recorded!'}
                    </p>
                  )}
                </div>
              )}

              {/* Finished Winner Banner */}
              {game.status === 'finished' && (
                <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-center space-y-2">
                  <Trophy className="w-9 h-9 text-amber-500 mx-auto" />
                  <div className="text-base font-black text-neutral-900 dark:text-white">
                    {game.winnerName
                      ? (isAr ? `الفائز: ${game.winnerName}` : `Winner: ${game.winnerName}`)
                      : (isAr ? 'انتهت اللعبة!' : 'Game Finished!')}
                  </div>
                </div>
              )}

              {/* Leaderboard */}
              {game.leaderboard.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-black text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    <span>{isAr ? 'لوحة النقاط' : 'Leaderboard'}</span>
                  </div>
                  <div className="space-y-1.5">
                    {game.leaderboard.slice(0, 8).map((entry, i) => (
                      <div
                        key={entry.userId}
                        className="px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800/70 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-cyan-600 dark:text-cyan-400 w-5">#{i + 1}</span>
                          <span className="font-bold text-neutral-900 dark:text-white">{entry.name}</span>
                        </div>
                        <span className="font-mono font-black text-amber-600 dark:text-amber-400">
                          {entry.score} {isAr ? 'نقطة' : 'pts'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Host Controls */}
              {canManageGames && (
                <div className="flex items-center gap-2 pt-2">
                  {game.status === 'active' && (
                    <button
                      type="button"
                      onClick={onNextRound}
                      className="flex-1 py-2.5 rounded-xl bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <SkipForward className="w-4 h-4" />
                      <span>{isAr ? 'كشف النتيجة' : 'Reveal Result'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onEndGame}
                    className="flex-1 py-2.5 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>{game.status === 'finished' ? (isAr ? 'قائمة الألعاب' : 'Game Menu') : (isAr ? 'إنهاء اللعبة' : 'End Game')}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
