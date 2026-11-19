import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  LogOut,
  Play,
  Plus,
  RefreshCw,
  ServerCrash,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, formatCountdown, formatDuration } from '../lib/api';
import type {
  CloudLaunchResponse,
  CloudProviderStatus,
  GamingSession,
  PublicUser,
  RentalOrder,
  SupportRequest,
  WalletAddressConfig,
} from '../types';

interface GamingDashboardProps {
  user: PublicUser;
  wallets: WalletAddressConfig[];
  onRentNew: () => void;
  onLogout: () => void;
}

type DashTab = 'session' | 'rentals' | 'payments' | 'support';

export function GamingDashboard({
  user,
  wallets,
  onRentNew,
  onLogout,
}: GamingDashboardProps) {
  const [tab, setTab] = useState<DashTab>('session');
  const [orders, setOrders] = useState<RentalOrder[]>([]);
  const [sessions, setSessions] = useState<GamingSession[]>([]);
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]);
  const [cloudProvider, setCloudProvider] = useState<CloudProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [launchState, setLaunchState] = useState<CloudLaunchResponse | null>(null);
  const [launching, setLaunching] = useState(false);

  // Pending tx verification right inside dashboard
  const [txInputs, setTxInputs] = useState<Record<string, string>>({});
  const [verifyingOrderId, setVerifyingOrderId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Support / Refund form
  const [supType, setSupType] = useState<'Refund' | 'Payment' | 'Technical' | 'General'>('Technical');
  const [supOrderId, setSupOrderId] = useState('');
  const [supSubject, setSupSubject] = useState('');
  const [supMessage, setSupMessage] = useState('');
  const [supSubmitting, setSupSubmitting] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const data = await api.getUserDashboard();
      setOrders(data.orders);
      setSessions(data.sessions);
      setSupportRequests(data.supportRequests);
      setCloudProvider(data.cloudProvider);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const activeSession =
    sessions.find((s) => s.status === 'Active' && new Date(s.expiresAt).getTime() > nowMs) ||
    sessions[0] ||
    null;

  const activeOrder = activeSession
    ? orders.find((o) => o.id === activeSession.orderId) || null
    : orders[0] || null;

  const remainingMs = activeSession
    ? Math.max(0, new Date(activeSession.expiresAt).getTime() - nowMs)
    : 0;

  const isSessionCurrentlyActive =
    Boolean(activeSession) &&
    activeSession?.status === 'Active' &&
    remainingMs > 0;

  const isSessionJustExpired =
    Boolean(activeSession) &&
    (activeSession?.status === 'Expired' ||
      (activeSession?.status === 'Active' && remainingMs <= 0));

  async function handleLaunchGame() {
    if (!activeSession) return;
    setLaunching(true);
    setActionError(null);
    try {
      const res = await api.launchSession(activeSession.id);
      setLaunchState(res);
      await loadDashboard();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Launch check failed.');
    } finally {
      setLaunching(false);
    }
  }

  async function handleVerifyOrder(orderId: string) {
    const hash = (txInputs[orderId] || '').trim();
    if (!hash) return;
    setVerifyingOrderId(orderId);
    setActionError(null);
    setActionMessage(null);
    try {
      const res = await api.verifyOrder(orderId, hash);
      setActionMessage(res.verification.message);
      await loadDashboard();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setVerifyingOrderId(null);
    }
  }

  async function handleRecheckOrder(orderId: string) {
    setVerifyingOrderId(orderId);
    setActionError(null);
    setActionMessage(null);
    try {
      const res = await api.recheckOrder(orderId);
      setActionMessage(res.verification.message);
      await loadDashboard();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Re-check failed.');
    } finally {
      setVerifyingOrderId(null);
    }
  }

  async function handleSubmitSupport(e: FormEvent) {
    e.preventDefault();
    setSupSubmitting(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await api.createSupportRequest({
        type: supType,
        subject: supSubject,
        message: supMessage,
        orderId: supOrderId || undefined,
      });
      setSupSubject('');
      setSupMessage('');
      setSupOrderId('');
      setActionMessage('Support request submitted to the platform team.');
      await loadDashboard();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not submit support request.');
    } finally {
      setSupSubmitting(false);
    }
  }

  function getExplorerUrl(order: RentalOrder): string | null {
    if (!order.txHash) return null;
    const w = wallets.find((item) => item.currency === order.currency);
    return w ? `${w.explorerTxBaseUrl}${order.txHash}` : null;
  }

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <p className="text-xs font-medium text-[#ff7b39]">
            Cloud Gaming Control Panel · {user.email}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-white">
            Welcome back, {user.username}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onRentNew}
            className="vice-cta-gradient inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#ff2e93]/20 hover:opacity-95 cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            RENT NEW SESSION
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer whitespace-nowrap"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Global feedback messages */}
      {actionMessage && (
        <div className="rounded-xl border border-[#38bdf8]/40 bg-[#38bdf8]/10 px-4 py-3 text-xs sm:text-sm text-sky-100">
          {actionMessage}
        </div>
      )}
      {actionError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs sm:text-sm text-rose-200">
          {actionError}
        </div>
      )}

      {/* Segmented Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 w-fit">
        {(
          [
            { id: 'session', label: 'Active Session' },
            { id: 'rentals', label: 'Rental History' },
            { id: 'payments', label: 'Payment History' },
            { id: 'support', label: 'Support & Refunds' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === item.id
                ? 'bg-[#ff2e93] text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="glass-surface rounded-2xl p-8 space-y-4">
          <div className="h-6 w-52 rounded bg-white/10 animate-pulse" />
          <div className="h-24 w-full rounded-xl bg-white/5 animate-pulse" />
        </div>
      ) : (
        <>
          {/* TAB 1: ACTIVE SESSION & LAUNCH */}
          {tab === 'session' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Session Control Card */}
              <div className="lg:col-span-7 glass-surface rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
                {activeSession ? (
                  <>
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                        <div>
                          <p className="text-xs text-slate-400">Purchased Package</p>
                          <h2 className="text-2xl font-bold text-white">
                            {activeSession.packageName} ·{' '}
                            {formatDuration(activeSession.durationMinutes)}
                          </h2>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Session Status</p>
                          <span
                            className={`inline-flex items-center gap-1.5 text-sm font-bold ${
                              isSessionCurrentlyActive
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {isSessionCurrentlyActive ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                            {isSessionCurrentlyActive ? 'Active' : activeSession.status === 'Revoked' ? 'Revoked' : 'Expired'}
                          </span>
                        </div>
                      </div>

                      {/* Expiration Notification */}
                      {isSessionJustExpired && (
                        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 flex items-start gap-3 text-xs sm:text-sm text-rose-100">
                          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
                          <div>
                            <p className="font-bold text-rose-300">
                              Session Expired Automatically
                            </p>
                            <p className="mt-1">
                              Your purchased rental window ended at{' '}
                              {new Date(activeSession.expiresAt).toLocaleString()}. Rent a new
                              session to regain cloud access.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Countdown & Payment Confirmation */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-white/10 bg-[#0a0812] p-4">
                          <p className="text-xs text-slate-400">Remaining Gaming Time</p>
                          <p className="mt-1 font-mono text-3xl font-extrabold text-white tabular-nums">
                            {formatCountdown(remainingMs)}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            Expires {new Date(activeSession.expiresAt).toLocaleTimeString()}
                          </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-[#0a0812] p-4 space-y-1.5">
                          <p className="text-xs text-slate-400">Payment Confirmation</p>
                          <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-400">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Confirmed On-Chain</span>
                          </div>
                          {activeOrder?.txHash && (
                            <p className="font-mono text-[11px] text-slate-400 truncate">
                              TX: {activeOrder.txHash}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Large LAUNCH GTA 6 Button */}
                    <div className="pt-2 space-y-3">
                      <button
                        type="button"
                        disabled={!isSessionCurrentlyActive || launching}
                        onClick={handleLaunchGame}
                        className="w-full vice-cta-gradient inline-flex items-center justify-center gap-3 rounded-xl py-4 px-6 text-base font-extrabold tracking-wide text-white shadow-xl shadow-[#ff2e93]/30 hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                      >
                        <Play className="h-5 w-5 fill-current" />
                        {launching
                          ? 'CONTACTING CLOUD STREAMING PROVIDER...'
                          : isSessionCurrentlyActive
                            ? 'LAUNCH GTA 6'
                            : 'SESSION EXPIRED — RENT NEW TIME'}
                      </button>

                      {launchState && (
                        <div
                          className={`rounded-xl border p-4 text-xs sm:text-sm space-y-2 ${
                            launchState.statusCode === 'STREAM_READY'
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                              : 'border-amber-500/40 bg-amber-500/10 text-amber-100'
                          }`}
                        >
                          <div className="flex items-center gap-2 font-bold">
                            <ServerCrash className="h-4 w-4 shrink-0" />
                            <span>
                              {launchState.statusCode === 'STREAM_READY'
                                ? 'WebRTC Stream Provisioned'
                                : 'Cloud Gaming Infrastructure Not Connected'}
                            </span>
                          </div>
                          <p>{launchState.message}</p>
                          {launchState.streamEndpoint && (
                            <p className="font-mono text-xs">
                              Endpoint: {launchState.streamEndpoint}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center space-y-4">
                    <Clock className="mx-auto h-10 w-10 text-slate-500" />
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        No Active Gaming Session
                      </h2>
                      <p className="mt-1 text-sm text-slate-400 max-w-md mx-auto">
                        Rent a 10-minute, 30-minute, or 1-hour session with cryptocurrency to
                        unlock your timed cloud dashboard.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onRentNew}
                      className="vice-cta-gradient rounded-xl px-6 py-3 text-xs font-bold text-white cursor-pointer"
                    >
                      PLAY GTA 6 NOW
                    </button>
                  </div>
                )}
              </div>

              {/* Right Column: Honest Cloud Gaming Infrastructure Integration Panel */}
              <div className="lg:col-span-5 glass-surface rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#38bdf8]">
                      Streaming Infrastructure
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        cloudProvider?.connected ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {cloudProvider?.connected ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white">
                    Cloud GPU Provider Integration
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {cloudProvider?.message}
                  </p>

                  {cloudProvider && !cloudProvider.connected && (
                    <div className="rounded-xl border border-white/10 bg-[#0a0812] p-4 space-y-2.5">
                      <p className="text-xs font-semibold text-white flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-[#ff7b39]" />
                        Required Server Configuration
                      </p>
                      <ul className="space-y-2 text-xs text-slate-400 font-mono">
                        {cloudProvider.requirements.map((req) => (
                          <li key={req} className="leading-relaxed">
                            • {req}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="border-t border-white/10 pt-4 text-xs text-slate-400 space-y-1">
                  <p>
                    Configured Region:{' '}
                    <span className="font-mono text-slate-200">
                      {cloudProvider?.region || 'us-east-miami'}
                    </span>
                  </p>
                  <p>
                    Game Entitlement Check:{' '}
                    <span className="text-slate-200">
                      {cloudProvider?.licenseVerified ? 'Verified License ID' : 'Pending Server License'}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RENTAL HISTORY */}
          {tab === 'rentals' && (
            <div className="glass-surface rounded-2xl p-6 overflow-x-auto">
              <h2 className="text-lg font-bold text-white mb-4">
                Rental Session History
              </h2>
              {sessions.length === 0 ? (
                <p className="text-sm text-slate-400 py-6">
                  No activated gaming sessions yet. Sessions activate automatically once
                  your crypto payment confirms on-chain.
                </p>
              ) : (
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="py-3 pr-4 font-medium">Session ID</th>
                      <th className="py-3 pr-4 font-medium">Package</th>
                      <th className="py-3 pr-4 font-medium">Duration</th>
                      <th className="py-3 pr-4 font-medium">Started</th>
                      <th className="py-3 pr-4 font-medium">Expires</th>
                      <th className="py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {sessions.map((s) => {
                      const rem = Math.max(0, new Date(s.expiresAt).getTime() - nowMs);
                      const effectiveStatus =
                        s.status === 'Active' && rem <= 0 ? 'Expired' : s.status;
                      return (
                        <tr key={s.id} className="hover:bg-white/[0.02]">
                          <td className="py-3 pr-4 font-mono text-xs text-slate-300">
                            {s.id.slice(0, 14)}…
                          </td>
                          <td className="py-3 pr-4 font-medium text-white">
                            {s.packageName}
                          </td>
                          <td className="py-3 pr-4 tabular-nums text-slate-300">
                            {formatDuration(s.durationMinutes)}
                          </td>
                          <td className="py-3 pr-4 tabular-nums text-slate-400">
                            {new Date(s.startedAt).toLocaleString()}
                          </td>
                          <td className="py-3 pr-4 tabular-nums text-slate-400">
                            {effectiveStatus === 'Active'
                              ? formatCountdown(rem)
                              : new Date(s.expiresAt).toLocaleString()}
                          </td>
                          <td className="py-3 font-semibold">
                            <span
                              className={
                                effectiveStatus === 'Active'
                                  ? 'text-emerald-400'
                                  : 'text-slate-400'
                              }
                            >
                              {effectiveStatus}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 3: PAYMENT HISTORY */}
          {tab === 'payments' && (
            <div className="glass-surface rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-white">
                Cryptocurrency Payment History
              </h2>
              {orders.length === 0 ? (
                <p className="text-sm text-slate-400 py-6">
                  No cryptocurrency rental orders found.
                </p>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => {
                    const explorer = getExplorerUrl(order);
                    return (
                      <div
                        key={order.id}
                        className="rounded-xl border border-white/10 bg-[#0a0812] p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white">
                              {order.packageName} · ${order.priceUsd.toFixed(2)} (
                              <span className="font-mono">
                                {order.expectedCryptoAmount} {order.currency.replace('_ERC20', '')}
                              </span>
                              )
                            </p>
                            <p className="text-xs text-slate-400">
                              {order.network} · {new Date(order.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <span
                            className={`text-xs font-bold ${
                              order.status === 'Confirmed'
                                ? 'text-emerald-400'
                                : order.status === 'Failed'
                                  ? 'text-rose-400'
                                  : 'text-amber-400'
                            }`}
                          >
                            {order.status} ({order.confirmations} conf)
                          </span>
                        </div>

                        <p className="text-xs text-slate-300">
                          Wallet: <code className="font-mono text-[#38bdf8]">{order.receivingAddress}</code>
                        </p>

                        {order.verificationMessage && (
                          <p className="text-xs text-slate-400">{order.verificationMessage}</p>
                        )}

                        {order.txHash ? (
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <code className="font-mono text-slate-300 break-all">
                              TX: {order.txHash}
                            </code>
                            <div className="flex items-center gap-3">
                              {explorer && (
                                <a
                                  href={explorer}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[#38bdf8] hover:underline"
                                >
                                  Explorer <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                              {order.status === 'Pending' && (
                                <button
                                  type="button"
                                  disabled={verifyingOrderId === order.id}
                                  onClick={() => handleRecheckOrder(order.id)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-white hover:bg-white/10 cursor-pointer"
                                >
                                  <RefreshCw className="h-3 w-3" />
                                  Re-check
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row gap-2 pt-1">
                            <input
                              type="text"
                              value={txInputs[order.id] || ''}
                              onChange={(e) =>
                                setTxInputs((prev) => ({ ...prev, [order.id]: e.target.value }))
                              }
                              placeholder="Submit blockchain transaction hash to verify..."
                              className="flex-1 rounded-lg border border-white/15 bg-black/50 px-3 py-2 font-mono text-xs text-white focus:border-[#ff2e93] focus:outline-none"
                            />
                            <button
                              type="button"
                              disabled={verifyingOrderId === order.id || !(txInputs[order.id] || '').trim()}
                              onClick={() => handleVerifyOrder(order.id)}
                              className="rounded-lg bg-[#ff2e93] px-4 py-2 text-xs font-bold text-white hover:opacity-95 disabled:opacity-45 cursor-pointer whitespace-nowrap"
                            >
                              {verifyingOrderId === order.id ? 'Verifying...' : 'Verify On-Chain'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SUPPORT & REFUNDS */}
          {tab === 'support' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={handleSubmitSupport}
                className="lg:col-span-5 glass-surface rounded-2xl p-6 space-y-4"
              >
                <h2 className="text-lg font-bold text-white">
                  Submit Support or Refund Request
                </h2>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Request Type
                  </label>
                  <select
                    value={supType}
                    onChange={(e) =>
                      setSupType(e.target.value as 'Refund' | 'Payment' | 'Technical' | 'General')
                    }
                    className="w-full rounded-xl border border-white/15 bg-[#0a0812] px-3 py-2.5 text-sm text-white focus:border-[#ff2e93] focus:outline-none"
                  >
                    <option value="Technical">Technical / Cloud Stream</option>
                    <option value="Payment">Crypto Payment Verification</option>
                    <option value="Refund">Refund Inquiry</option>
                    <option value="General">General Question</option>
                  </select>
                </div>

                {orders.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Related Order (Optional)
                    </label>
                    <select
                      value={supOrderId}
                      onChange={(e) => setSupOrderId(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-[#0a0812] px-3 py-2.5 text-sm text-white focus:border-[#ff2e93] focus:outline-none"
                    >
                      <option value="">None</option>
                      {orders.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.packageName} · ${o.priceUsd} ({o.status})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={supSubject}
                    onChange={(e) => setSupSubject(e.target.value)}
                    placeholder="Brief summary of your issue"
                    className="w-full rounded-xl border border-white/15 bg-[#0a0812] px-3 py-2.5 text-sm text-white focus:border-[#ff2e93] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Details
                  </label>
                  <textarea
                    required
                    minLength={10}
                    rows={4}
                    value={supMessage}
                    onChange={(e) => setSupMessage(e.target.value)}
                    placeholder="Include transaction hash or details..."
                    className="w-full rounded-xl border border-white/15 bg-[#0a0812] px-3 py-2.5 text-sm text-white focus:border-[#ff2e93] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={supSubmitting}
                  className="w-full vice-cta-gradient rounded-xl py-3 px-4 text-xs font-bold text-white cursor-pointer"
                >
                  {supSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </form>

              <div className="lg:col-span-7 glass-surface rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-white">Your Tickets</h2>
                {supportRequests.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    You have not submitted any support or refund tickets.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {supportRequests.map((req) => (
                      <div
                        key={req.id}
                        className="rounded-xl border border-white/10 bg-[#0a0812] p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm text-white">
                            {req.subject}
                          </span>
                          <span className="text-xs font-bold text-[#38bdf8]">
                            {req.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {req.type} · {new Date(req.createdAt).toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-300">{req.message}</p>
                        {req.adminNotes && (
                          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-xs text-slate-200">
                            <span className="font-semibold text-[#ff7b39]">Admin Note:</span>{' '}
                            {req.adminNotes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
