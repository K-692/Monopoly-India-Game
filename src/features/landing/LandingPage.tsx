import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/use-auth-store';
import { useGameStore } from '@/features/game/use-game-store';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Dices, ShieldCheck, Smartphone, Landmark } from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loginWithGoogle, loginAsGuest } = useAuthStore();
  const { initializeDemoGame } = useGameStore();

  const handleStartDemo = () => {
    if (!user) {
      loginAsGuest('Maharaja Player');
    }
    initializeDemoGame('Maharaja Player');
    navigate('/game/demo');
  };

  const handleGoDashboard = () => {
    navigate('/home');
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-6xl mx-auto w-full">
      {/* Hero Header */}
      <div className="text-center max-w-2xl mx-auto mb-8 animate-fade-in">
        <Badge variant="gold" className="mb-3 px-3 py-1 text-xs">
          🇮🇳 The Authentic Indian Property Trading Game
        </Badge>

        <h1 className="font-serif font-black text-4xl sm:text-6xl text-indian-terracotta-600 dark:text-indian-terracotta-400 tracking-tight leading-none mb-3">
          INDIAN MONOPOLY
        </h1>

        <p className="text-base sm:text-lg text-indian-navy-700 dark:text-indian-parchment-300 font-medium leading-relaxed">
          Trade iconic properties across Mumbai, Delhi, Bengaluru, and Jaipur. Roll server-verified dice, collect GST and transit revenue, build commercial towers, and emerge as the ultimate tycoon.
        </p>

        {/* Call to Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {user ? (
            <Button
              size="lg"
              variant="primary"
              onClick={handleGoDashboard}
              className="text-base font-bold px-8 shadow-md"
            >
              Enter Dashboard
            </Button>
          ) : (
            <Button
              size="lg"
              variant="primary"
              onClick={loginWithGoogle}
              className="text-base font-bold px-6 shadow-md flex items-center gap-2"
            >
              <span>Sign In with Google</span>
            </Button>
          )}

          <Button
            size="lg"
            variant="outline"
            onClick={handleStartDemo}
            className="text-base font-bold px-6 shadow-sm flex items-center gap-2"
          >
            <Dices className="w-5 h-5 text-indian-terracotta-500" />
            <span>Play Instant Match</span>
          </Button>
        </div>
      </div>

      {/* Visual Showcase Card */}
      <div className="w-full max-w-4xl mb-12 rounded-2xl overflow-hidden border border-indian-parchment-300 dark:border-indian-navy-700 shadow-board-elevation bg-white dark:bg-indian-navy-800">
        <div className="relative aspect-[16/9] w-full bg-indian-parchment-200 overflow-hidden flex items-center justify-center">
          <img
            src="./assets/interface.png"
            alt="Indian Monopoly Interface"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.src = './assets/board.png';
            }}
          />
        </div>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl">
        <Card className="p-5 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-indian-terracotta-100 dark:bg-indian-terracotta-900/40 text-indian-terracotta-600 flex items-center justify-center mb-3">
            <Landmark className="w-6 h-6" />
          </div>
          <h3 className="font-serif font-bold text-base text-indian-navy-900 dark:text-indian-parchment-100 mb-1">
            40 Authentic Indian Spaces
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            From Marine Drive and Connaught Place to Western Express, GST Checkposts, and Urja Power.
          </p>
        </Card>

        <Card className="p-5 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-indian-navy-100 dark:bg-indian-navy-900/40 text-indian-navy-600 flex items-center justify-center mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="font-serif font-bold text-base text-indian-navy-900 dark:text-indian-parchment-100 mb-1">
            Server-Authoritative
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Zero client cheating. Every roll, purchase, rent calculation, and tax is verified on the backend.
          </p>
        </Card>

        <Card className="p-5 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-indian-gold-100 dark:bg-indian-gold-900/40 text-indian-gold-700 flex items-center justify-center mb-3">
            <Smartphone className="w-6 h-6" />
          </div>
          <h3 className="font-serif font-bold text-base text-indian-navy-900 dark:text-indian-parchment-100 mb-1">
            Universal Responsive
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Purpose-built layouts with bottom sheets and thumb controls for iPhone, Android, iPad, and Mac.
          </p>
        </Card>
      </div>
    </div>
  );
};
