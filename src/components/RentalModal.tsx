import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { api, formatDuration } from '../lib/api';
import type {
  CryptoCurrency,
  CryptoQuote,
  PublicUser,
  RentalOrder,
  RentalPackage,
  WalletAddressConfig,
} from '../types';

interface RentalModalProps {
  open: boolean;
  packages: RentalPackage[];
  wallets: WalletAddressConfig[];
  initialPackageId?: string | null;
  user: PublicUser | null;
  onClose: () => void;
  onAuthenticated: (user: PublicUser) => void;
  onSessionActivated: () => void;
}

type ModalStep = 'packages' | 'checkout' | 'payment';

export function RentalModal({
  open,
  packages,
  wallets,
  initialPackageId,
  user,
  onClose,
  onAuthenticated,
  onSessionActivated,
}: RentalModalProps) {
  const [step, setStep] = useState<ModalStep>('packages');
  const [selectedPkg, setSelectedPkg] = useState<RentalPackage | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<CryptoCurrency>('SOL');
  const [quote, setQuote] = useState<CryptoQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  // Terms & Conditions gate
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showFullTerms, setShowFullTerms] = useState(true);

  // Inline auth state if user isn't logged in yet
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [authEmail, setAuthEmail] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Payment order & on-chain verification state
  const [order, setOrder] = useState<RentalOrder | null>(null);
  const [orderWallet, setOrderWallet] = useState<WalletAddressConfig | null>(null);
  const [txHashInput, setTxHashInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setOrder(null);
    setOrderWallet(null);
    setTxHashInput('');
    setTermsAccepted(false);

    if (initialPackageId) {
      const found = packages.find((p) => p.id === initialPackageId);
      if (found) {
        setSelectedPkg(found);
        setStep('checkout');
        return;
      }
    }
    setSelectedPkg(packages[1] || packages[0] || null);
    setStep('packages');
  }, [open, initialPackageId, packages]);

  useEffect(() => {
    if (!open || step !== 'checkout' || !selectedPkg) return;
    let cancelled = false;
    setQuoteLoading(true);
    api
      .getQuote(selectedPkg.id, selectedCurrency)
      .then((res) => {
        if (!cancelled) {
          setQuote(res.quote);
        }
      })
      .catch(() => {
        if (!cancelled) setQuote(null);
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, step, selectedPkg, selectedCurrency]);

  if (!open) return null;

  async function handleInlineAuth(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setAuthLoading(true);
    try {
      const res =
        authMode === 'login'
          ? await api.login({ email: authEmail, password: authPassword })
          : await api.register({
              email: authEmail,
              username: authUsername,
              password: authPassword,
            });
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleCreatePaymentOrder() {
    if (!selectedPkg || !termsAccepted) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.createOrder({
        packageId: selectedPkg.id,
        currency: selectedCurrency,
        termsAccepted: true,
      });
      setOrder(res.order);
      setOrderWallet(res.wallet);
      setQuote(res.quote);
      setStep('payment');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create payment order.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyPayment(e: FormEvent) {
    e.preventDefault();
    if (!order) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.verifyOrder(order.id, txHashInput);
      setOrder(res.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification request failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecheckPayment() {
    if (!order) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.recheckOrder(order.id);
      setOrder(res.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-check request failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopyAddress(addr: string) {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const activeWalletPreview = wallets.find((w) => w.currency === selectedCurrency);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6 backdrop-blur-md overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rental-modal-title"
    >
      <div className="glass-surface relative my-auto w-full max-w-4xl rounded-2xl p-5 sm:p-8 shadow-2xl max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          aria-label="Close rental checkout"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Step Navigation Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 pr-10 border-b border-white/10 pb-4">
          <div>
            <p className="text-xs font-medium text-[#ff7b39]">
              Cryptocurrency-Only Cloud Rental
            </p>
            <h2 id="rental-modal-title" className="text-2xl sm:text-3xl font-bold text-white">
              {step === 'packages' && 'Choose Your GTA 6 Rental Session'}
              {step === 'checkout' && 'Terms, Network & Crypto Checkout'}
              {step === 'payment' && 'Send Crypto & Verify On-Chain'}
            </h2>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span className={step === 'packages' ? 'text-[#ff2e93] font-bold' : ''}>
              01. Package
            </span>
            <span>/</span>
            <span className={step === 'checkout' ? 'text-[#ff2e93] font-bold' : ''}>
              02. Terms & Asset
            </span>
            <span>/</span>
            <span className={step === 'payment' ? 'text-[#ff2e93] font-bold' : ''}>
              03. Verify Tx
            </span>
          </div>
        </div>

        {/* STEP 1: PACKAGES */}
        {step === 'packages' && (
          <div>
            <div className="mb-5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs sm:text-sm text-amber-100 flex items-start gap-3">
              <Clock className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <p>
                Gaming access is strictly limited to your purchased duration. Sessions
                automatically expire and disconnect when your timer reaches{' '}
                <span className="font-mono font-semibold">00:00:00</span>.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`flex flex-col justify-between rounded-2xl p-6 transition-all ${
                    pkg.highlighted
                      ? 'border border-[#ff2e93]/60 bg-[#1a122a]'
                      : 'border border-white/10 bg-white/[0.03]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                      <span>{formatDuration(pkg.durationMinutes)}</span>
                      {pkg.highlighted && (
                        <span className="text-[#ff7b39] font-semibold">Most Popular</span>
                      )}
                    </div>
                    <h3 className="mt-2 text-xl font-bold text-white">{pkg.name}</h3>
                    <p className="mt-1 text-xs text-slate-400">{pkg.subtitle}</p>

                    <div className="mt-5 flex items-baseline gap-2">
                      <span className="font-display text-4xl font-extrabold text-white tabular-nums">
                        ${pkg.priceUsd}
                      </span>
                      <span className="text-xs text-slate-400">
                        / {formatDuration(pkg.durationMinutes)}
                      </span>
                    </div>

                    <ul className="mt-5 space-y-2.5 border-t border-white/10 pt-4 text-xs text-slate-300">
                      {pkg.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="h-3.5 w-3.5 shrink-0 text-[#ff2e93] mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPkg(pkg);
                      setError(null);
                      setStep('checkout');
                    }}
                    className={`mt-6 w-full rounded-xl py-3 px-4 text-xs font-bold tracking-wide text-white transition-all cursor-pointer whitespace-nowrap ${
                      pkg.highlighted
                        ? 'vice-cta-gradient shadow-lg shadow-[#ff2e93]/25 hover:opacity-95'
                        : 'border border-white/20 bg-white/10 hover:bg-white/15'
                    }`}
                  >
                    {pkg.buttonLabel}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: ACCOUNT + CRYPTO SELECTION + TERMS GATE */}
        {step === 'checkout' && selectedPkg && (
          <div className="space-y-6">
            <button
              type="button"
              onClick={() => {
                setStep('packages');
                setError(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to rental packages
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Package summary + Crypto Selector */}
              <div className="lg:col-span-7 space-y-5">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-slate-400">Selected Package</p>
                    <p className="text-lg font-bold text-white">
                      {selectedPkg.name} · {formatDuration(selectedPkg.durationMinutes)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Total USD</p>
                    <p className="font-mono text-2xl font-bold text-[#ff7b39] tabular-nums">
                      ${selectedPkg.priceUsd.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-white mb-2.5">
                    Select Cryptocurrency (Crypto-Only Checkout)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {wallets.map((w) => {
                      const active = w.currency === selectedCurrency;
                      return (
                        <button
                          key={w.currency}
                          type="button"
                          onClick={() => setSelectedCurrency(w.currency)}
                          className={`rounded-xl border p-3.5 text-left transition-all cursor-pointer ${
                            active
                              ? 'border-[#ff2e93] bg-[#ff2e93]/15'
                              : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm text-white">{w.symbol}</span>
                            <span className="font-mono text-[11px] text-slate-400">
                              {w.network}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-400 truncate">{w.label}</p>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    No credit cards, debit cards, PayPal, or bank transfers accepted.
                  </p>
                </div>

                {activeWalletPreview && (
                  <div className="rounded-xl border border-white/10 bg-[#0b0914] p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Estimated Payment Amount</span>
                      <span>{quote?.source || 'Spot feed'}</span>
                    </div>
                    <div className="font-mono text-xl font-bold text-white tabular-nums">
                      {quoteLoading
                        ? 'Calculating live rate...'
                        : quote
                          ? `${quote.expectedAmount} ${activeWalletPreview.symbol}`
                          : 'Rate unavailable'}
                    </div>
                    <p className="text-xs text-slate-400">
                      Network: <span className="text-slate-200">{activeWalletPreview.network}</span>
                    </p>
                  </div>
                )}

                {/* Inline Auth if user isn't logged in */}
                {!user && (
                  <div className="rounded-xl border border-[#38bdf8]/30 bg-[#38bdf8]/5 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">
                        Sign in or create an account to bind your session
                      </h3>
                      <div className="flex gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setAuthMode('register')}
                          className={`px-2.5 py-1 rounded-md cursor-pointer ${
                            authMode === 'register'
                              ? 'bg-[#38bdf8] text-slate-950 font-semibold'
                              : 'text-slate-300'
                          }`}
                        >
                          Sign Up
                        </button>
                        <button
                          type="button"
                          onClick={() => setAuthMode('login')}
                          className={`px-2.5 py-1 rounded-md cursor-pointer ${
                            authMode === 'login'
                              ? 'bg-[#38bdf8] text-slate-950 font-semibold'
                              : 'text-slate-300'
                          }`}
                        >
                          Login
                        </button>
                      </div>
                    </div>

                    <form onSubmit={handleInlineAuth} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="email"
                        required
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="Email address"
                        className="rounded-lg border border-white/15 bg-[#0a0812] px-3 py-2 text-xs text-white focus:border-[#38bdf8] focus:outline-none"
                      />
                      {authMode === 'register' && (
                        <input
                          type="text"
                          required
                          minLength={2}
                          value={authUsername}
                          onChange={(e) => setAuthUsername(e.target.value)}
                          placeholder="Gamertag"
                          className="rounded-lg border border-white/15 bg-[#0a0812] px-3 py-2 text-xs text-white focus:border-[#38bdf8] focus:outline-none"
                        />
                      )}
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="Password (min 8 chars)"
                        className={`rounded-lg border border-white/15 bg-[#0a0812] px-3 py-2 text-xs text-white focus:border-[#38bdf8] focus:outline-none ${
                          authMode === 'login' ? '' : 'sm:col-span-2'
                        }`}
                      />
                      <button
                        type="submit"
                        disabled={authLoading}
                        className="sm:col-span-2 rounded-lg bg-[#38bdf8] py-2 px-4 text-xs font-bold text-slate-950 hover:opacity-95 disabled:opacity-50 cursor-pointer"
                      >
                        {authLoading
                          ? 'Authenticating...'
                          : authMode === 'register'
                            ? 'Create Account & Continue'
                            : 'Sign In & Continue'}
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {/* Right Column: Mandatory Terms & Conditions */}
              <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-white/10 bg-[#0b0914] p-5 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-[#ff7b39]" />
                      Terms & Conditions
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowFullTerms((v) => !v)}
                      className="text-xs text-[#38bdf8] hover:underline cursor-pointer"
                    >
                      {showFullTerms ? 'Compact' : 'Read all'}
                    </button>
                  </div>

                  {showFullTerms && (
                    <ul className="space-y-2 text-xs text-slate-300 leading-relaxed max-h-56 overflow-y-auto pr-1">
                      <li>
                        1. Gaming access is available strictly for the purchased rental
                        duration ({formatDuration(selectedPkg.durationMinutes)}).
                      </li>
                      <li>
                        2. Sessions automatically expire and terminate when your rental time
                        runs out.
                      </li>
                      <li>
                        3. Cryptocurrency payments are subject to on-chain blockchain
                        confirmation before access activates.
                      </li>
                      <li>
                        4. Payments sent to incorrect networks (e.g. non-ERC20 chains) or
                        wrong wallet addresses may be permanently lost.
                      </li>
                      <li>
                        5. There are no guaranteed refunds for completed or expired gaming
                        sessions.
                      </li>
                      <li>
                        6. Users must comply with all applicable local laws and game publisher
                        licensing requirements.
                      </li>
                      <li>
                        7. Users must be at least 18 years old or have verifiable parental
                        permission.
                      </li>
                    </ul>
                  )}

                  <label className="mt-4 flex items-start gap-3 rounded-xl border border-white/15 bg-white/[0.03] p-3 text-xs text-slate-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[#ff2e93] cursor-pointer"
                    />
                    <span>
                      I have read and agree to the Terms & Conditions and understand that my
                      gaming access is limited to my purchased rental duration.
                    </span>
                  </label>
                </div>

                {error && (
                  <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  disabled={!termsAccepted || !user || submitting || quoteLoading}
                  onClick={handleCreatePaymentOrder}
                  className="w-full vice-cta-gradient rounded-xl py-3.5 px-4 text-xs font-bold tracking-wide text-white shadow-lg shadow-[#ff2e93]/25 hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {!user
                    ? 'SIGN IN ABOVE TO CONTINUE'
                    : !termsAccepted
                      ? 'ACCEPT TERMS TO CONTINUE'
                      : submitting
                        ? 'GENERATING PAYMENT ADDRESS...'
                        : `PROCEED TO CRYPTO PAYMENT ($${selectedPkg.priceUsd})`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: CRYPTO PAYMENT & ON-CHAIN VERIFICATION */}
        {step === 'payment' && order && orderWallet && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Payment Instructions */}
              <div className="lg:col-span-7 space-y-4">
                <div className="rounded-xl border border-white/10 bg-[#0b0914] p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                    <div>
                      <p className="text-xs text-slate-400">Exact Payment Required</p>
                      <p className="font-mono text-2xl font-bold text-white tabular-nums">
                        {order.expectedCryptoAmount} {orderWallet.symbol}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Required Network</p>
                      <p className="text-sm font-semibold text-[#ff7b39]">{order.network}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Receiving Wallet Address ({orderWallet.label})
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <code className="flex-1 break-all rounded-xl border border-white/15 bg-black/50 px-3.5 py-3 font-mono text-xs text-slate-100">
                        {order.receivingAddress}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopyAddress(order.receivingAddress)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-xs font-bold text-white hover:bg-white/15 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {copied ? (
                          <>
                            <Check className="h-4 w-4 text-emerald-400" />
                            COPIED
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            COPY WALLET ADDRESS
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {orderWallet.contractAddress && (
                    <p className="text-xs text-slate-400 font-mono break-all">
                      ERC20 Contract: {orderWallet.contractAddress}
                    </p>
                  )}

                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-100 space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold text-amber-300">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>Network Fees & Security Notice</span>
                    </div>
                    <p>
                      Send only <span className="font-semibold">{orderWallet.symbol}</span> on{' '}
                      <span className="font-semibold">{order.network}</span>. You are
                      responsible for blockchain gas/miner fees so the full{' '}
                      <span className="font-mono">{order.expectedCryptoAmount}</span> arrives.
                      We will NEVER ask for your private keys or seed phrase.
                    </p>
                  </div>
                </div>

                {/* Submit Transaction Hash */}
                <form
                  onSubmit={handleVerifyPayment}
                  className="rounded-xl border border-white/10 bg-[#0b0914] p-5 space-y-3"
                >
                  <label className="block text-sm font-semibold text-white">
                    Submit Blockchain Transaction Hash (TXID)
                  </label>
                  <p className="text-xs text-slate-400">
                    After sending your transfer, paste the transaction hash below. Our backend
                    queries the live blockchain RPC to verify recipient, amount, status,
                    confirmations, and duplicate-replay safety.
                  </p>
                  <input
                    type="text"
                    required
                    value={txHashInput}
                    onChange={(e) => setTxHashInput(e.target.value)}
                    disabled={order.status === 'Confirmed'}
                    placeholder={
                      order.currency === 'SOL'
                        ? 'Paste Solana Base58 signature...'
                        : order.currency === 'BTC'
                          ? 'Paste 64-char Bitcoin TXID...'
                          : 'Paste Ethereum 0x... transaction hash'
                    }
                    className="w-full rounded-xl border border-white/15 bg-black/50 px-3.5 py-3 font-mono text-xs text-white placeholder:text-slate-500 focus:border-[#ff2e93] focus:outline-none disabled:opacity-60"
                  />

                  {error && (
                    <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
                      {error}
                    </div>
                  )}

                  {order.status !== 'Confirmed' && (
                    <button
                      type="submit"
                      disabled={submitting || !txHashInput.trim()}
                      className="w-full vice-cta-gradient rounded-xl py-3 px-4 text-xs font-bold text-white shadow-lg shadow-[#ff2e93]/25 hover:opacity-95 disabled:opacity-45 cursor-pointer"
                    >
                      {submitting
                        ? 'VERIFYING ON BLOCKCHAIN RPC...'
                        : 'VERIFY TRANSACTION ON BLOCKCHAIN'}
                    </button>
                  )}
                </form>
              </div>

              {/* Verification Status Panel */}
              <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-white/10 bg-[#0b0914] p-5 space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Payment Status</span>
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                        order.status === 'Confirmed'
                          ? 'text-emerald-400'
                          : order.status === 'Failed'
                            ? 'text-rose-400'
                            : 'text-amber-400'
                      }`}
                    >
                      {order.status === 'Confirmed' && <CheckCircle2 className="h-4 w-4" />}
                      {order.status === 'Failed' && <XCircle className="h-4 w-4" />}
                      {order.status === 'Pending' && <Clock className="h-4 w-4" />}
                      {order.status}
                    </span>
                  </div>

                  <div className="border-t border-white/10 pt-3 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Order ID</span>
                      <span className="font-mono text-slate-200">{order.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Package</span>
                      <span className="text-slate-200">
                        {order.packageName} ({formatDuration(order.durationMinutes)})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Confirmations</span>
                      <span className="font-mono text-slate-200 tabular-nums">
                        {order.confirmations}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`rounded-xl border p-3.5 text-xs leading-relaxed ${
                      order.status === 'Confirmed'
                        ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
                        : order.status === 'Failed'
                          ? 'border-rose-500/35 bg-rose-500/10 text-rose-200'
                          : 'border-white/10 bg-white/[0.03] text-slate-300'
                    }`}
                  >
                    {order.verificationMessage ||
                      'Awaiting your on-chain transaction hash submission. Access activates only after direct blockchain RPC verification.'}
                  </div>

                  {order.txHash && (
                    <a
                      href={`${orderWallet.explorerTxBaseUrl}${order.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-[#38bdf8] hover:underline"
                    >
                      Inspect transaction on block explorer
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>

                <div className="space-y-2 pt-3 border-t border-white/10">
                  {order.status === 'Pending' && order.txHash && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleRecheckPayment}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 py-2.5 px-4 text-xs font-semibold text-white hover:bg-white/10 cursor-pointer"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${submitting ? 'animate-spin' : ''}`} />
                      Re-check Blockchain Confirmations
                    </button>
                  )}

                  {order.status === 'Confirmed' ? (
                    <button
                      type="button"
                      onClick={() => {
                        onSessionActivated();
                        onClose();
                      }}
                      className="w-full rounded-xl bg-emerald-500 py-3 px-4 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors cursor-pointer"
                    >
                      OPEN GAMING DASHBOARD
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-slate-400" />
                      <span>
                        Zero-trust verification: screenshots are never accepted; only
                        confirmed RPC state unlocks play.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
