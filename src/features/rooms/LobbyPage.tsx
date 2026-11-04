import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoomStore } from '@/features/rooms/use-room-store';
import { useAuthStore } from '@/features/auth/use-auth-store';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Copy, Check, Users, Play, Crown, ArrowLeft, Sliders, AlertCircle, Loader2 } from 'lucide-react';

export const LobbyPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { player, openNamePrompt } = useAuthStore();
  const {
    currentRoom,
    isLoading,
    error: roomError,
    subscribeToRoom,
    toggleReady,
    startGame,
    leaveRoom,
  } = useRoomStore();

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isTogglingReady, setIsTogglingReady] = useState(false);
  const [isStartingGame, setIsStartingGame] = useState(false);

  // If user has not set their name yet, prompt immediately
  useEffect(() => {
    if (!player) {
      openNamePrompt();
    }
  }, [player, openNamePrompt]);

  // Subscribe to real-time Firestore room document & members subcollection
  useEffect(() => {
    if (!roomId) return;
    const unsubscribe = subscribeToRoom(roomId);
    return () => {
      unsubscribe();
    };
  }, [roomId, subscribeToRoom]);

  // Automatic synchronized game transition when room reaches IN_PROGRESS
  useEffect(() => {
    if (currentRoom?.status === 'IN_PROGRESS' && currentRoom.gameId) {
      navigate(`/game/${currentRoom.gameId}`);
    }
  }, [currentRoom?.status, currentRoom?.gameId, navigate]);

  const handleCopyCode = () => {
    if (!currentRoom) return;
    navigator.clipboard.writeText(currentRoom.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    if (!currentRoom) return;
    const base = window.location.href.split('#')[0];
    const inviteUrl = `${base}#/join/${currentRoom.inviteCode}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleToggleReady = async () => {
    if (!currentRoom || !player) return;
    const currentMember = currentRoom.members[player.uid];
    if (!currentMember) return;

    setIsTogglingReady(true);
    try {
      await toggleReady(currentRoom.roomId, !currentMember.isReady);
    } finally {
      setIsTogglingReady(false);
    }
  };

  const handleStartGame = async () => {
    if (!currentRoom || isStartingGame) return;
    setIsStartingGame(true);
    try {
      const res = await startGame(currentRoom.roomId);
      if (res.ok && res.gameId) {
        navigate(`/game/${res.gameId}`);
      }
    } finally {
      setIsStartingGame(false);
    }
  };

  const handleLeave = () => {
    leaveRoom();
    navigate('/');
  };

  // Loading state
  if (isLoading && !currentRoom) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 text-indian-terracotta-500 animate-spin mb-4" />
        <h2 className="font-serif font-black text-xl text-indian-navy-900 dark:text-white mb-2">
          Entering Multiplayer Lobby...
        </h2>
        <p className="text-xs text-gray-500 max-w-sm">
          Establishing real-time connection with Cloud Firestore for Room #{roomId?.replace('room_', '').slice(0, 8)}
        </p>
      </div>
    );
  }

  // Error state / Room not found
  if (roomError && !currentRoom) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <Card className="max-w-md w-full p-6 border-red-300 dark:border-red-900 shadow-xl space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="font-serif font-black text-xl text-red-700 dark:text-red-400">
            Room Unavailable
          </h2>
          <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
            {roomError}
          </p>
          <Button onClick={handleLeave} variant="primary" className="w-full font-bold">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Return to Play Hub
          </Button>
        </Card>
      </div>
    );
  }

  if (!currentRoom) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-8 h-8 text-indian-terracotta-500 animate-spin mb-3" />
        <p className="text-xs text-gray-500">Connecting...</p>
      </div>
    );
  }

  const room = currentRoom;
  const isHost = Boolean(player && room.hostUid === player.uid);
  const currentMember = player ? room.members[player.uid] : null;
  const memberList = Object.values(room.members);
  const canStart = isHost && memberList.length >= 2 && memberList.every((m) => m.isReady);

  return (
    <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-indian-parchment-300 dark:border-indian-navy-700">
        <button
          onClick={handleLeave}
          className="flex items-center gap-1.5 text-xs font-semibold text-indian-navy-700 dark:text-indian-parchment-300 hover:text-indian-terracotta-600 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Play
        </button>

        <Badge variant={room.status === 'LOBBY' ? 'gold' : 'emerald'} className="text-xs">
          Room Status: {room.status}
        </Badge>
      </div>

      {roomError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center justify-between">
          <span>{roomError}</span>
        </div>
      )}

      {/* Invite Code & Share Card */}
      <Card className="p-5 mb-6 text-center border-indian-terracotta-300 bg-gradient-to-b from-white to-indian-parchment-100 dark:from-indian-navy-800 dark:to-indian-navy-900">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">
          Share Room Link / Code
        </span>
        <div className="text-3xl sm:text-4xl font-mono font-black tracking-widest text-indian-terracotta-600 dark:text-indian-terracotta-400 mb-4 select-all">
          {room.inviteCode}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyCode}
            className="text-xs flex items-center gap-1.5"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? 'Copied Code!' : 'Copy Code'}</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyLink}
            className="text-xs flex items-center gap-1.5"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Users className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Copied Link!' : 'Copy Invite Link'}</span>
          </Button>
        </div>
      </Card>

      {/* Host Configured Rules Summary */}
      {room.customRules && (
        <Card className="p-3.5 mb-6 border-indian-parchment-300 bg-amber-50/50 dark:bg-indian-navy-800">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold text-indian-navy-800 dark:text-indian-parchment-200">
            <Sliders className="w-4 h-4 text-indian-terracotta-500" />
            <span>Host Rules for this Match:</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-600 dark:text-gray-300">
            <div>
              Starting Cash:{' '}
              <strong className="text-indian-navy-900 dark:text-white">
                ₹{room.customRules.startingCash.toLocaleString('en-IN')}
              </strong>
            </div>
            <div>
              Turn Timer:{' '}
              <strong className="text-indian-navy-900 dark:text-white">
                {room.customRules.turnTimerSeconds}s
              </strong>
            </div>
            <div>
              Pass START:{' '}
              <strong className="text-indian-navy-900 dark:text-white">
                ₹{room.customRules.passStartReward.toLocaleString('en-IN')}
              </strong>
            </div>
            <div>
              Max Players:{' '}
              <strong className="text-indian-navy-900 dark:text-white">
                {room.customRules.maxPlayers}
              </strong>
            </div>
          </div>
        </Card>
      )}

      {/* Player Seats Grid */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-indian-navy-800 dark:text-indian-parchment-200 uppercase tracking-wider">
            Joined Players ({memberList.length} / {room.maxPlayers})
          </h3>
          <span className="text-[11px] text-gray-500">Requires minimum 2 ready players</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {memberList.map((m) => (
            <Card
              key={m.uid}
              className="p-3.5 flex items-center justify-between border-indian-parchment-300 bg-white dark:bg-indian-navy-850"
            >
              <div className="flex items-center gap-2.5">
                <div
                  style={{ backgroundColor: m.colorToken }}
                  className="w-9 h-9 rounded-full border border-white text-white font-black text-sm flex items-center justify-center shadow-xs"
                >
                  {m.displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-indian-navy-900 dark:text-indian-parchment-100">
                      {m.displayName}
                    </span>
                    {m.uid === room.hostUid && (
                      <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    )}
                  </div>
                  <span className="text-[10px] text-gray-500">
                    {m.uid === player?.uid ? 'You' : m.uid === room.hostUid ? 'Host' : 'Member'}
                  </span>
                </div>
              </div>

              <Badge
                variant={m.isReady ? 'emerald' : 'neutral'}
                className="text-[10px] py-1 px-2.5 font-bold"
              >
                {m.isReady ? 'Ready' : 'Not Ready'}
              </Badge>
            </Card>
          ))}

          {/* Empty Seats */}
          {Array.from({ length: Math.max(0, room.maxPlayers - memberList.length) }).map((_, i) => (
            <div
              key={i}
              className="border-2 border-dashed border-indian-parchment-300 dark:border-indian-navy-700 rounded-xl p-3.5 flex items-center justify-center text-xs text-gray-400 font-medium"
            >
              Waiting for player to join with code...
            </div>
          ))}
        </div>
      </div>

      {/* Start / Ready Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-indian-parchment-300 dark:border-indian-navy-700">
        {player && currentMember && (
          <Button
            size="lg"
            variant={currentMember.isReady ? 'outline' : 'secondary'}
            disabled={isTogglingReady}
            onClick={handleToggleReady}
            className="w-full sm:w-auto font-bold px-6 cursor-pointer"
          >
            {isTogglingReady ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
            ) : null}
            {currentMember.isReady ? 'Toggle Not Ready' : 'Ready Up'}
          </Button>
        )}

        {isHost ? (
          <Button
            size="lg"
            variant="primary"
            disabled={!canStart || isStartingGame}
            onClick={handleStartGame}
            className="w-full sm:w-auto font-bold px-8 shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            {isStartingGame ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
            <span>{isStartingGame ? 'Starting...' : 'Start Game'}</span>
          </Button>
        ) : (
          <div className="text-xs text-gray-500 italic">
            Waiting for host to start match once all players are ready...
          </div>
        )}
      </div>
    </div>
  );
};
