import type { OrganizationPlan, OrganizationRole, ProjectRole } from './enums.js';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  plan: OrganizationPlan;
  billingEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  joinedAt: Date;
}

export interface OrganizationInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: OrganizationRole;
  token: string;
  invitedByUserId: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  declinedAt: Date | null;
  createdAt: Date;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  organizationId: string | null;
  ownerId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface ProjectEnvironment {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  baseUrl: string | null;
  description: string | null;
  isDefault: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  addedAt: Date;
}

// APIレスポンス型
export interface OrganizationPublic {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  plan: OrganizationPlan;
}

export interface ProjectPublic {
  id: string;
  name: string;
  description: string | null;
  organizationId: string | null;
  ownerId: string | null;
}
