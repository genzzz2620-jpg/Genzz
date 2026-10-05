import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      subscriptionType: 'FREE' | 'PREMIUM';
      role: 'USER' | 'ADMIN';
      accountStatus: 'ACTIVE' | 'SUSPENDED';
    } & DefaultSession['user'];
  }

  interface User {
    subscriptionType?: 'FREE' | 'PREMIUM';
    role?: 'USER' | 'ADMIN';
    accountStatus?: 'ACTIVE' | 'SUSPENDED';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    subscriptionType?: 'FREE' | 'PREMIUM';
    role?: 'USER' | 'ADMIN';
    accountStatus?: 'ACTIVE' | 'SUSPENDED';
    lastActivitySync?: number;
  }
}
