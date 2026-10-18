/**
 * QrContext — value object describing which venue/table a scanned QR maps to
 * (C4 L4: «value object» QrContext created by QrService).
 */
export class QrContext {
  constructor(
    public readonly venueId: string,
    public readonly qrCodeId: string,
    public readonly tableLabel: string | null,
  ) {}
}
