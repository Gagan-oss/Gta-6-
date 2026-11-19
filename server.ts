import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  attachUser,
  clearSessionCookie,
  requireAdmin,
  requireAuth,
  setSessionCookie,
  type AuthenticatedRequest,
} from './server/auth.ts';
import {
  normalizeTxHash,
  validateTxHashFormat,
  verifyBlockchainPayment,
} from './server/blockchain.ts';
import { getCloudProviderStatus, launchCloudStreamSession } from './server/cloudProvider.ts';
import {
  db,
  expireElapsedSessions,
  getWalletByCurrency,
  hashPassword,
  initDatabase,
  verifyPassword,
} from './server/db.ts';
import { getCryptoQuote } from './server/pricing.ts';
import type {
  CryptoCurrency,
  GamingSession,
  RentalOrder,
  RentalPackage,
  SupportRequest,
  SupportStatus,
  WalletAddressConfig,
} from './src/types.ts';

initDatabase();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(attachUser);

function mapPackageRow(row: Record<string, unknown>): RentalPackage {
  return {
    id: row.id as string,
    name: row.name as string,
    subtitle: row.subtitle as string,
    durationMinutes: row.duration_minutes as number,
    priceUsd: row.price_usd as number,
    buttonLabel: row.button_label as string,
    features: JSON.parse(row.features_json as string) as string[],
    highlighted: Boolean(row.highlighted),
    active: Boolean(row.active),
    sortOrder: row.sort_order as number,
  };
}

function mapWalletRow(row: Record<string, unknown>): WalletAddressConfig {
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

function mapOrderRow(row: Record<string, unknown>): RentalOrder {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    packageId: row.package_id as string,
    packageName: row.package_name as string,
    durationMinutes: row.duration_minutes as number,
    priceUsd: row.price_usd as number,
    currency: row.currency as CryptoCurrency,
    network: row.network as string,
    receivingAddress: row.receiving_address as string,
    expectedCryptoAmount: row.expected_crypto_amount as string,
    txHash: (row.tx_hash as string | null) ?? null,
    status: row.status as RentalOrder['status'],
    confirmations: row.confirmations as number,
    verificationMessage: (row.verification_message as string | null) ?? null,
    verifiedAt: (row.verified_at as string | null) ?? null,
    termsAcceptedAt: row.terms_accepted_at as string,
    expiresOrderAt: row.expires_order_at as string,
    createdAt: row.created_at as string,
  };
}

function mapSessionRow(row: Record<string, unknown>): GamingSession {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    orderId: row.order_id as string,
    packageName: row.package_name as string,
    durationMinutes: row.duration_minutes as number,
    status: row.status as GamingSession['status'],
    startedAt: row.started_at as string,
    expiresAt: row.expires_at as string,
    lastLaunchAttemptAt: (row.last_launch_attempt_at as string | null) ?? null,
    streamNodeId: (row.stream_node_id as string | null) ?? null,
  };
}

function mapSupportRow(row: Record<string, unknown>): SupportRequest {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    userEmail: (row.user_email as string | undefined) ?? undefined,
    orderId: (row.order_id as string | null) ?? null,
    type: row.type as SupportRequest['type'],
    subject: row.subject as string,
    message: row.message as string,
    status: row.status as SupportStatus,
    adminNotes: (row.admin_notes as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function hasAdminUser(): boolean {
  const countRow = db
    .prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'")
    .get() as { count: number };
  return countRow.count > 0;
}

function activateSessionForConfirmedOrder(order: RentalOrder): GamingSession {
  const existing = db
    .prepare('SELECT * FROM sessions WHERE order_id = ?')
    .get(order.id) as Record<string, unknown> | undefined;
  if (existing) return mapSessionRow(existing);

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + order.durationMinutes * 60_000);
  const sessionId = `ses_${crypto.randomUUID()}`;

  db.prepare(`
    INSERT INTO sessions (
      id, user_id, order_id, package_name, duration_minutes, status, started_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, 'Active', ?, ?)
  `).run(
    sessionId,
    order.userId,
    order.id,
    order.packageName,
    order.durationMinutes,
    startedAt.toISOString(),
    expiresAt.toISOString()
  );

  const inserted = db
    .prepare('SELECT * FROM sessions WHERE id = ?')
    .get(sessionId) as Record<string, unknown>;
  return mapSessionRow(inserted);
}

// Public routes
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get('/api/packages', (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM packages WHERE active = 1 ORDER BY sort_order ASC')
    .all() as Array<Record<string, unknown>>;
  res.json({ packages: rows.map(mapPackageRow) });
});

app.get('/api/wallets', (_req, res) => {
  const rows = db.prepare('SELECT * FROM wallet_settings').all() as Array<Record<string, unknown>>;
  res.json({ wallets: rows.map(mapWalletRow) });
});

app.get('/api/quote', async (req, res) => {
  const packageId = String(req.query.packageId || '');
  const currency = String(req.query.currency || '') as CryptoCurrency;

  const pkgRow = db
    .prepare('SELECT * FROM packages WHERE id = ? AND active = 1')
    .get(packageId) as Record<string, unknown> | undefined;

  if (!pkgRow) {
    res.status(404).json({ error: 'Selected rental package not found.' });
    return;
  }

  const wallet = getWalletByCurrency(currency);
  if (!wallet) {
    res.status(400).json({ error: 'Unsupported cryptocurrency selected.' });
    return;
  }

  const quote = await getCryptoQuote(currency, pkgRow.price_usd as number);
  res.json({ quote, wallet });
});

app.get('/api/cloud/status', (_req, res) => {
  res.json({ provider: getCloudProviderStatus() });
});

// Authentication routes
app.get('/api/auth/me', (req: AuthenticatedRequest, res) => {
  res.json({
    user: req.user ?? null,
    adminInitialized: hasAdminUser(),
  });
});

app.post('/api/auth/register', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  if (username.length < 2 || username.length > 32) {
    res.status(400).json({ error: 'Username must be between 2 and 32 characters.' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const id = `usr_${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO users (id, email, username, password_hash, role, created_at)
    VALUES (?, ?, ?, ?, 'user', ?)
  `).run(id, email, username, hashPassword(password), createdAt);

  setSessionCookie(res, id);
  res.status(201).json({
    user: { id, email, username, role: 'user', createdAt },
  });
});

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const row = db
    .prepare('SELECT id, email, username, password_hash, role, created_at FROM users WHERE email = ?')
    .get(email) as
    | {
        id: string;
        email: string;
        username: string;
        password_hash: string;
        role: 'user' | 'admin';
        created_at: string;
      }
    | undefined;

  if (!row || !verifyPassword(password, row.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  setSessionCookie(res, row.id);
  res.json({
    user: {
      id: row.id,
      email: row.email,
      username: row.username,
      role: row.role,
      createdAt: row.created_at,
    },
  });
});

app.post('/api/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.post('/api/auth/setup-admin', (req, res) => {
  if (hasAdminUser()) {
    res.status(403).json({
      error: 'An administrator account is already configured. Sign in with your admin credentials.',
    });
    return;
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  const username = String(req.body?.username || 'Platform Owner').trim();
  const password = String(req.body?.password || '');

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Valid admin email is required.' });
    return;
  }
  if (password.length < 10) {
    res.status(400).json({ error: 'Admin password must be at least 10 characters long.' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    res.status(409).json({ error: 'That email is already registered as a regular user.' });
    return;
  }

  const id = `usr_${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO users (id, email, username, password_hash, role, created_at)
    VALUES (?, ?, ?, ?, 'admin', ?)
  `).run(id, email, username, hashPassword(password), createdAt);

  setSessionCookie(res, id);
  res.status(201).json({
    user: { id, email, username, role: 'admin', createdAt },
  });
});

// Authenticated User Dashboard & Checkout routes
app.get('/api/user/dashboard', requireAuth, (req: AuthenticatedRequest, res) => {
  expireElapsedSessions();
  const userId = req.user!.id;

  const orderRows = db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as Array<Record<string, unknown>>;

  const sessionRows = db
    .prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY started_at DESC')
    .all(userId) as Array<Record<string, unknown>>;

  const supportRows = db
    .prepare('SELECT * FROM support_requests WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as Array<Record<string, unknown>>;

  res.json({
    orders: orderRows.map(mapOrderRow),
    sessions: sessionRows.map(mapSessionRow),
    supportRequests: supportRows.map(mapSupportRow),
    cloudProvider: getCloudProviderStatus(),
  });
});

app.post('/api/orders', requireAuth, async (req: AuthenticatedRequest, res) => {
  const packageId = String(req.body?.packageId || '');
  const currency = String(req.body?.currency || '') as CryptoCurrency;
  const termsAccepted = req.body?.termsAccepted === true;

  if (!termsAccepted) {
    res.status(400).json({
      error: 'You must accept the Terms & Conditions before creating a payment order.',
    });
    return;
  }

  const pkgRow = db
    .prepare('SELECT * FROM packages WHERE id = ? AND active = 1')
    .get(packageId) as Record<string, unknown> | undefined;

  if (!pkgRow) {
    res.status(404).json({ error: 'Selected package is unavailable.' });
    return;
  }

  const wallet = getWalletByCurrency(currency);
  if (!wallet) {
    res.status(400).json({ error: 'Unsupported cryptocurrency selected.' });
    return;
  }

  const pkg = mapPackageRow(pkgRow);
  const quote = await getCryptoQuote(currency, pkg.priceUsd);
  const now = new Date();
  const expiresOrderAt = new Date(now.getTime() + 15 * 60_000);
  const orderId = `ord_${crypto.randomUUID()}`;

  db.prepare(`
    INSERT INTO orders (
      id, user_id, package_id, package_name, duration_minutes, price_usd,
      currency, network, receiving_address, expected_crypto_amount,
      status, confirmations, terms_accepted_at, expires_order_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 0, ?, ?, ?)
  `).run(
    orderId,
    req.user!.id,
    pkg.id,
    pkg.name,
    pkg.durationMinutes,
    pkg.priceUsd,
    wallet.currency,
    wallet.network,
    wallet.address,
    quote.expectedAmount,
    now.toISOString(),
    expiresOrderAt.toISOString(),
    now.toISOString()
  );

  const inserted = db
    .prepare('SELECT * FROM orders WHERE id = ?')
    .get(orderId) as Record<string, unknown>;

  res.status(201).json({
    order: mapOrderRow(inserted),
    wallet,
    quote,
  });
});

async function runOrderVerification(order: RentalOrder, rawTxHash: string) {
  const txHash = normalizeTxHash(order.currency, rawTxHash);
  const formatError = validateTxHashFormat(order.currency, txHash);
  if (formatError) {
    return { ok: false as const, statusCode: 400, error: formatError };
  }

  const wallet = getWalletByCurrency(order.currency);
  if (!wallet) {
    return { ok: false as const, statusCode: 500, error: 'Wallet configuration missing.' };
  }

  const replayNamespace =
    order.currency === 'USDT_ERC20' || order.currency === 'USDC_ERC20' ? 'ETH' : order.currency;
  const txKey = `${replayNamespace}:${txHash.toLowerCase()}`;

  const existingUse = db
    .prepare('SELECT order_id FROM used_transactions WHERE tx_key = ?')
    .get(txKey) as { order_id: string } | undefined;

  if (existingUse && existingUse.order_id !== order.id) {
    return {
      ok: false as const,
      statusCode: 409,
      error: 'Duplicate transaction detected: this blockchain transaction hash has already been claimed.',
    };
  }

  const verification = await verifyBlockchainPayment({
    currency: order.currency,
    txHash,
    wallet: { ...wallet, address: order.receivingAddress },
    expectedAmount: order.expectedCryptoAmount,
    orderCreatedAtIso: order.createdAt,
  });

  const nowIso = new Date().toISOString();
  let createdSession: GamingSession | null = null;

  const persistTx = db.transaction(() => {
    if (verification.status === 'Confirmed') {
      const claim = db
        .prepare('SELECT order_id FROM used_transactions WHERE tx_key = ?')
        .get(txKey) as { order_id: string } | undefined;
      if (claim && claim.order_id !== order.id) {
        throw new Error('REPLAY_CONFLICT');
      }
      if (!claim) {
        db.prepare(`
          INSERT INTO used_transactions (tx_key, order_id, currency, tx_hash, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(txKey, order.id, order.currency, txHash, nowIso);
      }
    }

    db.prepare(`
      UPDATE orders
      SET tx_hash = ?, status = ?, confirmations = ?, verification_message = ?, verified_at = ?
      WHERE id = ?
    `).run(
      txHash,
      verification.status,
      verification.confirmations,
      verification.message,
      verification.status === 'Confirmed' ? nowIso : null,
      order.id
    );

    if (verification.status === 'Confirmed') {
      createdSession = activateSessionForConfirmedOrder(order);
    }
  });

  try {
    persistTx();
  } catch (err) {
    if (err instanceof Error && err.message === 'REPLAY_CONFLICT') {
      return {
        ok: false as const,
        statusCode: 409,
        error: 'Duplicate transaction detected: already claimed by another order.',
      };
    }
    throw err;
  }

  const updatedOrderRow = db
    .prepare('SELECT * FROM orders WHERE id = ?')
    .get(order.id) as Record<string, unknown>;

  return {
    ok: true as const,
    order: mapOrderRow(updatedOrderRow),
    session: createdSession,
    verification,
  };
}

app.post('/api/orders/:id/verify', requireAuth, async (req: AuthenticatedRequest, res) => {
  const orderRow = db
    .prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id) as Record<string, unknown> | undefined;

  if (!orderRow) {
    res.status(404).json({ error: 'Order not found.' });
    return;
  }

  const order = mapOrderRow(orderRow);
  if (order.status === 'Confirmed') {
    const existingSession = db
      .prepare('SELECT * FROM sessions WHERE order_id = ?')
      .get(order.id) as Record<string, unknown> | undefined;
    res.json({
      order,
      session: existingSession ? mapSessionRow(existingSession) : null,
      verification: {
        status: 'Confirmed',
        confirmations: order.confirmations,
        message: order.verificationMessage || 'Payment already confirmed.',
      },
    });
    return;
  }

  const rawTxHash = String(req.body?.txHash || '').trim();
  const result = await runOrderVerification(order, rawTxHash);
  if (!result.ok) {
    res.status(result.statusCode).json({ error: result.error });
    return;
  }

  res.json({
    order: result.order,
    session: result.session,
    verification: result.verification,
  });
});

app.post('/api/orders/:id/recheck', requireAuth, async (req: AuthenticatedRequest, res) => {
  const orderRow = db
    .prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id) as Record<string, unknown> | undefined;

  if (!orderRow) {
    res.status(404).json({ error: 'Order not found.' });
    return;
  }

  const order = mapOrderRow(orderRow);
  if (!order.txHash) {
    res.status(400).json({ error: 'No transaction hash has been submitted for this order yet.' });
    return;
  }

  const result = await runOrderVerification(order, order.txHash);
  if (!result.ok) {
    res.status(result.statusCode).json({ error: result.error });
    return;
  }

  res.json({
    order: result.order,
    session: result.session,
    verification: result.verification,
  });
});

app.post('/api/sessions/:id/launch', requireAuth, async (req: AuthenticatedRequest, res) => {
  expireElapsedSessions();

  const row = db
    .prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id) as Record<string, unknown> | undefined;

  if (!row) {
    res.status(404).json({ error: 'Gaming session not found.' });
    return;
  }

  const session = mapSessionRow(row);
  const nowIso = new Date().toISOString();
  db.prepare('UPDATE sessions SET last_launch_attempt_at = ? WHERE id = ?').run(nowIso, session.id);

  const launchResult = await launchCloudStreamSession(session, req.user!.id);
  if (launchResult.statusCode === 'STREAM_READY' && launchResult.session.streamNodeId) {
    db.prepare('UPDATE sessions SET stream_node_id = ? WHERE id = ?').run(
      launchResult.session.streamNodeId,
      session.id
    );
  }

  res.json(launchResult);
});

app.post('/api/support', requireAuth, (req: AuthenticatedRequest, res) => {
  const type = String(req.body?.type || 'General') as SupportRequest['type'];
  const subject = String(req.body?.subject || '').trim();
  const message = String(req.body?.message || '').trim();
  const orderId = req.body?.orderId ? String(req.body.orderId).trim() : null;

  if (!['Refund', 'Payment', 'Technical', 'General'].includes(type)) {
    res.status(400).json({ error: 'Invalid request category.' });
    return;
  }
  if (subject.length < 3 || message.length < 10) {
    res.status(400).json({ error: 'Please include a subject and detailed message (min 10 chars).' });
    return;
  }

  if (orderId) {
    const ownedOrder = db
      .prepare('SELECT id FROM orders WHERE id = ? AND user_id = ?')
      .get(orderId, req.user!.id);
    if (!ownedOrder) {
      res.status(404).json({ error: 'Referenced order not found on your account.' });
      return;
    }
  }

  const id = `sup_${crypto.randomUUID()}`;
  const nowIso = new Date().toISOString();

  db.prepare(`
    INSERT INTO support_requests (
      id, user_id, order_id, type, subject, message, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'Open', ?, ?)
  `).run(id, req.user!.id, orderId, type, subject, message, nowIso, nowIso);

  const row = db
    .prepare('SELECT * FROM support_requests WHERE id = ?')
    .get(id) as Record<string, unknown>;

  res.status(201).json({ request: mapSupportRow(row) });
});

// Admin routes (strictly role-checked)
app.get('/api/admin/overview', requireAdmin, (_req, res) => {
  expireElapsedSessions();

  const usersRows = db.prepare(`
    SELECT
      u.id, u.email, u.username, u.role, u.created_at,
      COALESCE(SUM(CASE WHEN o.status = 'Confirmed' THEN o.price_usd ELSE 0 END), 0) as total_spent_usd,
      COUNT(DISTINCT o.id) as order_count,
      COUNT(DISTINCT CASE WHEN s.status = 'Active' THEN s.id END) as active_sessions_count
    FROM users u
    LEFT JOIN orders o ON o.user_id = u.id
    LEFT JOIN sessions s ON s.user_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all() as Array<Record<string, unknown>>;

  const orderRows = db.prepare(`
    SELECT o.*, u.email as user_email, u.username as username
    FROM orders o
    JOIN users u ON u.id = o.user_id
    ORDER BY o.created_at DESC
  `).all() as Array<Record<string, unknown>>;

  const sessionRows = db.prepare(`
    SELECT s.*, u.email as user_email, u.username as username
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    ORDER BY s.started_at DESC
  `).all() as Array<Record<string, unknown>>;

  const packageRows = db
    .prepare('SELECT * FROM packages ORDER BY sort_order ASC')
    .all() as Array<Record<string, unknown>>;

  const walletRows = db
    .prepare('SELECT * FROM wallet_settings')
    .all() as Array<Record<string, unknown>>;

  const supportRows = db.prepare(`
    SELECT sr.*, u.email as user_email
    FROM support_requests sr
    JOIN users u ON u.id = sr.user_id
    ORDER BY sr.created_at DESC
  `).all() as Array<Record<string, unknown>>;

  const orders = orderRows.map((row) => ({
    ...mapOrderRow(row),
    userEmail: row.user_email as string,
    username: row.username as string,
  }));

  const sessions = sessionRows.map((row) => ({
    ...mapSessionRow(row),
    userEmail: row.user_email as string,
    username: row.username as string,
  }));

  const totalRevenueUsd = orders
    .filter((o) => o.status === 'Confirmed')
    .reduce((sum, o) => sum + o.priceUsd, 0);

  res.json({
    metrics: {
      totalRevenueUsd,
      confirmedTransactions: orders.filter((o) => o.status === 'Confirmed').length,
      pendingTransactions: orders.filter((o) => o.status === 'Pending').length,
      failedTransactions: orders.filter((o) => o.status === 'Failed').length,
      activeSessions: sessions.filter((s) => s.status === 'Active').length,
      registeredUsers: usersRows.length,
      openSupportRequests: supportRows.filter((r) => r.status === 'Open' || r.status === 'In Review').length,
    },
    users: usersRows.map((u) => ({
      id: u.id as string,
      email: u.email as string,
      username: u.username as string,
      role: u.role as 'user' | 'admin',
      createdAt: u.created_at as string,
      totalSpentUsd: Number(u.total_spent_usd || 0),
      orderCount: Number(u.order_count || 0),
      activeSessionsCount: Number(u.active_sessions_count || 0),
    })),
    orders,
    sessions,
    packages: packageRows.map(mapPackageRow),
    wallets: walletRows.map(mapWalletRow),
    supportRequests: supportRows.map(mapSupportRow),
  });
});

app.post('/api/admin/orders/:id/recheck', requireAdmin, async (req, res) => {
  const row = db
    .prepare('SELECT * FROM orders WHERE id = ?')
    .get(req.params.id) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: 'Order not found.' });
    return;
  }
  const order = mapOrderRow(row);
  if (!order.txHash) {
    res.status(400).json({ error: 'Order has no transaction hash submitted.' });
    return;
  }

  const result = await runOrderVerification(order, order.txHash);
  if (!result.ok) {
    res.status(result.statusCode).json({ error: result.error });
    return;
  }

  res.json(result);
});

app.post('/api/admin/sessions/:id/revoke', requireAdmin, (req, res) => {
  const result = db
    .prepare("UPDATE sessions SET status = 'Revoked' WHERE id = ? AND status = 'Active'")
    .run(req.params.id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Active session not found.' });
    return;
  }

  res.json({ ok: true });
});

app.put('/api/admin/packages/:id', requireAdmin, (req, res) => {
  const existing = db
    .prepare('SELECT * FROM packages WHERE id = ?')
    .get(req.params.id) as Record<string, unknown> | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Package not found.' });
    return;
  }

  const name = String(req.body?.name ?? existing.name).trim();
  const subtitle = String(req.body?.subtitle ?? existing.subtitle).trim();
  const durationMinutes = Number(req.body?.durationMinutes ?? existing.duration_minutes);
  const priceUsd = Number(req.body?.priceUsd ?? existing.price_usd);
  const buttonLabel = String(req.body?.buttonLabel ?? `RENT FOR $${priceUsd}`).trim();
  const active = req.body?.active !== undefined ? Boolean(req.body.active) : Boolean(existing.active);
  const highlighted =
    req.body?.highlighted !== undefined
      ? Boolean(req.body.highlighted)
      : Boolean(existing.highlighted);
  const features = Array.isArray(req.body?.features)
    ? req.body.features.map(String)
    : (JSON.parse(existing.features_json as string) as string[]);

  if (!name || durationMinutes < 1 || priceUsd < 1) {
    res.status(400).json({ error: 'Invalid package values.' });
    return;
  }

  db.prepare(`
    UPDATE packages
    SET name = ?, subtitle = ?, duration_minutes = ?, price_usd = ?,
        button_label = ?, features_json = ?, highlighted = ?, active = ?
    WHERE id = ?
  `).run(
    name,
    subtitle,
    durationMinutes,
    priceUsd,
    buttonLabel,
    JSON.stringify(features),
    highlighted ? 1 : 0,
    active ? 1 : 0,
    req.params.id
  );

  const updated = db
    .prepare('SELECT * FROM packages WHERE id = ?')
    .get(req.params.id) as Record<string, unknown>;

  res.json({ package: mapPackageRow(updated) });
});

app.post('/api/admin/packages', requireAdmin, (req, res) => {
  const name = String(req.body?.name || '').trim();
  const subtitle = String(req.body?.subtitle || '').trim();
  const durationMinutes = Number(req.body?.durationMinutes || 0);
  const priceUsd = Number(req.body?.priceUsd || 0);
  const buttonLabel = String(req.body?.buttonLabel || `RENT FOR $${priceUsd}`).trim();
  const features = Array.isArray(req.body?.features)
    ? req.body.features.map(String)
    : [`${durationMinutes} Minutes cloud gaming session`, 'Auto-expires at 00:00:00'];

  if (!name || durationMinutes < 1 || priceUsd < 1) {
    res.status(400).json({ error: 'Name, duration, and price are required.' });
    return;
  }

  const id = `pkg_${crypto.randomUUID().slice(0, 8)}`;
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) as maxOrder FROM packages').get() as {
    maxOrder: number;
  };

  db.prepare(`
    INSERT INTO packages (
      id, name, subtitle, duration_minutes, price_usd, button_label,
      features_json, highlighted, active, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?)
  `).run(
    id,
    name,
    subtitle || 'Custom cloud gaming package',
    durationMinutes,
    priceUsd,
    buttonLabel,
    JSON.stringify(features),
    maxOrder.maxOrder + 1
  );

  const created = db.prepare('SELECT * FROM packages WHERE id = ?').get(id) as Record<string, unknown>;
  res.status(201).json({ package: mapPackageRow(created) });
});

app.put('/api/admin/wallets/:currency', requireAdmin, (req, res) => {
  const currency = String(req.params.currency) as CryptoCurrency;
  const existing = getWalletByCurrency(currency);
  if (!existing) {
    res.status(404).json({ error: 'Wallet currency not found.' });
    return;
  }

  const address = String(req.body?.address || '').trim();
  const minConfirmations = Math.max(
    1,
    Number(req.body?.minConfirmations ?? existing.minConfirmations)
  );

  if (address.length < 20) {
    res.status(400).json({ error: 'Please enter a valid receiving wallet address.' });
    return;
  }

  db.prepare(`
    UPDATE wallet_settings SET address = ?, min_confirmations = ? WHERE currency = ?
  `).run(address, minConfirmations, currency);

  res.json({ wallet: getWalletByCurrency(currency) });
});

app.put('/api/admin/support/:id', requireAdmin, (req, res) => {
  const status = String(req.body?.status || '') as SupportStatus;
  const adminNotes = String(req.body?.adminNotes ?? '').trim();

  if (!['Open', 'In Review', 'Refund Approved', 'Resolved'].includes(status)) {
    res.status(400).json({ error: 'Invalid support status.' });
    return;
  }

  const updatedAt = new Date().toISOString();
  const result = db
    .prepare(`
      UPDATE support_requests SET status = ?, admin_notes = ?, updated_at = ? WHERE id = ?
    `)
    .run(status, adminNotes || null, updatedAt, req.params.id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Support request not found.' });
    return;
  }

  const row = db
    .prepare(`
      SELECT sr.*, u.email as user_email
      FROM support_requests sr JOIN users u ON u.id = sr.user_id
      WHERE sr.id = ?
    `)
    .get(req.params.id) as Record<string, unknown>;

  res.json({ request: mapSupportRow(row) });
});

// Serve frontend via Vite in dev or built dist/ in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output missing. Run npm run build.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GTA 6 CLOUD server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
