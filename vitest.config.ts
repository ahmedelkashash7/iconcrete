import { defineConfig } from "vitest/config";
import path from "path";

/**
 * IConcrete System — test runner.
 *
 * Only pure modules are unit-tested here (concrete-engineering rules, money,
 * VAT, error codes, offline queue maths). They live in `src/lib` and
 * `src/convex` and import nothing from the Vite/React runtime, so no jsdom
 * environment and no browser shims are needed.
 */
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
    reporters: ["default"],
  },
});
