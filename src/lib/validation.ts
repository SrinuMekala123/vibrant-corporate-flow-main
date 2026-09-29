export const FULL_NAME_REGEX = /^[a-zA-Z\s]+$/;
export const COMPANY_NAME_REGEX = /^[a-zA-Z0-9\s&.,'\-\/()]+$/;
export const PHONE_REGEX = /^(?:\+91[\s-]?)?[6-9]\d{9}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (value: string) => {
  if (!value || typeof value !== "string") return false;
  return EMAIL_REGEX.test(value.trim());
};

export const isValidFullName = (value: string) => {
  const name = value.trim();
  return name.length >= 3 && name.length <= 100 && FULL_NAME_REGEX.test(name);
};

/** Individual: letters/spaces. Company: allows digits and common business punctuation. */
export const isValidCustomerDisplayName = (
  value: string,
  entityType: "Individual" | "Company" = "Individual"
) => {
  const name = value.trim();
  if (name.length < 3 || name.length > 100) return false;
  if (entityType === "Company") return COMPANY_NAME_REGEX.test(name);
  return FULL_NAME_REGEX.test(name);
};

export const isValidPhone = (value: string) => {
  if (!value || typeof value !== "string") return false;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return /^[6-9]\d{9}$/.test(digits);
  if (digits.length === 12 && digits.startsWith("91")) return /^[6-9]\d{9}$/.test(digits.slice(2));
  if (digits.length === 11 && digits.startsWith("0")) return /^[6-9]\d{9}$/.test(digits.slice(1));
  return false;
};

export const normalizePhone = (value: string) => {
  if (!value || typeof value !== "string") return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
};
