// 直接打活線 API，確認每個工具回得出真實資料。
import {
  scamCheck, companySearch, companyProfile,
  realpriceSearch, realpriceLocate, realpriceArea,
} from '../src/sources.mjs';

const cases = [
  ['taiwan_scam_check', () => scamCheck('https://www.google.com/abc')],
  ['taiwan_company_search', () => companySearch('台積電')],
  ['taiwan_company_profile', () => companyProfile('22099131')],
  ['taiwan_realprice_search', () => realpriceSearch('信義區')],
  ['taiwan_realprice_locate', () => realpriceLocate(25.034, 121.5645)],
  ['taiwan_realprice_area', () => realpriceArea('臺北市', '信義區')],
];

let pass = 0;
for (const [name, fn] of cases) {
  try {
    const r = await fn();
    const ok = r && !r.error;
    if (ok) pass++;
    console.log(`\n${ok ? '✅' : '❌'} ${name}`);
    console.log(JSON.stringify(r, null, 2).split('\n').slice(0, 14).join('\n'));
  } catch (e) {
    console.log(`\n💥 ${name}: ${e?.message || e}`);
  }
}
console.log(`\n── ${pass}/${cases.length} tools returned data ──`);
process.exit(pass === cases.length ? 0 : 1);
