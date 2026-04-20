import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "uos.department-operations",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Department Operations",
  description: "Department overlay for operations roles, jobs, skills, and connector policy.",
  author: "turmo.dev",
  categories: ["automation"],
  capabilities: [
    "events.subscribe",
    "plugin.state.read",
    "plugin.state.write",
    "ui.dashboardWidget.register"
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui"
  },
  ui: {
    slots: [
      {
        type: "dashboardWidget",
        id: "health-widget",
        displayName: "Department Operations Health",
        exportName: "DashboardWidget"
      }
    ]
  }
};

export default manifest;
