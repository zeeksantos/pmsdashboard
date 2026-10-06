import Image from "next/image";
import { cn } from "@/lib/cn";

// The Z-Fast flame on a white tile, so it stays readable on the dark brand-red sidebar.
export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-xl bg-white", className)}
      style={{ width: size, height: size }}>
      <Image src="/logo.png" alt="Z-Fast" width={size} height={size} className="p-1" priority />
    </span>
  );
}
