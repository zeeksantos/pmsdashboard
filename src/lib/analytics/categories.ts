export const EXPENSE_CATEGORIES = [
  "Rent / amortization",
  "Association dues",
  "Electricity",
  "Water",
  "Internet",
  "Cleaning",
  "Laundry",
  "Supplies & amenities",
  "Repairs & maintenance",
  "Furniture & equipment",
  "Taxes & permits",
  "Insurance",
  "Software & tools",
  "Marketing",
  "Other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** Categories that usually repeat every month (offered for fixed costs). */
export const RECURRING_CATEGORIES: ExpenseCategory[] = [
  "Rent / amortization",
  "Association dues",
  "Electricity",
  "Water",
  "Internet",
  "Cleaning",
  "Laundry",
  "Insurance",
  "Other",
];
