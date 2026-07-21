import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLogsQueryClient } from "./azureClient.js";
import { loadConfig } from "./config.js";
import { exceptionDetailTool } from "./tools/exceptionDetail.js";
import { failedRequestsTool } from "./tools/failedRequests.js";
import { recentExceptionsTool } from "./tools/recentExceptions.js";
import type { ToolDefinition } from "./tools/types.js";

const config = loadConfig();
const logsClient = createLogsQueryClient(config);
const resourceId = config.APPINSIGHTS_RESOURCE_ID;

const server = new McpServer({
  name: "app-insights-logs",
  version: "1.0.0",
});

const tools: ToolDefinition<any>[] = [recentExceptionsTool, exceptionDetailTool, failedRequestsTool];

for (const tool of tools) {
  server.tool(tool.name, tool.description, tool.schema, (args: Record<string, unknown>) =>
    tool.handler(logsClient, resourceId, args),
  );
}

await server.connect(new StdioServerTransport());
