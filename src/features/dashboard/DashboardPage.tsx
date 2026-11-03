import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/use-auth-store';
import { useRoomStore } from '@/features/rooms/use-room-store';
import { useGameStore } from '@/features/game/use-game-store';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PlusCircle, KeyRound, Dices, Users, ShieldCheck, Trophy } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { createRoom, joinRoom, error: roomError, setError } = useRoomStore();
  const { initializeDemoGame } = useGameStore();

  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const handleCreateRoom = async () => {
    if (!user) return;
    setIsCreating(true);
    try {
      const roomId = await createRoom({
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
      });
      navigate(`/room/${roomId}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !joinCodeInput.trim()) return;
    setIsJoining(true);
    try {
      const success = await joinRoom(joinCodeInput, {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
      });
      if (success) {
        navigate(`/room/room_${joinCodeInput.trim().toUpperCase()}`);
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleQuickPlay = () => {
    initializeDemoGame(user?.displayName || 'Maharaja Player');
    navigate('/game/demo');
  };

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
      {/* Welcome Banner */}
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-indian-parchment-300 dark:border-indian-navy-700">
        <div>
          <h1 className="font-serif font-black text-2xl sm:text-3xl text-indian-terracotta-600 dark:text-indian-terracotta-400">
            Namaste, {user?.displayName || 'Player'}!
          </h1>
          <p className="text-xs sm:text-sm text-indian-navy-700 dark:text-indian-parchment-300">
            Your unique friend code: <strong className="font-mono text-indian-terracotta-600 bg-indian-terracotta-50 px-2 py-0.5 rounded border border-indian-terracotta-200">{user?.friendCode || 'XXXXXX'}</strong>
          </p>
        </div>

        <Button
          size="md"
          variant="outline"
          onClick={handleQuickPlay}
          className="text-xs font-bold flex items-center gap-1.5"
        >
          <Dices className="w-4 h-4 text-indian-terracotta-500" />
          <span>Quick Practice Match</span>
        </Button>
      </div>

      {roomError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
          <span>{roomError}</span>
          <button onClick={() => setError(null)} className="font-bold underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        {/* Create Private Room Card */}
        <Card className="p-5 flex flex-col justify-between border-indian-parchment-300">
          <div>
            <div className="w-10 h-10 rounded-xl bg-indian-terracotta-100 text-indian-terracotta-600 flex items-center justify-center mb-3">
              <PlusCircle className="w-5 h-5" />
            </div>
            <h3 className="font-serif font-bold text-lg text-indian-navy-900 dark:text-indian-parchment-100 mb-1">
              Create Private Room
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
              Host a private room for 2 to 6 players. Share your 6-character room code or invite link.
            </p>
          </div>

          <Button
            size="lg"
            variant="primary"
            isLoading={isCreating}
            onClick={handleCreateRoom}
            className="w-full font-bold shadow-sm"
          >
            Create Room & Lobby
          </Button>
        </Card>

        {/* Join Room Card */}
        <Card className="p-5 flex flex-col justify-between border-indian-parchment-300">
          <div>
            <div className="w-10 h-10 rounded-xl bg-indian-navy-100 text-indian-navy-700 flex items-center justify-center mb-3">
              <KeyRound className="w-5 h-5" />
            </div>
            <h3 className="font-serif font-bold text-lg text-indian-navy-900 dark:text-indian-parchment-100 mb-1">
              Join with Room Code
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
              Have an invitation code from a friend? Enter it below to join their lobby.
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

      {/* Highlights & Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card
          onClick={() => navigate('/friends')}
          className="p-4 cursor-pointer hover:border-indian-terracotta-400 transition-all flex items-center gap-3"
        >
          <div className="w-9 h-9 rounded-lg bg-indian-gold-100 text-indian-gold-800 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-indian-navy-900 dark:text-indian-parchment-100">
              Manage Friends
            </h4>
            <span className="text-[10px] text-gray-500">Add by friend code</span>
          </div>
        </Card>

        <Card
          onClick={() => navigate('/history')}
          className="p-4 cursor-pointer hover:border-indian-terracotta-400 transition-all flex items-center gap-3"
        >
          <div className="w-9 h-9 rounded-lg bg-indian-emerald-500/10 text-indian-emerald-600 flex items-center justify-center">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-indian-navy-900 dark:text-indian-parchment-100">
              Game Archives
            </h4>
            <span className="text-[10px] text-gray-500">Past standings & results</span>
          </div>
        </Card>

        <Card
          onClick={() => navigate('/settings')}
          className="p-4 cursor-pointer hover:border-indian-terracotta-400 transition-all flex items-center gap-3"
        >
          <div className="w-9 h-9 rounded-lg bg-indian-navy-100 text-indian-navy-700 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-indian-navy-900 dark:text-indian-parchment-100">
              Game Settings
            </h4>
            <span className="text-[10px] text-gray-500">Audio, theme & access</span>
          </div>
        </Card>
      </div>
    </div>
  );
};
