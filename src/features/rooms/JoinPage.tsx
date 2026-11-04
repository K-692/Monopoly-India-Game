import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/use-auth-store';
import { useRoomStore } from '@/features/rooms/use-room-store';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Loader2, AlertCircle, ArrowLeft, Users } from 'lucide-react';

export const JoinPage: React.FC = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { player, isAuthInitialized, openNamePrompt } = useAuthStore();
  const { joinRoom, error: roomError, setError } = useRoomStore();

  const [isJoining, setIsJoining] = useState(false);
  const [joinFailedError, setJoinFailedError] = useState<string | null>(null);
  const joinAttemptedRef = useRef(false);

  const cleanCode = (inviteCode || '').trim().toUpperCase();

  // If user opens invite link and has no display name, prompt for name
  useEffect(() => {
    if (isAuthInitialized && !player) {
      openNamePrompt();
    }
  }, [isAuthInitialized, player, openNamePrompt]);

  // Attempt to join when player identity is ready
  useEffect(() => {
    if (!cleanCode || !player || isJoining || joinAttemptedRef.current) return;

    let isMounted = true;
    joinAttemptedRef.current = true;

    const performJoin = async () => {
      setIsJoining(true);
      setJoinFailedError(null);
      setError(null);

      try {
        const result = await joinRoom(cleanCode, {
          uid: player.uid,
          displayName: player.displayName,
          photoURL: null,
        });

        if (!isMounted) return;

        if (result.ok && result.roomId) {
          navigate(`/room/${result.roomId}`, { replace: true });
        } else {
          setJoinFailedError(result.error || 'Failed to join room. Verify the invitation code.');
          joinAttemptedRef.current = false;
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Error joining room.';
        setJoinFailedError(msg);
        joinAttemptedRef.current = false;
      } finally {
        if (isMounted) setIsJoining(false);
      }
    };

    performJoin();

    return () => {
      isMounted = false;
    };
  }, [cleanCode, player, isJoining, joinRoom, navigate, setError]);

  if (!cleanCode) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <Card className="max-w-md w-full p-6 border-red-300 dark:border-red-900 shadow-xl space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="font-serif font-black text-xl text-red-700 dark:text-red-400">
            Invalid Invitation Link
          </h2>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            No invitation code was found in the link.
          </p>
          <Button onClick={() => navigate('/')} variant="primary" className="w-full font-bold">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Return to Play Hub
          </Button>
        </Card>
      </div>
    );
  }

  if (joinFailedError || roomError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <Card className="max-w-md w-full p-6 border-red-300 dark:border-red-900 shadow-xl space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="font-serif font-black text-xl text-red-700 dark:text-red-400">
            Could Not Join Room
          </h2>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            {joinFailedError || roomError}
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              onClick={() => {
                setJoinFailedError(null);
                setError(null);
                if (player) {
                  joinRoom(cleanCode, {
                    uid: player.uid,
                    displayName: player.displayName,
                    photoURL: null,
                  }).then((res) => {
                    if (res.ok && res.roomId) {
                      navigate(`/room/${res.roomId}`, { replace: true });
                    }
                  });
                } else {
                  openNamePrompt();
                }
              }}
              variant="secondary"
              className="w-full font-bold"
            >
              Try Again
            </Button>
            <Button onClick={() => navigate('/')} variant="outline" className="w-full font-bold">
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Return to Play Hub
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <Card className="max-w-md w-full p-6 border-indian-terracotta-400 bg-white dark:bg-indian-navy-850 shadow-2xl space-y-4">
        <div className="w-12 h-12 rounded-full bg-indian-terracotta-100 dark:bg-indian-terracotta-950 text-indian-terracotta-600 mx-auto flex items-center justify-center">
          <Users className="w-6 h-6" />
        </div>
        <div>
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">
            Accepting Invitation
          </span>
          <div className="text-2xl font-mono font-black text-indian-terracotta-600 dark:text-indian-terracotta-400">
            Code: {cleanCode}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-gray-600 dark:text-gray-300 py-2">
          <Loader2 className="w-4 h-4 animate-spin text-indian-terracotta-500" />
          <span>
            {!player
              ? 'Waiting for your player name...'
              : 'Verifying invitation and connecting to room...'}
          </span>
        </div>

        {!player && (
          <Button onClick={() => openNamePrompt()} variant="primary" className="w-full font-bold">
            Set Display Name
          </Button>
        )}
      </Card>
    </div>
  );
};
