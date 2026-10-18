import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';
import { QrService } from '../feedback/qr.service';
import { AdminService } from './admin.service';
import { StatisticsService } from './statistics.service';

/**
 * AdminController (C4 L4) — dashboard endpoints. All routes require a valid
 * admin JWT. The venue is taken from the token so an admin only sees their own.
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly statistics: StatisticsService,
    private readonly qrService: QrService,
    private readonly config: ConfigService,
  ) {}

  @Get('reviews')
  listReviews(
    @CurrentUser() user: JwtPayload,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    return this.adminService.listReviews(this.venueOf(user), page, Math.min(pageSize, 100));
  }

  @Get('stats')
  stats(@CurrentUser() user: JwtPayload) {
    return this.statistics.forVenue(this.venueOf(user));
  }

  /** Mints a signed QR token + the guest form URL (optionally per table). */
  @Get('qr')
  qr(@CurrentUser() user: JwtPayload, @Query('table') table?: string) {
    const venueId = this.venueOf(user);
    const webBase = this.config.get<string[]>('corsOrigins', ['http://localhost:5173'])[0];
    return {
      token: this.qrService.generateToken(venueId, table),
      url: this.qrService.generateVenueUrl(webBase, venueId, table),
    };
  }

  private venueOf(user: JwtPayload): string {
    if (!user.venueId) {
      throw new BadRequestException('Admin is not assigned to a venue');
    }
    return user.venueId;
  }
}
