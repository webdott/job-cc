import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "node",
    // Route integration tests share one real (Docker) Postgres and truncate
    // it between tests — running files in parallel would let one file's
    // truncation race another's in-flight test against the same tables.
    fileParallelism: false,
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["node_modules", ".next", "e2e"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
