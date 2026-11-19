export type UserRole = 'user' | 'admin';

export type CryptoCurrency = 'SOL' | 'BTC' | 'USDT_ERC20' | 'USDC_ERC20';

export type PaymentStatus = 'Pending' | 'Confirmed' | 'Failed';

export type SessionStatus = 'Active' | 'Expired' | 'Revoked';

export type SupportStatus = 'Open' | 'In Review' | 'Refund Approved' | 'Resolved';

export interface PublicUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  createdAt: string;
}

export interface RentalPackage {
  id: string;
  name: string;
  subtitle: string;
  durationMinutes: number;
  priceUsd: number;
  buttonLabel: string;
  features: string[];
  highlighted: boolean;
  active: boolean;
  sortOrder: number;
}

export interface WalletAddressConfig {
  currency: CryptoCurrency;
  label: string;
  symbol: string;
  network: string;
  address: string;
  contractAddress?: string;
  decimals: number;
  explorerTxBaseUrl: string;
  minConfirmations: number;
}

export interface CryptoQuote {
  currency: CryptoCurrency;
  usdRate: number;
  expectedAmount: string;
  fetchedAt: string;
  source: string;
}

export interface RentalOrder {
  id: string;
  userId: string;
  packageId: string;
  packageName: string;
  durationMinutes: number;
  priceUsd: number;
  currency: CryptoCurrency;
  network: string;
  receivingAddress: string;
  expectedCryptoAmount: string;
  txHash: string | null;
  status: PaymentStatus;
  confirmations: number;
  verificationMessage: string | null;
  verifiedAt: string | null;
  termsAcceptedAt: string;
  expiresOrderAt: string;
  createdAt: string;
}

export interface GamingSession {
  id: string;
  userId: string;
  orderId: string;
  packageName: string;
  durationMinutes: number;
  status: SessionStatus;
  startedAt: string;
  expiresAt: string;
  lastLaunchAttemptAt: string | null;
  streamNodeId: string | null;
}

export interface SupportRequest {
  id: string;
  userId: string;
  userEmail?: string;
  orderId: string | null;
  type: 'Refund' | 'Payment' | 'Technical' | 'General';
  subject: string;
  message: string;
  status: SupportStatus;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CloudProviderStatus {
  connected: boolean;
  providerName: string | null;
  region: string;
  licenseVerified: boolean;
  statusCode: 'CONNECTED' | 'INFRASTRUCTURE_NOT_CONNECTED';
  message: string;
  requirements: string[];
}

export interface CloudLaunchResponse {
  connected: boolean;
  statusCode: 'STREAM_READY' | 'INFRASTRUCTURE_NOT_CONNECTED' | 'SESSION_EXPIRED';
  message: string;
  streamEndpoint?: string;
  signalingToken?: string;
  session: GamingSession;
  provider: CloudProviderStatus;
}

export interface AdminOverviewData {
  metrics: {
    totalRevenueUsd: number;
    confirmedTransactions: number;
    pendingTransactions: number;
    failedTransactions: number;
    activeSessions: number;
    registeredUsers: number;
    openSupportRequests: number;
  };
  users: Array<
    PublicUser & {
      totalSpentUsd: number;
      orderCount: number;
      activeSessionsCount: number;
    }
  >;
  orders: Array<RentalOrder & { userEmail: string; username: string }>;
  sessions: Array<GamingSession & { userEmail: string; username: string }>;
  packages: RentalPackage[];
  wallets: WalletAddressConfig[];
  supportRequests: SupportRequest[];
}
