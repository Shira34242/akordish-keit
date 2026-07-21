import { z } from "zod";
import { runKql } from "../azureClient.js";
import { textResult, type ToolDefinition } from "./types.js";

const schema = {
  hoursBack: z
    .number()
    .int()
    .min(1)
    .max(168)
    .default(24)
    .describe("How many hours back to search (max 168 = 7 days)."),
  minStatusCode: z
    .number()
    .int()
    .min(100)
    .max(599)
    .default(400)
    .describe("Only include requests with an HTTP result code at or above this value."),
};

const KQL = `
requests
| where toint(resultCode) >= {minStatusCode}
| summarize count=count(), lastSeen=max(timestamp), sampleOperationId=any(operation_Id)
  by name, resultCode
| order by count desc
`;

export const failedRequestsTool: ToolDefinition<typeof schema> = {
  name: "get_failed_requests",
  description:
    "List failing HTTP requests (4xx/5xx) from production, grouped by route and status code with counts. Useful for spotting broken endpoints even when no exception was thrown.",
  schema,
  handler: async (client, resourceId, args) => {
    const kql = KQL.replace("{minStatusCode}", String(args.minStatusCode));
    const { rows, truncated } = await runKql(client, resourceId, kql, args.hoursBack);
    return textResult(rows, truncated);
  },
};
