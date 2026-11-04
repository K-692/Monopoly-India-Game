import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePracticeStore } from './use-practice-store';
import { useAuthStore } from '@/features/auth/use-auth-store';
import { GameBoard } from '@/components/board/GameBoard';
import { PlayerStrip } from '@/components/player/PlayerStrip';
import { ActionPanel } from '@/components/player/ActionPanel';
import { EventTicker } from '@/components/feedback/EventTicker';
import { ReactionTray } from '@/components/feedback/ReactionTray';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Trophy, ArrowLeft, AlertCircle, Bot } from 'lucide-react';
import confetti from 'canvas-confetti';

export const PracticeMatchPage: React.FC = () => {
  const navigate = useNavigate();
  const { player } = useAuthStore();
  const {
    gameState,
    events,
    activeEmotes,
    selectedSpaceIndex,
    isRolling,
    isAiThinking,
    error,
    startPracticeMatch,
    selectSpace,
    dispatchAction,
    sendEmote,
    tickTurnTimer,
    dismissError,
  } = usePracticeStore();

  useEffect(() => {
    if (!gameState) {
      startPracticeMatch(player?.displayName || 'Maharaja Player');
    }
  }, [gameState, player?.displayName, startPracticeMatch]);

  // Turn timer countdown interval
  useEffect(() => {
    if (!gameState || gameState.status === 'COMPLETED') return;
    const interval = setInterval(() => {
      tickTurnTimer();
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState, tickTurnTimer]);

  // Victory fireworks
  useEffect(() => {
    if (gameState?.status === 'COMPLETED' && gameState.winnerUid) {
      try {
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // Ignored
      }
    }
  }, [gameState?.status, gameState?.winnerUid]);

  if (!gameState) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-10 h-10 border-4 border-indian-terracotta-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-indian-navy-800">
          Preparing the Practice Match...
        </p>
      </div>
    );
  }

  const isHumanTurn = gameState.currentPlayerUid === 'player_human';
  const winner = gameState.players.find((p) => p.uid === gameState.winnerUid);

  return (
    <div className="h-[calc(100dvh-54px)] max-h-screen overflow-hidden flex flex-col justify-between w-full max-w-[1600px] mx-auto px-2 sm:px-4 py-1.5 gap-1.5 select-none">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-1.5 border-b border-indian-parchment-300 dark:border-indian-navy-700 shrink-0">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-xs font-bold text-indian-navy-700 dark:text-indian-parchment-300 hover:text-indian-terracotta-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Exit Practice Match
        </button>

        <div className="flex items-center gap-2">
          <Badge variant="terracotta" className="text-xs font-bold flex items-center gap-1">
            <Bot className="w-3.5 h-3.5" /> Practice Match (Sandbox)
          </Badge>
          <span className="text-xs text-gray-500 font-mono">
            Turn #{gameState.turnNumber}
          </span>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={dismissError} className="font-bold underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* Victory Celebration Modal */}
      {gameState.status === 'COMPLETED' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <Card className="max-w-md w-full p-6 text-center border-2 border-indian-gold-500 shadow-2xl bg-white dark:bg-indian-navy-900">
            <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 mx-auto flex items-center justify-center mb-4 border border-amber-300 shadow-md">
              <Trophy className="w-8 h-8" />
            </div>

            <h2 className="font-serif font-black text-2xl text-indian-terracotta-600 mb-1">
              PRACTICE MATCH COMPLETED!
            </h2>
            <p className="text-base font-bold text-indian-navy-900 dark:text-indian-parchment-100 mb-4">
              👑 {winner?.displayName} is the Sovereign Tycoon!
            </p>

            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={() => startPracticeMatch(player?.displayName || 'Maharaja Player')}
                className="flex-1 font-bold"
              >
                Play Again
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/')}
                className="flex-1 font-bold"
              >
                Back to Play
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Main 3-Column Non-Scrollable Game Canvas */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-4 items-center overflow-hidden min-h-0">
        {/* Left Column: Player Strip */}
        <div className="hidden lg:block lg:col-span-3 h-full overflow-y-auto pr-1">
          <PlayerStrip
            players={gameState.players}
            currentPlayerUid={gameState.currentPlayerUid}
            properties={gameState.properties}
            onSelectPlayer={(uid) => {
              const p = gameState.players.find((pl) => pl.uid === uid);
              if (p) selectSpace(p.position);
            }}
          />
        </div>

        {/* Center Column: The 40-Space Board with in-board dice and buzz cards */}
        <div className="col-span-1 lg:col-span-6 flex items-center justify-center h-full max-h-full">
          <GameBoard
            gameState={gameState}
            selectedSpaceIndex={selectedSpaceIndex}
            onSelectSpace={selectSpace}
            isRolling={isRolling}
            onRollDice={() => dispatchAction('ROLL_DICE')}
            isMyTurn={isHumanTurn && !isAiThinking}
          />
        </div>

        {/* Right Column: Actions & Property Deed Details */}
        <div className="hidden lg:block lg:col-span-3 h-full overflow-y-auto pl-1">
          <ActionPanel
            gameState={gameState}
            selectedSpaceIndex={selectedSpaceIndex}
            onDispatch={dispatchAction}
            isRolling={isRolling}
            userUid="player_human"
          />
        </div>
      </div>

      {/* Bottom Tray: Event Ticker & Reaction Tray */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-1.5 shrink-0 pt-1">
        <div className="w-full sm:flex-1">
          <EventTicker events={events} />
        </div>
        <div className="shrink-0">
          <ReactionTray
            onSendEmote={(emote) => sendEmote(emote, player?.displayName || 'Player')}
            activeEmotes={activeEmotes}
          />
        </div>
      </div>
    </div>
  );
};
