import { v } from "convex/values";
import { requireCapability } from "./access";
import { query } from "./_generated/server";

const AUDIT_MAX_ROWS = 600;

/**
 * Audit feed for the compliance screen. Restricted to the roles that are
 * responsible for traceability (owner, manager, reviewer).
 */
export const list = query({
  args: {
    from: v.string(),
    to: v.string(),
  },
  handler: async (ctx, { from, to }) => {
    await requireCapability(ctx, "viewAudit");
    return await ctx.db
      .query("auditLogs")
      .withIndex("by_date", (q) => q.gte("date", from).lte("date", to))
      .order("desc")
      .take(AUDIT_MAX_ROWS);
  },
});
