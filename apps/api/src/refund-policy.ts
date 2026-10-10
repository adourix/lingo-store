export const canRestoreSaleStock = (
  saleTotalMinor: bigint,
  alreadyRefundedMinor: bigint,
  requestedRefundMinor: bigint,
): boolean => alreadyRefundedMinor === 0n && requestedRefundMinor === saleTotalMinor;
