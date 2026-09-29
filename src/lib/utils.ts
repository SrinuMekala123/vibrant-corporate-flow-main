import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFullCustomerAddress(loc: {
  location_name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
} | null | undefined): string {
  if (!loc) return "";
  const name = (loc.location_name || "").trim();
  const address = (loc.address || "").trim();
  const city = (loc.city || "").trim();
  const state = (loc.state || "").trim();
  const pincode = (loc.pincode || "").trim();

  const isGeneric = ["primary address", "primary", "address 1", "address 2", "address 3", "default address"].includes(name.toLowerCase());

  const parts: string[] = [];
  if (name && !isGeneric) {
    parts.push(name);
  }
  if (address) {
    if (!name || isGeneric || !address.toLowerCase().includes(name.toLowerCase())) {
      parts.push(address);
    } else {
      parts.push(address);
      if (parts[0] === name) {
        parts.shift();
      }
    }
  }
  if (city && !address.toLowerCase().includes(city.toLowerCase())) {
    parts.push(city);
  }
  if (state && !address.toLowerCase().includes(state.toLowerCase())) {
    parts.push(state);
  }
  if (pincode && !address.includes(pincode)) {
    parts.push(pincode);
  }

  const result = parts.filter(Boolean).join(", ");
  return result || name || address || "";
}

