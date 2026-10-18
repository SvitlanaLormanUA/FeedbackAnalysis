import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * CreateFeedbackDto (C4 L4) — body of POST /feedback. Validation rules match
 * the diagram: signed QR token, rating 1..5, optional comment up to 1000 chars.
 */
export class CreateFeedbackDto {
  @IsString()
  @IsNotEmpty()
  qrToken!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
