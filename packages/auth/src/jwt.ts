import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { JwtPayload, TokenPair, AuthConfig } from './types.js';
import { AuthenticationError } from '@agentest/shared';

export function generateTokens(
  userId: string,
  email: string,
  config: AuthConfig
): TokenPair {
  const accessPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
    sub: userId,
    email,
    type: 'access',
    jti: crypto.randomUUID(),
  };

  const refreshPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
    sub: userId,
    email,
    type: 'refresh',
    jti: crypto.randomUUID(),
  };

  const accessOptions: SignOptions = {
    expiresIn: config.jwt.accessExpiry as SignOptions['expiresIn'],
  };

  const refreshOptions: SignOptions = {
    expiresIn: config.jwt.refreshExpiry as SignOptions['expiresIn'],
  };

  const accessToken = jwt.sign(accessPayload, config.jwt.accessSecret, accessOptions);

  const refreshToken = jwt.sign(refreshPayload, config.jwt.refreshSecret, refreshOptions);

  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string, config: AuthConfig): JwtPayload {
  try {
    const payload = jwt.verify(token, config.jwt.accessSecret) as JwtPayload;
    if (payload.type !== 'access') {
      throw new AuthenticationError('Invalid token type');
    }
    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError('Invalid token');
    }
    throw error;
  }
}

export function verifyRefreshToken(token: string, config: AuthConfig): JwtPayload {
  try {
    const payload = jwt.verify(token, config.jwt.refreshSecret) as JwtPayload;
    if (payload.type !== 'refresh') {
      throw new AuthenticationError('Invalid token type');
    }
    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Refresh token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError('Invalid refresh token');
    }
    throw error;
  }
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload | null;
  } catch {
    return null;
  }
}

export function getTokenExpiry(expiresIn: string): Date {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid expiry format: ${expiresIn}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const now = new Date();
  switch (unit) {
    case 's':
      return new Date(now.getTime() + value * 1000);
    case 'm':
      return new Date(now.getTime() + value * 60 * 1000);
    case 'h':
      return new Date(now.getTime() + value * 60 * 60 * 1000);
    case 'd':
      return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
    default:
      throw new Error(`Unknown time unit: ${unit}`);
  }
}
