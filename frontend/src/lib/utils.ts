import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Default Indian country code for phone inputs */
export const IN_PHONE_PREFIX = "+91 ";

/**
 * Keeps +91 fixed and formats up to 10 national digits (optional 5+5 spacing).
 */
export function formatIndiaMobileInput(raw: string): string {
  if (raw === "") return IN_PHONE_PREFIX;

  if (!raw.startsWith("+91")) {
    let digits = raw.replace(/\D/g, "");
    if (digits.startsWith("91")) digits = digits.slice(2);
    digits = digits.slice(0, 10);
    if (digits.length === 0) return IN_PHONE_PREFIX;
    if (digits.length <= 5) return IN_PHONE_PREFIX + digits;
    return `${IN_PHONE_PREFIX}${digits.slice(0, 5)} ${digits.slice(5)}`;
  }

  const rest = raw.slice(3).replace(/\s/g, "").replace(/\D/g, "").slice(0, 10);
  if (rest.length === 0) return IN_PHONE_PREFIX;
  if (rest.length <= 5) return IN_PHONE_PREFIX + rest;
  return `${IN_PHONE_PREFIX}${rest.slice(0, 5)} ${rest.slice(5)}`;
}

/** True when value has +91 and 10 digits after it. */
export function isValidIndiaMobileDisplay(phone: string): boolean {
  const d = phone.replace(/\D/g, "");
  return d.length === 12 && d.startsWith("91");
}

/** Prefill for profile edit: empty → +91; 10-digit local → formatted; existing +91 → reformatted. */
export function normalizeProfilePhoneForEdit(stored: string | null | undefined): string {
  const p = String(stored ?? "").trim();
  if (!p) return IN_PHONE_PREFIX;
  if (p.startsWith("+91")) return formatIndiaMobileInput(p);
  const digits = p.replace(/\D/g, "");
  if (digits.length === 10) return formatIndiaMobileInput("91" + digits);
  return p;
}
