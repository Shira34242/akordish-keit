import { z } from "zod";
import { runKql } from "../azureClient.js";
import { textResult, type ToolDefinition } from "./types.js";

const schema = {
  operationId: z
    .string()
    .min(1)
    .describe("The operation_Id (or operation_ParentId) returned as sampleOperationId by get_recent_exceptions or get_failed_requests."),
  hoursBack: z
    .number()
    .int()
    .min(1)
    .max(168)
    .default(168)
    .describe("How many hours back to search for this operation (defaults to the full 7-day retention window)."),
};

function escapeKqlString(value: string): string {
  return value.replace(/'/g, "\\'");
}

const KQL_TEMPLATE = `
union exceptions, requests, traces
| where operation_Id == '{operationId}' or operation_ParentId == '{operationId}'
| project timestamp, itemType, message=coalesce(outerMessage, message, ""), severityLevel, resultCode, name, duration, details
| order by timestamp asc
`;

export const exceptionDetailTool: ToolDefinition<typeof schema> = {
  name: "get_exception_detail",
  description:
    "Get the full correlated timeline (exception, request, and trace records) for one operation, to see the full context of a single failure before proposing a fix.",
  schema,
  handler: async (client, resourceId, args) => {
    const kql = KQL_TEMPLATE.replaceAll("{operationId}", escapeKqlString(args.operationId));
    const { rows, truncated } = await runKql(client, resourceId, kql, args.hoursBack);
    return textResult(rows, truncated);
  },
};
