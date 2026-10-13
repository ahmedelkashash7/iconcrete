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
 *   GET /api/v1/iconcrete/orders.csv?from=2026-01-01&to=2026-12-31
 *
 * Authentication is a single shared token read from the deployment environment
 * (`ICONCRETE_EXPORT_TOKEN`) and it must be sent in the **`x-iconcrete-token`
 * header**. It is deliberately *not* accepted as a URL query parameter: query
 * strings end up in access logs, browser history, proxies and Referer headers.
 * Until the owner configures the token the layer answers 503 with the exact
 * instruction instead of leaking data or failing silently.
 *
 * Optional configuration:
 *   ICONCRETE_CORS_ORIGINS   comma-separated allow-list of origins. When unset
 *                            no cross-origin access is granted at all (the
 *                            browser blocks it); there is no wildcard.
 *   ICONCRETE_EXPORT_BRANCHES comma-separated branch *codes* the token may
 *                            read. When set, every row outside those branches
 *                            is dropped, whatever the caller asks for.
 */

const PREFIX = "/api/v1/iconcrete/";
const ROW_LIMIT_MAX = 20_000;
const ROW_LIMIT_DEFAULT = 5_000;

/** Constant-time string comparison (no early return, no length leak). */
function timingSafeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    diff |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return diff === 0;
}

function allowedOrigins(): string[] {
  return (process.env.ICONCRETE_CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

/**
 * CORS headers for one request. No wildcard: an origin is reflected only when it
 * appears in ICONCRETE_CORS_ORIGINS.
 */
function corsHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "content-type, x-iconcrete-token",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    Vary: "Origin",
  };
  const origin = request.headers.get("Origin");
  if (!origin) return headers;
  if (allowedOrigins().includes(origin.replace(/\/$/, ""))) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(
  request: Request,
  body: unknown,
  status = 200,
  sheet?: string,
): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders(request),
  };
  if (sheet) headers["Content-Disposition"] = `attachment; filename="${sheet}.json"`;
  return new Response(JSON.stringify(body, null, 2), { status, headers });
}

/**
 * Guards a CSV cell against spreadsheet formula injection.
 *
 * Excel and LibreOffice execute a cell that starts with `=`, `+`, `-`, `@`, a
 * tab or a carriage return. A customer called `=cmd|'/c calc'!A1` would be a
 * live formula in the analyst's workbook, so every such cell is prefixed with an
 * apostrophe and the value is quoted.
 */
export function sanitizeCsvCell(value: ExportRow[string]): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  const dangerous = /^[\s]*[=+\-@\t\r]/;
  const needsQuote = /[",\n\r]/.test(text) || dangerous.test(text);
  const guarded = dangerous.test(text) ? `'${text}` : text;
  return needsQuote ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

function csv(request: Request, rows: ExportRow[], sheet: string): Response {
  const columns: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) if (!columns.includes(key)) columns.push(key);
  }
  const lines = [
    `# ${sheet} — IConcrete System export (Test_Data_Flag marks demo rows)`,
    columns.join(","),
    ...rows.map((row) => columns.map((column) => sanitizeCsvCell(row[column])).join(",")),
  ];
  // The BOM keeps Arabic headers readable when Excel opens the file directly.
  return new Response(`\uFEFF${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${sheet}.csv"`,
      ...corsHeaders(request),
    },
  });
}

type Access =
  | { status: "ok" }
  | { status: "unconfigured" }
  | { status: "unauthorized" };

/** Header-only, constant-time token check. */
function authorize(request: Request): Access {
  const expected = process.env.ICONCRETE_EXPORT_TOKEN;
  if (!expected) return { status: "unconfigured" };
  const provided = request.headers.get("x-iconcrete-token") ?? "";
  if (provided.length === 0 || !timingSafeEqual(provided, expected)) {
    return { status: "unauthorized" };
  }
  return { status: "ok" };
}

/** Branch codes this token may read, or `null` for "every branch". */
function scopedBranches(): string[] | null {
  const raw = process.env.ICONCRETE_EXPORT_BRANCHES;
  if (!raw) return null;
  const codes = raw
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
  return codes.length > 0 ? codes : null;
}

function stripMoney(rows: ExportRow[], columns: string[]): ExportRow[] {
  if (columns.length === 0) return rows;
  return rows.map((row) => {
    const copy: ExportRow = { ...row };
    for (const column of columns) delete copy[column];
    return copy;
  });
}

const corsHandler = httpAction(
  async (_ctx, request) => new Response(null, { status: 204, headers: corsHeaders(request) }),
);

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
    const scoped = scopedBranches();
    return json(request, {
      ok: configured,
      layer: "IConcrete unified export",
      version: "1.0",
      tokenConfigured: configured,
      corsOriginsConfigured: allowedOrigins().length,
      branchScope: scoped ?? "all",
      message: configured
        ? "الطبقة جاهزة. أرسل الرمز في ترويسة x-iconcrete-token مع أي طلب بيانات."
        : "أضف مفتاح ICONCRETE_EXPORT_TOKEN من تبويب المفاتيح لتفعيل التصدير.",
      auth: "header x-iconcrete-token only (never a query parameter)",
      entities: EXPORT_ENTITIES.map((entity) => entity.key),
      generatedAt: new Date().toISOString(),
    });
  }

  const access = authorize(request);
  if (access.status === "unconfigured") {
    return json(
      request,
      {
        ok: false,
        error: "EXPORT_TOKEN_MISSING",
        message:
          "التصدير معطّل: أضف ICONCRETE_EXPORT_TOKEN من تبويب المفاتيح في المشروع، ثم أعد المحاولة.",
      },
      503,
    );
  }
  if (access.status === "unauthorized") {
    return json(
      request,
      {
        ok: false,
        error: "UNAUTHORIZED",
        message:
          "رمز غير صحيح أو غير موجود. أرسله في ترويسة x-iconcrete-token (لا تُقبل معامِلات الرابط).",
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
    const scoped = scopedBranches();
    return json(request, {
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
      auth: "header x-iconcrete-token only",
      branchScope: scoped ?? "all",
      rowLimit: { default: ROW_LIMIT_DEFAULT, max: ROW_LIMIT_MAX },
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
      request,
      {
        ok: false,
        error: "UNKNOWN_ENTITY",
        message: `لا يوجد كيان باسم «${rawName}».`,
        available: EXPORT_ENTITIES.map((item) => item.key),
      },
      404,
    );
  }

  const requestedLimit = Number(url.searchParams.get("limit") ?? ROW_LIMIT_DEFAULT);
  const limit = Math.min(
    Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : ROW_LIMIT_DEFAULT),
    ROW_LIMIT_MAX,
  );
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const requestedBranch = url.searchParams.get("branch") ?? undefined;
  const money = url.searchParams.get("money") !== "0";

  let rows = await ctx.runQuery(internal.exportLayer.fetchEntity, {
    entity: entity.key,
    from,
    to,
    limit,
  });

  // Branch scope comes from the token's configuration, not from the caller.
  const scoped = scopedBranches();
  if (scoped) {
    const allowed = new Set(scoped);
    rows = rows.filter((row) =>
      allowed.has(String(row.branch ?? "").trim().toUpperCase()),
    );
  }
  if (requestedBranch) {
    const wanted = requestedBranch.trim().toUpperCase();
    if (scoped && !scoped.includes(wanted)) {
      return json(
        request,
        {
          ok: false,
          error: "BRANCH_NOT_ALLOWED",
          message: `الرمز الحالي لا يسمح بالفرع «${requestedBranch}».`,
          allowedBranches: scoped,
        },
        403,
      );
    }
    rows = rows.filter((row) => String(row.branch ?? "").trim().toUpperCase() === wanted);
  }
  if (!money) rows = stripMoney(rows, entity.money ?? []);

  return format === "csv"
    ? csv(request, rows, entity.sheet)
    : json(request, { ok: true, entity: entity.key, count: rows.length, rows });
});

http.route({ pathPrefix: PREFIX, method: "GET", handler: exportHandler });
http.route({ pathPrefix: PREFIX, method: "OPTIONS", handler: corsHandler });

export default http;
