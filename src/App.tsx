import { useCallback, useEffect, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { GamingDashboard } from './components/GamingDashboard';
import { HomePage } from './components/HomePage';
import { Navbar, type AppView } from './components/Navbar';
import { RentalModal } from './components/RentalModal';
import { api } from './lib/api';
import type { PublicUser, RentalPackage, WalletAddressConfig } from './types';

export function App() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [adminInitialized, setAdminInitialized] = useState(true);
  const [packages, setPackages] = useState<RentalPackage[]>([]);
  const [wallets, setWallets] = useState<WalletAddressConfig[]>([]);

  const [activeView, setActiveView] = useState<AppView>('home');
  const [rentModalOpen, setRentModalOpen] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const loadBootstrap = useCallback(async () => {
    try {
      const [meRes, pkgRes, walletRes] = await Promise.all([
        api.getMe(),
        api.getPackages(),
        api.getWallets(),
      ]);
      setUser(meRes.user);
      setAdminInitialized(meRes.adminInitialized);
      setPackages(pkgRes.packages);
      setWallets(walletRes.wallets);
    } catch {
      // Initial load resilient fallback handled gracefully in UI
    }
  }, []);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  function handleNavigate(view: AppView, sectionId?: string) {
    setActiveView(view);
    if (view === 'home' && sectionId) {
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        el?.scrollIntoView({ behavior: 'smooth' });
      }, 40);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function handleOpenRentModal(packageId?: string) {
    setSelectedPackageId(packageId || null);
    setRentModalOpen(true);
  }

  async function handleLogout() {
    await api.logout();
    setUser(null);
    setActiveView('home');
  }

  return (
    <div className="min-h-screen bg-[#08070d] text-slate-100 flex flex-col">
      <Navbar
        user={user}
        activeView={activeView}
        onNavigate={handleNavigate}
        onOpenRentModal={() => handleOpenRentModal()}
        onOpenAuthModal={() => setAuthModalOpen(true)}
        onLogout={handleLogout}
      />

      <div className="flex-1">
        {activeView === 'home' && (
          <HomePage
            user={user}
            packages={packages}
            wallets={wallets}
            onPlayNow={handleOpenRentModal}
            onOpenAuth={() => setAuthModalOpen(true)}
            onOpenDashboard={() => handleNavigate('dashboard')}
          />
        )}

        {activeView === 'dashboard' && user && (
          <GamingDashboard
            user={user}
            wallets={wallets}
            onRentNew={() => handleOpenRentModal()}
            onLogout={handleLogout}
          />
        )}

        {activeView === 'dashboard' && !user && (
          <div className="mx-auto max-w-lg px-4 py-20 text-center space-y-4">
            <h1 className="text-2xl font-bold text-white">Sign in to view your dashboard</h1>
            <p className="text-sm text-slate-400">
              Access active GTA 6 cloud sessions, countdown timers, and payment history.
            </p>
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="vice-cta-gradient rounded-xl px-6 py-3 text-xs font-bold text-white cursor-pointer"
            >
              Sign In / Create Account
            </button>
          </div>
        )}

        {activeView === 'admin' && (
          <AdminDashboard
            user={user}
            adminInitialized={adminInitialized}
            onAdminAuthenticated={(newAdmin) => {
              setUser(newAdmin);
              setAdminInitialized(true);
            }}
            onDataUpdated={loadBootstrap}
          />
        )}
      </div>

      <RentalModal
        open={rentModalOpen}
        packages={packages}
        wallets={wallets}
        initialPackageId={selectedPackageId}
        user={user}
        onClose={() => setRentModalOpen(false)}
        onAuthenticated={(authedUser) => {
          setUser(authedUser);
          void loadBootstrap();
        }}
        onSessionActivated={() => {
          setActiveView('dashboard');
        }}
      />

      <AuthModal
        open={authModalOpen}
        adminInitialized={adminInitialized}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={(authedUser) => {
          setUser(authedUser);
          setAdminInitialized(true);
          if (authedUser.role === 'admin') {
            setActiveView('admin');
          } else {
            setActiveView('dashboard');
          }
        }}
      />
    </div>
  );
}
