import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Trophy, Clock, ArrowLeft, Building } from 'lucide-react';
import { GameArchive } from '@/domain/game-types';

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();

  // Curated demo archives to verify the UI layout
  const mockArchives: GameArchive[] = [
    {
      archiveId: 'arch_101',
      gameId: 'game_ind_402',
      roomId: 'room_DELHI_1',
      rulesetVersion: '1.0.0',
      winnerUid: 'p1',
      winnerName: 'Arjun (Maharaja)',
      startedAt: Date.now() - 7200000,
      completedAt: Date.now() - 3600000,
      durationSeconds: 3600,
      totalTurns: 48,
      participantUids: ['p1', 'p2', 'p3'],
      retentionUntil: Date.now() + 365 * 24 * 3600000,
      playerSnapshots: [
        {
          uid: 'p1',
          displayName: 'Arjun (Maharaja)',
          photoURL: null,
          finalCash: 18400,
          netWorth: 34500,
          rank: 1,
          propertiesCount: 9,
        },
        {
          uid: 'p2',
          displayName: 'Priya (Mumbai)',
          photoURL: null,
          finalCash: 0,
          netWorth: 12000,
          rank: 2,
          propertiesCount: 4,
        },
        {
          uid: 'p3',
          displayName: 'Vikram (Delhi)',
          photoURL: null,
          finalCash: 0,
          netWorth: 0,
          rank: 3,
          propertiesCount: 0,
        },
      ],
    },
  ];

  return (
    <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-indian-parchment-300 dark:border-indian-navy-700">
        <button
          onClick={() => navigate('/home')}
          className="flex items-center gap-1.5 text-xs font-semibold text-indian-navy-700 dark:text-indian-parchment-300 hover:text-indian-terracotta-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        <h1 className="font-serif font-bold text-lg text-indian-navy-900 dark:text-indian-parchment-100">
          Game Archives & History
        </h1>
      </div>

      <div className="space-y-4">
        {mockArchives.map((archive) => (
          <Card key={archive.archiveId} className="p-4 border-indian-parchment-300">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-indian-parchment-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Trophy className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-indian-navy-900 dark:text-indian-parchment-100">
                    Winner: {archive.winnerName}
                  </h4>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {Math.round(archive.durationSeconds / 60)} mins
                    </span>
                    <span>•</span>
                    <span>{archive.totalTurns} turns</span>
                    <span>•</span>
                    <span>v{archive.rulesetVersion}</span>
                  </div>
                </div>
              </div>

              <Badge variant="emerald" className="text-[10px]">
                Archived & Verified
              </Badge>
            </div>

            {/* Standings Table */}
            <div className="mt-3 space-y-1.5">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                Final Standings
              </span>
              {archive.playerSnapshots.map((p) => (
                <div
                  key={p.uid}
                  className="flex items-center justify-between text-xs py-1 px-2 rounded bg-indian-parchment-100/60 dark:bg-indian-navy-800/60"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-500 w-4">#{p.rank}</span>
                    <span className="font-semibold text-indian-navy-900 dark:text-indian-parchment-100">
                      {p.displayName}
                    </span>
                    <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                      <Building className="w-2.5 h-2.5" /> {p.propertiesCount}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-700">₹{p.netWorth.toLocaleString('en-IN')}</span>
                    <span className="text-[10px] text-gray-400 block">cash: ₹{p.finalCash.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
