import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import type { PublicUser } from '../types';

export type AppView = 'home' | 'dashboard' | 'admin';

interface NavbarProps {
  user: PublicUser | null;
  activeView: AppView;
  onNavigate: (view: AppView, sectionId?: string) => void;
  onOpenRentModal: () => void;
  onOpenAuthModal: () => void;
  onLogout: () => void;
}

export function Navbar({
  user,
  activeView,
  onNavigate,
  onOpenRentModal,
  onOpenAuthModal,
  onLogout,
}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLinkClick = (view: AppView, sectionId?: string) => {
    setMobileOpen(false);
    onNavigate(view, sectionId);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#08070d]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleLinkClick('home')}
          className="font-display text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff2e93] rounded-md px-1"
        >
          GTA 6 <span className="vice-gradient-text">CLOUD</span>
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            type="button"
            onClick={() => handleLinkClick('home', 'packages')}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Packages
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('home', 'how-it-works')}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            How It Works
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('home', 'security')}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Security
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('home', 'faq')}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            FAQ
          </button>
          {user && (
            <button
              type="button"
              onClick={() => handleLinkClick('dashboard')}
              className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'dashboard' ? 'text-[#ff7b39] font-semibold' : ''
              }`}
            >
              Dashboard
            </button>
          )}
          {user?.role === 'admin' && (
            <button
              type="button"
              onClick={() => handleLinkClick('admin')}
              className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'admin' ? 'text-[#38bdf8] font-semibold' : ''
              }`}
            >
              Admin
            </button>
          )}
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          {user ? (
            <button
              type="button"
              onClick={
                activeView === 'dashboard' ? onOpenRentModal : () => handleLinkClick('dashboard')
              }
              className="vice-cta-gradient px-5 py-2.5 text-xs font-bold tracking-wide text-white rounded-lg shadow-lg shadow-[#ff2e93]/20 hover:opacity-95 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              {activeView === 'dashboard' ? 'RENT SESSION' : 'GAMING DASHBOARD'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenRentModal}
              className="vice-cta-gradient px-5 py-2.5 text-xs font-bold tracking-wide text-white rounded-lg shadow-lg shadow-[#ff2e93]/20 hover:opacity-95 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              PLAY GTA 6 NOW
            </button>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setMobileOpen((prev) => !prev)}
          className="md:hidden inline-flex items-center justify-center rounded-lg border border-white/10 p-2 text-slate-200 hover:bg-white/5 cursor-pointer"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 bg-[#0b0914] px-4 py-4 space-y-3">
          <div className="flex flex-col gap-2 text-sm text-slate-200">
            <button
              type="button"
              onClick={() => handleLinkClick('home', 'packages')}
              className="text-left py-2 hover:text-white cursor-pointer"
            >
              Packages
            </button>
            <button
              type="button"
              onClick={() => handleLinkClick('home', 'how-it-works')}
              className="text-left py-2 hover:text-white cursor-pointer"
            >
              How It Works
            </button>
            <button
              type="button"
              onClick={() => handleLinkClick('home', 'security')}
              className="text-left py-2 hover:text-white cursor-pointer"
            >
              Security
            </button>
            <button
              type="button"
              onClick={() => handleLinkClick('home', 'faq')}
              className="text-left py-2 hover:text-white cursor-pointer"
            >
              FAQ
            </button>
            {user && (
              <button
                type="button"
                onClick={() => handleLinkClick('dashboard')}
                className="text-left py-2 text-[#ff7b39] font-medium cursor-pointer"
              >
                Gaming Dashboard
              </button>
            )}
            {user?.role === 'admin' && (
              <button
                type="button"
                onClick={() => handleLinkClick('admin')}
                className="text-left py-2 text-[#38bdf8] font-medium cursor-pointer"
              >
                Admin Console
              </button>
            )}
          </div>
          <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onOpenRentModal();
              }}
              className="w-full vice-cta-gradient py-2.5 px-4 text-xs font-bold text-white rounded-lg cursor-pointer"
            >
              PLAY GTA 6 NOW
            </button>
            {user ? (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  onLogout();
                }}
                className="w-full border border-white/15 py-2 px-4 text-xs font-medium text-slate-300 rounded-lg cursor-pointer"
              >
                Sign Out ({user.username})
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  onOpenAuthModal();
                }}
                className="w-full border border-white/15 py-2 px-4 text-xs font-medium text-slate-200 rounded-lg cursor-pointer"
              >
                Sign In / Sign Up
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
