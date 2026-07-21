import type { LogsQueryClient } from "@azure/monitor-query";
import type { ZodRawShape, z } from "zod";

export interface ToolDefinition<Shape extends ZodRawShape> {
  name: string;
  description: string;
  schema: Shape;
  handler: (
    client: LogsQueryClient,
    resourceId: string,
    args: z.objectOutputType<Shape, z.ZodTypeAny>,
  ) => Promise<{ content: { type: "text"; text: string }[] }>;
}

export function textResult(rows: unknown[], truncated: boolean) {
  const body = JSON.stringify(rows, null, 2);
  const note = truncated
    ? "\n\n(Results truncated at 50 rows — narrow the time range or filters for more detail.)"
    : "";
  return {
    content: [{ type: "text" as const, text: body + note }],
  };
}
