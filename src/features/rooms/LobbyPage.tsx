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
  Bot,
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  Clock,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import { copyToClipboard } from '@/lib/utils/clipboard';
import { useToastStore } from '@/components/feedback/toast-store';

const TOTAL_ROOM_SLOTS = 6;

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
    addCpu,
    removeCpu,
    renameCpu,
    startGame,
    leaveRoom,
  } = useRoomStore();

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isTogglingReady, setIsTogglingReady] = useState(false);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [isAddingCpu, setIsAddingCpu] = useState(false);
  const [removingCpuUid, setRemovingCpuUid] = useState<string | null>(null);
  const [editingCpuId, setEditingCpuId] = useState<string | null>(null);
  const [editingCpuName, setEditingCpuName] = useState('');
  const [isSavingCpuName, setIsSavingCpuName] = useState(false);
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

  const handleCopyCode = async () => {
    if (!currentRoom) return;
    const ok = await copyToClipboard(currentRoom.inviteCode);
    if (ok) {
      setCopiedCode(true);
      useToastStore.getState().addToast({
        type: 'success',
        title: 'Room Code Copied',
        message: `Invite code ${currentRoom.inviteCode} copied to clipboard!`,
      });
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      useToastStore.getState().addToast({
        type: 'error',
        title: 'Copy Failed',
        message: 'Could not copy room code automatically. Please select it manually.',
      });
    }
  };

  const handleCopyLink = async () => {
    if (!shareableUrl) return;
    const ok = await copyToClipboard(shareableUrl);
    if (ok) {
      setCopiedLink(true);
      useToastStore.getState().addToast({
        type: 'success',
        title: 'Invite Link Copied',
        message: 'Shareable LAN invite link copied to clipboard!',
      });
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      useToastStore.getState().addToast({
        type: 'error',
        title: 'Copy Failed',
        message: 'Could not copy invite link automatically. Please select it manually.',
      });
    }
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

  // Host CPU Management Controls
  const handleAddCpu = async () => {
    if (!isHost || isAddingCpu || !currentRoom) return;
    if (Object.keys(currentRoom.members).length >= TOTAL_ROOM_SLOTS) {
      useToastStore.getState().addToast({
        type: 'error',
        title: 'Room Full',
        message: `All ${TOTAL_ROOM_SLOTS} player slots are already occupied.`,
      });
      return;
    }

    setIsAddingCpu(true);
    try {
      const res = await addCpu();
      if (!res.ok && res.error) {
        useToastStore.getState().addToast({
          type: 'error',
          title: 'Add CPU Failed',
          message: res.error,
        });
      }
    } finally {
      setIsAddingCpu(false);
    }
  };

  const handleRemoveCpu = async (cpuUid: string) => {
    if (!isHost || removingCpuUid) return;
    setRemovingCpuUid(cpuUid);
    try {
      const res = await removeCpu(cpuUid);
      if (!res.ok && res.error) {
        useToastStore.getState().addToast({
          type: 'error',
          title: 'Remove CPU Failed',
          message: res.error,
        });
      }
    } finally {
      setRemovingCpuUid(null);
    }
  };

  const handleStartRename = (cpuUid: string, currentName: string) => {
    setEditingCpuId(cpuUid);
    setEditingCpuName(currentName);
  };

  const handleCancelRename = () => {
    setEditingCpuId(null);
    setEditingCpuName('');
  };

  const handleSaveRename = async (cpuUid: string) => {
    const trimmed = editingCpuName.trim();
    if (!trimmed) {
      useToastStore.getState().addToast({
        type: 'error',
        title: 'Invalid Name',
        message: 'Computer player name cannot be empty.',
      });
      return;
    }

    setIsSavingCpuName(true);
    try {
      const res = await renameCpu(cpuUid, trimmed);
      if (res.ok) {
        setEditingCpuId(null);
      } else {
        useToastStore.getState().addToast({
          type: 'error',
          title: 'Rename Failed',
          message: res.error || 'Failed to rename computer player.',
        });
      }
    } finally {
      setIsSavingCpuName(false);
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

  // Requirements 4 & 5: Readiness & Game Start Conditions
  // 1. Minimum 2 total players (humans + CPUs).
  // 2. Every currently present human player must be READY (including the host!). CPUs are automatically ready.
  const humanMembers = memberList.filter((m) => !m.isCpu && m.playerType !== 'COMPUTER');
  const unreadyHumans = humanMembers.filter((m) => !m.isReady);
  const allHumansReady = unreadyHumans.length === 0;
  const hasMinimumPlayers = memberList.length >= 2;
  const canStart = isHost && hasMinimumPlayers && allHumansReady;

  let startDisabledReason = '';
  if (!hasMinimumPlayers) {
    startDisabledReason = 'Waiting for more players (minimum 2 total players required).';
  } else if (!allHumansReady) {
    const unreadyNames = unreadyHumans.map((m) =>
      m.uid === player?.uid ? 'You (Host)' : m.displayName
    );
    startDisabledReason = `Waiting for ${unreadyNames.join(', ')} to get ready.`;
  }

  // Calculate remaining empty slots out of 6
  const emptySlotCount = Math.max(0, TOTAL_ROOM_SLOTS - memberList.length);

  return (
    <div className="flex-1 overflow-y-auto w-full px-4 py-6">
      <div className="max-w-3xl mx-auto pb-8">
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
            <span>Match Rules Configuration:</span>
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
              Capacity:{' '}
              <strong className="text-indian-navy-900 dark:text-white">
                {TOTAL_ROOM_SLOTS} Slots
              </strong>
            </div>
          </div>
        </Card>
      )}

      {/* Section 2 & 3: Six Fixed Player Slots Grid & Host CPU Management */}
      <div className="mb-6">
        <div className="mb-3">
          <h3 className="text-xs font-bold text-indian-navy-800 dark:text-indian-parchment-200 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-4 h-4 text-indian-terracotta-600" />
            <span>Room Slots ({memberList.length} / {TOTAL_ROOM_SLOTS})</span>
          </h3>
          <p className="text-[11px] text-gray-500">
            Min 2 players required. Humans must be ready; CPUs are auto-ready.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Render Joined Players */}
          {memberList.map((m, index) => {
            const isCpu = Boolean(m.isCpu || m.playerType === 'COMPUTER');
            const isCurrentPlayer = player && m.uid === player.uid;
            const isEditingThisCpu = isCpu && editingCpuId === m.uid;

            return (
              <Card
                key={m.uid}
                className="p-3.5 flex items-center justify-between border-indian-parchment-300 bg-white dark:bg-indian-navy-850 shadow-xs transition-all"
                data-testid={`player-slot-${m.uid}`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                  <div
                    style={{ backgroundColor: m.colorToken }}
                    className="w-9 h-9 rounded-full border border-white text-white font-black text-sm flex items-center justify-center shadow-xs shrink-0"
                  >
                    {m.displayName.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* Inline CPU Rename mode */}
                    {isEditingThisCpu ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editingCpuName}
                          maxLength={20}
                          onChange={(e) => setEditingCpuName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(m.uid);
                            if (e.key === 'Escape') handleCancelRename();
                          }}
                          autoFocus
                          className="w-full px-2 py-0.5 text-xs rounded border border-blue-400 bg-white dark:bg-indian-navy-950 text-indian-navy-900 dark:text-white focus:outline-hidden"
                          placeholder="CPU Name"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRename(m.uid)}
                          disabled={isSavingCpuName}
                          className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 cursor-pointer"
                          title="Save Name"
                        >
                          {isSavingCpuName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelRename}
                          disabled={isSavingCpuName}
                          className="p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-indian-navy-900 dark:text-indian-parchment-100 truncate max-w-[140px]">
                          {m.displayName}
                        </span>

                        {m.uid === room.hostUid && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            <Crown className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                            <span>Host</span>
                          </span>
                        )}

                        {isCpu ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-black bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                            <Bot className="w-2.5 h-2.5" />
                            <span>CPU</span>
                          </span>
                        ) : isCurrentPlayer ? (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            You
                          </span>
                        ) : null}

                        {/* Host controls for renaming/removing this CPU */}
                        {isHost && isCpu && room.status === 'LOBBY' && (
                          <div className="inline-flex items-center gap-1 ml-1">
                            <button
                              type="button"
                              onClick={() => handleStartRename(m.uid, m.displayName)}
                              className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 p-0.5 rounded cursor-pointer"
                              title="Rename CPU"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveCpu(m.uid)}
                              disabled={removingCpuUid === m.uid}
                              className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-0.5 rounded cursor-pointer disabled:opacity-50"
                              title="Remove CPU"
                            >
                              {removingCpuUid === m.uid ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <span className="text-[10px] text-gray-500 block">
                      Slot {index + 1} • {isCpu ? 'Computer Player' : isCurrentPlayer ? 'Local Player' : 'Human Player'}
                    </span>
                  </div>
                </div>

                {/* Requirement 4: Distinct visual & text readiness indicator (not color alone) */}
                <div className="shrink-0">
                  {isCpu ? (
                    <div
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                      title="Computer players are automatically ready"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Ready</span>
                    </div>
                  ) : m.isReady ? (
                    <div
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                      title="Player has confirmed ready"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Ready</span>
                    </div>
                  ) : (
                    <div
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                      title="Waiting for player to ready up"
                    >
                      <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>Not Ready</span>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}

          {/* Render Remaining Empty Slots up to 6 */}
          {Array.from({ length: emptySlotCount }).map((_, i) => {
            const slotNumber = memberList.length + i + 1;
            return (
              <div
                key={`empty-slot-${slotNumber}`}
                className="border-2 border-dashed border-indian-parchment-300 dark:border-indian-navy-700 rounded-xl p-3 flex items-center justify-between text-xs text-gray-400 font-medium bg-indian-parchment-100/30 dark:bg-indian-navy-900/30"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full border border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center text-[11px] font-bold text-gray-400">
                    {slotNumber}
                  </div>
                  <div>
                    <span className="font-bold text-gray-500 dark:text-gray-400 text-xs block">
                      Slot {slotNumber}: Available
                    </span>
                    <span className="text-[10px] text-gray-400">
                      Open for human or CPU
                    </span>
                  </div>
                </div>

                {isHost ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAddCpu}
                    disabled={isAddingCpu}
                    className="text-[11px] h-7 px-2.5 flex items-center gap-1 border-blue-400 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add CPU</span>
                  </Button>
                ) : (
                  <span className="text-[10px] text-gray-400 italic">
                    Waiting for player...
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Requirement 4 & 5: Bottom Action Bar with Ready Toggle & Start Game */}
      <div className="pt-4 border-t border-indian-parchment-300 dark:border-indian-navy-700 space-y-3">
        {/* Explanation text when cannot start */}
        {!canStart && isHost && (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{startDisabledReason}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Human Player Ready / Not Ready Control (Requirement 4: includes host!) */}
          {player && currentMember && !currentMember.isCpu && (
            <Button
              size="lg"
              variant={currentMember.isReady ? 'outline' : 'secondary'}
              disabled={isTogglingReady}
              onClick={handleToggleReady}
              className={`w-full sm:w-auto font-bold px-6 flex items-center justify-center gap-2 cursor-pointer transition-all ${
                currentMember.isReady
                  ? 'border-amber-500 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
              }`}
            >
              {isTogglingReady ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : currentMember.isReady ? (
                <Clock className="w-4 h-4" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>{currentMember.isReady ? 'Set to Not Ready' : 'Ready Up'}</span>
            </Button>
          )}

          {/* Host Start Game Control (Requirement 5) */}
          {isHost ? (
            <Button
              size="lg"
              variant="primary"
              disabled={!canStart || isStartingGame}
              onClick={handleStartGame}
              className="w-full sm:w-auto font-bold px-8 shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  </div>
  );
};
