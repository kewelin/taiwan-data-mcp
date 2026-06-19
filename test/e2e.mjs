// 用 MCP client 連 stdio server，驗證協定層：list tools + call tool。
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const transport = new StdioClientTransport({
  command: 'node',
  args: [join(here, '..', 'src', 'server.mjs')],
});
const client = new Client({ name: 'e2e', version: '0' }, { capabilities: {} });
await client.connect(transport);

const { tools } = await client.listTools();
console.log(`tools/list → ${tools.length} tools:`);
for (const t of tools) console.log('  •', t.name);

const call = await client.callTool({
  name: 'taiwan_company_profile',
  arguments: { unified_business_no: '22099131' },
});
const text = call.content?.[0]?.text || '';
const obj = JSON.parse(text);
console.log(`\ntools/call taiwan_company_profile(22099131) → name = ${obj.name}, 負責人 = ${obj.representative}`);

const call2 = await client.callTool({
  name: 'taiwan_scam_check',
  arguments: { domain: 'google.com' },
});
console.log(`tools/call taiwan_scam_check(google.com) → risk = ${JSON.parse(call2.content[0].text).risk}`);

const call3 = await client.callTool({
  name: 'taiwan_company_risk',
  arguments: { name: '台積電' },
});
const risk = JSON.parse(call3.content[0].text);
console.log(`tools/call taiwan_company_risk(name=台積電) → ${risk.unified_business_no} ${risk.name}, level = ${risk.risk_level}`);

await client.close();
const names = new Set(tools.map((t) => t.name));
const ok =
  tools.length === 18 &&
  ['taiwan_company_profile', 'taiwan_company_risk', 'taiwan_scam_check', 'taiwan_farm_price'].every((n) => names.has(n)) &&
  obj.name?.includes('台灣積體') &&
  risk.unified_business_no === '22099131';
console.log(`\n${ok ? '✅ MCP 協定層 OK' : '❌ 異常'}`);
process.exit(ok ? 0 : 1);
