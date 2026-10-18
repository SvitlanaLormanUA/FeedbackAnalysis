import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Guards admin-only routes. Apply with @UseGuards(JwtAuthGuard). */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
