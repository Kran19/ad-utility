import { RoleType } from './auth';
import { CampaignStatus, CreativeType, AdPlacement, DeviceType } from './ad';

export interface AdminUserDto {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
  roles: RoleType[];
}

export interface AdminCreateUserDto {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  roles: RoleType[];
}

export interface AdminUpdateUserDto {
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  roles?: RoleType[];
}

export interface AdminRoleDto {
  id: string;
  name: RoleType;
  description?: string | null;
  permissions: string[];
}

export interface AdminDashboardMetricsDto {
  totalUsers: number;
  activeUtilities: number;
  totalUtilities: number;
  activeCampaigns: number;
  totalCampaigns: number;
  activeCreatives: number;
  totalCreatives: number;
  totalImpressions: number;
  totalClicks: number;
  adCtr: number;
  totalPageViews: number;
  toolStarts: number;
  toolCompletions: number;
  toolCompletionRate: number;
  totalAiRequests: number;
  totalAiTokens: number;
  totalAiCostUsd: number;
}

export interface AdminAuditLogDto {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorIp?: string | null;
  details?: Record<string, any> | null;
  createdAt: string;
}

export interface AdminPaginationQueryDto {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AdminSettingDto {
  key: string;
  value: Record<string, any>;
  category: string;
  description?: string | null;
  isEncrypted: boolean;
  updatedAt: string;
}

export interface AdminUpdateSettingDto {
  value: Record<string, any>;
}
