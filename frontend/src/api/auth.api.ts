import { apiClient, unwrap } from './client';
import { userFromAccessToken } from '@/utils/jwt';
import type {
  LoginRequest,
  LoginResponse,
  MfaVerifyRequest,
  RegisterOrgRequest,
  User,
  MfaSetupResponse,
  UserRole,
  TrustedDevice,
} from '@/types';

export interface AuthMeResponse {
  id: string;
  email: string;
  role: UserRole;
  orgId: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  mfaEnabled: boolean;
  mfaEligible?: boolean;
  lastLogin?: string | null;
  createdAt?: string;
}

function mapMeToUser(data: AuthMeResponse): User {
  return {
    id: data.id,
    email: data.email,
    role: data.role,
    orgId: data.orgId,
    firstName: data.firstName,
    lastName: data.lastName,
    name: data.name,
    mfaEnabled: data.mfaEnabled,
    mfaEligible: data.mfaEligible ?? true,
    lastLogin: data.lastLogin ?? undefined,
    createdAt: data.createdAt,
  };
}

/** Backend login success (no MFA) */
interface BackendTokenPair {
  accessToken: string;
  refreshToken: string;
  promptTrustDevice?: boolean;
}

/** Backend MFA challenge */
interface BackendMfaChallenge {
  requiresMfa: true;
  tempToken: string;
}

type BackendLoginResult = BackendTokenPair | BackendMfaChallenge;

function isMfaChallenge(data: BackendLoginResult): data is BackendMfaChallenge {
  return 'requiresMfa' in data && data.requiresMfa === true;
}

function isTokenPair(data: BackendLoginResult): data is BackendTokenPair {
  return 'accessToken' in data && 'refreshToken' in data;
}

export const authApi = {
  login: async (payload: LoginRequest): Promise<LoginResponse> => {
    const res = await apiClient.post('/api/auth/login', payload);
    const data = unwrap(res) as BackendLoginResult;

    if (isMfaChallenge(data)) {
      return { requiresMfa: true, mfaToken: data.tempToken };
    }

    if (isTokenPair(data)) {
      return {
        requiresMfa: false,
        user: userFromAccessToken(data.accessToken, payload.email),
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      };
    }

    throw new Error('Unexpected login response from server');
  },

  verifyMfa: async (payload: MfaVerifyRequest): Promise<{ user: User; accessToken: string; refreshToken: string }> => {
    const res = await apiClient.post('/api/auth/mfa/verify', {
      code: payload.code,
      tempToken: payload.mfaToken,
      rememberMe: payload.rememberMe ?? false,
    });
    const data = unwrap(res) as BackendTokenPair;
    if (!isTokenPair(data)) {
      throw new Error('Unexpected MFA verify response from server');
    }
    // Email not returned after MFA — use placeholder; profile can refresh later
    const user = userFromAccessToken(data.accessToken, '');
    return {
      user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    };
  },

  register: async (payload: RegisterOrgRequest): Promise<{ user: User; accessToken: string; refreshToken: string }> => {
    const res = await apiClient.post('/api/auth/register-org', payload);
    const data = unwrap(res) as BackendTokenPair;
    if (!isTokenPair(data)) {
      throw new Error('Unexpected register response from server');
    }
    return {
      user: userFromAccessToken(data.accessToken, payload.adminEmail),
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    };
  },

  refreshToken: async (refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> => {
    const res = await apiClient.post('/api/auth/refresh', { refreshToken });
    return unwrap(res);
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/api/auth/logout');
  },

  setupMfa: async (): Promise<MfaSetupResponse> => {
    const res = await apiClient.post('/api/auth/mfa/setup');
    return unwrap(res);
  },

  enableMfa: async (code: string): Promise<void> => {
    await apiClient.post('/api/auth/mfa/confirm-setup', { code });
  },

  getMe: async (): Promise<User> => {
    const res = await apiClient.get('/api/auth/me');
    return mapMeToUser(unwrap(res) as AuthMeResponse);
  },

  changePassword: async (payload: {
    currentPassword: string;
    newPassword: string;
  }): Promise<void> => {
    await apiClient.post('/api/auth/change-password', payload);
  },

  registerTrustedDevice: async (deviceId: string): Promise<{ trustedUntil: string }> => {
    const res = await apiClient.post('/api/auth/trusted-devices', { deviceId });
    return unwrap(res) as { success: boolean; trustedUntil: string };
  },

  listTrustedDevices: async (): Promise<TrustedDevice[]> => {
    const res = await apiClient.get('/api/auth/trusted-devices');
    return unwrap(res) as TrustedDevice[];
  },

  revokeTrustedDevice: async (deviceId: string): Promise<void> => {
    await apiClient.delete(`/api/auth/trusted-devices/${deviceId}`);
  },
};

export const authKeys = {
  me: ['auth', 'me'] as const,
};
