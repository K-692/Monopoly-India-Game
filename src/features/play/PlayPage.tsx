import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/use-auth-store';
import { useRoomStore } from '@/features/rooms/use-room-store';
import { CreateRoomRulesModal } from '@/components/rooms/CreateRoomRulesModal';
import { HostCustomRules } from '@/domain/ruleset';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { KeyRound, SlidersHorizontal, Sparkles, AlertCircle, Dices, Bot, ArrowRight } from 'lucide-react';
import { isFirebaseConfigured, firebaseConfigError } from '@/lib/firebase/firebase-config';

export const PlayPage: React.FC = () => {
  const navigate = useNavigate();
  const { player, openNamePrompt } = useAuthStore();
  const { createRoom, joinRoom, error: roomError, setError } = useRoomStore();

  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

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
    if (!isFirebaseConfigured) {
      setError(firebaseConfigError || 'Firebase configuration is incomplete.');
      return;
    }
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

    if (!isFirebaseConfigured) {
      setError(firebaseConfigError || 'Firebase configuration is incomplete.');
      return;
    }

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
          Buy Jaipur MI Road, Marine Drive, and Cyber Towers. Roll in-board dice, navigate Civic Fund events, and out-trade rivals.
        </p>
      </div>

      {roomError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
          <span>{roomError}</span>
          <button onClick={() => setError(null)} className="font-bold underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {!isFirebaseConfigured && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            <strong>Multiplayer Backend Notice:</strong> {firebaseConfigError} Offline Sandbox Practice match below is fully playable.
          </span>
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
              Create a private room. Configure starting cash, turn timers (15s–60s), pass START rewards, and max players before sharing your link.
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
              Have an invitation code from a friend? Enter it below to join their live room directly.
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
