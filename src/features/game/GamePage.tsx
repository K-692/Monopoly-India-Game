import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameStore } from './use-game-store';
import { useAuthStore } from '@/features/auth/use-auth-store';
import { useRoomStore } from '@/features/rooms/use-room-store';
import { GameBoard } from '@/components/board/GameBoard';
import { PlayerStrip } from '@/components/player/PlayerStrip';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Trophy, ArrowLeft, AlertCircle, Users, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';

export const GamePage: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { player } = useAuthStore();
  const { currentRoom, subscribeToRoom } = useRoomStore();
  const {
    gameState,
    events,
    selectedSpaceIndex,
    isRolling,
    walkingAnimation,
    error,
    initializeGameFromRoom,
    dispatchAction,
    selectSpace,
    dismissError,
    tickTurnTimer,
  } = useGameStore();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Turn Countdown Timer ticker
  useEffect(() => {
    if (!gameState || gameState.status === 'COMPLETED') return;
    const interval = setInterval(() => {
      tickTurnTimer();
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState, tickTurnTimer]);

  // Handle Game Initialization: multiplayer match requires real room members or derived room
  useEffect(() => {
    if (!gameId) {
      navigate('/');
      return;
    }

    if (currentRoom && currentRoom.members && Object.keys(currentRoom.members).length >= 1) {
      return initializeGameFromRoom(
        currentRoom.roomId,
        gameId,
        currentRoom.members,
        currentRoom.customRules
      );
    } else if (!currentRoom) {
      // Rehydrate room from gameId if user refreshed or arrived directly
      const derivedRoomId = 'room_' + gameId.replace('game_', '');
      const unsubscribe = subscribeToRoom(derivedRoomId);
      return () => {
        unsubscribe();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, currentRoom?.roomId]);

  // Trigger celebration on victory
  useEffect(() => {
    if (gameState?.status === 'COMPLETED' && gameState.winnerUid) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });
    }
  }, [gameState?.status, gameState?.winnerUid]);

  if (!gameState) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <Loader2 className="w-10 h-10 text-indian-terracotta-500 animate-spin mb-4" />
        <h2 className="font-serif font-black text-lg text-indian-navy-900 dark:text-white">
          Entering Game Session...
        </h2>
        <p className="text-xs text-gray-500 mt-1 max-w-sm">
          Loading game room state and initializing Indian Monopoly board.
        </p>
      </div>
    );
  }

  const isMyTurn = !player ? (gameState.currentPlayerUid === 'player_1') : (gameState.currentPlayerUid === player.uid);
  const winner = gameState.players.find((p) => p.uid === gameState.winnerUid);

  return (
    <div className="h-[calc(100dvh-50px)] max-h-screen overflow-hidden flex flex-col justify-between w-full max-w-none px-2 sm:px-3 py-1 gap-1 select-none">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-1 border-b border-indian-parchment-300 dark:border-indian-navy-700 shrink-0">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-xs font-bold text-indian-navy-700 dark:text-indian-parchment-300 hover:text-indian-terracotta-600 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Exit Room
        </button>

        <div className="flex items-center gap-2">
          <Badge variant="navy" className="text-xs font-bold flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {`Room #${gameState.roomId.replace('room_', '').slice(0, 6).toUpperCase()}`}
          </Badge>
          <span className="text-xs text-gray-500 font-mono font-bold">
            Turn #{gameState.turnNumber}
          </span>
          <button
            onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
            className="sm:hidden text-xs text-indian-terracotta-600 font-bold underline"
          >
            {mobileDrawerOpen ? 'Hide Players' : 'Show Players'}
          </button>
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
              GAME OVER!
            </h2>
            <p className="text-base font-bold text-indian-navy-900 dark:text-indian-parchment-100 mb-4">
              👑 {winner?.displayName} has conquered the board!
            </p>

            <div className="flex gap-2">
              <Button
                variant="primary"
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
        <div
          className={`h-full overflow-hidden flex-col justify-start w-32 sm:w-36 md:w-40 shrink-0 ${
            mobileDrawerOpen ? 'flex absolute inset-y-12 left-2 z-40 bg-white dark:bg-indian-navy-900 p-2 rounded-xl shadow-xl' : 'hidden sm:flex'
          }`}
        >
          <PlayerStrip
            players={gameState.players}
            currentPlayerUid={gameState.currentPlayerUid}
            properties={gameState.properties}
            transactions={gameState.transactions}
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
            onDismissCardPopup={() => {}}
            onDismissMoneyAck={() => {}}
            onDispatch={dispatchAction}
            isMyTurn={isMyTurn && !walkingAnimation}
            userUid={player?.uid || 'player_1'}
            lastEvent={events[0]}
            walkingAnimation={walkingAnimation}
          />
        </div>
      </div>
    </div>
  );
};
