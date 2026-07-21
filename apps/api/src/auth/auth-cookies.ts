import { createHash, randomUUID } from 'crypto';
import type { CookieOptions, Response } from 'express';

export const ACCESS_COOKIE = 'erp_access';
export const REFRESH_COOKIE = 'erp_refresh';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newTokenId(): string {
  return randomUUID();
}

/** Chấp nhận số giây hoặc chuỗi dạng 15m / 7d / 900s. */
export function parseExpiresIn(
  value: string | undefined,
  fallbackSeconds: number,
): string | number {
  if (!value || !value.trim()) {
    return fallbackSeconds;
  }
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }
  return trimmed;
}

export function durationToMs(value: string | number): number {
  if (typeof value === 'number') {
    return value * 1000;
  }
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(value.trim());
  if (!match) {
    return 604800000;
  }
  const amount = Number(match[1]);
  switch (match[2]) {
    case 'ms':
      return amount;
    case 's':
      return amount * 1000;
    case 'm':
      return amount * 60_000;
    case 'h':
      return amount * 3_600_000;
    case 'd':
      return amount * 86_400_000;
    default:
      return 604800000;
  }
}

export function cookieSecureFlag(): boolean {
  if (process.env.COOKIE_SECURE === 'true') return true;
  if (process.env.COOKIE_SECURE === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  accessExpiresIn: string | number,
  refreshExpiresIn: string | number,
) {
  const secure = cookieSecureFlag();
  const base: CookieOptions = {
    httpOnly: true,
    secure,
    sameSite: 'lax',
  };

  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...base,
    path: '/',
    maxAge: durationToMs(accessExpiresIn),
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...base,
    path: '/api/auth',
    maxAge: durationToMs(refreshExpiresIn),
  });
}

export function clearAuthCookies(res: Response) {
  const secure = cookieSecureFlag();
  res.clearCookie(ACCESS_COOKIE, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
  });
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/api/auth',
  });
}
