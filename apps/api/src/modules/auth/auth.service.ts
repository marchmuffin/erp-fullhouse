import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { randomBytes, createHash } from 'crypto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: {
        tenant: { select: { id: true, name: true, schemaName: true, status: true } },
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account temporarily locked. Please try again later.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      // Increment failed login count
      const newCount = user.failedLoginCount + 1;
      const maxAttempts = 5;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: newCount,
          lockedUntil: newCount >= maxAttempts
            ? new Date(Date.now() + 30 * 60 * 1000)  // Lock for 30 min
            : undefined,
        },
      });

      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed login count on success
    if (user.failedLoginCount > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
    }

    return user;
  }

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    // Check if 2FA is required
    if (user.twoFaEnabled) {
      if (!loginDto.totpCode) {
        return { requiresTwoFa: true, userId: user.id };
      }

      const isValidTotp = authenticator.verify({
        token: loginDto.totpCode,
        secret: user.twoFaSecret!,
      });

      if (!isValidTotp) {
        throw new UnauthorizedException('Invalid 2FA code');
      }
    }

    // Check user status
    if (user.status !== 'active') {
      throw new UnauthorizedException(`Account is ${user.status}`);
    }

    // Check tenant status
    if (user.tenant && ['suspended', 'cancelled'].includes(user.tenant.status)) {
      throw new UnauthorizedException(`Tenant account is ${user.tenant.status}`);
    }

    // Build permissions list
    const permissions: string[] = user.userRoles.flatMap((ur) =>
      ur.role.rolePermissions.map((rp) => rp.permission.code),
    );
    const uniquePermissions = [...new Set(permissions)];

    // Generate tokens
    const tokens = await this.generateTokens(user.id, uniquePermissions, user.isSuperAdmin);

    // Store refresh token
    await this.storeRefreshToken(user.id, tokens.refreshToken, ipAddress, userAgent);

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ipAddress || null },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        action: 'LOGIN',
        module: 'auth',
        resource: 'session',
        ipAddress,
        userAgent,
      },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: 900, // 15 minutes in seconds
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isSuperAdmin: user.isSuperAdmin,
        tenantId: user.tenantId,
        tenantName: user.tenant?.name,
        locale: user.locale,
        timezone: user.timezone,
        permissions: uniquePermissions,
        twoFaEnabled: user.twoFaEnabled,
      },
    };
  }

  async refreshToken(dto: RefreshTokenDto) {
    const tokenHash = createHash('sha256').update(dto.refreshToken).digest('hex');

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Revoke old token (rotation)
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Get fresh user data with permissions
    const user = await this.prisma.user.findUnique({
      where: { id: storedToken.userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: { rolePermissions: { include: { permission: true } } },
            },
          },
        },
      },
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('User account is not active');
    }

    const permissions: string[] = user.userRoles.flatMap((ur) =>
      ur.role.rolePermissions.map((rp) => rp.permission.code),
    );
    const uniquePermissions = [...new Set(permissions)];

    const tokens = await this.generateTokens(user.id, uniquePermissions, user.isSuperAdmin);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
      await this.prisma.refreshToken.updateMany({
        where: { userId, tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'LOGOUT',
        module: 'auth',
        resource: 'session',
      },
    });
  }

  private async generateTokens(userId: string, permissions: string[], isSuperAdmin: boolean) {
    const payload = { sub: userId, permissions, isSuperAdmin };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRES_IN', '15m'),
      }),
      this.generateRefreshTokenString(),
    ]);

    return { accessToken, refreshToken };
  }

  private generateRefreshTokenString(): string {
    return randomBytes(64).toString('hex');
  }

  private async storeRefreshToken(
    userId: string,
    token: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });
  }

  async setup2FA(userId: string): Promise<{ secret: string; qrCodeUri: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const secret = authenticator.generateSecret();
    const qrCodeUri = authenticator.keyuri(user.email, 'ERP全家桶', secret);
    // Store secret temporarily (not enabled yet)
    await this.prisma.user.update({ where: { id: userId }, data: { twoFaSecret: secret } });
    return { secret, qrCodeUri };
  }

  async enable2FA(userId: string, totpCode: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFaSecret) throw new BadRequestException('2FA setup not initiated');
    const isValid = authenticator.verify({ token: totpCode, secret: user.twoFaSecret });
    if (!isValid) throw new UnauthorizedException('Invalid TOTP code');
    await this.prisma.user.update({ where: { id: userId }, data: { twoFaEnabled: true } });
  }

  async disable2FA(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) throw new UnauthorizedException('Invalid password');
    await this.prisma.user.update({ where: { id: userId }, data: { twoFaEnabled: false, twoFaSecret: null } });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, displayName: true, avatarUrl: true,
        locale: true, timezone: true, twoFaEnabled: true, isSuperAdmin: true,
        lastLoginAt: true, createdAt: true,
        tenant: { select: { id: true, name: true, plan: true, status: true, trialEndsAt: true, subscriptionEndsAt: true } },
        userRoles: { include: { role: { select: { id: true, name: true } } } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
