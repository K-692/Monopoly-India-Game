import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoomStore } from '@/features/rooms/use-room-store';
import { useAuthStore } from '@/features/auth/use-auth-store';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  Copy,
  Check,
  Users,
  Play,
  Crown,
  ArrowLeft,
  Sliders,
  AlertCircle,
  Loader2,
  QrCode,
  Wifi,
  ChevronDown,
} from 'lucide-react';
import QRCode from 'qrcode';

export const LobbyPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { player, openNamePrompt } = useAuthStore();
  const {
    currentRoom,
    isLoading,
    error: roomError,
    lanInfo,
    selectedLanAddress,
    setSelectedLanAddress,
    subscribeToRoom,
    toggleReady,
    startGame,
    leaveRoom,
  } = useRoomStore();

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isTogglingReady, setIsTogglingReady] = useState(false);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  // If user has not set their name yet, prompt immediately
  useEffect(() => {
    if (!player) {
      openNamePrompt();
    }
  }, [player, openNamePrompt]);

  // Subscribe to real-time room state
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

  // Determine authoritative shareable LAN URL (never localhost for other devices)
  const getShareableUrl = (): string => {
    if (!currentRoom) return '';
    const port = lanInfo?.port || (typeof window !== 'undefined' ? window.location.port || '4173' : '4173');
    const targetIp =
      selectedLanAddress ||
      lanInfo?.primaryLanAddress ||
      (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
        ? window.location.hostname
        : null);

    if (targetIp) {
      return `http://${targetIp}:${port}/#/join/${currentRoom.inviteCode}`;
    }

    // Fallback if no LAN interface detected
    const base = typeof window !== 'undefined' ? window.location.href.split('#')[0] : '';
    return `${base}#/join/${currentRoom.inviteCode}`;
  };

  const shareableUrl = getShareableUrl();

  // Generate QR code data URL whenever shareable URL changes
  useEffect(() => {
    if (!shareableUrl) return;
    let isMounted = true;
    QRCode.toDataURL(shareableUrl, {
      margin: 1,
      width: 220,
      color: {
        dark: '#1A2B4C',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch((err) => {
        console.warn('QR code generation failed:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [shareableUrl]);

  const handleCopyCode = () => {
    if (!currentRoom) return;
    navigator.clipboard.writeText(currentRoom.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    if (!shareableUrl) return;
    navigator.clipboard.writeText(shareableUrl);
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
          Entering LAN Lobby...
        </h2>
        <p className="text-xs text-gray-500 max-w-sm">
          Connecting to authoritative LAN server for Room #{roomId?.replace('room_', '').slice(0, 8)}
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

        <div className="flex items-center gap-2">
          {lanInfo?.primaryLanAddress && (
            <Badge variant="neutral" className="text-[11px] font-mono hidden sm:inline-flex items-center gap-1">
              <Wifi className="w-3 h-3 text-emerald-600" />
              <span>{lanInfo.primaryLanAddress}:{lanInfo.port}</span>
            </Badge>
          )}
          <Badge variant={room.status === 'LOBBY' ? 'gold' : 'emerald'} className="text-xs">
            Status: {room.status}
          </Badge>
        </div>
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
        <div className="text-3xl sm:text-5xl font-mono font-black tracking-widest text-indian-terracotta-600 dark:text-indian-terracotta-400 mb-2 select-all">
          {room.inviteCode}
        </div>

        {/* Shareable URL display */}
        <div className="max-w-md mx-auto mb-4 bg-indian-parchment-200 dark:bg-indian-navy-950 rounded-lg p-2 text-xs font-mono text-indian-navy-900 dark:text-indian-parchment-200 break-all border border-indian-parchment-300 dark:border-indian-navy-800">
          {shareableUrl}
        </div>

        {/* Multi-interface address selector if server detected multiple LAN IPs */}
        {lanInfo && lanInfo.lanAddresses.length > 1 && isHost && (
          <div className="mb-4 inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <span>Share via IP:</span>
            <div className="relative inline-block">
              <select
                value={selectedLanAddress || lanInfo.primaryLanAddress || ''}
                onChange={(e) => setSelectedLanAddress(e.target.value)}
                className="bg-white dark:bg-indian-navy-900 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 pr-6 text-xs font-mono appearance-none cursor-pointer"
              >
                {lanInfo.lanAddresses.map((ip) => (
                  <option key={ip} value={ip}>
                    {ip}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 absolute right-1.5 top-2 pointer-events-none text-gray-400" />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyCode}
            className="text-xs flex items-center gap-1.5 cursor-pointer"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? 'Copied Code!' : 'Copy Code'}</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyLink}
            className="text-xs flex items-center gap-1.5 cursor-pointer"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Users className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Copied Link!' : 'Copy Invite Link'}</span>
          </Button>

          {qrDataUrl && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowQrModal(!showQrModal)}
              className="text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>{showQrModal ? 'Hide QR' : 'Show Phone QR'}</span>
            </Button>
          )}
        </div>

        {/* QR Code Reveal Panel */}
        {showQrModal && qrDataUrl && (
          <div className="mt-4 pt-4 border-t border-indian-parchment-300 dark:border-indian-navy-700 flex flex-col items-center">
            <div className="p-3 bg-white rounded-xl shadow-md border border-gray-200">
              <img src={qrDataUrl} alt="LAN Join QR Code" className="w-44 h-44" />
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
              Scan with phone camera connected to the same Wi-Fi network to join immediately!
            </p>
          </div>
        )}
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
