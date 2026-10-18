import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { QrContext } from './qr.context';

interface QrPayload {
  venueId: string;
  qrCodeId: string;
  tableLabel?: string | null;
}

/**
 * QrService (C4 L4) — generates signed, personalised QR tokens and resolves a
 * scanned token back into a trusted QrContext. The token is self-contained and
 * HMAC-signed so no DB lookup is needed to validate it.
 *
 * Token format: base64url(payloadJson) + "." + base64url(hmac)
 */
@Injectable()
export class QrService {
  private readonly signingSecret: string;

  constructor(config: ConfigService) {
    this.signingSecret = config.get<string>('qrSigningSecret', 'change-me');
  }

  /** Builds a signed token for a venue (optionally pinned to a table). */
  generateToken(venueId: string, tableLabel?: string): string {
    const payload: QrPayload = {
      venueId,
      qrCodeId: `${venueId}:${tableLabel ?? 'default'}`,
      tableLabel: tableLabel ?? null,
    };
    const body = this.encode(JSON.stringify(payload));
    return `${body}.${this.sign(body)}`;
  }

  /** Full URL a QR image should encode, pointing at the guest web form. */
  generateVenueUrl(baseUrl: string, venueId: string, tableLabel?: string): string {
    const token = this.generateToken(venueId, tableLabel);
    return `${baseUrl.replace(/\/$/, '')}/feedback?token=${encodeURIComponent(token)}`;
  }

  /** Validates signature and returns the QrContext, or throws 401. */
  resolveToken(token: string): QrContext {
    const [body, signature] = token.split('.');
    if (!body || !signature || !this.verify(body, signature)) {
      throw new UnauthorizedException('Invalid QR token');
    }
    let payload: QrPayload;
    try {
      payload = JSON.parse(this.decode(body)) as QrPayload;
    } catch {
      throw new UnauthorizedException('Malformed QR token');
    }
    if (!payload.venueId || !payload.qrCodeId) {
      throw new UnauthorizedException('Incomplete QR token');
    }
    return new QrContext(payload.venueId, payload.qrCodeId, payload.tableLabel ?? null);
  }

  private sign(body: string): string {
    return createHmac('sha256', this.signingSecret).update(body).digest('base64url');
  }

  private verify(body: string, signature: string): boolean {
    const expected = this.sign(body);
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private encode(value: string): string {
    return Buffer.from(value, 'utf8').toString('base64url');
  }

  private decode(value: string): string {
    return Buffer.from(value, 'base64url').toString('utf8');
  }
}
