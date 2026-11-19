import {
  Ban,
  Check,
  Plus,
  RefreshCw,
  Save,
  Shield,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, formatCountdown, formatDuration } from '../lib/api';
import type {
  AdminOverviewData,
  CryptoCurrency,
  PaymentStatus,
  PublicUser,
  SupportStatus,
} from '../types';

interface AdminDashboardProps {
  user: PublicUser | null;
  adminInitialized: boolean;
  onAdminAuthenticated: (user: PublicUser) => void;
  onDataUpdated: () => void;
}

type AdminTab = 'transactions' | 'sessions' | 'users' | 'packages' | 'wallets' | 'support';

export function AdminDashboard({
  user,
  adminInitialized,
  onAdminAuthenticated,
  onDataUpdated,
}: AdminDashboardProps) {
  const [tab, setTab] = useState<AdminTab>('transactions');
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [txFilter, setTxFilter] = useState<'All' | PaymentStatus>('All');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // First-time owner setup form (only rendered if ZERO admins exist in DB)
  const [setupEmail, setSetupEmail] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupSubmitting, setSetupSubmitting] = useState(false);

  // Editable wallet states
  const [walletDrafts, setWalletDrafts] = useState<
    Record<string, { address: string; minConfirmations: number }>
  >({});

  // Editable package states
  const [pkgDrafts, setPkgDrafts] = useState<
    Record<string, { name: string; durationMinutes: number; priceUsd: number; active: boolean }>
  >({});
  const [newPkgName, setNewPkgName] = useState('');
  const [newPkgDuration, setNewPkgDuration] = useState(120);
  const [newPkgPrice, setNewPkgPrice] = useState(90);

  // Support note drafts
  const [supportDrafts, setSupportDrafts] = useState<
    Record<string, { status: SupportStatus; adminNotes: string }>
  >({});

  const loadAdmin = useCallback(async () => {
    if (user?.role !== 'admin') {
      setLoading(false);
      return;
    }
    try {
      const overview = await api.getAdminOverview();
      setData(overview);

      const wMap: Record<string, { address: string; minConfirmations: number }> = {};
      for (const w of overview.wallets) {
        wMap[w.currency] = { address: w.address, minConfirmations: w.minConfirmations };
      }
      setWalletDrafts(wMap);

      const pMap: Record<
        string,
        { name: string; durationMinutes: number; priceUsd: number; active: boolean }
      > = {};
      for (const p of overview.packages) {
        pMap[p.id] = {
          name: p.name,
          durationMinutes: p.durationMinutes,
          priceUsd: p.priceUsd,
          active: p.active,
        };
      }
      setPkgDrafts(pMap);

      const sMap: Record<string, { status: SupportStatus; adminNotes: string }> = {};
      for (const sr of overview.supportRequests) {
        sMap[sr.id] = { status: sr.status, adminNotes: sr.adminNotes || '' };
      }
      setSupportDrafts(sMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin overview.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadAdmin();
  }, [loadAdmin]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function handleSetupAdmin(e: FormEvent) {
    e.preventDefault();
    setSetupSubmitting(true);
    setError(null);
    try {
      const res = await api.setupAdmin({
        email: setupEmail,
        username: 'Platform Admin',
        password: setupPassword,
      });
      onAdminAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin setup failed.');
    } finally {
      setSetupSubmitting(false);
    }
  }

  if (user?.role !== 'admin') {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16">
        <div className="glass-surface rounded-2xl p-8 space-y-5">
          <div className="flex items-center gap-2 text-[#38bdf8] text-xs font-semibold">
            <Shield className="h-4 w-4" />
            <span>Role-Based Admin Console</span>
          </div>

          {!adminInitialized ? (
            <>
              <h1 className="text-2xl font-bold text-white">
                Initialize Platform Owner Account
              </h1>
              <p className="text-sm text-slate-300">
                No administrator account exists yet. Create the sole owner account to
                manage packages, cryptocurrency wallets, sessions, and revenue.
              </p>
              <form onSubmit={handleSetupAdmin} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Owner Email</label>
                  <input
                    type="email"
                    required
                    value={setupEmail}
                    onChange={(e) => setSetupEmail(e.target.value)}
                    placeholder="owner@yourdomain.com"
                    className="w-full rounded-xl border border-white/15 bg-[#0a0812] px-4 py-2.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Owner Password (min 10 chars)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={10}
                    value={setupPassword}
                    onChange={(e) => setSetupPassword(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-[#0a0812] px-4 py-2.5 text-sm text-white"
                  />
                </div>
                {error && (
                  <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={setupSubmitting}
                  className="vice-cta-gradient rounded-xl px-6 py-3 text-xs font-bold text-white cursor-pointer"
                >
                  {setupSubmitting ? 'Creating...' : 'Create Owner Admin Account'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-white">Administrator Access Required</h1>
              <p className="text-sm text-slate-400">
                This route is restricted to accounts with <code className="font-mono">role = admin</code>.
                Sign in with an administrator account to inspect platform revenue and manage
                wallets or packages.
              </p>
            </>
          )}
        </div>
      </section>
    );
  }

  async function handleRecheckOrder(orderId: string) {
    setFeedback(null);
    setError(null);
    try {
      await api.adminRecheckOrder(orderId);
      setFeedback(`Re-checked order ${orderId} against blockchain RPC.`);
      await loadAdmin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-check failed.');
    }
  }

  async function handleRevokeSession(sessionId: string) {
    setFeedback(null);
    setError(null);
    try {
      await api.adminRevokeSession(sessionId);
      setFeedback(`Session ${sessionId} revoked.`);
      await loadAdmin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Revoke failed.');
    }
  }

  async function handleSavePackage(id: string) {
    const draft = pkgDrafts[id];
    if (!draft) return;
    setFeedback(null);
    setError(null);
    try {
      await api.adminUpdatePackage(id, {
        name: draft.name,
        durationMinutes: Number(draft.durationMinutes),
        priceUsd: Number(draft.priceUsd),
        buttonLabel: `RENT FOR $${Number(draft.priceUsd)}`,
        active: draft.active,
      });
      setFeedback(`Updated package "${draft.name}".`);
      await loadAdmin();
      onDataUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Package update failed.');
    }
  }

  async function handleCreatePackage(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setError(null);
    try {
      await api.adminCreatePackage({
        name: newPkgName,
        subtitle: 'Custom cloud gaming rental duration',
        durationMinutes: Number(newPkgDuration),
        priceUsd: Number(newPkgPrice),
        buttonLabel: `RENT FOR $${Number(newPkgPrice)}`,
      });
      setNewPkgName('');
      setFeedback('Created new rental package.');
      await loadAdmin();
      onDataUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create package.');
    }
  }

  async function handleSaveWallet(currency: CryptoCurrency) {
    const draft = walletDrafts[currency];
    if (!draft) return;
    setFeedback(null);
    setError(null);
    try {
      await api.adminUpdateWallet(currency, {
        address: draft.address,
        minConfirmations: Number(draft.minConfirmations),
      });
      setFeedback(`Updated ${currency} receiving wallet address.`);
      await loadAdmin();
      onDataUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wallet update failed.');
    }
  }

  async function handleSaveSupport(id: string) {
    const draft = supportDrafts[id];
    if (!draft) return;
    setFeedback(null);
    setError(null);
    try {
      await api.adminUpdateSupport(id, draft);
      setFeedback(`Updated support ticket ${id}.`);
      await loadAdmin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Support update failed.');
    }
  }

  const filteredOrders =
    data?.orders.filter((o) => txFilter === 'All' || o.status === txFilter) || [];

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <p className="text-xs font-medium text-[#38bdf8]">
            Owner Operations · Role-Protected
          </p>
          <h1 className="mt-1 text-3xl font-bold text-white">Admin Console</h1>
        </div>
        <button
          type="button"
          onClick={() => void loadAdmin()}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/10 cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh Data
        </button>
      </div>

      {feedback && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs sm:text-sm text-emerald-200 flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs sm:text-sm text-rose-200">
          {error}
        </div>
      )}

      {loading || !data ? (
        <div className="glass-surface rounded-2xl p-8 h-48 animate-pulse" />
      ) : (
        <>
          {/* Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              {
                label: 'Total Revenue',
                value: `$${data.metrics.totalRevenueUsd.toFixed(2)}`,
                accent: 'text-emerald-400',
              },
              {
                label: 'Confirmed Tx',
                value: String(data.metrics.confirmedTransactions),
                accent: 'text-white',
              },
              {
                label: 'Pending Tx',
                value: String(data.metrics.pendingTransactions),
                accent: 'text-amber-400',
              },
              {
                label: 'Active Sessions',
                value: String(data.metrics.activeSessions),
                accent: 'text-[#ff7b39]',
              },
              {
                label: 'Users',
                value: String(data.metrics.registeredUsers),
                accent: 'text-white',
              },
              {
                label: 'Open Support',
                value: String(data.metrics.openSupportRequests),
                accent: 'text-[#38bdf8]',
              },
            ].map((m) => (
              <div key={m.label} className="glass-surface rounded-xl p-4">
                <p className="text-xs text-slate-400">{m.label}</p>
                <p className={`mt-1 font-mono text-2xl font-bold tabular-nums ${m.accent}`}>
                  {m.value}
                </p>
              </div>
            ))}
          </div>

          {/* Sub-navigation Tabs */}
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 w-fit">
            {(
              [
                { id: 'transactions', label: 'Transactions' },
                { id: 'sessions', label: 'Active Sessions' },
                { id: 'users', label: 'Registered Users' },
                { id: 'packages', label: 'Packages' },
                { id: 'wallets', label: 'Crypto Wallets' },
                { id: 'support', label: 'Refunds & Support' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  tab === t.id ? 'bg-[#38bdf8] text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* TRANSACTIONS */}
          {tab === 'transactions' && (
            <div className="glass-surface rounded-2xl p-6 space-y-4 overflow-x-auto">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-white">
                  Rental Purchases & On-Chain Verification
                </h2>
                <div className="flex gap-1 rounded-lg bg-white/5 p-1">
                  {(['All', 'Confirmed', 'Pending', 'Failed'] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setTxFilter(status)}
                      className={`rounded-md px-3 py-1 text-xs font-semibold cursor-pointer ${
                        txFilter === status
                          ? 'bg-white text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="py-3 pr-4">User</th>
                    <th className="py-3 pr-4">Package</th>
                    <th className="py-3 pr-4">Amount</th>
                    <th className="py-3 pr-4">TX Hash</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredOrders.map((o) => (
                    <tr key={o.id}>
                      <td className="py-3 pr-4 text-slate-200">{o.userEmail}</td>
                      <td className="py-3 pr-4 text-white font-medium">
                        {o.packageName} (${o.priceUsd})
                      </td>
                      <td className="py-3 pr-4 font-mono tabular-nums text-slate-300">
                        {o.expectedCryptoAmount} {o.currency.replace('_ERC20', '')}
                      </td>
                      <td className="py-3 pr-4 font-mono text-slate-400 max-w-[200px] truncate">
                        {o.txHash || 'Awaiting tx hash'}
                      </td>
                      <td className="py-3 pr-4 font-bold">
                        <span
                          className={
                            o.status === 'Confirmed'
                              ? 'text-emerald-400'
                              : o.status === 'Failed'
                                ? 'text-rose-400'
                                : 'text-amber-400'
                          }
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="py-3">
                        {o.txHash && o.status !== 'Confirmed' && (
                          <button
                            type="button"
                            onClick={() => handleRecheckOrder(o.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1 text-white hover:bg-white/10 cursor-pointer"
                          >
                            <RefreshCw className="h-3 w-3" />
                            Re-check
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        No transactions match this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* SESSIONS */}
          {tab === 'sessions' && (
            <div className="glass-surface rounded-2xl p-6 overflow-x-auto">
              <h2 className="text-lg font-bold text-white mb-4">
                Active & Historical Gaming Sessions
              </h2>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="py-3 pr-4">Player</th>
                    <th className="py-3 pr-4">Package</th>
                    <th className="py-3 pr-4">Remaining</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3">Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {data.sessions.map((s) => {
                    const rem = Math.max(0, new Date(s.expiresAt).getTime() - nowMs);
                    const liveActive = s.status === 'Active' && rem > 0;
                    return (
                      <tr key={s.id}>
                        <td className="py-3 pr-4 text-slate-200">{s.userEmail}</td>
                        <td className="py-3 pr-4 text-white font-medium">
                          {s.packageName} ({formatDuration(s.durationMinutes)})
                        </td>
                        <td className="py-3 pr-4 font-mono tabular-nums text-slate-300">
                          {liveActive ? formatCountdown(rem) : '00:00:00'}
                        </td>
                        <td className="py-3 pr-4 font-bold">
                          <span className={liveActive ? 'text-emerald-400' : 'text-slate-400'}>
                            {liveActive ? 'Active' : s.status === 'Revoked' ? 'Revoked' : 'Expired'}
                          </span>
                        </td>
                        <td className="py-3">
                          {liveActive && (
                            <button
                              type="button"
                              onClick={() => handleRevokeSession(s.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-rose-200 hover:bg-rose-500/20 cursor-pointer"
                            >
                              <Ban className="h-3 w-3" />
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {data.sessions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        No gaming sessions recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* USERS */}
          {tab === 'users' && (
            <div className="glass-surface rounded-2xl p-6 overflow-x-auto">
              <h2 className="text-lg font-bold text-white mb-4">Registered Users</h2>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="py-3 pr-4">Username</th>
                    <th className="py-3 pr-4">Email</th>
                    <th className="py-3 pr-4">Role</th>
                    <th className="py-3 pr-4">Orders</th>
                    <th className="py-3 pr-4">Total Spent</th>
                    <th className="py-3">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {data.users.map((u) => (
                    <tr key={u.id}>
                      <td className="py-3 pr-4 font-medium text-white">{u.username}</td>
                      <td className="py-3 pr-4 text-slate-300">{u.email}</td>
                      <td className="py-3 pr-4 font-mono text-[#38bdf8]">{u.role}</td>
                      <td className="py-3 pr-4 tabular-nums text-slate-300">{u.orderCount}</td>
                      <td className="py-3 pr-4 font-mono tabular-nums text-emerald-400">
                        ${u.totalSpentUsd.toFixed(2)}
                      </td>
                      <td className="py-3 tabular-nums text-slate-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* PACKAGES */}
          {tab === 'packages' && (
            <div className="space-y-6">
              <div className="glass-surface rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-white">Manage Rental Packages</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {data.packages.map((pkg) => {
                    const draft = pkgDrafts[pkg.id];
                    if (!draft) return null;
                    return (
                      <div
                        key={pkg.id}
                        className="rounded-xl border border-white/10 bg-[#0a0812] p-4 space-y-3"
                      >
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">
                            Package Name
                          </label>
                          <input
                            type="text"
                            value={draft.name}
                            onChange={(e) =>
                              setPkgDrafts((prev) => ({
                                ...prev,
                                [pkg.id]: { ...draft, name: e.target.value },
                              }))
                            }
                            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">
                              Minutes
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={draft.durationMinutes}
                              onChange={(e) =>
                                setPkgDrafts((prev) => ({
                                  ...prev,
                                  [pkg.id]: {
                                    ...draft,
                                    durationMinutes: Number(e.target.value),
                                  },
                                }))
                              }
                              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">
                              Price (USD)
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={draft.priceUsd}
                              onChange={(e) =>
                                setPkgDrafts((prev) => ({
                                  ...prev,
                                  [pkg.id]: { ...draft, priceUsd: Number(e.target.value) },
                                }))
                              }
                              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-xs text-white"
                            />
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={draft.active}
                            onChange={(e) =>
                              setPkgDrafts((prev) => ({
                                ...prev,
                                [pkg.id]: { ...draft, active: e.target.checked },
                              }))
                            }
                            className="accent-[#38bdf8]"
                          />
                          Visible on homepage
                        </label>
                        <button
                          type="button"
                          onClick={() => handleSavePackage(pkg.id)}
                          className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#38bdf8] py-2 text-xs font-bold text-slate-950 cursor-pointer"
                        >
                          <Save className="h-3.5 w-3.5" />
                          Save Changes
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <form
                onSubmit={handleCreatePackage}
                className="glass-surface rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
              >
                <div>
                  <label className="block text-xs text-slate-400 mb-1">New Package Name</label>
                  <input
                    type="text"
                    required
                    value={newPkgName}
                    onChange={(e) => setNewPkgName(e.target.value)}
                    placeholder="Marathon Session"
                    className="w-full rounded-lg border border-white/15 bg-[#0a0812] px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Duration (Min)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newPkgDuration}
                    onChange={(e) => setNewPkgDuration(Number(e.target.value))}
                    className="w-full rounded-lg border border-white/15 bg-[#0a0812] px-3 py-2 font-mono text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Price (USD)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newPkgPrice}
                    onChange={(e) => setNewPkgPrice(Number(e.target.value))}
                    className="w-full rounded-lg border border-white/15 bg-[#0a0812] px-3 py-2 font-mono text-xs text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="vice-cta-gradient inline-flex items-center justify-center gap-1.5 rounded-lg py-2 px-4 text-xs font-bold text-white cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Package
                </button>
              </form>
            </div>
          )}

          {/* WALLETS */}
          {tab === 'wallets' && (
            <div className="glass-surface rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-white">
                Manage Receiving Cryptocurrency Wallet Addresses
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.wallets.map((w) => {
                  const draft = walletDrafts[w.currency];
                  if (!draft) return null;
                  return (
                    <div
                      key={w.currency}
                      className="rounded-xl border border-white/10 bg-[#0a0812] p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">{w.label}</span>
                        <span className="text-slate-400">{w.network}</span>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">
                          Receiving Address
                        </label>
                        <input
                          type="text"
                          value={draft.address}
                          onChange={(e) =>
                            setWalletDrafts((prev) => ({
                              ...prev,
                              [w.currency]: { ...draft, address: e.target.value },
                            }))
                          }
                          className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-xs text-white"
                        />
                      </div>
                      <div className="flex items-end gap-3">
                        <div className="w-32">
                          <label className="block text-[11px] text-slate-400 mb-1">
                            Min Confirmations
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={draft.minConfirmations}
                            onChange={(e) =>
                              setWalletDrafts((prev) => ({
                                ...prev,
                                [w.currency]: {
                                  ...draft,
                                  minConfirmations: Number(e.target.value),
                                },
                              }))
                            }
                            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-xs text-white"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSaveWallet(w.currency)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#38bdf8] py-2 px-4 text-xs font-bold text-slate-950 cursor-pointer"
                        >
                          <Save className="h-3.5 w-3.5" />
                          Update Wallet
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SUPPORT & REFUNDS */}
          {tab === 'support' && (
            <div className="glass-surface rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-white">Refunds & Support Requests</h2>
              {data.supportRequests.length === 0 ? (
                <p className="text-sm text-slate-400">No support requests submitted yet.</p>
              ) : (
                <div className="space-y-4">
                  {data.supportRequests.map((sr) => {
                    const draft = supportDrafts[sr.id];
                    if (!draft) return null;
                    return (
                      <div
                        key={sr.id}
                        className="rounded-xl border border-white/10 bg-[#0a0812] p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-sm text-white">{sr.subject}</p>
                            <p className="text-xs text-slate-400">
                              {sr.userEmail} · {sr.type} ·{' '}
                              {new Date(sr.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <span className="text-xs font-bold text-[#38bdf8]">{sr.status}</span>
                        </div>
                        <p className="text-xs text-slate-300">{sr.message}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
                          <select
                            value={draft.status}
                            onChange={(e) =>
                              setSupportDrafts((prev) => ({
                                ...prev,
                                [sr.id]: {
                                  ...draft,
                                  status: e.target.value as SupportStatus,
                                },
                              }))
                            }
                            className="sm:col-span-3 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                          >
                            <option value="Open">Open</option>
                            <option value="In Review">In Review</option>
                            <option value="Refund Approved">Refund Approved</option>
                            <option value="Resolved">Resolved</option>
                          </select>
                          <input
                            type="text"
                            value={draft.adminNotes}
                            onChange={(e) =>
                              setSupportDrafts((prev) => ({
                                ...prev,
                                [sr.id]: { ...draft, adminNotes: e.target.value },
                              }))
                            }
                            placeholder="Resolution notes visible to user..."
                            className="sm:col-span-7 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveSupport(sr.id)}
                            className="sm:col-span-2 rounded-lg bg-[#38bdf8] py-2 px-3 text-xs font-bold text-slate-950 cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
