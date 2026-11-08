import { supabaseUrl } from "@/lib/env";
import type { Workspace } from "@/lib/database.types";

/** Public URL of a workspace logo in the an-branding bucket. */
export function logoUrl(path: string | null): string | null {
  if (!path || !supabaseUrl) return null;
  return `${supabaseUrl}/storage/v1/object/public/an-branding/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

export function brandName(ws: Pick<Workspace, "brand_name" | "name">): string {
  return ws.brand_name?.trim() || ws.name;
}

/** Product name shown before a customer has a workspace (sign-up, login). */
export const PRODUCT_NAME = process.env.NEXT_PUBLIC_ANALYTICS_PRODUCT_NAME || "Rental Portfolio Analytics";

/** How customers reach you to pay / renew. Shown in licence banners. */
export const SALES_CONTACT =
  process.env.NEXT_PUBLIC_ANALYTICS_SALES_CONTACT || "Message us to activate your licence.";
