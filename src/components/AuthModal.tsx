import { Lock, Shield, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import type { PublicUser } from '../types';

interface AuthModalProps {
  open: boolean;
  adminInitialized: boolean;
  onClose: () => void;
  onSuccess: (user: PublicUser) => void;
}

export function AuthModal({
  open,
  adminInitialized,
  onClose,
  onSuccess,
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'admin-setup'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await api.login({ email, password });
        onSuccess(res.user);
      } else if (mode === 'register') {
        const res = await api.register({ email, username, password });
        onSuccess(res.user);
      } else {
        const res = await api.setupAdmin({
          email,
          username: username || 'Platform Owner',
          password,
        });
        onSuccess(res.user);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="glass-surface relative w-full max-w-md rounded-2xl p-6 sm:p-8 shadow-2xl">
        <button
          type="button"
          aria-label="Close authentication modal"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs font-medium text-[#ff7b39] mb-2">
            <Lock className="h-3.5 w-3.5" />
            <span>GTA 6 CLOUD Account</span>
          </div>
          <h2 id="auth-modal-title" className="text-2xl font-bold text-white">
            {mode === 'login'
              ? 'Sign in to your account'
              : mode === 'register'
                ? 'Create your gaming account'
                : 'Initialize platform owner'}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {mode === 'admin-setup'
              ? 'One-time setup for the initial platform administrator.'
              : 'Track rental countdowns, verify crypto payments, and launch sessions.'}
          </p>
        </div>

        <div className="mb-6 flex rounded-xl bg-white/5 p-1 border border-white/10">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              mode === 'login'
                ? 'bg-[#ff2e93] text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              mode === 'register'
                ? 'bg-[#ff2e93] text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="player@example.com"
              className="w-full rounded-xl border border-white/15 bg-[#0a0812] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#ff2e93] focus:outline-none"
            />
          </div>

          {mode !== 'login' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {mode === 'admin-setup' ? 'Admin Name' : 'Gamertag / Username'}
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={32}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={mode === 'admin-setup' ? 'Platform Owner' : 'ViceRunner99'}
                className="w-full rounded-xl border border-white/15 bg-[#0a0812] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#ff2e93] focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              minLength={mode === 'admin-setup' ? 10 : 8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'admin-setup' ? 'Minimum 10 characters' : 'Minimum 8 characters'}
              className="w-full rounded-xl border border-white/15 bg-[#0a0812] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#ff2e93] focus:outline-none"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full vice-cta-gradient rounded-xl py-3 px-4 text-sm font-bold text-white shadow-lg shadow-[#ff2e93]/25 hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            {loading
              ? 'Processing...'
              : mode === 'login'
                ? 'Sign In'
                : mode === 'register'
                  ? 'Create Account'
                  : 'Create Owner Admin Account'}
          </button>
        </form>

        {!adminInitialized && mode !== 'admin-setup' && (
          <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-[#38bdf8]" />
              No admin owner set yet
            </span>
            <button
              type="button"
              onClick={() => {
                setMode('admin-setup');
                setError(null);
              }}
              className="text-[#38bdf8] hover:underline font-medium cursor-pointer"
            >
              Initialize Admin
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
