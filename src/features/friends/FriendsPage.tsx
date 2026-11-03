import React, { useState } from 'react';
import { useFriendsStore } from './use-friends-store';
import { useAuthStore } from '@/features/auth/use-auth-store';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Users, UserPlus, Check, X, Trash2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const FriendsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { friends, pendingRequests, sendRequest, acceptRequest, rejectRequest, removeFriend, error } =
    useFriendsStore();

  const [codeQuery, setCodeQuery] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeQuery.trim()) return;
    const ok = await sendRequest(codeQuery);
    if (ok) {
      setSuccessMsg(`Friend request sent to code ${codeQuery.toUpperCase()}!`);
      setCodeQuery('');
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  return (
    <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-indian-parchment-300 dark:border-indian-navy-700">
        <button
          onClick={() => navigate('/home')}
          className="flex items-center gap-1.5 text-xs font-semibold text-indian-navy-700 dark:text-indian-parchment-300 hover:text-indian-terracotta-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase tracking-widest block">Your Friend Code</span>
          <span className="font-mono text-sm font-bold text-indian-terracotta-600 bg-indian-terracotta-50 px-2 py-0.5 rounded border border-indian-terracotta-200">
            {user?.friendCode || 'XXXXXX'}
          </span>
        </div>
      </div>

      {/* Add Friend Form */}
      <Card className="p-4 mb-6 border-indian-parchment-300">
        <h3 className="text-xs font-bold text-indian-navy-800 dark:text-indian-parchment-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <UserPlus className="w-4 h-4 text-indian-terracotta-500" /> Add Friend by Code
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Enter your friend's 6-character code to send them a private friend request.
        </p>

        <form onSubmit={handleSendRequest} className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. MEERA4"
            value={codeQuery}
            onChange={(e) => setCodeQuery(e.target.value.toUpperCase())}
            maxLength={8}
            className="flex-1 bg-white dark:bg-indian-navy-900 border border-indian-parchment-400 dark:border-indian-navy-700 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indian-terracotta-500"
          />
          <Button type="submit" variant="primary" disabled={codeQuery.trim().length < 4} className="font-bold text-xs px-5">
            Send Request
          </Button>
        </form>

        {error && <p className="text-xs text-red-600 mt-2 font-medium">{error}</p>}
        {successMsg && <p className="text-xs text-emerald-600 mt-2 font-medium">{successMsg}</p>}
      </Card>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-bold text-indian-navy-800 dark:text-indian-parchment-200 uppercase tracking-wider mb-2">
            Pending Friend Requests ({pendingRequests.length})
          </h3>
          <div className="space-y-2">
            {pendingRequests.map((req) => (
              <Card key={req.id} className="p-3 flex items-center justify-between border-amber-300 bg-amber-50/50">
                <div>
                  <span className="text-xs font-bold text-indian-navy-900 block">{req.senderName}</span>
                  <span className="text-[10px] text-gray-500 font-mono">Code: {req.senderFriendCode}</span>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="primary" onClick={() => acceptRequest(req.id)} className="text-xs px-3 py-1">
                    <Check className="w-3.5 h-3.5" /> Accept
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => rejectRequest(req.id)} className="text-xs px-2 py-1 text-red-600">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Friends List */}
      <div>
        <h3 className="text-xs font-bold text-indian-navy-800 dark:text-indian-parchment-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Users className="w-4 h-4 text-indian-navy-600" /> Active Friends ({friends.length})
        </h3>

        {friends.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400 border border-dashed border-indian-parchment-300 rounded-xl">
            No friends added yet. Share your friend code with colleagues and friends!
          </div>
        ) : (
          <div className="space-y-2">
            {friends.map((f) => (
              <Card key={f.uid} className="p-3.5 flex items-center justify-between border-indian-parchment-300">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-indian-navy-700 text-white font-bold text-xs flex items-center justify-center">
                    {f.displayName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-indian-navy-900 dark:text-indian-parchment-100">
                        {f.displayName}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          f.isOnline ? 'bg-emerald-500' : 'bg-gray-400'
                        }`}
                        title={f.isOnline ? 'Online' : 'Offline'}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500 font-mono">Code: {f.friendCode}</span>
                  </div>
                </div>

                <button
                  onClick={() => removeFriend(f.uid)}
                  title="Remove friend"
                  className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
