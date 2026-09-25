import { describe, it, expect } from "vitest";
import {
  validateCustomerFormFields,
  buildCreateCustomerUserPayload,
  mapCreateCustomerUserError,
  normalizeBranchIds,
  resolvePrimaryBranchId,
  buildCustomerBranchRows,
  getCustomerBranchNames,
} from "@/lib/customerForm";

const SUNEEL_EMAIL = "suneel@gmail.com";
const HYDERABAD_BRANCH_ID = "branch-hyd-uuid";
const SECUNDERABAD_BRANCH_ID = "branch-sec-uuid";

describe("validateCustomerFormFields", () => {
  it("accepts a valid customer with login account for suneel@gmail.com", () => {
    const result = validateCustomerFormFields({
      fullName: "Suneel Kumar",
      phone: "9876543210",
      email: SUNEEL_EMAIL,
      createLoginAccount: true,
      loginPassword: "Welcome@123!",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.trimmedEmail).toBe(SUNEEL_EMAIL);
      expect(result.trimmedName).toBe("Suneel Kumar");
      expect(result.cleanPhone).toBe("9876543210");
    }
  });

  it("rejects invalid email", () => {
    const result = validateCustomerFormFields({
      fullName: "Suneel Kumar",
      phone: "9876543210",
      email: "not-an-email",
      createLoginAccount: false,
    });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/valid email/i) });
  });

  it("rejects short password when creating login account", () => {
    const result = validateCustomerFormFields({
      fullName: "Suneel Kumar",
      phone: "9876543210",
      email: SUNEEL_EMAIL,
      createLoginAccount: true,
      loginPassword: "short",
    });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/8 characters/i) });
  });

  it("accepts company names with digits and punctuation", () => {
    const result = validateCustomerFormFields({
      fullName: "3M India Pvt. Ltd",
      phone: "9876543210",
      email: "",
      entityType: "Company",
      createLoginAccount: false,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects individual names with digits", () => {
    const result = validateCustomerFormFields({
      fullName: "John 3rd",
      phone: "9876543210",
      email: "",
      entityType: "Individual",
      createLoginAccount: false,
    });
    expect(result.ok).toBe(false);
  });
});

describe("multi-branch helpers", () => {
  it("normalizes multiple branch ids and dedupes", () => {
    expect(
      normalizeBranchIds({
        branchIds: [HYDERABAD_BRANCH_ID, SECUNDERABAD_BRANCH_ID, HYDERABAD_BRANCH_ID],
      })
    ).toEqual([HYDERABAD_BRANCH_ID, SECUNDERABAD_BRANCH_ID]);
  });

  it("falls back to single branchId", () => {
    expect(normalizeBranchIds({ branchId: HYDERABAD_BRANCH_ID })).toEqual([HYDERABAD_BRANCH_ID]);
  });

  it("uses first selected branch as primary", () => {
    expect(resolvePrimaryBranchId([HYDERABAD_BRANCH_ID, SECUNDERABAD_BRANCH_ID])).toBe(
      HYDERABAD_BRANCH_ID
    );
    expect(resolvePrimaryBranchId([])).toBeNull();
  });

  it("builds junction rows for Hyderabad + Secunderabad", () => {
    expect(
      buildCustomerBranchRows("cust-1", [HYDERABAD_BRANCH_ID, SECUNDERABAD_BRANCH_ID])
    ).toEqual([
      { customer_id: "cust-1", branch_id: HYDERABAD_BRANCH_ID },
      { customer_id: "cust-1", branch_id: SECUNDERABAD_BRANCH_ID },
    ]);
  });

  it("reads display names from customer_branches join", () => {
    expect(
      getCustomerBranchNames({
        branches: { branch_name: "Legacy Only" },
        customer_branches: [
          { branches: { branch_name: "Hyderabad (Headquarters)" } },
          { branches: { branch_name: "Secunderabad" } },
        ],
      })
    ).toEqual(["Hyderabad (Headquarters)", "Secunderabad"]);
  });
});

describe("buildCreateCustomerUserPayload", () => {
  it("builds payload for suneel@gmail.com with multiple branch_ids", () => {
    const payload = buildCreateCustomerUserPayload({
      email: "Suneel@Gmail.com",
      password: "Welcome@123!",
      fullName: "Suneel Kumar",
      phone: "9876543210",
      address: "Banjara Hills",
      customerType: "Retail",
      branchIds: [HYDERABAD_BRANCH_ID, SECUNDERABAD_BRANCH_ID],
      mode: "add",
    });

    expect(payload).toEqual({
      email: SUNEEL_EMAIL,
      password: "Welcome@123!",
      full_name: "Suneel Kumar",
      phone: "9876543210",
      role: "customer",
      createCustomerRecord: true,
      customerData: {
        address: "Banjara Hills",
        customer_type: "Retail",
        entity_type: "Individual",
        branch_id: HYDERABAD_BRANCH_ID,
        branch_ids: [HYDERABAD_BRANCH_ID, SECUNDERABAD_BRANCH_ID],
      },
    });
  });

  it("includes entity_type Company when provided", () => {
    const payload = buildCreateCustomerUserPayload({
      email: SUNEEL_EMAIL,
      password: "Welcome@123!",
      fullName: "Acme Corp",
      phone: "9876543210",
      customerType: "Corporate",
      entityType: "Company",
      branchIds: [HYDERABAD_BRANCH_ID],
      mode: "add",
    });
    expect(payload.customerData).toMatchObject({
      entity_type: "Company",
      customer_type: "Corporate",
    });
  });

  it("includes Secunderabad when selected alone", () => {
    const payload = buildCreateCustomerUserPayload({
      email: SUNEEL_EMAIL,
      password: "Welcome@123!",
      fullName: "Suneel Kumar",
      phone: "9876543210",
      branchIds: [SECUNDERABAD_BRANCH_ID],
      mode: "add",
    });
    expect(payload.customerData).toMatchObject({
      branch_id: SECUNDERABAD_BRANCH_ID,
      branch_ids: [SECUNDERABAD_BRANCH_ID],
    });
  });

  it("omits customerData fields in edit mode", () => {
    const payload = buildCreateCustomerUserPayload({
      email: SUNEEL_EMAIL,
      password: "Welcome@123!",
      fullName: "Suneel Kumar",
      phone: "9876543210",
      branchIds: [HYDERABAD_BRANCH_ID],
      mode: "edit",
    });
    expect(payload.createCustomerRecord).toBe(false);
    expect(payload.customerData).toEqual({});
  });
});

describe("mapCreateCustomerUserError", () => {
  it("maps Email already exists to a friendly message", () => {
    expect(mapCreateCustomerUserError("Email already exists")).toBe(
      "An account with this email already exists."
    );
  });

  it("passes through other errors", () => {
    expect(mapCreateCustomerUserError("Auth service is not configured")).toBe(
      "Auth service is not configured"
    );
  });
});
