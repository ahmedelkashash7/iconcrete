import { ConvexError } from "convex/values";

/** Surfaces the Arabic validation message thrown by the Convex layer. */
export function errorMessage(error: unknown, fallback = "تعذر إتمام العملية"): string {
  if (error instanceof ConvexError) {
    return typeof error.data === "string" ? error.data : fallback;
  }
  if (error instanceof Error) {
    // Server errors arrive wrapped, strip the transport noise if present.
    const match = /Uncaught (?:Convex)?Error: (.+?)(?:\n|$)/.exec(error.message);
    return match?.[1]?.trim() || error.message || fallback;
  }
  return fallback;
}
