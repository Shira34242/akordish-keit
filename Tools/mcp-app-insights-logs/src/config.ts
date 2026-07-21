const REQUIRED_VARS = [
  "AZURE_TENANT_ID",
  "AZURE_CLIENT_ID",
  "AZURE_CLIENT_SECRET",
  "APPINSIGHTS_RESOURCE_ID",
] as const;

type RequiredVar = (typeof REQUIRED_VARS)[number];

export type Config = Record<RequiredVar, string>;

export function loadConfig(): Config {
  const missing = REQUIRED_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        "See Tools/mcp-app-insights-logs/.env.example and the plan's Azure setup steps.",
    );
  }

  return Object.fromEntries(
    REQUIRED_VARS.map((name) => [name, process.env[name] as string]),
  ) as Config;
}
