import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameStore } from './use-game-store';
import { useAuthStore } from '@/features/auth/use-auth-store';
import { useRoomStore } from '@/features/rooms/use-room-store';
import { GameBoard } from '@/components/board/GameBoard';
import { PlayerStrip } from '@/components/player/PlayerStrip';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Trophy, ArrowLeft, AlertCircle, Users, Loader2, Flag, Clock } from 'lucide-react';
import confetti from 'canvas-confetti';
import { getSocket } from '@/lib/socket/socket-client';
import { calculateNetWorth, formatGameTimer } from '@/domain/ruleset';

const GameElapsedTimer: React.FC<{
  startedAt?: number;
  completedAt?: number | null;
  status?: string;
  totalGameTimeSeconds?: number;
}> = React.memo(({ startedAt, completedAt, status, totalGameTimeSeconds }) => {
  const [elapsed, setElapsed] = useState<number>(() => {
    if (!startedAt) return 0;
    if (typeof totalGameTimeSeconds === 'number') return totalGameTimeSeconds;
    const end = completedAt || Date.now();
    return Math.max(0, Math.floor((end - startedAt) / 1000));
  });

  useEffect(() => {
    if (!startedAt) return;
    if (status === 'COMPLETED') {
      const end = completedAt || Date.now();
      setElapsed(Math.max(0, Math.floor((end - startedAt) / 1000)));
      return;
    }
    if (typeof totalGameTimeSeconds === 'number') {
      setElapsed(totalGameTimeSeconds);
    }
    const timer = setInterval(() => {
      const end = completedAt || Date.now();
      setElapsed(Math.max(0, Math.floor((end - startedAt) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [startedAt, completedAt, status, totalGameTimeSeconds]);

  return <span>{formatGameTimer(elapsed)}</span>;
});

export const GamePage: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { player } = useAuthStore();
  const { currentRoom } = useRoomStore();
  const {
    gameState,
    events,
    selectedSpaceIndex,
    isRolling,
    pendingCommandType,
    walkingAnimation,
    error,
    initializeGameFromRoom,
    dispatchAction,
    selectSpace,
    dismissError,
  } = useGameStore();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const handleRollDice = useCallback(() => {
    dispatchAction('ROLL_DICE');
  }, [dispatchAction]);

  const handleDispatch = useCallback((commandType: Parameters<typeof dispatchAction>[0], payload?: Record<string, unknown>) => {
    dispatchAction(commandType, payload);
  }, [dispatchAction]);

  const handleSelectSpace = useCallback((index: number | null) => {
    selectSpace(index);
  }, [selectSpace]);

  const handleGiveUp = useCallback(() => {
    if (gameState?.currentPlayerUid === (player?.uid || 'player_1')) {
      dispatchAction('GIVE_UP');
    }
  }, [gameState?.currentPlayerUid, player?.uid, dispatchAction]);

  // Handle Game Initialization: multiplayer match requires real room members or derived room
  useEffect(() => {
    if (!gameId) {
      navigate('/');
      return;
    }

    const socket = getSocket();

    let cleanupRoom: (() => void) | undefined;
    // Late replies for a game we already navigated away from must never be applied
    let cancelled = false;

    const joinGameSession = () => {
      // Authoritatively join game room on the server to retrieve active state and attach presence
      socket.emit('game:join', { gameId }, (response) => {
        if (cancelled) return;
        if (response?.ok && response.gameState && response.gameState.gameId !== gameId) return;
        if (response && response.ok) {
          if (response.gameState) {
            useGameStore.getState().setLiveGameState(response.gameState);
            useGameStore.getState().setError(null);
          }
          if (response.room) {
            useRoomStore.setState({ currentRoom: response.room, activeRoomId: response.room.roomId });
            if (!cleanupRoom && response.room.members && Object.keys(response.room.members).length >= 1) {
              cleanupRoom = initializeGameFromRoom(
                response.room.roomId,
                gameId,
                response.room.members,
                response.room.customRules
              );
            }
          }
        } else {
          const errMsg =
            response?.error === 'Game not found'
              ? 'The game server restarted or the room expired. Please create or join a new room.'
              : response?.error || 'Game session unavailable. Please return to Play Hub.';
          useGameStore.getState().setError(errMsg);
        }
      });
    };

    if (socket.connected) {
      joinGameSession();
    } else {
      socket.once('connect', joinGameSession);
    }

    socket.on('connect', joinGameSession);

    if (currentRoom && currentRoom.members && Object.keys(currentRoom.members).length >= 1) {
      cleanupRoom = initializeGameFromRoom(
        currentRoom.roomId,
        gameId,
        currentRoom.members,
        currentRoom.customRules
      );
    }

    return () => {
      cancelled = true;
      socket.off('connect', joinGameSession);
      if (cleanupRoom) cleanupRoom();
    };
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

  if (error && !gameState) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <Card className="max-w-md w-full p-6 border-red-300 dark:border-red-900 shadow-xl space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="font-serif font-black text-xl text-red-700 dark:text-red-400">
            Game Unavailable
          </h2>
          <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
            {error}
          </p>
          <Button onClick={() => navigate('/')} variant="primary" className="w-full font-bold">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Return to Play Hub
          </Button>
        </Card>
      </div>
    );
  }

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
    <div className="h-[calc(100dvh-50px)] max-h-screen overflow-hidden flex flex-col justify-between w-full max-w-none px-2 sm:px-3 py-1 gap-1 select-none pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      {/* Top Header Bar */}
      <div className="relative flex items-center justify-between pb-1 border-b border-indian-parchment-300 dark:border-indian-navy-700 shrink-0">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-xs font-bold text-indian-navy-700 dark:text-indian-parchment-300 hover:text-indian-terracotta-600 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Exit Room
        </button>

        {/* Synchronized Total Game Duration Timer (centered in header bar) */}
        <div
          data-testid="game-timer"
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 font-mono text-xs sm:text-sm font-bold text-indian-navy-900 dark:text-indian-parchment-100 bg-indian-parchment-200/80 dark:bg-indian-navy-800/80 px-2.5 py-0.5 rounded-lg border border-indian-parchment-300 dark:border-indian-navy-700 shadow-sm pointer-events-none select-none"
          title="Total gameplay duration"
        >
          <Clock className="w-3.5 h-3.5 text-indian-terracotta-600 dark:text-indian-gold-400 shrink-0" />
          <GameElapsedTimer
            startedAt={gameState.startedAt}
            completedAt={gameState.completedAt}
            status={gameState.status}
            totalGameTimeSeconds={gameState.totalGameTimeSeconds}
          />
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="navy" className="text-xs font-bold flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {`Room #${gameState.roomId.replace('room_', '').slice(0, 6).toUpperCase()}`}
          </Badge>
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

      {/* Victory / Game Over Modal with Comprehensive Scoreboard */}
      {gameState.status === 'COMPLETED' && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in select-none">
          <Card className="max-w-xl w-full p-6 text-center border-2 border-indian-gold-500 shadow-2xl bg-white dark:bg-indian-navy-900 overflow-hidden flex flex-col gap-4">
            <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 mx-auto flex items-center justify-center border border-amber-300 shadow-md">
              <Trophy className="w-8 h-8" />
            </div>

            <div>
              <h2 className="font-serif font-black text-2xl text-indian-terracotta-600 mb-1">
                GAME OVER
              </h2>
              {gameState.isTie ? (
                <p className="text-base font-bold text-indian-navy-900 dark:text-indian-parchment-100">
                  🤝 It&apos;s a Tie! Highest Net Worth: ₹{(winner?.netWorth ?? calculateNetWorth(winner?.uid || '', winner?.cash || 0, gameState.properties, gameState.pendingFinancialObligation)).toLocaleString('en-IN')}
                </p>
              ) : (
                <p className="text-base font-bold text-indian-navy-900 dark:text-indian-parchment-100">
                  👑 {winner?.displayName || 'Champion'} wins with Net Worth ₹{(winner?.netWorth ?? calculateNetWorth(winner?.uid || '', winner?.cash || 0, gameState.properties, gameState.pendingFinancialObligation)).toLocaleString('en-IN')}!
                </p>
              )}

              {gameState.gameOverReason && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs font-semibold">
                  <Flag className="w-3.5 h-3.5 shrink-0" />
                  <span>{gameState.gameOverReason}</span>
                  {gameState.disqualifiedPlayerName && (
                    <span className="font-bold">({gameState.disqualifiedPlayerName})</span>
                  )}
                </div>
              )}
            </div>

            {/* Scoreboard Table (Ranked by Authoritative Net Worth) */}
            <div className="border border-indian-parchment-300 dark:border-indian-navy-700 rounded-xl overflow-hidden text-left">
              <div className="bg-indian-parchment-200 dark:bg-indian-navy-800/80 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 grid grid-cols-12 gap-2">
                <span className="col-span-1 text-center">#</span>
                <span className="col-span-4">Player</span>
                <span className="col-span-3 text-right">Net Worth</span>
                <span className="col-span-2 text-right">Cash</span>
                <span className="col-span-2 text-center">Status</span>
              </div>
              <div className="divide-y divide-indian-parchment-200 dark:divide-indian-navy-800 max-h-48 overflow-y-auto">
                {[...gameState.players]
                  .map((p) => ({
                    ...p,
                    computedNetWorth: calculateNetWorth(p.uid, p.cash, gameState.properties, gameState.pendingFinancialObligation),
                  }))
                  .sort((a, b) => {
                    if (a.uid === gameState.winnerUid && !gameState.isTie) return -1;
                    if (b.uid === gameState.winnerUid && !gameState.isTie) return 1;
                    if (b.computedNetWorth !== a.computedNetWorth) return b.computedNetWorth - a.computedNetWorth;
                    if (b.cash !== a.cash) return b.cash - a.cash;
                    return a.uid.localeCompare(b.uid);
                  })
                  .map((p, idx) => {
                    const isWinner = p.uid === gameState.winnerUid && !gameState.isTie;
                    const isDisqualified = p.uid === gameState.disqualifiedPlayerUid;
                    const netWorth = p.computedNetWorth;

                    return (
                      <div
                        key={p.uid}
                        className={`px-3 py-2 text-xs grid grid-cols-12 gap-2 items-center ${
                          isWinner ? 'bg-amber-50/70 dark:bg-amber-950/30 font-bold' : ''
                        }`}
                      >
                        <span className="col-span-1 text-center text-gray-500 font-bold">
                          {idx + 1}
                        </span>
                        <div className="col-span-4 flex items-center gap-1.5 truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: p.colorToken }}
                          />
                          <span className="truncate">{p.displayName}</span>
                          {(p.isCpu || p.playerType === 'COMPUTER') && (
                            <span className="px-1 py-0.2 rounded text-[7px] font-black bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 shrink-0">
                              CPU
                            </span>
                          )}
                        </div>
                        <span className="col-span-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          ₹{netWorth.toLocaleString('en-IN')}
                        </span>
                        <span className="col-span-2 text-right font-mono text-gray-600 dark:text-gray-300">
                          ₹{p.cash.toLocaleString('en-IN')}
                        </span>
                        <div className="col-span-2 text-center">
                          {isWinner ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                              Winner 🏆
                            </span>
                          ) : isDisqualified ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border border-red-300">
                              {gameState.gameOverReason === 'PLAYER_DISQUALIFIED' ? 'Disqualified' : 'Surrendered'}
                            </span>
                          ) : p.isBankrupt ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                              Bankrupt
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                              Active
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="primary"
                data-testid="close-finished-game"
                onClick={() => {
                  // Game is over: delete it everywhere and leave the room, then go home.
                  useGameStore.getState().closeFinishedGame(gameState.gameId);
                  useRoomStore.getState().leaveRoom();
                  navigate('/');
                }}
                className="flex-1 font-bold py-2.5"
              >
                Close Game
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
            pendingFinancialObligation={gameState.pendingFinancialObligation}
            transactions={gameState.transactions}
            turnTimeRemaining={gameState.turnTimeRemaining}
            turnTimeLimit={gameState.turnTimeLimit}
            isTimerPaused={Boolean(
              gameState.isTimerPaused ||
              walkingAnimation ||
              gameState.handoff?.isActive ||
              (gameState.movement && !gameState.movement.isComplete)
            )}
            onSelectPlayer={() => {}}
            onSelectSpace={handleSelectSpace}
            userUid={player?.uid || 'player_1'}
            onGiveUp={handleGiveUp}
          />
        </div>

        {/* Center Canvas: Full-Size Game Board (Enlarged across all available screen space) */}
        <div className="flex-1 flex items-center justify-center h-full max-h-full min-h-0 min-w-0 overflow-hidden">
          <GameBoard
            gameState={gameState}
            selectedSpaceIndex={selectedSpaceIndex}
            onSelectSpace={handleSelectSpace}
            isRolling={isRolling}
            pendingCommandType={pendingCommandType}
            onRollDice={handleRollDice}
            onDismissCardPopup={() => {}}
            onDismissMoneyAck={() => {}}
            onDispatch={handleDispatch}
            isMyTurn={
              isMyTurn &&
              !walkingAnimation &&
              !gameState.handoff?.isActive &&
              (!gameState.movement || gameState.movement.isComplete)
            }
            userUid={player?.uid || 'player_1'}
            lastEvent={events[0]}
            walkingAnimation={walkingAnimation}
          />
        </div>
      </div>
    </div>
  );
};
