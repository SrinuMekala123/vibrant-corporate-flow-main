import { describe, it, expect, vi } from "vitest";
import {
  buildCreateCustomerUserPayload,
  createCustomerUserAccount,
  syncCustomerBranches,
  type InvokeCreateCustomerUserFn,
} from "@/lib/customerForm";

const SUNEEL_EMAIL = "suneel@gmail.com";
const HYDERABAD_BRANCH_ID = "branch-hyd-uuid";
const SECUNDERABAD_BRANCH_ID = "branch-sec-uuid";

describe("createCustomerUserAccount", () => {
  it("succeeds for suneel@gmail.com when Edge Function returns userId", async () => {
    const invoke = vi.fn<InvokeCreateCustomerUserFn>().mockResolvedValue({
      data: {
        success: true,
        userId: "user-suneel-uuid",
        user: { id: "user-suneel-uuid", email: SUNEEL_EMAIL, full_name: "Suneel Kumar", role: "customer" },
      },
      error: null,
    });

    const payload = buildCreateCustomerUserPayload({
      email: SUNEEL_EMAIL,
      password: "Welcome@123!",
      fullName: "Suneel Kumar",
      phone: "9876543210",
      customerType: "Retail",
      branchIds: [HYDERABAD_BRANCH_ID, SECUNDERABAD_BRANCH_ID],
      mode: "add",
    });

    const result = await createCustomerUserAccount(invoke, payload);

    expect(invoke).toHaveBeenCalledWith("create-customer-user", { body: payload });
    expect(payload.customerData).toMatchObject({
      branch_ids: [HYDERABAD_BRANCH_ID, SECUNDERABAD_BRANCH_ID],
    });
    expect(result.userId).toBe("user-suneel-uuid");
    expect(result.data.user.email).toBe(SUNEEL_EMAIL);
  });

  it("throws friendly error when email already exists (data.error)", async () => {
    const invoke = vi.fn<InvokeCreateCustomerUserFn>().mockResolvedValue({
      data: { error: "Email already exists" },
      error: null,
    });

    const payload = buildCreateCustomerUserPayload({
      email: SUNEEL_EMAIL,
      password: "Welcome@123!",
      fullName: "Suneel Kumar",
      phone: "9876543210",
      mode: "add",
    });

    await expect(createCustomerUserAccount(invoke, payload)).rejects.toThrow(
      "An account with this email already exists."
    );
  });

  it("throws friendly error when FunctionsHttpError reports duplicate", async () => {
    const invoke = vi.fn<InvokeCreateCustomerUserFn>().mockResolvedValue({
      data: null,
      error: { message: "Email already exists", context: undefined },
    });

    const payload = buildCreateCustomerUserPayload({
      email: SUNEEL_EMAIL,
      password: "Welcome@123!",
      fullName: "Suneel Kumar",
      phone: "9876543210",
      mode: "add",
    });

    await expect(createCustomerUserAccount(invoke, payload)).rejects.toThrow(
      "An account with this email already exists."
    );
  });

  it("throws when user id is missing from success response", async () => {
    const invoke = vi.fn<InvokeCreateCustomerUserFn>().mockResolvedValue({
      data: { success: true },
      error: null,
    });

    const payload = buildCreateCustomerUserPayload({
      email: SUNEEL_EMAIL,
      password: "Welcome@123!",
      fullName: "Suneel Kumar",
      phone: "9876543210",
      mode: "add",
    });

    await expect(createCustomerUserAccount(invoke, payload)).rejects.toThrow(
      "Did not receive user ID from server."
    );
  });
});

describe("syncCustomerBranches", () => {
  it("replaces links with Hyderabad and Secunderabad", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const eq = vi.fn().mockResolvedValue({ error: null });
    const del = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ delete: del, insert });

    await syncCustomerBranches({ from } as any, "cust-1", [
      HYDERABAD_BRANCH_ID,
      SECUNDERABAD_BRANCH_ID,
    ]);

    expect(from).toHaveBeenCalledWith("customer_branches");
    expect(del).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith("customer_id", "cust-1");
    expect(insert).toHaveBeenCalledWith([
      { customer_id: "cust-1", branch_id: HYDERABAD_BRANCH_ID },
      { customer_id: "cust-1", branch_id: SECUNDERABAD_BRANCH_ID },
    ]);
  });

  it("clears all links when branch list is empty", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const eq = vi.fn().mockResolvedValue({ error: null });
    const del = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ delete: del, insert });

    await syncCustomerBranches({ from } as any, "cust-1", []);

    expect(insert).not.toHaveBeenCalled();
  });
});
