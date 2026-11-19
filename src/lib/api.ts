import type {
  AdminOverviewData,
  CloudLaunchResponse,
  CloudProviderStatus,
  CryptoCurrency,
  CryptoQuote,
  GamingSession,
  PublicUser,
  RentalOrder,
  RentalPackage,
  SupportRequest,
  SupportStatus,
  WalletAddressConfig,
} from '../types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  getMe: () => request<{ user: PublicUser | null; adminInitialized: boolean }>('/api/auth/me'),
  register: (body: { email: string; username: string; password: string }) =>
    request<{ user: PublicUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  login: (body: { email: string; password: string }) =>
    request<{ user: PublicUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  setupAdmin: (body: { email: string; username: string; password: string }) =>
    request<{ user: PublicUser }>('/api/auth/setup-admin', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getPackages: () => request<{ packages: RentalPackage[] }>('/api/packages'),
  getWallets: () => request<{ wallets: WalletAddressConfig[] }>('/api/wallets'),
  getQuote: (packageId: string, currency: CryptoCurrency) =>
    request<{ quote: CryptoQuote; wallet: WalletAddressConfig }>(
      `/api/quote?packageId=${encodeURIComponent(packageId)}&currency=${encodeURIComponent(currency)}`
    ),
  getCloudStatus: () => request<{ provider: CloudProviderStatus }>('/api/cloud/status'),

  getUserDashboard: () =>
    request<{
      orders: RentalOrder[];
      sessions: GamingSession[];
      supportRequests: SupportRequest[];
      cloudProvider: CloudProviderStatus;
    }>('/api/user/dashboard'),

  createOrder: (body: { packageId: string; currency: CryptoCurrency; termsAccepted: boolean }) =>
    request<{ order: RentalOrder; wallet: WalletAddressConfig; quote: CryptoQuote }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  verifyOrder: (orderId: string, txHash: string) =>
    request<{
      order: RentalOrder;
      session: GamingSession | null;
      verification: { status: string; confirmations: number; message: string };
    }>(`/api/orders/${encodeURIComponent(orderId)}/verify`, {
      method: 'POST',
      body: JSON.stringify({ txHash }),
    }),

  recheckOrder: (orderId: string) =>
    request<{
      order: RentalOrder;
      session: GamingSession | null;
      verification: { status: string; confirmations: number; message: string };
    }>(`/api/orders/${encodeURIComponent(orderId)}/recheck`, {
      method: 'POST',
    }),

  launchSession: (sessionId: string) =>
    request<CloudLaunchResponse>(`/api/sessions/${encodeURIComponent(sessionId)}/launch`, {
      method: 'POST',
    }),

  createSupportRequest: (body: {
    type: 'Refund' | 'Payment' | 'Technical' | 'General';
    subject: string;
    message: string;
    orderId?: string;
  }) =>
    request<{ request: SupportRequest }>('/api/support', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getAdminOverview: () => request<AdminOverviewData>('/api/admin/overview'),
  adminRecheckOrder: (orderId: string) =>
    request<{ order: RentalOrder }>(`/api/admin/orders/${encodeURIComponent(orderId)}/recheck`, {
      method: 'POST',
    }),
  adminRevokeSession: (sessionId: string) =>
    request<{ ok: boolean }>(`/api/admin/sessions/${encodeURIComponent(sessionId)}/revoke`, {
      method: 'POST',
    }),
  adminUpdatePackage: (
    id: string,
    body: Partial<{
      name: string;
      subtitle: string;
      durationMinutes: number;
      priceUsd: number;
      buttonLabel: string;
      active: boolean;
      highlighted: boolean;
    }>
  ) =>
    request<{ package: RentalPackage }>(`/api/admin/packages/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  adminCreatePackage: (body: {
    name: string;
    subtitle: string;
    durationMinutes: number;
    priceUsd: number;
    buttonLabel?: string;
  }) =>
    request<{ package: RentalPackage }>('/api/admin/packages', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  adminUpdateWallet: (
    currency: CryptoCurrency,
    body: { address: string; minConfirmations: number }
  ) =>
    request<{ wallet: WalletAddressConfig }>(
      `/api/admin/wallets/${encodeURIComponent(currency)}`,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      }
    ),
  adminUpdateSupport: (
    id: string,
    body: { status: SupportStatus; adminNotes: string }
  ) =>
    request<{ request: SupportRequest }>(`/api/admin/support/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
};

export function formatDuration(minutes: number): string {
  if (minutes === 60) return '1 Hour';
  if (minutes > 60 && minutes % 60 === 0) return `${minutes / 60} Hours`;
  return `${minutes} Minutes`;
}

export function formatCountdown(msRemaining: number): string {
  const clamped = Math.max(0, Math.floor(msRemaining / 1000));
  const hrs = Math.floor(clamped / 3600);
  const mins = Math.floor((clamped % 3600) / 60);
  const secs = clamped % 60;
  return [hrs, mins, secs].map((n) => String(n).padStart(2, '0')).join(':');
}
