import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  const jwt = new JwtService({ secret: 'test-secret' });

  function build(admin: unknown) {
    const prisma = {
      admin: { findUnique: jest.fn().mockResolvedValue(admin) },
    } as unknown as PrismaService;
    return new AuthService(prisma, jwt);
  }

  it('issues a JWT for valid credentials', async () => {
    const passwordHash = await bcrypt.hash('secret123', 10);
    const service = build({
      id: 'admin-1',
      email: 'admin@example.com',
      passwordHash,
      venueId: 'venue-1',
    });

    const { accessToken } = await service.login({
      email: 'admin@example.com',
      password: 'secret123',
    });

    const payload = jwt.verify(accessToken);
    expect(payload.sub).toBe('admin-1');
    expect(payload.email).toBe('admin@example.com');
    expect(payload.venueId).toBe('venue-1');
  });

  it('rejects a wrong password', async () => {
    const passwordHash = await bcrypt.hash('secret123', 10);
    const service = build({ id: 'admin-1', email: 'a@b.c', passwordHash, venueId: null });

    await expect(service.login({ email: 'a@b.c', password: 'nope' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an unknown email without leaking which field was wrong', async () => {
    const service = build(null);

    await expect(
      service.login({ email: 'ghost@example.com', password: 'whatever' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
