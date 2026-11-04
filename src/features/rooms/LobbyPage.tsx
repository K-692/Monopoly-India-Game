import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoomStore } from '@/features/rooms/use-room-store';
import { useAuthStore } from '@/features/auth/use-auth-store';
import { useGameStore } from '@/features/game/use-game-store';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Copy, Check, Users, Play, Crown, ArrowLeft, Sliders } from 'lucide-react';

export const LobbyPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { player, openNamePrompt } = useAuthStore();
  const { currentRoom, toggleReady, leaveRoom } = useRoomStore();
  const { initializeDemoGame } = useGameStore();

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // If user has not set their name yet, prompt immediately
  React.useEffect(() => {
    if (!player) {
      openNamePrompt();
    }
  }, [player, openNamePrompt]);

  const room = currentRoom || {
    roomId: roomId || 'room_default',
    inviteCode: roomId?.replace('room_', '').toUpperCase() || 'IND789',
    inviteCodeHash: 'IND789',
    hostUid: player?.uid || 'host_1',
    status: 'LOBBY' as const,
    maxPlayers: 4,
    turnTimerSeconds: 30 as const,
    gameMode: 'STANDARD' as const,
    customRules: {
      startingCash: 15000,
      passStartReward: 2000,
      turnTimerSeconds: 30,
      maxPlayers: 4,
      jailBail: 500,
      doubleRentMonopoly: true,
      allowAuctions: true,
      gameMode: 'STANDARD',
    },
    members: {
      [player?.uid || 'host_1']: {
        uid: player?.uid || 'host_1',
        displayName: player?.displayName || 'Host Player',
        photoURL: null,
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
    memberUids: [player?.uid || 'host_1', 'player_2'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    expiresAt: Date.now() + 86400000,
  };

  const isHost = player && room.hostUid === player.uid;
  const currentMember = player ? room.members[player.uid] : null;
  const memberList = Object.values(room.members);
  const canStart = memberList.length >= 2 && memberList.every((m) => m.isReady);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}#/room/${room.roomId}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleStartGame = () => {
    initializeDemoGame(player?.displayName || 'Host Player');
    navigate(`/game/${room.roomId}`);
  };

  const handleLeave = () => {
    leaveRoom();
    navigate('/');
  };

  return (
    <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-indian-parchment-300 dark:border-indian-navy-700">
        <button
          onClick={handleLeave}
          className="flex items-center gap-1.5 text-xs font-semibold text-indian-navy-700 dark:text-indian-parchment-300 hover:text-indian-terracotta-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Play
        </button>

        <Badge variant="gold" className="text-xs">
          Room Status: LOBBY
        </Badge>
      </div>

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
            <div>Starting Cash: <strong className="text-indian-navy-900 dark:text-white">₹{room.customRules.startingCash.toLocaleString('en-IN')}</strong></div>
            <div>Turn Timer: <strong className="text-indian-navy-900 dark:text-white">{room.customRules.turnTimerSeconds}s</strong></div>
            <div>Pass START: <strong className="text-indian-navy-900 dark:text-white">₹{room.customRules.passStartReward.toLocaleString('en-IN')}</strong></div>
            <div>Max Players: <strong className="text-indian-navy-900 dark:text-white">{room.customRules.maxPlayers}</strong></div>
          </div>
        </Card>
      )}

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
                    {m.uid === player?.uid ? 'You' : 'Member'}
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
              Waiting for player to join with link...
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
            onClick={() => toggleReady(player.uid)}
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
