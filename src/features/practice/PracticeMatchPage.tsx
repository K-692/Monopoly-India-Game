import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePracticeStore } from './use-practice-store';
import { useAuthStore } from '@/features/auth/use-auth-store';
import { GameBoard } from '@/components/board/GameBoard';
import { PlayerStrip } from '@/components/player/PlayerStrip';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Trophy, ArrowLeft, Bot, AlertCircle } from 'lucide-react';

export const PracticeMatchPage: React.FC = () => {
  const navigate = useNavigate();
  const { player } = useAuthStore();
  const {
    gameState,
    events,
    selectedSpaceIndex,
    isRolling,
    walkingAnimation,
    error,
    isAiThinking,
    startPracticeMatch,
    dispatchAction,
    selectSpace,
    dismissError,
    tickTurnTimer,
  } = usePracticeStore();

  // Initialize Practice Match once on mount
  useEffect(() => {
    if (!gameState) {
      const defaultName = player?.displayName || 'Maharaja Player';
      startPracticeMatch(defaultName);
    }
  }, [gameState, player?.displayName, startPracticeMatch]);

  // Turn Countdown Timer ticker
  useEffect(() => {
    if (!gameState || gameState.status === 'COMPLETED') return;
    const interval = setInterval(() => {
      tickTurnTimer();
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState, tickTurnTimer]);

  if (!gameState) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-10 h-10 border-4 border-indian-terracotta-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-indian-navy-800 dark:text-white">
          Preparing the Practice Match...
        </p>
      </div>
    );
  }

  const isHumanTurn = gameState.currentPlayerUid === 'player_human';
  const winner = gameState.players.find((p) => p.uid === gameState.winnerUid);

  return (
    <div className="h-[calc(100dvh-50px)] max-h-screen overflow-hidden flex flex-col justify-between w-full max-w-none px-2 sm:px-3 py-1 gap-1 select-none">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-1 border-b border-indian-parchment-300 dark:border-indian-navy-700 shrink-0">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-xs font-bold text-indian-navy-700 dark:text-indian-parchment-300 hover:text-indian-terracotta-600 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Exit Practice Match
        </button>

        <div className="flex items-center gap-2">
          <Badge variant="terracotta" className="text-xs font-bold flex items-center gap-1">
            <Bot className="w-3.5 h-3.5" /> Practice Match (Sandbox)
          </Badge>
          <span className="text-xs text-gray-500 font-mono font-bold">
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
          <button onClick={dismissError} className="font-bold underline ml-2 cursor-pointer">
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

      {/* Main Game Canvas: Slim Left Panel + Maximized Full-Screen Game Board (No Right Container, No Footer) */}
      <div className="flex-1 flex gap-2 items-stretch overflow-hidden min-h-0 w-full">
        {/* Left Column: Slim Player Strip (Select to View Info) */}
        <div className="hidden sm:flex flex-col justify-start h-full overflow-hidden w-32 sm:w-36 md:w-40 shrink-0">
          <PlayerStrip
            players={gameState.players}
            currentPlayerUid={gameState.currentPlayerUid}
            properties={gameState.properties}
            turnTimeRemaining={gameState.turnTimeRemaining}
            turnTimeLimit={gameState.turnTimeLimit}
            onSelectPlayer={() => {}}
            onSelectSpace={selectSpace}
          />
        </div>

        {/* Center Canvas: Full-Size Game Board (Enlarged across all available screen space) */}
        <div className="flex-1 flex items-center justify-center h-full max-h-full min-h-0 min-w-0 overflow-hidden">
          <GameBoard
            gameState={gameState}
            selectedSpaceIndex={selectedSpaceIndex}
            onSelectSpace={selectSpace}
            isRolling={isRolling}
            onRollDice={() => dispatchAction('ROLL_DICE')}
            onDismissCardPopup={() => dispatchAction('DISMISS_CARD_POPUP')}
            onDismissMoneyAck={() => dispatchAction('DISMISS_MONEY_ACK')}
            onDispatch={dispatchAction}
            isMyTurn={isHumanTurn && !isAiThinking && !walkingAnimation}
            userUid="player_human"
            lastEvent={events[0]}
            walkingAnimation={walkingAnimation}
          />
        </div>
      </div>
    </div>
  );
};
