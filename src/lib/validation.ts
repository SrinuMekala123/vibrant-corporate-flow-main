export const FULL_NAME_REGEX = /^[a-zA-Z\s]+$/;
export const COMPANY_NAME_REGEX = /^[a-zA-Z0-9\s&.,'\-\/()]+$/;
export const PHONE_REGEX = /^(?:\+91[\s-]?)?[6-9]\d{9}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export const isValidPhone = (value: string) => PHONE_REGEX.test(value.trim());

export const isValidEmail = (value: string) => EMAIL_REGEX.test(value.trim());

export const normalizePhone = (value: string) => value.trim().replace(/[\s-]/g, "");
