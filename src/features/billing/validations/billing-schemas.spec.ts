import { describe, expect, it } from "vitest";

import { createBillSchema } from "./billing-schemas";

const baseBill = {
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
  orderId: "order-1",
  customerName: "Ravi Kumar",
  customerPhone: "+91 98765 43210",
};

describe("createBillSchema customer identity", () => {
  it("accepts a bill with customer name and phone", () => {
    expect(createBillSchema.safeParse(baseBill).success).toBe(true);
  });

  it("rejects a bill without a customer name", () => {
    const result = createBillSchema.safeParse({
      ...baseBill,
      customerName: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a bill without a valid customer phone", () => {
    const result = createBillSchema.safeParse({
      ...baseBill,
      customerPhone: "",
    });

    expect(result.success).toBe(false);
  });
});
