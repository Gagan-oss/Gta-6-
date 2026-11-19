import {
  Check,
  ChevronDown,
  Clock,
  Cpu,
  Globe,
  Lock,
  Play,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { formatDuration } from '../lib/api';
import type { PublicUser, RentalPackage, WalletAddressConfig } from '../types';

interface HomePageProps {
  user: PublicUser | null;
  packages: RentalPackage[];
  wallets: WalletAddressConfig[];
  onPlayNow: (packageId?: string) => void;
  onOpenAuth: () => void;
  onOpenDashboard: () => void;
}

const FAQS = [
  {
    q: 'Can I really play GTA 6 on a low-end PC, Mac, or old laptop?',
    a: 'Yes. In cloud gaming, all 3D rendering, physics, and storage run on remote data-center GPUs. Your browser only decodes a low-latency video stream and sends back keyboard, mouse, or controller inputs—meaning any device capable of smooth 1080p/4K video playback can connect.',
  },
  {
    q: 'What happens when my rented time runs out?',
    a: 'Your rental access is strictly bound to the purchased duration (10 minutes, 30 minutes, or 1 hour). When the countdown reaches 00:00:00, the cloud session automatically expires and disconnects the remote stream.',
  },
  {
    q: 'Why do you only accept cryptocurrency payments?',
    a: 'Cryptocurrency enables borderless, instant settlement without chargeback fraud or card-processor delays. Every payment is verified directly on Solana, Bitcoin, or Ethereum mainnet RPCs before a session activates.',
  },
  {
    q: 'How long does payment verification take?',
    a: 'Solana transactions typically verify within seconds. Ethereum ERC20 (USDT/USDC) transactions verify after 1 block confirmation (~12–24 seconds). Bitcoin transactions verify once included in a confirmed block (typically 10+ minutes depending on miner fee).',
  },
  {
    q: 'Does clicking Launch immediately run GTA 6 on this demo server?',
    a: 'Live gameplay requires a legally licensed copy of GTA 6 and an active remote WebRTC GPU streaming provider configured on the backend. If the cloud streaming node is not connected, the dashboard transparently displays the infrastructure connection status instead of faking gameplay.',
  },
];

export function HomePage({
  user,
  packages,
  wallets,
  onPlayNow,
  onOpenAuth,
  onOpenDashboard,
}: HomePageProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  return (
    <main>
      {/* HERO SECTION */}
      <section className="relative min-h-[82vh] flex items-center overflow-hidden border-b border-white/10">
        {/* Background Vice City Visual */}
        <div className="absolute inset-0 z-0 overflow-hidden bg-[#08070d]">
          {!heroImgFailed ? (
            <img
              src="/assets/aistudio/Screenshot_2026-11-08_195245_198918b5.png"
              alt="Vice City neon sunset skyline"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="h-full w-full object-cover object-[72%_18%] scale-110 opacity-75"
            />
          ) : (
            <div className="h-full w-full vice-mesh" />
          )}

          {/* Measured contrast scrims for >=4.5:1 text legibility */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#08070d] via-[#08070d]/85 to-[#08070d]/35" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#08070d] via-transparent to-[#08070d]/60" />

          {/* Subtle Neon Palm Horizon Accent */}
          <svg
            aria-hidden="true"
            viewBox="0 0 1440 220"
            className="pointer-events-none absolute bottom-0 left-0 w-full h-36 opacity-45"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="viceHorizon" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ff2e93" stopOpacity="0.4" />
                <stop offset="50%" stopColor="#9333ea" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#ff7b39" stopOpacity="0.4" />
              </linearGradient>
            </defs>
            <path
              d="M0 190 Q360 155 720 185 T1440 175 L1440 220 L0 220 Z"
              fill="#08070d"
            />
            <path
              d="M0 190 Q360 155 720 185 T1440 175"
              fill="none"
              stroke="url(#viceHorizon)"
              strokeWidth="2"
            />
          </svg>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="max-w-2xl space-y-6">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#ff7b39]">
              <span>Cloud GPU Streaming</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span>Vice City Edition</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span>Crypto-Only Instant Rental</span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white [text-wrap:balance] leading-[1.06]">
              PLAY GTA 6 ON <span className="vice-gradient-text">ANY PC.</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
              Experience the next generation of gaming without expensive gaming hardware.
              Rent your gaming session and play through the cloud.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => onPlayNow()}
                className="vice-cta-gradient inline-flex items-center gap-2.5 rounded-xl px-7 py-4 text-sm font-extrabold tracking-wide text-white shadow-xl shadow-[#ff2e93]/30 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
              >
                <Play className="h-4 w-4 fill-current" />
                PLAY GTA 6 NOW
              </button>

              {user ? (
                <button
                  type="button"
                  onClick={onOpenDashboard}
                  className="rounded-xl border border-white/20 bg-white/5 px-6 py-4 text-sm font-semibold text-white hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Open Dashboard
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="rounded-xl border border-white/20 bg-white/5 px-6 py-4 text-sm font-semibold text-white hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Sign In / Account
                </button>
              )}
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">
              <span>10m, 30m & 1h timed sessions</span>
              <span aria-hidden="true">·</span>
              <span>SOL, BTC & ERC20 USDT/USDC</span>
              <span aria-hidden="true">·</span>
              <span>Zero local GPU required</span>
            </div>
          </div>
        </div>
      </section>

      {/* RENTAL PACKAGES SECTION */}
      <section id="packages" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-xs font-semibold text-[#ff2e93] mb-2">
              Timed Cloud Access
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Rental Packages
            </h2>
          </div>
          <p className="text-sm text-slate-400 max-w-md">
            Gaming access is strictly limited to your purchased duration. Sessions
            automatically expire when the countdown timer finishes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`glass-surface rounded-2xl p-7 flex flex-col justify-between transition-transform duration-200 hover:-translate-y-1 ${
                pkg.highlighted
                  ? 'border-[#ff2e93]/55 shadow-xl shadow-[#ff2e93]/10'
                  : 'border-white/10'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{formatDuration(pkg.durationMinutes)}</span>
                  {pkg.highlighted && (
                    <span className="text-[#ff7b39] font-semibold">Recommended</span>
                  )}
                </div>

                <h3 className="mt-3 text-2xl font-bold text-white">{pkg.name}</h3>
                <p className="mt-1.5 text-sm text-slate-400">{pkg.subtitle}</p>

                <div className="mt-6 flex items-baseline gap-2">
                  <span className="font-display text-4xl font-extrabold text-white tabular-nums">
                    ${pkg.priceUsd}
                  </span>
                  <span className="text-xs text-slate-400">
                    / {formatDuration(pkg.durationMinutes)}
                  </span>
                </div>

                <ul className="mt-6 space-y-3 border-t border-white/10 pt-5 text-sm text-slate-300">
                  {pkg.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Check className="h-4 w-4 shrink-0 text-[#ff2e93] mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => onPlayNow(pkg.id)}
                className={`mt-8 w-full rounded-xl py-3.5 px-5 text-xs font-bold tracking-wide text-white transition-all cursor-pointer whitespace-nowrap ${
                  pkg.highlighted
                    ? 'vice-cta-gradient shadow-lg shadow-[#ff2e93]/25 hover:opacity-95'
                    : 'border border-white/15 bg-white/10 hover:bg-white/15'
                }`}
              >
                {pkg.buttonLabel}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* HOW CLOUD GAMING WORKS */}
      <section
        id="how-it-works"
        className="border-y border-white/10 bg-[#0d0b16]/80 py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-semibold text-[#38bdf8] mb-2">
              Architecture & Flow
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              How Cloud Gaming Works
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-400">
              Skip $2,000 graphics cards and massive 150GB downloads. Stream directly
              from dedicated cloud hardware in four verifiable steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: '01. Select Session',
                title: 'Pick Your Rental Window',
                desc: 'Choose 10 minutes, 30 minutes, or 1 hour based on how long you want to play.',
                icon: Clock,
              },
              {
                step: '02. Crypto Payment',
                title: 'Send SOL, BTC, or ERC20',
                desc: 'Lock an exact live crypto quote and transfer funds to our verified receiving wallet.',
                icon: Wallet,
              },
              {
                step: '03. RPC Verification',
                title: 'Direct On-Chain Check',
                desc: 'Submit your transaction hash. Our backend verifies recipient, amount, and confirmations directly on-chain.',
                icon: ShieldCheck,
              },
              {
                step: '04. Cloud Stream',
                title: 'Launch From Any Browser',
                desc: 'Connect to the remote GPU instance with WebRTC input passthrough until your timer expires.',
                icon: Cpu,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="glass-surface rounded-2xl p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs font-mono text-[#ff7b39] mb-4">
                      <span>{item.step}</span>
                      <Icon className="h-4 w-4 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">{item.title}</h3>
                    <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECURITY & CRYPTO VERIFICATION */}
      <section id="security" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-6 glass-surface rounded-2xl p-7 sm:p-8 flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold text-[#ff2e93] mb-2">
                Zero-Trust Payment Integrity
              </p>
              <h2 className="text-3xl font-bold text-white tracking-tight">
                Security & On-Chain Verification
              </h2>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                Every rental order is protected against spoofing, underpayment, and
                transaction replay. We never trust screenshots or unverified client claims.
              </p>

              <div className="mt-6 space-y-4 text-sm text-slate-300">
                <div className="flex items-start gap-3">
                  <Lock className="h-4 w-4 shrink-0 text-[#38bdf8] mt-1" />
                  <div>
                    <span className="font-semibold text-white">No Private Keys Requested:</span>{' '}
                    We never ask for seed phrases, wallet signatures, or private keys.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-[#ff2e93] mt-1" />
                  <div>
                    <span className="font-semibold text-white">Direct Blockchain RPC:</span>{' '}
                    Backend servers inspect Solana, Bitcoin, and Ethereum ERC20 logs for
                    exact receiving address, amount, and confirmation depth.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Globe className="h-4 w-4 shrink-0 text-[#ff7b39] mt-1" />
                  <div>
                    <span className="font-semibold text-white">Replay Protection:</span>{' '}
                    Confirmed transaction hashes are permanently bound to a single order
                    and cannot be reused.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 glass-surface rounded-2xl p-7 sm:p-8 flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold text-[#ff7b39] mb-2">
                Supported Networks
              </p>
              <h3 className="text-2xl font-bold text-white">
                Accepted Cryptocurrency Wallets
              </h3>
              <p className="mt-2 text-xs text-slate-400">
                Send funds only on the exact listed network. Cross-chain transfers may
                result in permanent loss of funds.
              </p>

              <div className="mt-5 space-y-3">
                {wallets.map((w) => (
                  <div
                    key={w.currency}
                    className="rounded-xl border border-white/10 bg-black/35 p-3.5"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-white">{w.label}</span>
                      <span className="text-slate-400">{w.network}</span>
                    </div>
                    <code className="block break-all font-mono text-xs text-[#38bdf8]">
                      {w.address}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section id="faq" className="border-t border-white/10 bg-[#0d0b16]/60 py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold text-[#ff7b39] mb-2">
              Platform Questions
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={item.q}
                  className="glass-surface rounded-xl overflow-hidden transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left text-sm sm:text-base font-semibold text-white hover:bg-white/[0.03] cursor-pointer"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-[#ff2e93]' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="border-t border-white/10 px-5 py-4 text-sm text-slate-300 leading-relaxed">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 bg-[#06050a] py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <p className="font-display text-base font-extrabold text-white">
              GTA 6 <span className="vice-gradient-text">CLOUD</span>
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              GTA 6 CLOUD is an independent cloud gaming rental platform and is not
              affiliated with, endorsed by, or sponsored by Rockstar Games or Take-Two
              Interactive. Grand Theft Auto VI (GTA 6) is a trademark of its respective
              owner.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-xs text-slate-400">
            <a href="#packages" className="hover:text-white">
              Packages
            </a>
            <a href="#how-it-works" className="hover:text-white">
              How It Works
            </a>
            <a href="#security" className="hover:text-white">
              Security
            </a>
            <a href="#faq" className="hover:text-white">
              FAQ
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
