import { ClientSecretCredential } from "@azure/identity";
import { LogsQueryClient, LogsQueryResultStatus } from "@azure/monitor-query";
import type { Config } from "./config.js";

const MAX_ROWS = 50;

export function createLogsQueryClient(config: Config): LogsQueryClient {
  const credential = new ClientSecretCredential(
    config.AZURE_TENANT_ID,
    config.AZURE_CLIENT_ID,
    config.AZURE_CLIENT_SECRET,
  );
  return new LogsQueryClient(credential);
}

function timespanFromHours(hoursBack: number): { startTime: Date; endTime: Date } {
  const clampedHours = Math.min(Math.max(hoursBack, 1), 168);
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - clampedHours * 60 * 60 * 1000);
  return { startTime, endTime };
}

export async function runKql(
  client: LogsQueryClient,
  resourceId: string,
  kql: string,
  hoursBack: number,
): Promise<{ rows: Record<string, unknown>[]; truncated: boolean }> {
  const result = await client.queryResource(resourceId, kql, timespanFromHours(hoursBack));

  if (result.status !== LogsQueryResultStatus.Success) {
    const message =
      result.status === LogsQueryResultStatus.PartialFailure
        ? result.partialError?.message
        : "Unknown Log Analytics query failure";
    throw new Error(`Application Insights query failed: ${message}`);
  }

  const table = result.tables[0];
  if (!table) {
    return { rows: [], truncated: false };
  }

  const rows = table.rows.map((row) =>
    Object.fromEntries(table.columnDescriptors.map((col, i) => [col.name, row[i]])),
  );

  const truncated = rows.length > MAX_ROWS;
  return { rows: rows.slice(0, MAX_ROWS), truncated };
}
