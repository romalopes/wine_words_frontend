import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
    include: ["src/**/*.{test,spec}.{js,mjs,jsx,ts,tsx}"],
  },
  // Bind both IPv4 and IPv6 loopback: Node binds only the first address it
  // resolves for "localhost" (::1 here), which left 127.0.0.1:5173 refusing
  // connections. Both loopback addresses must serve the app, because Google
  // Identity Services validates the exact page origin against the client's
  // authorised JavaScript origins.
  server: { host: true, port: 5173, strictPort: true },
});
