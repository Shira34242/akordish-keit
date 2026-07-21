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
  top: z.number().int().min(1).max(50).default(20).describe("Max number of exception groups to return."),
};

const KQL = `
exceptions
| summarize
    count=count(),
    lastSeen=max(timestamp),
    sampleOperationId=any(operation_Id),
    sampleMessage=any(outerMessage),
    sampleStack=any(details[0].rawStack)
  by problemId, type, method
| order by count desc
| take {top}
`;

export const recentExceptionsTool: ToolDefinition<typeof schema> = {
  name: "get_recent_exceptions",
  description:
    "List production exceptions from Application Insights, grouped by problem, with counts and a sample stack trace. Use this first to see what's currently failing.",
  schema,
  handler: async (client, resourceId, args) => {
    const kql = KQL.replace("{top}", String(args.top));
    const { rows, truncated } = await runKql(client, resourceId, kql, args.hoursBack);
    return textResult(rows, truncated);
  },
};
