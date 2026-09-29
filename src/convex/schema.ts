import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

/** Production shifts at the batching plant. */
export const shiftValidator = v.union(
  v.literal("morning"),
  v.literal("evening"),
  v.literal("night"),
);
export type Shift = Infer<typeof shiftValidator>;

/** Lifecycle of a single production/dispatch record. */
export const logStatusValidator = v.union(
  v.literal("delivered"),
  v.literal("in_progress"),
  v.literal("cancelled"),
);
export type LogStatus = Infer<typeof logStatusValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    /**
     * IConcrete v1 — daily production & quantities ledger.
     * One row = one dispatch order produced by the plant on a given day/shift.
     * Quantities are cubic meters (m³), money values are EGP.
     */
    productionLogs: defineTable({
      /** ISO day the work happened (YYYY-MM-DD) — the Power Query "sort by date" key. */
      date: v.string(),
      shift: shiftValidator,
      /** Concrete grade, e.g. C30/37. */
      mixDesign: v.string(),
      customer: v.string(),
      site: v.optional(v.string()),
      orderRef: v.optional(v.string()),
      /** Batched quantity. */
      quantityM3: v.number(),
      /** Quantity accepted on site. */
      deliveredM3: v.number(),
      /** Quantity returned by the customer / rejected. */
      returnedM3: v.number(),
      pricePerM3: v.number(),
      costPerM3: v.number(),
      truckCount: v.number(),
      /** Delivered inside the agreed pouring window. */
      onTime: v.boolean(),
      status: logStatusValidator,
      notes: v.optional(v.string()),
      /** Test_Data_Flag — demo rows can be purged without touching real records. */
      isTestData: v.boolean(),
      createdBy: v.optional(v.id("users")),
    })
      .index("by_date", ["date"])
      .index("by_customer", ["customer"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
