export const FULL_NAME_REGEX = /^[a-zA-Z\s]+$/;
export const PHONE_REGEX = /^(?:\+91[\s-]?)?[6-9]\d{9}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidFullName = (value: string) => {
  const name = value.trim();
  return name.length >= 3 && name.length <= 100 && FULL_NAME_REGEX.test(name);
};

export const isValidPhone = (value: string) => PHONE_REGEX.test(value.trim());

export const isValidEmail = (value: string) => EMAIL_REGEX.test(value.trim());

export const normalizePhone = (value: string) => value.trim().replace(/[\s-]/g, "");
