import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, PLAYER_COLORS } from '@/features/auth/use-auth-store';
import { useRoomStore } from '@/features/rooms/use-room-store';
import { CreateRoomRulesModal } from '@/components/rooms/CreateRoomRulesModal';
import { HostCustomRules } from '@/domain/ruleset';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  KeyRound,
  SlidersHorizontal,
  Sparkles,
  Wifi,
  WifiOff,
  UserCheck,
  Edit2,
  Lock,
  Check,
  AlertCircle,
} from 'lucide-react';
import { getSocket } from '@/lib/socket/socket-client';

export const PlayPage: React.FC = () => {
  const navigate = useNavigate();
  const { player, setPlayerName } = useAuthStore();
  const { createRoom, joinRoom, error: roomError, setError, lanInfo, fetchLanInfo } = useRoomStore();

  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  // Requirement 6: Inline Username Setup State & Validation
  const isValidUsername = (name?: string | null): boolean => {
    if (!name) return false;
    const trimmed = name.trim();
    return trimmed.length >= 2 && trimmed.length <= 20 && /^[a-zA-Z0-9 _-]+$/.test(trimmed);
  };

  const hasUsername = isValidUsername(player?.displayName);
  const [usernameInput, setUsernameInput] = useState(player?.displayName || '');
  const [selectedColor, setSelectedColor] = useState(player?.avatarColor || PLAYER_COLORS[0]);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(!hasUsername);
  const [isSavingName, setIsSavingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (player?.displayName && isValidUsername(player.displayName)) {
      setUsernameInput(player.displayName);
      if (player.avatarColor) setSelectedColor(player.avatarColor);
      setIsEditingName(false);
    } else {
      setIsEditingName(true);
    }
  }, [player]);

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

  const validateInput = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'Player name is required.';
    }
    if (trimmed.length < 2) {
      return 'Player name must be at least 2 characters.';
    }
    if (trimmed.length > 20) {
      return 'Player name cannot exceed 20 characters.';
    }
    if (!/^[a-zA-Z0-9 _-]+$/.test(trimmed)) {
      return 'Only letters, numbers, spaces, hyphens, and underscores allowed.';
    }
    return null;
  };

  const handleSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validateInput(usernameInput);
    if (error) {
      setUsernameError(error);
      nameInputRef.current?.focus();
      return;
    }

    setUsernameError(null);
    setIsSavingName(true);
    try {
      await setPlayerName(usernameInput.trim(), selectedColor);
      setIsEditingName(false);
    } finally {
      setIsSavingName(false);
    }
  };

  // Host Create Room with Custom Rules
  const handleOpenCreateModal = () => {
    if (!hasUsername) {
      setIsEditingName(true);
      setUsernameError('Please set your player name first to host a room.');
      nameInputRef.current?.focus();
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
    if (!hasUsername || !player) {
      setIsEditingName(true);
      setUsernameError('Please set your player name first to join a room.');
      nameInputRef.current?.focus();
      return;
    }

    const cleanCode = joinCodeInput.trim().toUpperCase();
    if (!cleanCode) return;

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
              <span>
                LAN Server: Offline or Connecting. Launch with{' '}
                <code className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1.5 py-0.5 rounded">
                  npm run lan:host
                </code>
              </span>
            </div>
          )}
        </div>

        {/* USERNAME SETUP & TYCOON IDENTITY PROMPT (Requirement 6) */}
        {!hasUsername || isEditingName ? (
          <Card className="max-w-xl mx-auto mb-7 p-5 sm:p-6 border-2 border-indian-terracotta-500 shadow-xl bg-white dark:bg-indian-navy-900 animate-scale-in">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-indian-terracotta-100 dark:bg-indian-terracotta-950/80 text-indian-terracotta-600 flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-serif font-black text-lg sm:text-xl text-indian-terracotta-600 dark:text-indian-terracotta-400 leading-tight">
                  Tycoon Identity Setup
                </h2>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Choose your player name and token color to host or join multiplayer matches.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveUsername} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-indian-navy-800 dark:text-indian-parchment-200 uppercase tracking-wider">
                    Player Name (2–20 characters)
                  </label>
                  <span className="text-[11px] font-mono text-gray-500">
                    {usernameInput.trim().length}/20
                  </span>
                </div>
                <input
                  ref={nameInputRef}
                  type="text"
                  autoFocus
                  required
                  placeholder="e.g. Vikramaditya or Priya"
                  value={usernameInput}
                  onChange={(e) => {
                    setUsernameInput(e.target.value);
                    if (usernameError) setUsernameError(null);
                  }}
                  maxLength={20}
                  className="w-full bg-indian-parchment-100 dark:bg-indian-navy-800 border border-indian-parchment-400 dark:border-indian-navy-700 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-indian-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indian-terracotta-500 transition-all"
                />
                {usernameError && (
                  <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 text-xs font-semibold mt-1.5 animate-slide-in-left">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{usernameError}</span>
                  </div>
                )}
              </div>

              {/* Player Color Token Palette */}
              <div>
                <label className="block text-xs font-bold text-indian-navy-800 dark:text-indian-parchment-200 mb-1.5 uppercase tracking-wider">
                  Player Token Color
                </label>
                <div className="flex items-center gap-2.5 flex-wrap">
                  {PLAYER_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setSelectedColor(col)}
                      style={{ backgroundColor: col }}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-white shadow-md flex items-center justify-center transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                      title={col}
                    >
                      {selectedColor === col && (
                        <Check className="w-4 h-4 text-white drop-shadow-md stroke-[3]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSavingName}
                  disabled={!usernameInput.trim()}
                  className="flex-1 font-bold shadow-md flex items-center justify-center gap-2"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Confirm Tycoon Identity</span>
                </Button>
                {hasUsername && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setUsernameInput(player?.displayName || '');
                      setIsEditingName(false);
                    }}
                    className="font-bold text-xs"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </Card>
        ) : (
          /* Active Player Identity Bar */
          <div className="max-w-xl mx-auto mb-6 p-2.5 px-4 rounded-xl bg-white/80 dark:bg-indian-navy-900/80 border border-indian-parchment-300 dark:border-indian-navy-700 shadow-2xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                style={{ backgroundColor: player?.avatarColor || selectedColor }}
                className="w-6 h-6 rounded-full border-2 border-white shadow-xs flex items-center justify-center text-[10px] text-white font-black"
              >
                {player?.displayName?.charAt(0).toUpperCase()}
              </div>
              <div className="text-xs">
                <span className="text-gray-500 dark:text-gray-400">Playing as: </span>
                <strong className="text-indian-navy-950 dark:text-white font-bold">
                  {player?.displayName}
                </strong>
              </div>
            </div>
            <button
              onClick={() => setIsEditingName(true)}
              className="text-xs font-semibold text-indian-terracotta-600 hover:text-indian-terracotta-700 dark:text-indian-terracotta-400 flex items-center gap-1 hover:underline cursor-pointer"
            >
              <Edit2 className="w-3 h-3" />
              <span>Change</span>
            </button>
          </div>
        )}

        {roomError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center justify-between">
            <span>{roomError}</span>
            <button onClick={() => setError(null)} className="font-bold underline ml-2 cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        {/* MULTIPLAYER PRIVATE ROOMS: HOST & JOIN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          {/* Create Room Card */}
          <Card
            className={`p-5 flex flex-col justify-between border-indian-parchment-300 transition-opacity ${
              !hasUsername ? 'opacity-70' : 'opacity-100'
            }`}
          >
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
              className="w-full font-bold shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              {hasUsername ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Customize Rules & Host</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Set Name Above to Host</span>
                </>
              )}
            </Button>
          </Card>

          {/* Join Room with Code Card */}
          <Card
            className={`p-5 flex flex-col justify-between border-indian-parchment-300 transition-opacity ${
              !hasUsername ? 'opacity-70' : 'opacity-100'
            }`}
          >
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
                disabled={!hasUsername}
                className="flex-1 bg-white dark:bg-indian-navy-900 border border-indian-parchment-400 dark:border-indian-navy-700 rounded-lg px-3 py-2 text-sm font-mono tracking-widest text-center uppercase focus:outline-none focus:ring-2 focus:ring-indian-terracotta-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <Button
                type="submit"
                variant="secondary"
                isLoading={isJoining}
                disabled={!hasUsername || joinCodeInput.trim().length < 4}
                className="font-bold text-xs px-5 cursor-pointer"
              >
                {hasUsername ? 'Join' : 'Locked'}
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
