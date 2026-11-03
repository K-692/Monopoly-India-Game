import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoomStore } from '@/features/rooms/use-room-store';
import { useAuthStore } from '@/features/auth/use-auth-store';
import { useGameStore } from '@/features/game/use-game-store';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Copy, Check, Users, Play, Crown, ArrowLeft } from 'lucide-react';

export const LobbyPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currentRoom, toggleReady, leaveRoom } = useRoomStore();
  const { initializeDemoGame } = useGameStore();

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // If no live room in store, fallback to simulated room
  const room = currentRoom || {
    roomId: roomId || 'room_default',
    inviteCode: 'IND789',
    inviteCodeHash: 'IND789',
    hostUid: user?.uid || 'host_1',
    status: 'LOBBY' as const,
    maxPlayers: 4,
    turnTimerSeconds: 45 as const,
    gameMode: 'STANDARD' as const,
    members: {
      [user?.uid || 'host_1']: {
        uid: user?.uid || 'host_1',
        displayName: user?.displayName || 'Host Player',
        photoURL: user?.photoURL || null,
        isReady: true,
        joinedAt: Date.now(),
        colorToken: '#C85A32',
      },
      player_2: {
        uid: 'player_2',
        displayName: 'Priya (Mumbai)',
        photoURL: null,
        isReady: true,
        joinedAt: Date.now() + 1000,
        colorToken: '#1A2B4C',
      },
    },
    memberUids: [user?.uid || 'host_1', 'player_2'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    expiresAt: Date.now() + 86400000,
  };

  const isHost = user && room.hostUid === user.uid;
  const currentMember = user ? room.members[user.uid] : null;
  const memberList = Object.values(room.members);
  const canStart = memberList.length >= 2 && memberList.every((m) => m.isReady);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}#/home?join=${room.inviteCode}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleStartGame = () => {
    initializeDemoGame(user?.displayName || 'Maharaja Player');
    navigate(`/game/${room.roomId}`);
  };

  const handleLeave = () => {
    leaveRoom();
    navigate('/home');
  };

  return (
    <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
      {/* Lobby Header */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-indian-parchment-300 dark:border-indian-navy-700">
        <button
          onClick={handleLeave}
          className="flex items-center gap-1.5 text-xs font-semibold text-indian-navy-700 dark:text-indian-parchment-300 hover:text-indian-terracotta-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        <Badge variant="gold" className="text-xs">
          Room Status: LOBBY
        </Badge>
      </div>

      {/* Invite Code & Share Card */}
      <Card className="p-5 mb-6 text-center border-indian-terracotta-300 bg-gradient-to-b from-white to-indian-parchment-100 dark:from-indian-navy-800 dark:to-indian-navy-900">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">
          Room Invitation Code
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

      {/* Player Seats Grid */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-indian-navy-800 dark:text-indian-parchment-200 uppercase tracking-wider">
            Joined Players ({memberList.length} / {room.maxPlayers})
          </h3>
          <span className="text-[11px] text-gray-500">Requires 2 to start</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {memberList.map((m) => (
            <Card
              key={m.uid}
              className="p-3.5 flex items-center justify-between border-indian-parchment-300"
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
                    {m.uid === user?.uid ? 'You' : 'Member'}
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
              Waiting for player to join...
            </div>
          ))}
        </div>
      </div>

      {/* Start / Ready Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-indian-parchment-300 dark:border-indian-navy-700">
        {user && currentMember && (
          <Button
            size="lg"
            variant={currentMember.isReady ? 'outline' : 'secondary'}
            onClick={() => toggleReady(user.uid)}
            className="w-full sm:w-auto font-bold px-6"
          >
            {currentMember.isReady ? 'Toggle Not Ready' : 'Ready Up'}
          </Button>
        )}

        {isHost ? (
          <Button
            size="lg"
            variant="primary"
            disabled={!canStart}
            onClick={handleStartGame}
            className="w-full sm:w-auto font-bold px-8 shadow-md flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Start Game</span>
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
