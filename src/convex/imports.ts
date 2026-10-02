import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { requireCapability, requireViewer } from "./access";
import { recordAudit } from "./auditLog";
import { ensureDefaultBranch } from "./branches";
import { DATE_RE, MAX_ROWS, r2 } from "./measures";
import { can } from "./permissions";
import type { Viewer } from "./permissions";
import { standardPricing } from "./pricing";
import { loadMixPrices } from "./settings";
import { logStatusValidator, shiftValidator } from "./schema";
import type { LogStatus, Shift } from "./schema";

/**
 * Excel is the foundation of the plant's data entry: the employee fills the
 * template and uploads it, and these rows become part of the same production
 * ledger every other screen reads from — so the dashboard, quality, stores and
 * forecasts update the moment the import lands.
 *
 * The server keeps the same guarantees as manual entry: fields are validated,
 * operators are priced from the approved mix list (they never carry money in),
 * and the whole import is written to the audit trail.
 */

const MAX_IMPORT_ROWS = 2_000;

const rowValidator = v.object({
  date: v.string(),
  shift: shiftValidator,
  mixDesign: v.string(),
  customer: v.string(),
  site: v.optional(v.string()),
  orderRef: v.optional(v.string()),
  quantityM3: v.number(),
  deliveredM3: v.number(),
  returnedM3: v.number(),
  pricePerM3: v.number(),
  costPerM3: v.number(),
  truckCount: v.number(),
  onTime: v.boolean(),
  status: logStatusValidator,
  notes: v.optional(v.string()),
});

type ImportRow = {
  date: string;
  shift: Shift;
  mixDesign: string;
  customer: string;
  site?: string;
  orderRef?: string;
  quantityM3: number;
  deliveredM3: number;
  returnedM3: number;
  pricePerM3: number;
  costPerM3: number;
  truckCount: number;
  onTime: boolean;
  status: LogStatus;
  notes?: string;
};

function assertValid(row: ImportRow): string | null {
  const numbers = [
    row.quantityM3,
    row.deliveredM3,
    row.returnedM3,
    row.pricePerM3,
    row.costPerM3,
    row.truckCount,
  ];
  if (numbers.some((n) => !Number.isFinite(n))) return "قيمة رقمية غير صالحة";
  if (!DATE_RE.test(row.date)) return "تاريخ غير صالح (YYYY-MM-DD)";
  if (!row.customer.trim()) return "اسم العميل مطلوب";
  if (!row.mixDesign.trim()) return "نوع الخلطة مطلوب";
  if (row.quantityM3 <= 0) return "الكمية المنتجة يجب أن تكون أكبر من صفر";
  if (row.deliveredM3 < 0 || row.returnedM3 < 0) return "الكميات لا يمكن أن تكون بالسالب";
  if (row.deliveredM3 + row.returnedM3 > row.quantityM3 + 0.01) {
    return "المسلّمة + المرتجعة تتجاوز المنتجة";
  }
  if (row.pricePerM3 <= 0) return "سعر المتر يجب أن يكون أكبر من صفر";
  if (row.costPerM3 < 0) return "تكلفة المتر لا يمكن أن تكون سالبة";
  if (row.truckCount < 0) return "عدد العربات لا يمكن أن يكون سالبًا";
  return null;
}

/**
 * Fills prices from the approved mix list whenever the row has none, and always
 * for roles that are not allowed to see money — exactly like manual entry.
 */
async function priceRow(
  ctx: MutationCtx,
  viewer: Viewer,
  row: ImportRow,
): Promise<ImportRow> {
  const financialsVisible = can(viewer, "viewFinancials");
  const hasPrices = row.pricePerM3 > 0;
  if (financialsVisible && hasPrices) return row;

  const prices = await loadMixPrices(ctx);
  const preset = standardPricing(row.mixDesign, prices);
  return {
    ...row,
    pricePerM3: financialsVisible && hasPrices ? row.pricePerM3 : preset.price,
    costPerM3: financialsVisible && hasPrices ? row.costPerM3 : preset.cost,
  };
}

export const importProduction = mutation({
  args: {
    rows: v.array(rowValidator),
    branchId: v.optional(v.id("branches")),
    filename: v.optional(v.string()),
  },
  handler: async (ctx, { rows, branchId: requestedBranch, filename }) => {
    const viewer = await requireCapability(ctx, "createLog");
    if (rows.length === 0) {
      throw new ConvexError("لم يصل أي سطر صالح للاستيراد");
    }
    if (rows.length > MAX_IMPORT_ROWS) {
      throw new ConvexError(
        `الحد الأقصى ${MAX_IMPORT_ROWS} سطرًا في المرة الواحدة — قسّم الملف`,
      );
    }

    const branchId = requestedBranch ?? (await ensureDefaultBranch(ctx, viewer.userId));
    let inserted = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (let index = 0; index < rows.length; index += 1) {
      const priced = await priceRow(ctx, viewer, rows[index]);
      const problem = assertValid(priced);
      if (problem) {
        errors.push({ row: index + 1, message: problem });
        continue;
      }
      await ctx.db.insert("productionLogs", {
        branchId,
        date: priced.date,
        shift: priced.shift,
        mixDesign: priced.mixDesign.trim(),
        customer: priced.customer.trim(),
        site: priced.site?.trim() || undefined,
        orderRef: priced.orderRef?.trim() || undefined,
        quantityM3: r2(priced.quantityM3),
        deliveredM3: r2(priced.deliveredM3),
        returnedM3: r2(priced.returnedM3),
        pricePerM3: r2(priced.pricePerM3),
        costPerM3: r2(priced.costPerM3),
        truckCount: Math.round(priced.truckCount),
        onTime: priced.onTime,
        status: priced.status,
        notes: priced.notes?.trim() || undefined,
        isTestData: false,
        createdBy: viewer.userId,
      });
      inserted += 1;
    }

    if (inserted > 0) {
      await recordAudit(ctx, {
        actorId: viewer.userId,
        action: "create",
        entity: "productionLogs",
        label: `استيراد Excel${filename ? ` — ${filename}` : ""} (${inserted} سطرًا)`,
        changes: [],
      });
    }

    return {
      inserted,
      skipped: errors.length,
      errors: errors.slice(0, 25),
    };
  },
});

/** Live counts so the import screen can prove the cloud updated instantly. */
export const importStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireViewer(ctx);
    const logs = await ctx.db.query("productionLogs").withIndex("by_date").take(MAX_ROWS);
    const dates = logs.map((log) => log.date).sort();
    return {
      total: logs.length,
      testData: logs.filter((log) => log.isTestData).length,
      first: dates[0] ?? null,
      last: dates[dates.length - 1] ?? null,
    };
  },
});

export type ImportResult = {
  inserted: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
};

export type ImportBranchId = Id<"branches">;
