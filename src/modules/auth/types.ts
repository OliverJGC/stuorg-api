export type AuthSession = { accessToken: string; refreshToken: string; expiresIn: number };
export type Membership = { id: string; name: string; role: string; isAdmin: boolean };
export type SessionUser = { id: string; firstName: string; lastName: string };

export type ProviderSession = { access_token: string; refresh_token: string; expires_in: number };
