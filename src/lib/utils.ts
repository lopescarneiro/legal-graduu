import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge de classes Tailwind (clsx + tailwind-merge). Mesma convenção da suíte. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
