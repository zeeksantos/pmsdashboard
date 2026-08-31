import type { PaymentMethod } from "@/lib/database.types";

export const PAYMENT_METHODS: PaymentMethod[] = ["GCASH", "MAYA", "CASH", "BANK_TRANSFER", "CARD"];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  GCASH: "GCash",
  MAYA: "Maya",
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  CARD: "Card",
};
