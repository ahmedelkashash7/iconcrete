import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { EXPORT_ENTITIES, findEntity, type ExportRow } from "./exportLayer";

const http = httpRouter();

auth.addHttpRoutes(http);

/**
 * IConcrete System — read-only integration endpoints for Excel / Power Query,
 * Power BI and Azure SQL copy jobs.
 *
 *   GET /api/v1/iconcrete/health
 *   GET /api/v1/iconcrete/manifest.json
 *   GET /api/v1/iconcrete/orders.csv?token=…&from=2026-01-01&to=2026-12-31
 *
 * Access is a single shared token read from the deployment's environment
 * (`ICONCRETE_EXPORT_TOKEN`). Until the owner adds it the layer answers 503 with
 * the exact instruction instead of leaking data or failing silently.
 */

const PREFIX = "/api/v1/iconcrete/";
const ROW_LIMIT = 20_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-iconcrete-token",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

function csv(rows: ExportRow[], sheet: string): Response {
  const columns: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) if (!columns.includes(key)) columns.push(key);
  }
  const escape = (value: ExportRow[string]): string => {
    if (value === null || value === undefined) return "";
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [
    `# ${sheet} — IConcrete System export (Test_Data_Flag marks demo rows)`,
    columns.join(","),
    ...rows.map((row) => columns.map((column) => escape(row[column])).join(",")),
  ];
  // The BOM keeps Arabic headers readable when Excel opens the file directly.
  return new Response(`\uFEFF${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${sheet}.csv"`,
      ...CORS,
    },
  });
}

function authorized(request: Request): { ok: boolean; configured: boolean } {
  const expected = process.env.ICONCRETE_EXPORT_TOKEN;
  if (!expected) return { ok: false, configured: false };
  const url = new URL(request.url);
  const provided =
    request.headers.get("x-iconcrete-token") ?? url.searchParams.get("token") ?? "";
  return { ok: provided.length > 0 && provided === expected, configured: true };
}

function stripMoney(rows: ExportRow[], columns: string[]): ExportRow[] {
  if (columns.length === 0) return rows;
  return rows.map((row) => {
    const copy: ExportRow = { ...row };
    for (const column of columns) delete copy[column];
    return copy;
  });
}

const corsHandler = httpAction(async () => new Response(null, { status: 204, headers: CORS }));

const exportHandler = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const path = url.pathname.slice(PREFIX.length);
  const [rawName, format] = (() => {
    if (path === "health" || path === "health.json") return ["health", "json"] as const;
    const [name, extension] = path.split(".");
    return [name, extension === "csv" ? "csv" : "json"] as const;
  })();

  if (rawName === "health") {
    const configured = Boolean(process.env.ICONCRETE_EXPORT_TOKEN);
    return json({
      ok: configured,
      layer: "IConcrete unified export",
      version: "1.0",
      tokenConfigured: configured,
      message: configured
        ? "الطبقة جاهزة. أضف ?token=… إلى أي طلب بيانات."
        : "أضف مفتاح ICONCRETE_EXPORT_TOKEN من تبويب المفاتيح لتفعيل التصدير.",
      entities: EXPORT_ENTITIES.map((entity) => entity.key),
      generatedAt: new Date().toISOString(),
    });
  }

  const access = authorized(request);
  if (!access.configured) {
    return json(
      {
        ok: false,
        error: "EXPORT_TOKEN_MISSING",
        message:
          "التصدير معطّل: أضف ICONCRETE_EXPORT_TOKEN من تبويب المفاتيح في المشروع، ثم أعد المحاولة.",
      },
      503,
    );
  }
  if (!access.ok) {
    return json(
      {
        ok: false,
        error: "UNAUTHORIZED",
        message: "رمز غير صحيح. أرسله في ?token= أو في ترويسة x-iconcrete-token.",
      },
      401,
    );
  }

  if (rawName === "manifest") {
    const stats = await ctx.runQuery(internal.exportLayer.manifestStats, {});
    const columns = await Promise.all(
      EXPORT_ENTITIES.map(async (entity) => {
        const sample = await ctx.runQuery(internal.exportLayer.fetchEntity, {
          entity: entity.key,
          limit: 1,
        });
        return { key: entity.key, columns: sample.length > 0 ? Object.keys(sample[0]) : [] };
      }),
    );
    const columnMap = new Map(columns.map((entry) => [entry.key, entry.columns]));
    return json({
      ok: true,
      layer: "IConcrete unified export",
      version: "1.0",
      format: "csv|json",
      unit: stats.unit,
      currency: stats.currency,
      today: stats.today,
      generatedAt: stats.generatedAt,
      latestOrderDate: stats.latestOrderDate,
      orders: stats.orders,
      recentOrders: stats.recentOrders,
      auth: "?token=… or header x-iconcrete-token",
      entities: EXPORT_ENTITIES.map((entity) => ({
        key: entity.key,
        sheet: entity.sheet,
        label: entity.label,
        layer: entity.layer,
        description: entity.description,
        endpoint: `${PREFIX}${entity.key}.csv`,
        ranged: entity.ranged,
        moneyColumns: entity.money ?? [],
        sources: entity.sources,
        columns: columnMap.get(entity.key) ?? [],
      })),
    });
  }

  const entity = findEntity(rawName);
  if (!entity) {
    return json(
      {
        ok: false,
        error: "UNKNOWN_ENTITY",
        message: `لا يوجد كيان باسم «${rawName}».`,
        available: EXPORT_ENTITIES.map((item) => item.key),
      },
      404,
    );
  }

  const limit = Math.min(Number(url.searchParams.get("limit") ?? ROW_LIMIT) || ROW_LIMIT, ROW_LIMIT);
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const branch = url.searchParams.get("branch") ?? undefined;
  const money = url.searchParams.get("money") !== "0";

  let rows = await ctx.runQuery(internal.exportLayer.fetchEntity, {
    entity: entity.key,
    from,
    to,
    limit,
  });

  if (branch) rows = rows.filter((row) => String(row.branch ?? "") === branch);
  if (!money) rows = stripMoney(rows, entity.money ?? []);

  return format === "csv" ? csv(rows, entity.sheet) : json({ ok: true, entity: entity.key, count: rows.length, rows });
});

http.route({ pathPrefix: PREFIX, method: "GET", handler: exportHandler });
http.route({ pathPrefix: PREFIX, method: "OPTIONS", handler: corsHandler });

export default http;
