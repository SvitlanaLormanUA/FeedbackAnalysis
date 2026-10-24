import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Integration test for admin login. Boots the real AuthController →
 * AuthService → JwtModule wiring with DTO validation; only the admin table
 * (Prisma) is faked. Passwords use a real bcrypt hash.
 */
describe('Auth login (integration)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  const prisma = { admin: { findUnique: jest.fn() } };

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('admin12345', 10);
    prisma.admin.findUnique.mockImplementation(({ where }: { where: { email: string } }) =>
      where.email === 'admin@example.com'
        ? Promise.resolve({
            id: 'admin-1',
            email: 'admin@example.com',
            passwordHash,
            venueId: 'venue-1',
          })
        : Promise.resolve(null),
    );

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-jwt-secret', signOptions: { expiresIn: '1d' } })],
      controllers: [AuthController],
      providers: [AuthService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    jwt = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns a usable JWT for valid credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'admin12345' })
      .expect(200);

    expect(typeof res.body.accessToken).toBe('string');
    const payload = jwt.verify(res.body.accessToken);
    expect(payload.sub).toBe('admin-1');
    expect(payload.venueId).toBe('venue-1');
  });

  it('rejects a wrong password with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'wrong' })
      .expect(401);
  });

  it('rejects an unknown email with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'admin12345' })
      .expect(401);
  });

  it('rejects a malformed email with 400 (DTO validation)', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'admin12345' })
      .expect(400);
  });

  it('rejects a missing password with 400', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@example.com' })
      .expect(400);
  });
});
