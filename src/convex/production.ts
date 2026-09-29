import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { DATE_RE, MAX_ROWS, addDays, enrichLog, r2, utcToday } from "./measures";
import { logStatusValidator, shiftValidator } from "./schema";
import type { LogStatus, Shift } from "./schema";

/** Fields shared by create/update so both are validated identically. */
const logFields = {
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
};

type LogInput = {
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

/** Error prevention: every entry passes through the same rule set. */
function assertValid(input: LogInput) {
  const numbers = [
    input.quantityM3,
    input.deliveredM3,
    input.returnedM3,
    input.pricePerM3,
    input.costPerM3,
    input.truckCount,
  ];
  if (numbers.some((n) => !Number.isFinite(n))) {
    throw new ConvexError("كل الحقول الرقمية يجب أن تكون أرقامًا صحيحة");
  }
  if (!DATE_RE.test(input.date)) {
    throw new ConvexError("تاريخ غير صالح (المطلوب YYYY-MM-DD)");
  }
  if (!input.customer.trim()) {
    throw new ConvexError("اسم العميل مطلوب");
  }
  if (!input.mixDesign.trim()) {
    throw new ConvexError("نوع الخلطة مطلوب");
  }
  if (input.quantityM3 <= 0) {
    throw new ConvexError("الكمية المنتجة يجب أن تكون أكبر من صفر");
  }
  if (input.deliveredM3 < 0 || input.returnedM3 < 0) {
    throw new ConvexError("الكميات لا يمكن أن تكون بالسالب");
  }
  if (input.deliveredM3 + input.returnedM3 > input.quantityM3 + 0.01) {
    throw new ConvexError(
      "الكمية المسلّمة + المرتجعة لا يمكن أن تتجاوز الكمية المنتجة",
    );
  }
  if (input.pricePerM3 <= 0) {
    throw new ConvexError("سعر البيع للمتر يجب أن يكون أكبر من صفر");
  }
  if (input.costPerM3 < 0) {
    throw new ConvexError("تكلفة المتر لا يمكن أن تكون سالبة");
  }
  if (input.truckCount < 0) {
    throw new ConvexError("عدد العربات لا يمكن أن يكون سالبًا");
  }
}

/** Rows for the daily ledger table, enriched with the per-row measures. */
export const list = query({
  args: {
    from: v.string(),
    to: v.string(),
  },
  handler: async (ctx, { from, to }) => {
    const logs = await ctx.db
      .query("productionLogs")
      .withIndex("by_date", (q) => q.gte("date", from).lte("date", to))
      .order("desc")
      .take(MAX_ROWS);

    return logs.map(enrichLog);
  },
});

export const create = mutation({
  args: logFields,
  handler: async (ctx, args) => {
    assertValid(args);
    const userId = await getAuthUserId(ctx);
    return await ctx.db.insert("productionLogs", {
      ...args,
      customer: args.customer.trim(),
      mixDesign: args.mixDesign.trim(),
      site: args.site?.trim() || undefined,
      orderRef: args.orderRef?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      quantityM3: r2(args.quantityM3),
      deliveredM3: r2(args.deliveredM3),
      returnedM3: r2(args.returnedM3),
      pricePerM3: r2(args.pricePerM3),
      costPerM3: r2(args.costPerM3),
      isTestData: false,
      createdBy: userId ?? undefined,
    });
  },
});

export const update = mutation({
  args: { id: v.id("productionLogs"), ...logFields },
  handler: async (ctx, { id, ...args }) => {
    assertValid(args);
    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new ConvexError("القيد لم يعد موجودًا");
    }
    // Editing a demo row marks it as real data again.
    await ctx.db.patch(id, {
      ...args,
      customer: args.customer.trim(),
      mixDesign: args.mixDesign.trim(),
      site: args.site?.trim() || undefined,
      orderRef: args.orderRef?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      quantityM3: r2(args.quantityM3),
      deliveredM3: r2(args.deliveredM3),
      returnedM3: r2(args.returnedM3),
      pricePerM3: r2(args.pricePerM3),
      costPerM3: r2(args.costPerM3),
      isTestData: false,
    });
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("productionLogs") },
  handler: async (ctx, { id }) => {
    const existing = await ctx.db.get(id);
    if (!existing) return null;
    await ctx.db.delete(id);
    return id;
  },
});

/** Purges only rows carrying Test_Data_Flag — real entries are never touched. */
export const clearTestData = mutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("productionLogs")
      .withIndex("by_date")
      .take(MAX_ROWS);
    const testRows = rows.filter((row) => row.isTestData);
    for (const row of testRows) {
      await ctx.db.delete(row._id);
    }
    return testRows.length;
  },
});

/* ------------------------------------------------------------------ */
/* Demo data (Test_Data_Flag = true)                                   */
/* ------------------------------------------------------------------ */

const MIXES = [
  { name: "C20/25", price: 1290, cost: 1045 },
  { name: "C25/30", price: 1405, cost: 1118 },
  { name: "C30/37", price: 1530, cost: 1205 },
  { name: "C35/45", price: 1665, cost: 1312 },
  { name: "C40/50", price: 1820, cost: 1438 },
];

const CUSTOMERS = [
  "المقاولون العرب",
  "أوراسكوم للإنشاء والصناعة",
  "حسن علام للإنشاءات",
  "وادي النيل للمقاولات",
  "طلعت مصطفى جروب",
  "السويدي للمقاولات",
  "المصرية للتعمير",
  "بتروجت",
];

const SITES = [
  "العاصمة الإدارية - حي R7",
  "التجمع الخامس - امتداد الحي الأول",
  "مدينة العلمين الجديدة - المرحلة 2",
  "محور روض الفرج",
  "توسعات مترو الأنفاق - المرحلة 4",
  "منطقة لوجستية - العين السخنة",
];

const SHIFTS: Shift[] = ["morning", "evening", "night"];

/** Deterministic PRNG so the demo ledger always looks the same. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const seedDemoData = mutation({
  args: { today: v.optional(v.string()) },
  handler: async (ctx, { today }) => {
    const existing = await ctx.db.query("productionLogs").take(1);
    if (existing.length > 0) {
      return { inserted: 0, skipped: true };
    }

    const anchor = today && DATE_RE.test(today) ? today : utcToday();
    const random = mulberry32(20260929);
    const rows: Array<LogInput & { isTestData: boolean }> = [];

    for (let offset = 89; offset >= 0; offset -= 1) {
      const date = addDays(anchor, -offset);
      const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); // 5 = Friday (weekend)
      const monthFactor = 1 + 0.06 * Math.sin((offset / 30) * Math.PI);
      // Roughly every two weeks a disrupted day lands in the ledger (rain, site
      // shutdown, waiting time). Those days genuinely run at a loss.
      const disruptedDay = offset % 14 === 3;

      let entries = random() < 0.35 ? 2 : 3;
      if (weekday === 5) entries = random() < 0.55 ? 0 : 1;
      else if (weekday === 6) entries = Math.max(1, entries - 1);

      for (let i = 0; i < entries; i += 1) {
        const mix = MIXES[Math.floor(random() * MIXES.length)];
        const shift: Shift =
          random() < 0.42 ? SHIFTS[0] : random() < 0.62 ? SHIFTS[1] : SHIFTS[2];
        // Skewed pick: the first customers stay the biggest accounts.
        const customer = CUSTOMERS[Math.floor(random() ** 1.7 * CUSTOMERS.length)];
        const site = SITES[Math.floor(random() * SITES.length)];

        const quantity = Math.round((34 + random() * 108) * monthFactor);
        const returned = random() < 0.34 ? Math.round(quantity * (0.01 + random() * 0.07)) : 0;
        const delivered = Math.max(1, quantity - returned);
        const price = mix.price * (disruptedDay ? 0.9 : 0.94 + random() * 0.11);
        // A hard pour (long haul, pump waiting, night shift) carries extra cost,
        // which is what pushes some rows below the break-even line.
        const hardPour = disruptedDay || random() < 0.09;
        const cost =
          mix.cost *
          (0.96 + random() * 0.2) *
          (disruptedDay ? 1.32 : hardPour ? 1.22 : 1);
        const truckCount = Math.max(1, Math.round(quantity / 9));
        const roll = random();
        const status: LogStatus =
          offset === 0 && roll > 0.86
            ? "in_progress"
            : roll > 0.975
              ? "cancelled"
              : "delivered";

        rows.push({
          date,
          shift,
          mixDesign: mix.name,
          customer,
          site,
          orderRef: `IC-${date.replace(/-/g, "").slice(2)}-${(i + 1)
            .toString()
            .padStart(2, "0")}`,
          quantityM3: r2(quantity),
          deliveredM3: r2(delivered),
          returnedM3: r2(returned),
          pricePerM3: r2(price),
          costPerM3: r2(cost),
          truckCount,
          onTime: random() < (status === "delivered" ? 0.91 : 0.72),
          status,
          notes: disruptedDay
            ? "يوم متعثر: تأخير في الموقع وتوقف عربات — تكلفة تشغيل إضافية"
            : hardPour
              ? "صب بطلمبة مع تأخير — تكلفة تشغيل إضافية"
              : undefined,
          isTestData: true,
        });
      }
    }

    for (const row of rows) {
      await ctx.db.insert("productionLogs", row);
    }

    return { inserted: rows.length, skipped: false };
  },
});
