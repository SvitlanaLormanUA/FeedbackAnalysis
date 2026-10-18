/**
 * FeedbackAcceptedDto (C4 L4) — response returned to the guest after a review
 * is accepted and queued for analysis.
 */
export class FeedbackAcceptedDto {
  id!: string;
  createdAt!: Date;

  constructor(id: string, createdAt: Date) {
    this.id = id;
    this.createdAt = createdAt;
  }
}
