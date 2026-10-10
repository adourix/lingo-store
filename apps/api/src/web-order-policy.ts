import { minorForQuantity, qty } from "./money.js";

export type WebOrderStatus =
  "PENDING" | "CONFIRMED" | "PROCESSING" | "READY" | "COMPLETED" | "CANCELLED";

const transitions: Readonly<Record<WebOrderStatus, readonly WebOrderStatus[]>> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["READY", "CANCELLED"],
  READY: ["CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionWebOrder(from: WebOrderStatus, to: WebOrderStatus): boolean {
  return transitions[from].includes(to);
}

export function canCollectCashForWebOrder(input: {
  status: WebOrderStatus;
  paymentStatus: "UNPAID" | "PAID";
  totalMinor: bigint;
  previouslyCollectedMinor: bigint;
  amountMinor: bigint;
}): boolean {
  return (
    input.status === "READY" &&
    input.paymentStatus === "UNPAID" &&
    input.amountMinor > 0n &&
    input.previouslyCollectedMinor === 0n &&
    input.amountMinor === input.totalMinor
  );
}
export type WebOrderLineInput = { productId: string; quantity: number };
export type WebOrderPrice = {
  productName: string;
  unitPriceMinor: bigint;
  unitCostMinor: bigint;
};

export function calculateWebOrderPricing(
  requested: WebOrderLineInput[],
  currentCatalog: ReadonlyMap<string, WebOrderPrice>,
): {
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPriceMinor: bigint;
    unitCostMinor: bigint;
    totalMinor: bigint;
  }>;
  subtotalMinor: bigint;
} {
  if (requested.length === 0) throw new Error("EMPTY_ORDER");
  let subtotalMinor = 0n;
  const items = requested.map((line) => {
    const current = currentCatalog.get(line.productId);
    if (!current || current.unitPriceMinor < 0n) throw new Error("PRODUCT_UNAVAILABLE");
    const totalMinor = minorForQuantity(current.unitPriceMinor, line.quantity);
    subtotalMinor += totalMinor;
    return {
      productId: line.productId,
      productName: current.productName,
      quantity: qty(line.quantity),
      unitPriceMinor: current.unitPriceMinor,
      unitCostMinor: current.unitCostMinor,
      totalMinor,
    };
  });
  if (subtotalMinor <= 0n) throw new Error("INVALID_ORDER_TOTAL");
  return { items, subtotalMinor };
}
