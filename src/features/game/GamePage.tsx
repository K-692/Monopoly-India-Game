import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from './use-game-store';
import { useAuthStore } from '@/features/auth/use-auth-store';
import { GameBoard } from '@/components/board/GameBoard';
import { SpaceDeedInspector } from '@/components/board/SpaceDeedInspector';
import { BOARD_SPACES } from '@/domain/board-config';
import { PlayerStrip } from '@/components/player/PlayerStrip';
import { ActionPanel } from '@/components/player/ActionPanel';
import { EventTicker } from '@/components/feedback/EventTicker';
import { ReactionTray } from '@/components/feedback/ReactionTray';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Trophy, ArrowLeft, AlertCircle, ChevronUp, ChevronDown } from 'lucide-react';
import confetti from 'canvas-confetti';

export const GamePage: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { player } = useAuthStore();
  const {
    gameState,
    events,
    activeEmotes,
    selectedSpaceIndex,
    isRolling,
    walkingAnimation,
    error,
    initializeDemoGame,
    selectSpace,
    dispatchAction,
    sendEmote,
    dismissError,
  } = useGameStore();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    if (!gameState) {
      initializeDemoGame(player?.displayName || 'Player');
    }
  }, [gameState, initializeDemoGame, player]);

  // Turn timer interval
  useEffect(() => {
    if (!gameState || gameState.status === 'COMPLETED') return;
    const interval = setInterval(() => {
      const remaining = (gameState.turnTimeRemaining ?? 30) - 1;
      if (remaining <= 0) {
        // Auto-action on timer expiry
        if (gameState.phase === 'AWAIT_ROLL') {
          dispatchAction('ROLL_DICE');
        } else if (gameState.phase === 'PROPERTY_DECISION') {
          dispatchAction('DECLINE_PROPERTY');
        } else {
          dispatchAction('END_TURN');
        }
      } else {
        useGameStore.setState({
          gameState: {
            ...gameState,
            turnTimeRemaining: remaining,
          },
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState, dispatchAction]);

  // Victory celebration trigger
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
          Loading Board...
        </p>
      </div>
    );
  }

  const isMyTurn = !player || player.uid === gameState.currentPlayerUid || gameState.currentPlayerUid === 'player_1';
  const winner = gameState.players.find((p) => p.uid === gameState.winnerUid);

  return (
    <div className="h-[calc(100dvh-54px)] max-h-screen overflow-hidden flex flex-col justify-between w-full max-w-none px-2 sm:px-3 py-1 gap-1 select-none">
      {/* Top Game Bar */}
      <div className="flex items-center justify-between pb-1.5 border-b border-indian-parchment-300 dark:border-indian-navy-700 shrink-0">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-xs font-bold text-indian-navy-700 dark:text-indian-parchment-300 hover:text-indian-terracotta-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Exit Room
        </button>

        <div className="flex items-center gap-2">
          <Badge variant="terracotta" className="text-xs font-bold">
            Room: {gameId || 'Match'}
          </Badge>
          <span className="text-xs text-gray-500 font-mono">
            Turn #{gameState.turnNumber}
          </span>
        </div>

        {/* Mobile Toggle Player List */}
        <button
          onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
          className="lg:hidden text-xs font-bold flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-indian-parchment-300 shadow-xs"
        >
          <span>Players</span>
          {mobileDrawerOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Error Notification Banner */}
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

      {/* Victory Celebration Modal Overlay */}
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
              👑 {winner?.displayName || 'A Player'} is the Sovereign Tycoon!
            </p>

            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={() => initializeDemoGame(player?.displayName)}
                className="flex-1 font-bold"
              >
                Rematch
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

      {/* Main 3-Column Non-Scrollable Canvas with Stretched Board and Compact Left Panel */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[210px_1fr_250px] xl:grid-cols-[230px_1fr_270px] gap-2 items-stretch overflow-hidden min-h-0">
        {/* Left Column: Player Strip & Space Deed Inspector */}
        <div
          className={`h-full overflow-hidden justify-between pr-0.5 gap-1.5 min-w-0 ${
            mobileDrawerOpen ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'
          }`}
        >
          <PlayerStrip
            players={gameState.players}
            currentPlayerUid={gameState.currentPlayerUid}
            properties={gameState.properties}
            turnTimeRemaining={gameState.turnTimeRemaining}
            turnTimeLimit={gameState.turnTimeLimit}
            onSelectPlayer={(uid) => {
              const p = gameState.players.find((pl) => pl.uid === uid);
              if (p) selectSpace(p.position);
            }}
            onSelectSpace={selectSpace}
          />

          {/* Selected Space Deed Inspector */}
          <SpaceDeedInspector
            space={selectedSpaceIndex !== null ? BOARD_SPACES[selectedSpaceIndex] : null}
            propertyState={selectedSpaceIndex !== null ? gameState.properties[selectedSpaceIndex] : null}
            players={gameState.players}
            isOwner={
              selectedSpaceIndex !== null &&
              gameState.properties[selectedSpaceIndex]?.ownerUid === player?.uid
            }
            onDispatch={dispatchAction}
          />
        </div>

        {/* Center Column: The 40-Space Board (Stretched Left-to-Right Covering Maximum Window) */}
        <div className="flex items-center justify-center h-full max-h-full min-h-0 min-w-0 overflow-hidden py-0.5">
          <GameBoard
            gameState={gameState}
            selectedSpaceIndex={selectedSpaceIndex}
            onSelectSpace={selectSpace}
            isRolling={isRolling}
            onRollDice={() => dispatchAction('ROLL_DICE')}
            isMyTurn={isMyTurn && !walkingAnimation}
            lastEvent={events[0]}
            walkingAnimation={walkingAnimation}
          />
        </div>

        {/* Right Column: Actions, Live Activity & My Info with Click Portfolio */}
        <div className="hidden lg:flex lg:flex-col justify-between h-full overflow-hidden pl-0.5 min-w-0">
          <ActionPanel
            gameState={gameState}
            selectedSpaceIndex={selectedSpaceIndex}
            onDispatch={dispatchAction}
            isRolling={isRolling}
            userUid={player?.uid}
          />
        </div>
      </div>

      {/* Bottom Tray: Live Activity Ticker & Reaction Tray */}
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
