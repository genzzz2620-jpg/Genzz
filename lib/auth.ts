import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { consumeRateLimit, requestAddress } from '@/lib/security/rate-limit';

const SESSION_MAX_AGE = 8 * 60 * 60;

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE,
  },
  jwt: { maxAge: SESSION_MAX_AGE },
  useSecureCookies: process.env.NODE_ENV === 'production',
  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === 'production' ? '__Secure-' : ''}next-auth.session-token`,
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production' },
    },
    callbackUrl: {
      name: `${process.env.NODE_ENV === 'production' ? '__Secure-' : ''}next-auth.callback-url`,
      options: { sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production' },
    },
    csrfToken: {
      name: `${process.env.NODE_ENV === 'production' ? '__Host-' : ''}next-auth.csrf-token`,
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production' },
    },
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        const address = requestAddress(req.headers);
        if (!consumeRateLimit(`login:${address}`, 10, 15 * 60_000).allowed) return null;

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email.toLowerCase(),
          },
        });

        if (!user || user.accountStatus === 'SUSPENDED') {
          return null;
        }

        const isValidPassword = await bcrypt.compare(credentials.password, user.passwordHash);

        if (!isValidPassword) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          subscriptionType: user.subscriptionType,
          role: user.role,
          accountStatus: user.accountStatus,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.subscriptionType = user.subscriptionType as 'FREE' | 'PREMIUM';
        token.role = user.role as 'USER' | 'ADMIN';
        token.accountStatus = user.accountStatus as 'ACTIVE' | 'SUSPENDED';
      }

      const userId = typeof token.id === 'string' ? token.id : token.sub;
      if (userId) {
        const currentUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, role: true, accountStatus: true, subscriptionType: true },
        });
        if (!currentUser) {
          token.accountStatus = 'SUSPENDED';
        } else {
          token.name = currentUser.name;
          token.role = currentUser.role;
          token.accountStatus = currentUser.accountStatus;
          token.subscriptionType = currentUser.subscriptionType;
          const lastActivitySync = typeof token.lastActivitySync === 'number' ? token.lastActivitySync : 0;
          if (currentUser.accountStatus === 'ACTIVE' && Date.now() - lastActivitySync > 5 * 60 * 1000) {
            await prisma.user.updateMany({ where: { id: userId, accountStatus: 'ACTIVE' }, data: { lastActiveAt: new Date() } });
            token.lastActivitySync = Date.now();
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.subscriptionType = (token.subscriptionType as 'FREE' | 'PREMIUM') || 'FREE';
        session.user.role = (token.role as 'USER' | 'ADMIN') || 'USER';
        session.user.accountStatus = (token.accountStatus as 'ACTIVE' | 'SUSPENDED') || 'ACTIVE';
        if (session.user.accountStatus === 'SUSPENDED') session.user.id = '';
      }

      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
