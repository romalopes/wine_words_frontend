import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "com.winewords.app",
  appName: "Wine Words",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
}

export default config
