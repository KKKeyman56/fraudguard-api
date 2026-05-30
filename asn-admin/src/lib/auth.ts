import { LoginCredentials, User } from '@/types';

const VALID_USERS: Record<string, { password: string; role: string }> = {
  admin: { password: 'admin123', role: 'Administrator' },
  operator: { password: 'operator123', role: 'Operator' },
};

export function authenticate(credentials: LoginCredentials): User | null {
  const user = VALID_USERS[credentials.username.toLowerCase()];
  if (!user || user.password !== credentials.password) return null;
  return { username: credentials.username, role: user.role };
}

export const AUTH_COOKIE = 'asn_auth';

export function encodeSession(user: User): string {
  return btoa(JSON.stringify(user));
}

export function decodeSession(token: string): User | null {
  try {
    return JSON.parse(atob(token)) as User;
  } catch {
    return null;
  }
}
