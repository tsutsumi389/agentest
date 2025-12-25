import type { UserPlan } from './enums.js';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  plan: UserPlan;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface Account {
  id: string;
  userId: string;
  provider: string;
  providerAccountId: string;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastActiveAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface RefreshToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

// API Response types
export interface UserPublic {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  plan: UserPlan;
}
