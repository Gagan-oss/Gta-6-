import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { PublicUser } from '../src/types.ts';
import { db } from './db.ts';

const COOKIE_NAME = 'gta6cloud_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const runtimeSecret =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

interface TokenPayload {
  uid: string;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  user?: PublicUser;
}

function signPayload(payload: TokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', runtimeSecret)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', runtimeSecret)
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
    if (!parsed.uid || !parsed.exp || Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, userId: string) {
  const token = signPayload({
    uid: userId,
    exp: Date.now() + SESSION_TTL_MS,
  });

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

export function getUserFromRequest(req: Request): PublicUser | null {
  const rawToken = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (!rawToken) return null;
  const payload = verifyToken(rawToken);
  if (!payload) return null;

  const row = db
    .prepare('SELECT id, email, username, role, created_at FROM users WHERE id = ?')
    .get(payload.uid) as
    | { id: string; email: string; username: string; role: 'user' | 'admin'; created_at: string }
    | undefined;

  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    role: row.role,
    createdAt: row.created_at,
  };
}

export function attachUser(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  req.user = getUserFromRequest(req) ?? undefined;
  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required. Please log in or create an account.' });
    return;
  }
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Administrator permissions required.' });
    return;
  }
  next();
}
