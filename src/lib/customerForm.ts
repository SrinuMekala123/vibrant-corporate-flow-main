import { isValidCustomerDisplayName, isValidEmail, isValidPhone, normalizePhone } from "@/lib/validation";

export type CustomerFormMode = "add" | "edit";
export type CustomerEntityType = "Individual" | "Company";

export interface CustomerFormInput {
  fullName: string;
  phone: string;
  email: string;
  address?: string;
  customerType?: string;
  entityType?: CustomerEntityType;
  /** @deprecated Prefer branchIds — kept for backward-compatible callers */
  branchId?: string;
  branchIds?: string[];
  createLoginAccount?: boolean;
  profileUserId?: string;
  loginPassword?: string;
  mode?: CustomerFormMode;
}

export interface CreateCustomerUserPayload {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  role: "customer";
  createCustomerRecord: boolean;
  customerData: {
    address: string | null;
    customer_type: string;
    entity_type: CustomerEntityType;
    branch_id: string | null;
    branch_ids: string[];
  } | Record<string, never>;
}

export type CustomerFormValidationResult =
  | {
      ok: true;
      trimmedName: string;
      cleanPhone: string;
      trimmedEmail: string;
    }
  | { ok: false; error: string };

/** Normalize multi-branch selection; falls back to single branchId if needed. */
export function normalizeBranchIds(input: {
  branchIds?: string[];
  branchId?: string;
}): string[] {
  const fromArray = (input.branchIds || []).filter(Boolean);
  if (fromArray.length > 0) {
    return [...new Set(fromArray)];
  }
  if (input.branchId) return [input.branchId];
  return [];
}

/** Primary branch kept on customers.branch_id for legacy joins. */
export function resolvePrimaryBranchId(branchIds: string[]): string | null {
  return branchIds[0] || null;
}

/** Build junction rows for customer_branches. */
export function buildCustomerBranchRows(customerId: string, branchIds: string[]) {
  return branchIds.map((branch_id) => ({
    customer_id: customerId,
    branch_id,
  }));
}

/** Validate identity + optional login-account fields used by Add/Edit Customer. */
export function validateCustomerFormFields(input: CustomerFormInput): CustomerFormValidationResult {
  const entityType: CustomerEntityType = input.entityType === "Company" ? "Company" : "Individual";
  const trimmedName = input.fullName.trim();
  if (!isValidCustomerDisplayName(trimmedName, entityType)) {
    return {
      ok: false,
      error:
        entityType === "Company"
          ? "Company name must be 3-100 characters (letters, numbers, and common punctuation)."
          : "Name must be 3-100 characters and contain only letters and spaces.",
    };
  }

  const cleanPhone = normalizePhone(input.phone);
  if (!isValidPhone(input.phone)) {
    return {
      ok: false,
      error: "Please enter a valid 10-digit Indian mobile number (e.g., +91 9876543210)",
    };
  }

  const trimmedEmail = input.email.trim().toLowerCase();
  if (trimmedEmail && !isValidEmail(trimmedEmail)) {
    return { ok: false, error: "Please enter a valid email address" };
  }

  const creatingLogin = Boolean(input.createLoginAccount) && !input.profileUserId;
  if (creatingLogin) {
    if (!trimmedEmail) {
      return { ok: false, error: "Email is required to create a login account." };
    }
    if (!input.loginPassword || input.loginPassword.length < 8) {
      return { ok: false, error: "Password must be at least 8 characters." };
    }
  }

  return { ok: true, trimmedName, cleanPhone, trimmedEmail };
}

/** Build the Edge Function body for create-customer-user (matches Customers.tsx Path A). */
export function buildCreateCustomerUserPayload(input: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  address?: string;
  customerType?: string;
  entityType?: CustomerEntityType;
  branchId?: string;
  branchIds?: string[];
  mode?: CustomerFormMode;
}): CreateCustomerUserPayload {
  const mode = input.mode ?? "add";
  const branchIds = normalizeBranchIds({
    branchIds: input.branchIds,
    branchId: input.branchId,
  });
  const primaryBranchId = resolvePrimaryBranchId(branchIds);
  const entityType: CustomerEntityType =
    input.entityType === "Company" ? "Company" : "Individual";

  return {
    email: input.email.trim().toLowerCase(),
    password: input.password,
    full_name: input.fullName.trim(),
    phone: normalizePhone(input.phone),
    role: "customer",
    createCustomerRecord: mode === "add",
    customerData:
      mode === "add"
        ? {
            address: input.address?.trim() || null,
            customer_type: input.customerType || "Retail",
            entity_type: entityType,
            branch_id: primaryBranchId,
            branch_ids: branchIds,
          }
        : {},
  };
}

/** Map Edge Function / client error text to a stable user-facing message. */
export function mapCreateCustomerUserError(errorMessage: string): string {
  const message = (errorMessage || "").trim();
  if (/already exists|email.*(duplicate|exists)|user.*already/i.test(message)) {
    return "An account with this email already exists.";
  }
  return message || "Failed to create login account.";
}

export type InvokeCreateCustomerUserFn = (
  functionName: string,
  options: { body: CreateCustomerUserPayload }
) => Promise<{ data: any; error: any }>;

/**
 * Invoke create-customer-user and normalize success / duplicate errors.
 * Used by Customers page and unit tests with a mocked invoke.
 */
export async function createCustomerUserAccount(
  invoke: InvokeCreateCustomerUserFn,
  payload: CreateCustomerUserPayload
): Promise<{ userId: string; data: any }> {
  const { data, error: fnError } = await invoke("create-customer-user", { body: payload });

  if (fnError) {
    let errorMessage = fnError.message || "";
    const errorResponse = fnError.context;
    if (errorResponse instanceof Response) {
      try {
        const errorBody = await errorResponse.clone().json();
        errorMessage = errorBody?.error || errorMessage;
      } catch {
        // Keep the client error message when the Edge Function body is unavailable.
      }
    }
    throw new Error(mapCreateCustomerUserError(errorMessage));
  }

  if (data?.error) {
    throw new Error(mapCreateCustomerUserError(String(data.error)));
  }

  const userId = data?.user?.id || data?.userId;
  if (!userId) {
    throw new Error("Did not receive user ID from server.");
  }

  return { userId, data };
}

type SupabaseLike = {
  from: (table: string) => {
    delete: () => {
      eq: (col: string, val: string) => Promise<{ error: any }>;
    };
    insert: (rows: { customer_id: string; branch_id: string }[]) => Promise<{ error: any }>;
  };
};

/** Replace all branch links for a customer (client-side after create/update). */
export async function syncCustomerBranches(
  client: SupabaseLike,
  customerId: string,
  branchIds: string[]
): Promise<void> {
  const uniqueIds = [...new Set(branchIds.filter(Boolean))];
  const { error: deleteError } = await client
    .from("customer_branches")
    .delete()
    .eq("customer_id", customerId);
  if (deleteError) throw new Error(deleteError.message || "Failed to clear customer branches");

  if (uniqueIds.length === 0) return;

  const { error: insertError } = await client
    .from("customer_branches")
    .insert(buildCustomerBranchRows(customerId, uniqueIds));
  if (insertError) throw new Error(insertError.message || "Failed to save customer branches");
}

/** Collect display names from joined customer_branches + legacy branches. */
export function getCustomerBranchNames(customer: {
  branches?: { branch_name?: string } | null;
  customer_branches?: Array<{ branches?: { branch_name?: string } | null }> | null;
}): string[] {
  const fromJunction = (customer.customer_branches || [])
    .map((row) => row.branches?.branch_name)
    .filter((name): name is string => Boolean(name));
  if (fromJunction.length > 0) return fromJunction;
  if (customer.branches?.branch_name) return [customer.branches.branch_name];
  return [];
}
