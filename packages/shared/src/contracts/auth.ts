/**
 * System Role Types supported by the platform
 */
export type RoleType = 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR' | 'ANALYST';

/**
 * Authenticated User Profile
 */
export interface AuthUserProfile {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  isActive: boolean;
  roles: RoleType[];
  permissions: string[];
}

/**
 * JWT Token Payload
 */
export interface JwtPayload {
  sub: string;
  email: string;
  roles: RoleType[];
  permissions: string[];
  iat?: number;
  exp?: number;
}

/**
 * Login Request DTO
 */
export interface LoginRequestDto {
  email: string;
  password: string;
}

/**
 * Refresh Token Request DTO
 */
export interface RefreshTokenRequestDto {
  refreshToken: string;
}

/**
 * Auth Token Response Payload
 */
export interface AuthResponseData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUserProfile;
}
