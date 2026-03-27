import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';

jest.mock('bcrypt');

const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
};

const mockJwtService = {
  signAsync: jest.fn(),
  verify: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string, fallback?: string) => {
    if (key === 'JWT_SECRET') return 'test-secret';
    if (key === 'JWT_EXPIRES_IN') return fallback ?? '15m';
    return fallback;
  }),
};

// Minimal user fixture matching the validateUser shape
function makeUser(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'user-1',
    email: 'test@example.com',
    displayName: 'Test User',
    avatarUrl: null,
    passwordHash: '$2b$10$hashedpassword',
    isSuperAdmin: false,
    tenantId: 'tenant-1',
    status: 'active',
    locale: 'zh-TW',
    timezone: 'Asia/Taipei',
    twoFaEnabled: false,
    twoFaSecret: null,
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    lastLoginIp: null,
    tenant: {
      id: 'tenant-1',
      name: 'Test Tenant',
      schemaName: 'tenant_test',
      status: 'active',
    },
    userRoles: [
      {
        role: {
          rolePermissions: [
            { permission: { code: 'sales:read' } },
            { permission: { code: 'sales:write' } },
          ],
        },
      },
    ],
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('login()', () => {
    const loginDto = { email: 'test@example.com', password: 'correct-password' };

    it('should return tokens and user info when credentials are valid', async () => {
      const user = makeUser();
      mockPrisma.user.findFirst.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.signAsync.mockResolvedValue('access-token-abc');
      mockPrisma.refreshToken.create.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.login(loginDto);

      expect(result).toMatchObject({
        accessToken: 'access-token-abc',
        expiresIn: 900,
        user: {
          id: 'user-1',
          email: 'test@example.com',
          permissions: expect.arrayContaining(['sales:read', 'sales:write']),
        },
      });
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      const user = makeUser();
      mockPrisma.user.findFirst.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      mockPrisma.user.update.mockResolvedValue({});

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when account is locked (failedLoginCount >= 5)', async () => {
      const futureDate = new Date(Date.now() + 30 * 60 * 1000);
      const user = makeUser({ failedLoginCount: 5, lockedUntil: futureDate });
      mockPrisma.user.findFirst.mockResolvedValue(user);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      // Password comparison should never be reached
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should increment failedLoginCount when password is wrong and lock after 5 failures', async () => {
      const user = makeUser({ failedLoginCount: 4 });
      mockPrisma.user.findFirst.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      mockPrisma.user.update.mockResolvedValue({});

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ failedLoginCount: 5 }),
        }),
      );
    });
  });

  describe('refreshToken()', () => {
    it('should return new tokens for a valid refresh token', async () => {
      const futureDate = new Date(Date.now() + 60_000);
      const storedToken = {
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: futureDate,
        user: makeUser(),
      };
      const freshUser = makeUser();

      mockPrisma.refreshToken.findUnique.mockResolvedValue(storedToken);
      mockPrisma.refreshToken.update.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue(freshUser);
      mockJwtService.signAsync.mockResolvedValue('new-access-token');
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refreshToken({ refreshToken: 'some-refresh-token' });

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBeDefined();
      // Old token should be revoked
      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rt-1' },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
    });

    it('should throw UnauthorizedException when refresh token is not found', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(
        service.refreshToken({ refreshToken: 'nonexistent-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when refresh token has been revoked', async () => {
      const storedToken = {
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        user: makeUser(),
      };
      mockPrisma.refreshToken.findUnique.mockResolvedValue(storedToken);

      await expect(
        service.refreshToken({ refreshToken: 'revoked-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when refresh token has expired', async () => {
      const storedToken = {
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000), // already expired
        user: makeUser(),
      };
      mockPrisma.refreshToken.findUnique.mockResolvedValue(storedToken);

      await expect(
        service.refreshToken({ refreshToken: 'expired-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
