import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerSearchTools } from './search.ts';
import { registerKbWikiTools } from './kb_wiki.ts';
import { registerProjectTools } from './projects.ts';
import { registerInventoryTools } from './inventory.ts';
import { registerComputeTools } from './compute.ts';

export function registerAllTools(server: McpServer): void {
  registerSearchTools(server);
  registerKbWikiTools(server);
  registerProjectTools(server);
  registerInventoryTools(server);
  registerComputeTools(server);
}
