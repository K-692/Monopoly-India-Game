import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/use-auth-store';
import { useRoomStore } from '@/features/rooms/use-room-store';
import { CreateRoomRulesModal } from '@/components/rooms/CreateRoomRulesModal';
import { HostCustomRules } from '@/domain/ruleset';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { KeyRound, SlidersHorizontal, Sparkles, Dices, Bot, ArrowRight, Wifi, WifiOff } from 'lucide-react';
import { getSocket } from '@/lib/socket/socket-client';

export const PlayPage: React.FC = () => {
  const navigate = useNavigate();
  const { player, openNamePrompt } = useAuthStore();
  const { createRoom, joinRoom, error: roomError, setError, lanInfo, fetchLanInfo } = useRoomStore();

  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  useEffect(() => {
    fetchLanInfo();
    const socket = getSocket();

    const updateConnection = () => {
      setIsSocketConnected(socket.connected);
    };

    updateConnection();
    socket.on('connect', updateConnection);
    socket.on('disconnect', updateConnection);

    return () => {
      socket.off('connect', updateConnection);
      socket.off('disconnect', updateConnection);
    };
  }, [fetchLanInfo]);

  // Practice Match Trigger (Isolated Sandbox Mode)
  const handleLaunchPractice = () => {
    if (!player) {
      openNamePrompt('/practice');
      return;
    }
    navigate('/practice');
  };

  // Host Create Room with Custom Rules
  const handleOpenCreateModal = () => {
    if (!player) {
      openNamePrompt();
      return;
    }
    setIsRulesModalOpen(true);
  };

  const handleCreateWithRules = async (rules: HostCustomRules) => {
    if (!player) return;
    setIsCreating(true);
    try {
      const roomId = await createRoom(
        {
          uid: player.uid,
          displayName: player.displayName,
          photoURL: null,
        },
        rules
      );
      setIsRulesModalOpen(false);
      navigate(`/room/${roomId}`);
    } catch {
      // Error is set in room store
    } finally {
      setIsCreating(false);
    }
  };

  // Join Room with Code
  const handleJoinWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = joinCodeInput.trim().toUpperCase();
    if (!cleanCode) return;

    if (!player) {
      openNamePrompt(`/join/${cleanCode}`);
      return;
    }

    setIsJoining(true);
    try {
      const result = await joinRoom(cleanCode, {
        uid: player.uid,
        displayName: player.displayName,
        photoURL: null,
      });
      if (result.ok && result.roomId) {
        navigate(`/room/${result.roomId}`);
      }
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full px-4 py-6">
      <div className="max-w-5xl mx-auto">
        {/* Hero Welcome */}
        <div className="text-center max-w-2xl mx-auto mb-6">
          <Badge variant="gold" className="mb-2 px-3 py-1 text-xs font-bold">
            🇮🇳 Real-Time Indian Property Trading
          </Badge>
          <h1 className="font-serif font-black text-3xl sm:text-5xl text-indian-terracotta-600 dark:text-indian-terracotta-400 tracking-tight leading-none mb-2">
            INDIAN MONOPOLY
          </h1>
          <p className="text-xs sm:text-sm text-indian-navy-700 dark:text-indian-parchment-300 font-medium">
            Buy Jaipur MI Road, Marine Drive, and Cyber Towers. Roll in-board dice, navigate Civic Fund events, and out-trade rivals across your Wi-Fi LAN.
          </p>
        </div>

        {/* LAN Server Connection Status Indicator */}
        <div className="mb-5 flex items-center justify-center">
          {isSocketConnected ? (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>LAN Multiplayer Server: Online</span>
              {lanInfo?.primaryLanAddress && (
                <span className="text-[11px] font-mono bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded text-emerald-900 dark:text-emerald-200">
                  {lanInfo.primaryLanAddress}:{lanInfo.port}
                </span>
              )}
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-medium">
              <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>LAN Server: Offline or Connecting. Launch with <code className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1.5 py-0.5 rounded">npm run lan:host</code></span>
            </div>
          )}
        </div>

        {roomError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center justify-between">
            <span>{roomError}</span>
            <button onClick={() => setError(null)} className="font-bold underline ml-2 cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        {/* FEATURED: PRACTICE MATCH (SANDBOX TESTER) */}
        <Card className="p-5 sm:p-6 mb-8 border-2 border-indian-gold-500 bg-gradient-to-r from-amber-500/10 via-amber-50/60 to-white dark:from-indian-navy-800 dark:to-indian-navy-900 shadow-md relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="p-1 rounded-md bg-amber-500 text-white shadow-xs">
                  <Bot className="w-4 h-4" />
                </span>
                <span className="text-xs font-extrabold uppercase tracking-widest text-amber-900 dark:text-amber-400">
                  Gameplay Sandbox
                </span>
                <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                  Practice Match
                </span>
              </div>

              <h3 className="font-serif font-bold text-lg sm:text-xl text-indian-navy-900 dark:text-white mb-1">
                Launch Solo Practice Match
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                Test all gameplay features on the non-scrollable board: in-board dice rolling, turn timers, Civic & Market buzz cards, property building, and trading with simulated tycoons.
              </p>
            </div>

            <Button
              size="lg"
              variant="primary"
              onClick={handleLaunchPractice}
              className="w-full md:w-auto font-bold px-6 py-3 shadow-md flex items-center justify-center gap-2 bg-gradient-to-r from-indian-gold-600 to-indian-terracotta-500 hover:from-indian-gold-700 hover:to-indian-terracotta-600 shrink-0 text-sm cursor-pointer"
            >
              <Dices className="w-4 h-4" />
              <span>Launch Practice Match</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>

        {/* MULTIPLAYER PRIVATE ROOMS: HOST & JOIN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          {/* Create Room Card */}
          <Card className="p-5 flex flex-col justify-between border-indian-parchment-300">
            <div>
              <div className="w-10 h-10 rounded-xl bg-indian-terracotta-100 text-indian-terracotta-600 flex items-center justify-center mb-3">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <h3 className="font-serif font-bold text-lg text-indian-navy-900 dark:text-indian-parchment-100 mb-1">
                Host Multiplayer Room
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                Create a private room on your local Wi-Fi. Configure starting cash, turn timers (15s–60s), pass START rewards, and share your LAN URL or 6-character code with friends.
              </p>
            </div>

            <Button
              size="lg"
              variant="primary"
              isLoading={isCreating}
              onClick={handleOpenCreateModal}
              className="w-full font-bold shadow-sm flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Customize Rules & Host</span>
            </Button>
          </Card>

          {/* Join Room with Code Card */}
          <Card className="p-5 flex flex-col justify-between border-indian-parchment-300">
            <div>
              <div className="w-10 h-10 rounded-xl bg-indian-navy-100 text-indian-navy-700 flex items-center justify-center mb-3">
                <KeyRound className="w-5 h-5" />
              </div>
              <h3 className="font-serif font-bold text-lg text-indian-navy-900 dark:text-indian-parchment-100 mb-1">
                Join with Room Code
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                Connected to the same Wi-Fi? Enter the 6-character invitation code from the host laptop to join instantly.
              </p>
            </div>

            <form onSubmit={handleJoinWithCode} className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. 7K4MN2"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                maxLength={8}
                className="flex-1 bg-white dark:bg-indian-navy-900 border border-indian-parchment-400 dark:border-indian-navy-700 rounded-lg px-3 py-2 text-sm font-mono tracking-widest text-center uppercase focus:outline-none focus:ring-2 focus:ring-indian-terracotta-500"
              />
              <Button
                type="submit"
                variant="secondary"
                isLoading={isJoining}
                disabled={joinCodeInput.trim().length < 4}
                className="font-bold text-xs px-5"
              >
                Join
              </Button>
            </form>
          </Card>
        </div>

        {/* Rules Customization Modal */}
        <CreateRoomRulesModal
          isOpen={isRulesModalOpen}
          onClose={() => setIsRulesModalOpen(false)}
          onCreate={handleCreateWithRules}
          isLoading={isCreating}
        />
      </div>
    </div>
  );
};
