import { createLogsQueryClient, runKql } from "../src/azureClient.js";
import { loadConfig } from "../src/config.js";

async function main() {
  console.log("Loading config from environment variables...");
  const config = loadConfig();

  console.log("Building Azure credential and Logs Query client...");
  const client = createLogsQueryClient(config);

  console.log(`Querying Application Insights resource ${config.APPINSIGHTS_RESOURCE_ID}...`);
  const { rows } = await runKql(client, config.APPINSIGHTS_RESOURCE_ID, "requests | take 1", 24);

  console.log(`Success. Received ${rows.length} row(s) back from Application Insights.`);
  if (rows.length > 0) {
    console.log("Sample row:", rows[0]);
  } else {
    console.log(
      "No rows in the last 24h — this can be normal (low traffic) but double-check the resource ID/permissions if unexpected.",
    );
  }
}

main().catch((error) => {
  console.error("Connection test failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
