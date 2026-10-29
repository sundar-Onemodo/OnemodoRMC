export interface LineItemCalculationParams {
  quantity: number;
  rate: number;
  pump_rate: number;
  taxRate: number;
  isTaxInclusive: boolean;
  discount?: number;
  discountType?: string;
}

export interface LineItemCalculationResult {
  discountAmount: number;
  materialUntaxed: number;
  materialTax: number;
  materialTotal: number;
  pumpCharge: number;
  grossAmount: number;
  untaxedAmount: number;
  taxAmount: number;
  amountTotal: number;
}

export function calculateLineItemTotals(
  params: LineItemCalculationParams,
): LineItemCalculationResult {
  const qty = Number(params.quantity || 0);
  const rate = Number(params.rate || 0);
  const pumpRate = Number(params.pump_rate || 0);
  const taxRate = Number(params.taxRate || 0);
  const isTaxInclusive = Boolean(params.isTaxInclusive);

  const pumpCharge = pumpRate;
  const grossLine = qty * rate + pumpCharge;
  const discountValue = Math.max(0, Number(params.discount || 0));
  const discountAmount = Math.min(
    grossLine,
    Number(
      (params.discountType === "%"
        ? (grossLine * discountValue) / 100
        : discountValue
      ).toFixed(2),
    ),
  );

  let materialUntaxed = 0;
  let materialTax = 0;
  let materialTotal = 0;
  let untaxedAmount = 0;
  let taxAmount = 0;
  let amountTotal = 0;
  let grossAmount = 0;

  if (isTaxInclusive) {
    grossAmount = qty * rate + pumpCharge - discountAmount;
    untaxedAmount =
      taxRate > 0 ? (grossAmount * 100) / (100 + taxRate) : grossAmount;
    taxAmount = grossAmount - untaxedAmount;
    amountTotal = grossAmount;

    materialTotal = qty * rate;
    materialUntaxed =
      taxRate > 0 ? (materialTotal * 100) / (100 + taxRate) : materialTotal;
    materialTax = materialTotal - materialUntaxed;
  } else {
    materialUntaxed = qty * rate;
    materialTax = (materialUntaxed * taxRate) / 100;
    materialTotal = materialUntaxed + materialTax;
    untaxedAmount = materialUntaxed + pumpCharge - discountAmount;
    taxAmount = (untaxedAmount * taxRate) / 100;
    grossAmount = untaxedAmount;
    amountTotal = untaxedAmount + taxAmount;
  }

  return {
    discountAmount,
    materialUntaxed: Number(materialUntaxed.toFixed(2)),
    materialTax: Number(materialTax.toFixed(2)),
    materialTotal: Number(materialTotal.toFixed(2)),
    pumpCharge: Number(pumpCharge.toFixed(2)),
    grossAmount: Number(grossAmount.toFixed(2)),
    untaxedAmount: Number(untaxedAmount.toFixed(2)),
    taxAmount: Number(taxAmount.toFixed(2)),
    amountTotal: Number(amountTotal.toFixed(2)),
  };
}

export function useLineItemCalculation() {
  return {
    calculateLineItemTotals,
  };
}

export default function QuotationCalculationScreen() {
  return null;
}

