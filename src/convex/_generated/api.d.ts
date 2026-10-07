/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as alerts from "../alerts.js";
import type * as analytics from "../analytics.js";
import type * as audit from "../audit.js";
import type * as auditLog from "../auditLog.js";
import type * as auth from "../auth.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as branches from "../branches.js";
import type * as crons from "../crons.js";
import type * as exportLayer from "../exportLayer.js";
import type * as forecast from "../forecast.js";
import type * as http from "../http.js";
import type * as imports from "../imports.js";
import type * as inventory from "../inventory.js";
import type * as measures from "../measures.js";
import type * as permissions from "../permissions.js";
import type * as pricing from "../pricing.js";
import type * as production from "../production.js";
import type * as quality from "../quality.js";
import type * as settings from "../settings.js";
import type * as sync from "../sync.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  alerts: typeof alerts;
  analytics: typeof analytics;
  audit: typeof audit;
  auditLog: typeof auditLog;
  auth: typeof auth;
  "auth/emailOtp": typeof auth_emailOtp;
  branches: typeof branches;
  crons: typeof crons;
  exportLayer: typeof exportLayer;
  forecast: typeof forecast;
  http: typeof http;
  imports: typeof imports;
  inventory: typeof inventory;
  measures: typeof measures;
  permissions: typeof permissions;
  pricing: typeof pricing;
  production: typeof production;
  quality: typeof quality;
  settings: typeof settings;
  sync: typeof sync;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
