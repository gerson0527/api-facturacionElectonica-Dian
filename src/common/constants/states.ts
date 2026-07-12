export enum InvoiceStatus {
  DRAFT = 'draft',
  QUEUED = 'queued',
  SIGNING = 'signing',
  SIGNED = 'signed',
  SUBMITTED = 'submitted',
  PENDING_DIAN = 'pending_dian',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  TRANSMISSION_FAILED = 'transmission_failed',
}

export enum DianSubmissionStatus {
  CREATED = 'created',
  SENDING = 'sending',
  SENT = 'sent',
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  FAILED = 'failed',
}

export const ALLOWED_INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  [InvoiceStatus.DRAFT]: [InvoiceStatus.QUEUED],
  [InvoiceStatus.QUEUED]: [InvoiceStatus.SIGNING, InvoiceStatus.TRANSMISSION_FAILED],
  [InvoiceStatus.SIGNING]: [InvoiceStatus.SIGNED, InvoiceStatus.TRANSMISSION_FAILED],
  [InvoiceStatus.SIGNED]: [InvoiceStatus.SUBMITTED, InvoiceStatus.TRANSMISSION_FAILED],
  [InvoiceStatus.SUBMITTED]: [InvoiceStatus.PENDING_DIAN, InvoiceStatus.TRANSMISSION_FAILED],
  [InvoiceStatus.PENDING_DIAN]: [InvoiceStatus.ACCEPTED, InvoiceStatus.REJECTED, InvoiceStatus.TRANSMISSION_FAILED],
  [InvoiceStatus.ACCEPTED]: [],
  [InvoiceStatus.REJECTED]: [InvoiceStatus.QUEUED],
  [InvoiceStatus.TRANSMISSION_FAILED]: [InvoiceStatus.QUEUED],
};

export const ALLOWED_SUBMISSION_TRANSITIONS: Record<DianSubmissionStatus, DianSubmissionStatus[]> = {
  [DianSubmissionStatus.CREATED]: [DianSubmissionStatus.SENDING],
  [DianSubmissionStatus.SENDING]: [DianSubmissionStatus.SENT, DianSubmissionStatus.FAILED],
  [DianSubmissionStatus.SENT]: [DianSubmissionStatus.PENDING, DianSubmissionStatus.FAILED],
  [DianSubmissionStatus.PENDING]: [DianSubmissionStatus.ACCEPTED, DianSubmissionStatus.REJECTED, DianSubmissionStatus.FAILED],
  [DianSubmissionStatus.ACCEPTED]: [],
  [DianSubmissionStatus.REJECTED]: [],
  [DianSubmissionStatus.FAILED]: [DianSubmissionStatus.SENDING],
};

export function validateTransition<T extends string>(
  current: T,
  next: T,
  allowedMap: Record<T, T[]>,
): void {
  const allowed = allowedMap[current];
  if (!allowed || !allowed.includes(next)) {
    throw new Error(`Transición inválida: ${current} -> ${next}`);
  }
}
