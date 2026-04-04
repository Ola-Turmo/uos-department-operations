/**
 * Connectors Configuration
 * 
 * This module exports the connectors configuration as a TypeScript object
 * to avoid JSON import issues across different module resolution modes.
 */

export const connectorsConfig = {
  requiredToolkits: [
    "slack",
    "notion",
    "googlesheets",
    "googledrive",
    "googledocs"
  ],
  roleToolkits: [
    {
      roleKey: "operations",
      toolkits: ["slack", "notion", "googlesheets"]
    },
    {
      roleKey: "operations-knowledge-lead",
      toolkits: ["googledrive", "googledocs", "notion"]
    },
    {
      roleKey: "operations-automation-operator",
      toolkits: ["slack", "googlesheets", "notion"]
    }
  ]
} as const;

export type ConnectorsConfig = typeof connectorsConfig;
