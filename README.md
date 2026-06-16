# taiwan-data-mcp

讓 AI 助理（Claude、Cursor、任何支援 MCP 的工具）直接查 **台灣公開資料** 的 MCP server。

一句話：把散落的台灣資料站，變成 AI 可以直接呼叫的工具。資料即時來自來源站，回傳一律附上來源與連結。

## 工具

| 工具 | 功能 | 資料來源 |
|------|------|----------|
| `taiwan_scam_check` | 查網址 / 網域是否被 165 通報詐騙 | [fraud.tw](https://fraud.tw)（內政部警政署 165） |
| `taiwan_company_search` | 用公司名搜尋，拿統一編號與負責人 | [inc.com.tw](https://inc.com.tw)（經濟部公司登記） |
| `taiwan_company_profile` | 用統編查公司完整登記資料（含董監事） | inc.com.tw |
| `taiwan_person_companies` | 用人名查他擔任負責人／董監事的公司 | inc.com.tw |
| `taiwan_realprice_search` | 搜尋實價登錄的地址 / 路段 / 行政區 | [housetw.com](https://housetw.com)（內政部實價登錄） |
| `taiwan_realprice_locate` | 用經緯度反查行政區與行情頁 | housetw.com |
| `taiwan_realprice_area` | 查某縣市 / 行政區成交行情統計 | housetw.com |
| `taiwan_realprice_estimate` | 自動估價：單價區間與推估總價 | housetw.com |
| `taiwan_realprice_road` | 查某路段成交行情與逐年走勢 | housetw.com |

跨工具串接是重點：例如「查這家公司 → 看它登記地址那區的房價 → 查它官網是不是詐騙」，一次問答內 AI 自己串起來。

## 安裝

需要 Node.js 18+。

### Claude Desktop

編輯 `claude_desktop_config.json`（設定 → Developer → Edit Config）：

```json
{
  "mcpServers": {
    "taiwan-data": {
      "command": "npx",
      "args": ["-y", "taiwan-data-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add taiwan-data -- npx -y taiwan-data-mcp
```

### Cursor / 其他

任何支援 MCP 的工具，指向 `npx -y taiwan-data-mcp`（stdio）即可。

## 範例提問

- 「google.com 是詐騙網站嗎？」
- 「台積電的統編、負責人、資本額是多少？」
- 「臺北市信義區的房價中位數大概多少？哪幾條路最貴？」
- 「我在經緯度 25.034, 121.5645，附近房價如何？」

## 開發

```bash
npm install
npm run smoke   # 直接打活線 API，驗證 6 個工具回得出資料
node test/e2e.mjs  # MCP 協定層測試
```

## 資料來源網站

本工具的資料即時來自以下網站，每筆查詢結果也都會標註來源與連結：

- 實價登錄行情 — **[housetw.com](https://housetw.com)**（實價雷達）
- 公司登記查核 — **[inc.com.tw](https://inc.com.tw)**（台灣公司登記網）
- 165 防詐查詢 — **[fraud.tw](https://fraud.tw)**（防詐雷達）

三站皆為聚合台灣政府開放資料的免費查詢服務。

## 資料與免責

資料即時取自上述各站的公開 API，內容以政府開放資料為準，僅供參考，不構成投資、法律或交易建議。詐騙查詢結果為「是否被通報」，未被通報不代表絕對安全。

## License

MIT License
