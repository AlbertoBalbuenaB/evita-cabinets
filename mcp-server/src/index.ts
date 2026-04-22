import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.ts';

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdio transport keeps the process alive until the client disconnects.
  // Stderr is safe for logging; stdout is reserved for the JSON-RPC stream.
  process.stderr.write('[evita-mcp] Server listening on stdio\n');
}

main().catch((err) => {
  process.stderr.write(`[evita-mcp] fatal: ${err?.stack ?? err}\n`);
  process.exit(1);
});
