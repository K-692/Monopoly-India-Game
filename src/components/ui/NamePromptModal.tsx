import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/use-auth-store';
import { Button } from './Button';
import { Card } from './Card';
import { UserCheck } from 'lucide-react';
import { AvatarPicker } from './AvatarPicker';

interface NamePromptModalProps {
  onSuccess?: (name: string) => void;
}

export const NamePromptModal: React.FC<NamePromptModalProps> = ({ onSuccess }) => {
  const navigate = useNavigate();
  const { player, isNamePromptOpen, setPlayerName, closeNamePrompt, pendingRedirectUrl } = useAuthStore();
  const [nameInput, setNameInput] = useState(player?.displayName || '');
  const [emoji, setEmoji] = useState<string | null>(player?.avatarEmoji ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  // Re-seed the form with the current profile each time the prompt opens
  if (isNamePromptOpen !== wasOpen) {
    setWasOpen(isNamePromptOpen);
    if (isNamePromptOpen) {
      setNameInput(player?.displayName || '');
      setEmoji(player?.avatarEmoji ?? null);
      setError(null);
    }
  }

  if (!isNamePromptOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = nameInput.trim();
    if (clean.length < 2) {
      setError('Name must be 2–20 characters.');
      return;
    }
    setSaving(true);
    const res = await setPlayerName(clean, undefined, emoji);
    setSaving(false);
    if (!res.ok) {
      setError(res.error || 'Could not save your profile.');
      return;
    }
    onSuccess?.(clean);
    closeNamePrompt();
    if (pendingRedirectUrl) {
      navigate(pendingRedirectUrl);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <Card className="max-w-md w-full p-4 sm:p-6 border-2 border-indian-terracotta-500 shadow-2xl bg-white dark:bg-indian-navy-900 my-auto">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-indian-terracotta-100 text-indian-terracotta-600 mx-auto flex items-center justify-center mb-3">
          <UserCheck className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>

        <h2 className="font-serif font-black text-xl sm:text-2xl text-center text-indian-terracotta-600 mb-1">
          Welcome Tycoon!
        </h2>
        <p className="text-xs text-center text-gray-600 dark:text-gray-300 mb-4">
          Enter your name to join Indian Monopoly rooms and matches.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-indian-navy-800 dark:text-indian-parchment-200 mb-1 uppercase tracking-wider">
              Your Player Name
            </label>
            <input
              type="text"
              autoFocus
              required
              placeholder="e.g. Vikramaditya or Priya"
              value={nameInput}
              onChange={(e) => {
                setNameInput(e.target.value);
                setError(null);
              }}
              maxLength={20}
              className="w-full bg-indian-parchment-100 dark:bg-indian-navy-800 border border-indian-parchment-400 dark:border-indian-navy-700 rounded-lg px-3 py-2.5 text-sm font-semibold text-indian-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indian-terracotta-500"
            />
          </div>

          {error && <p data-testid="name-prompt-error" className="text-xs font-semibold text-red-600">{error}</p>}

          <div>
            <label className="block text-xs font-bold text-indian-navy-800 dark:text-indian-parchment-200 mb-1 uppercase tracking-wider">
              Avatar
            </label>
            <AvatarPicker
              value={emoji}
              onChange={setEmoji}
              fallbackLetter={(nameInput.trim() || 'P').charAt(0).toUpperCase()}
              color={player?.avatarColor}
            />
          </div>

          <div className="flex gap-2">
            {player && (
              <Button type="button" variant="ghost" onClick={closeNamePrompt} className="font-bold">
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              disabled={!nameInput.trim() || saving}
              className="w-full font-bold shadow-md"
            >
              {player ? 'Save' : 'Enter Game'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
