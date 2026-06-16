#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  scamCheck, companySearch, companyProfile, personCompanies, companyRisk,
  realpriceSearch, realpriceLocate, realpriceArea, realpriceEstimate, realpriceRoad,
} from './sources.mjs';

const TOOLS = [
  {
    name: 'taiwan_scam_check',
    description:
      '查詢某網址 / 網域是否被內政部警政署 165 反詐騙通報為詐騙或涉詐網站。輸入網址或網域（如 example.com 或完整 URL）。回傳風險等級、通報情形與來源連結。資料來源：fraud.tw（165 開放資料）。',
    inputSchema: {
      type: 'object',
      properties: { domain: { type: 'string', description: '要查詢的網址或網域，例如 example.com、https://www.example.com' } },
      required: ['domain'],
    },
    run: (a) => scamCheck(a.domain),
  },
  {
    name: 'taiwan_company_search',
    description:
      '用公司名稱（或關鍵字）搜尋台灣公司，回傳符合的公司清單與其統一編號、負責人。要拿到完整資料請接著用 taiwan_company_profile 查統編。資料來源：inc.com.tw（經濟部公司登記）。',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: '公司名稱或關鍵字，例如「台積電」「鴻海精密」' } },
      required: ['name'],
    },
    run: (a) => companySearch(a.name),
  },
  {
    name: 'taiwan_company_profile',
    description:
      '用 8 位統一編號查台灣公司完整登記資料：名稱、負責人、資本額、實收資本、設立日期、登記地址、營業項目、狀態、上市櫃與進出口資格等。資料來源：inc.com.tw。',
    inputSchema: {
      type: 'object',
      properties: { unified_business_no: { type: 'string', description: '8 位統一編號，例如 22099131' } },
      required: ['unified_business_no'],
    },
    run: (a) => companyProfile(a.unified_business_no),
  },
  {
    name: 'taiwan_person_companies',
    description:
      '用人名查他擔任「負責人／董監事」的台灣公司，回傳關聯公司數與範例公司（公司關係／查老闆人脈用）。以姓名比對，可能含同名同姓。資料來源：inc.com.tw。',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: '人名，例如「郭台銘」' } },
      required: ['name'],
    },
    run: (a) => personCompanies(a.name),
  },
  {
    name: 'taiwan_company_risk',
    description:
      '公司風險查核（盡職調查紅旗）：用 8 位統編查該公司有無政府採購拒絕往來、勞動法令裁罰、環保裁罰，回傳風險等級與紅旗清單。資料來源：inc.com.tw（聚合政府公開資料）。',
    inputSchema: {
      type: 'object',
      properties: { unified_business_no: { type: 'string', description: '8 位統一編號，例如 22099131' } },
      required: ['unified_business_no'],
    },
    run: (a) => companyRisk(a.unified_business_no),
  },
  {
    name: 'taiwan_realprice_search',
    description:
      '搜尋台灣不動產實價登錄的地址 / 路段 / 行政區，回傳符合項目與成交筆數、連結。用來定位某地址或某區，再看其行情。資料來源：housetw.com（內政部實價登錄）。',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: '地址、路段或行政區關鍵字，例如「信義區」「忠孝東路」' } },
      required: ['query'],
    },
    run: (a) => realpriceSearch(a.query),
  },
  {
    name: 'taiwan_realprice_locate',
    description:
      '用經緯度 (lat,lng) 反查所在的台灣縣市與行政區，並回傳該區實價頁連結。適合「我現在在這個座標，附近房價如何」。資料來源：housetw.com。',
    inputSchema: {
      type: 'object',
      properties: {
        lat: { type: 'number', description: '緯度，例如 25.034' },
        lng: { type: 'number', description: '經度，例如 121.5645' },
      },
      required: ['lat', 'lng'],
    },
    run: (a) => realpriceLocate(a.lat, a.lng),
  },
  {
    name: 'taiwan_realprice_area',
    description:
      '查某縣市 / 行政區的不動產成交行情統計：中位與平均單價（萬/坪）、成交筆數、平均屋齡、價格分位、熱門路段排行。資料來源：housetw.com（內政部實價登錄）。',
    inputSchema: {
      type: 'object',
      properties: {
        county: { type: 'string', description: '縣市，例如「臺北市」「新北市」（用「臺」非「台」）' },
        district: { type: 'string', description: '行政區（可選），例如「信義區」' },
      },
      required: ['county'],
    },
    run: (a) => realpriceArea(a.county, a.district),
  },
  {
    name: 'taiwan_realprice_estimate',
    description:
      '自動估價：輸入縣市+行政區（可加建物型態/屋齡/坪數），回傳可比案例的單價區間（萬/坪）與推估總價。資料來源：housetw.com（內政部實價登錄）。',
    inputSchema: {
      type: 'object',
      properties: {
        county: { type: 'string', description: '縣市，例如「臺北市」（用「臺」非「台」）' },
        district: { type: 'string', description: '行政區，例如「信義區」' },
        building_type: { type: 'string', description: '建物型態（可選），例如「住宅大樓」「公寓」「華廈」' },
        house_age: { type: 'number', description: '屋齡（可選，年）' },
        area_ping: { type: 'number', description: '坪數（可選），給了才會推估總價' },
      },
      required: ['county', 'district'],
    },
    run: (a) => realpriceEstimate(a.county, a.district, { type: a.building_type, age: a.house_age, ping: a.area_ping }),
  },
  {
    name: 'taiwan_realprice_road',
    description:
      '查某路段的不動產成交行情：單價統計（萬/坪）、成交筆數、屋齡與逐年價格走勢。資料來源：housetw.com（內政部實價登錄）。',
    inputSchema: {
      type: 'object',
      properties: {
        county: { type: 'string', description: '縣市，例如「臺北市」' },
        district: { type: 'string', description: '行政區，例如「信義區」' },
        road: { type: 'string', description: '路段，例如「松高路」「忠孝東路四段」' },
      },
      required: ['county', 'district', 'road'],
    },
    run: (a) => realpriceRoad(a.county, a.district, a.road),
  },
];

const server = new Server(
  { name: 'taiwan-data-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = TOOLS.find((t) => t.name === req.params.name);
  if (!tool) return { content: [{ type: 'text', text: `未知工具：${req.params.name}` }], isError: true };
  try {
    const result = await tool.run(req.params.arguments || {});
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], isError: !!result?.error };
  } catch (e) {
    return { content: [{ type: 'text', text: `工具執行錯誤：${e?.message || e}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('taiwan-data-mcp running (stdio) — 10 tools: 防詐 / 公司登記 / 實價登錄');
