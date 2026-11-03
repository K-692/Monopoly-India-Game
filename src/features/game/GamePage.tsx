import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from './use-game-store';
import { useAuthStore } from '@/features/auth/use-auth-store';
import { GameBoard } from '@/components/board/GameBoard';
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
  const { user } = useAuthStore();
  const {
    gameState,
    events,
    activeEmotes,
    selectedSpaceIndex,
    isRolling,
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
      initializeDemoGame(user?.displayName || 'Maharaja Player');
    }
  }, [gameState, initializeDemoGame, user]);

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
          Preparing the Indian board...
        </p>
      </div>
    );
  }

  const winner = gameState.players.find((p) => p.uid === gameState.winnerUid);

  return (
    <div className="flex-1 flex flex-col justify-between w-full max-w-[1600px] mx-auto px-2 sm:px-4 py-2 sm:py-4 gap-2">
      {/* Top Game Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-indian-parchment-300 dark:border-indian-navy-700">
        <button
          onClick={() => navigate('/home')}
          className="flex items-center gap-1.5 text-xs font-semibold text-indian-navy-700 dark:text-indian-parchment-300 hover:text-indian-terracotta-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Leave Game
        </button>

        <div className="flex items-center gap-2">
          <Badge variant="terracotta" className="text-xs font-bold">
            Live Game: {gameId || 'Demo Match'}
          </Badge>
          <Badge variant="neutral" className="text-xs">
            v{gameState.version}
          </Badge>
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
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center justify-between animate-fade-in">
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

            <div className="mb-6 space-y-2 text-left bg-indian-parchment-100 dark:bg-indian-navy-800 p-3 rounded-lg border border-indian-parchment-300">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Final Standings
              </h4>
              {gameState.players
                .slice()
                .sort((a, b) => b.netWorth - a.netWorth)
                .map((p, idx) => (
                  <div key={p.uid} className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-indian-navy-900 dark:text-indian-parchment-100">
                      #{idx + 1} {p.displayName}
                    </span>
                    <span className="font-bold text-emerald-700">
                      ₹{p.netWorth.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
            </div>

            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={() => initializeDemoGame(user?.displayName)}
                className="flex-1 font-bold"
              >
                Rematch
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/home')}
                className="flex-1 font-bold"
              >
                Return to Dashboard
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Main 3-Column Responsive Workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-start">
        {/* Left Column: Player Strip (Desktop persistent, Mobile collapsible drawer) */}
        <div
          className={`lg:col-span-3 lg:block ${
            mobileDrawerOpen ? 'block' : 'hidden'
          }`}
        >
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

        {/* Center Column: The 40-Space Board */}
        <div className="col-span-1 lg:col-span-6 flex flex-col items-center justify-center">
          <GameBoard
            gameState={gameState}
            selectedSpaceIndex={selectedSpaceIndex}
            onSelectSpace={selectSpace}
            isRolling={isRolling}
          />
        </div>

        {/* Right Column: Actions, Property Deed Details & Management */}
        <div className="col-span-1 lg:col-span-3 w-full">
          <ActionPanel
            gameState={gameState}
            selectedSpaceIndex={selectedSpaceIndex}
            onDispatch={dispatchAction}
            isRolling={isRolling}
            userUid={user?.uid}
          />
        </div>
      </div>

      {/* Bottom Tray: Live Activity Ticker & Reaction Tray */}
      <div className="mt-2 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="w-full sm:flex-1">
          <EventTicker events={events} />
        </div>
        <div className="shrink-0">
          <ReactionTray
            onSendEmote={(emote) => sendEmote(emote, user?.displayName || 'Player')}
            activeEmotes={activeEmotes}
          />
        </div>
      </div>
    </div>
  );
};
