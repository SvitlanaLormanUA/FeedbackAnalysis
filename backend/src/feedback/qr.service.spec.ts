import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { QrService } from './qr.service';

describe('QrService', () => {
  const config = { get: () => 'test-secret' } as unknown as ConfigService;
  const service = new QrService(config);

  it('round-trips a signed token back into a QrContext', () => {
    const token = service.generateToken('venue-1', 'table-7');
    const ctx = service.resolveToken(token);
    expect(ctx.venueId).toBe('venue-1');
    expect(ctx.tableLabel).toBe('table-7');
    expect(ctx.qrCodeId).toContain('venue-1');
  });

  it('rejects a tampered token', () => {
    const token = service.generateToken('venue-1');
    const tampered = token.slice(0, -2) + 'xy';
    expect(() => service.resolveToken(tampered)).toThrow(UnauthorizedException);
  });

  it('rejects a malformed token', () => {
    expect(() => service.resolveToken('not-a-token')).toThrow(UnauthorizedException);
  });

  it('builds a guest URL containing the token', () => {
    const url = service.generateVenueUrl('https://app.example.com/', 'venue-1');
    expect(url.startsWith('https://app.example.com/feedback?token=')).toBe(true);
  });
});
