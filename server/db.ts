import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  CryptoCurrency,
  RentalPackage,
  WalletAddressConfig,
} from '../src/types.ts';

const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'gta6cloud.sqlite');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, keyHex] = stored.split(':');
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS packages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      price_usd REAL NOT NULL,
      button_label TEXT NOT NULL,
      features_json TEXT NOT NULL,
      highlighted INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS wallet_settings (
      currency TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      symbol TEXT NOT NULL,
      network TEXT NOT NULL,
      address TEXT NOT NULL,
      contract_address TEXT,
      decimals INTEGER NOT NULL,
      explorer_tx_base_url TEXT NOT NULL,
      min_confirmations INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      package_id TEXT NOT NULL,
      package_name TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      price_usd REAL NOT NULL,
      currency TEXT NOT NULL,
      network TEXT NOT NULL,
      receiving_address TEXT NOT NULL,
      expected_crypto_amount TEXT NOT NULL,
      tx_hash TEXT,
      status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Confirmed', 'Failed')),
      confirmations INTEGER NOT NULL DEFAULT 0,
      verification_message TEXT,
      verified_at TEXT,
      terms_accepted_at TEXT NOT NULL,
      expires_order_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS used_transactions (
      tx_key TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      currency TEXT NOT NULL,
      tx_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
      package_name TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Expired', 'Revoked')),
      started_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      last_launch_attempt_at TEXT,
      stream_node_id TEXT
    );

    CREATE TABLE IF NOT EXISTS support_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      order_id TEXT,
      type TEXT NOT NULL CHECK (type IN ('Refund', 'Payment', 'Technical', 'General')),
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Review', 'Refund Approved', 'Resolved')),
      admin_notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const pkgCount = db.prepare('SELECT COUNT(*) as count FROM packages').get() as { count: number };
  if (pkgCount.count === 0) {
    const defaultPackages: RentalPackage[] = [
      {
        id: 'pkg_quick_10m',
        name: 'Quick Session',
        subtitle: 'Instant Vice City drop-in for fast runs',
        durationMinutes: 10,
        priceUsd: 10,
        buttonLabel: 'RENT FOR $10',
        features: [
          '10 Minutes guaranteed cloud rig access',
          'Auto-expires strictly at 00:00:00',
          'Up to 4K 60fps WebRTC stream capability',
          'Zero local storage or GPU required',
        ],
        highlighted: false,
        active: true,
        sortOrder: 1,
      },
      {
        id: 'pkg_standard_30m',
        name: 'Standard Session',
        subtitle: 'Most popular for missions and exploration',
        durationMinutes: 30,
        priceUsd: 25,
        buttonLabel: 'RENT FOR $25',
        features: [
          '30 Minutes dedicated cloud GPU slot',
          'Auto-expires strictly at 00:00:00',
          'Priority low-latency regional routing',
          'Keyboard, mouse & controller passthrough',
        ],
        highlighted: true,
        active: true,
        sortOrder: 2,
      },
      {
        id: 'pkg_premium_60m',
        name: 'Premium Session',
        subtitle: 'Full hour of uninterrupted cloud power',
        durationMinutes: 60,
        priceUsd: 50,
        buttonLabel: 'RENT FOR $50',
        features: [
          '1 Hour (60 Minutes) high-tier GPU instance',
          'Auto-expires strictly at 00:00:00',
          'Ultra-low jitter 120Hz capable stream profile',
          'Priority support & session diagnostics',
        ],
        highlighted: false,
        active: true,
        sortOrder: 3,
      },
    ];

    const insertPkg = db.prepare(`
      INSERT INTO packages (
        id, name, subtitle, duration_minutes, price_usd, button_label,
        features_json, highlighted, active, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const pkg of defaultPackages) {
      insertPkg.run(
        pkg.id,
        pkg.name,
        pkg.subtitle,
        pkg.durationMinutes,
        pkg.priceUsd,
        pkg.buttonLabel,
        JSON.stringify(pkg.features),
        pkg.highlighted ? 1 : 0,
        pkg.active ? 1 : 0,
        pkg.sortOrder
      );
    }
  }

  const walletCount = db.prepare('SELECT COUNT(*) as count FROM wallet_settings').get() as { count: number };
  if (walletCount.count === 0) {
    const defaultWallets: WalletAddressConfig[] = [
      {
        currency: 'SOL',
        label: 'Solana (SOL)',
        symbol: 'SOL',
        network: 'Solana Mainnet',
        address: 'AgMMwo8vXoXJGd5RuEFv7N9YRH2912hNY4JdmDr1B66X',
        decimals: 9,
        explorerTxBaseUrl: 'https://solscan.io/tx/',
        minConfirmations: 1,
      },
      {
        currency: 'BTC',
        label: 'Bitcoin (BTC)',
        symbol: 'BTC',
        network: 'Bitcoin Mainnet',
        address: 'bc1qhqlsxseecjnfpkf4lkxx9pc6wwj253a235gpku',
        decimals: 8,
        explorerTxBaseUrl: 'https://mempool.space/tx/',
        minConfirmations: Number(process.env.MIN_BTC_CONFIRMATIONS || 1),
      },
      {
        currency: 'USDT_ERC20',
        label: 'USDT (Ethereum Network – ERC20)',
        symbol: 'USDT',
        network: 'Ethereum Mainnet (ERC20)',
        address: '0x284B8732Af2F7b460B49dCFed87c4cB842D3c25f',
        contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        decimals: 6,
        explorerTxBaseUrl: 'https://etherscan.io/tx/',
        minConfirmations: Number(process.env.MIN_ETH_CONFIRMATIONS || 1),
      },
      {
        currency: 'USDC_ERC20',
        label: 'USDC (Ethereum Network – ERC20)',
        symbol: 'USDC',
        network: 'Ethereum Mainnet (ERC20)',
        address: '0x284B8732Af2F7b460B49dCFed87c4cB842D3c25f',
        contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        decimals: 6,
        explorerTxBaseUrl: 'https://etherscan.io/tx/',
        minConfirmations: Number(process.env.MIN_ETH_CONFIRMATIONS || 1),
      },
    ];

    const insertWallet = db.prepare(`
      INSERT INTO wallet_settings (
        currency, label, symbol, network, address, contract_address,
        decimals, explorer_tx_base_url, min_confirmations
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const w of defaultWallets) {
      insertWallet.run(
        w.currency,
        w.label,
        w.symbol,
        w.network,
        w.address,
        w.contractAddress ?? null,
        w.decimals,
        w.explorerTxBaseUrl,
        w.minConfirmations
      );
    }
  }

  // Seed admin account solely on server side from environment variables
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@gta6cloud.local').toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD;
  const existingAdmin = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(adminEmail) as { id: string } | undefined;

  if (!existingAdmin && adminPassword) {
    db.prepare(`
      INSERT INTO users (id, email, username, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, 'admin', ?)
    `).run(
      `usr_${crypto.randomUUID()}`,
      adminEmail,
      'Platform Admin',
      hashPassword(adminPassword),
      new Date().toISOString()
    );
  }
}

export function expireElapsedSessions() {
  const nowIso = new Date().toISOString();
  db.prepare(`
    UPDATE sessions
    SET status = 'Expired'
    WHERE status = 'Active' AND expires_at <= ?
  `).run(nowIso);
}

export function getWalletByCurrency(currency: CryptoCurrency): WalletAddressConfig | null {
  const row = db
    .prepare('SELECT * FROM wallet_settings WHERE currency = ?')
    .get(currency) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    currency: row.currency as CryptoCurrency,
    label: row.label as string,
    symbol: row.symbol as string,
    network: row.network as string,
    address: row.address as string,
    contractAddress: (row.contract_address as string | null) ?? undefined,
    decimals: row.decimals as number,
    explorerTxBaseUrl: row.explorer_tx_base_url as string,
    minConfirmations: row.min_confirmations as number,
  };
}
