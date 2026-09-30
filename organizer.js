// Classification is a suggestion: unknown sites stay on the desktop.
const rules = [
  ['AI 助手', /chatgpt|openai|claude|gemini|deepseek|kimi|通义|豆包|copilot|perplexity/i],
  ['开发工具', /github|gitlab|gitee|gitcode|cloudflare|vscode|stack.?overflow|developer\.mozilla|codepen|vercel|开发|编程/i],
  ['音乐', /spotify|music|音乐|soundcloud|bandcamp/i],
  ['游戏', /steampowered|epicgames|游戏|game|itch\.io/i],
  ['影音', /bilibili|youtube|netflix|iqiyi|v\.qq|twitch|movie|视频|番剧|动漫|电影|漫画/i],
  ['学习阅读', /xuetang|worldcat|scholar|wolfram|icourse|coursera|arxiv|wikipedia|translate|deepl|zhihu|douban|课程|图书|翻译|学术|计算|阅读/i],
  ['社交', /(^|\s)x(\s|$)|x\.com|twitter|telegram|微信|qq空间|discord|weibo|社交/i],
  ['效率办公', /notion|mail|todo|calendar|keep|docs|drive|邮箱|日历|网盘|文档|飞书|钉钉/i],
  ['生活', /taobao|jd\.com|maps|购物|外卖|地图|旅行|美团|携程/i],
  ['设计工具', /figma|unsplash|squoosh|tinypng|canva|设计|压缩|截图/i],
  ['搜索', /google|bing\.com|baidu|搜索/i]
];

export function suggestGroups(apps) {
  const groups = new Map();
  for (const app of apps) {
    if (app.system) continue;
    let host = '';
    try { host = new URL(app.url).hostname; } catch { /* Unknown apps remain ungrouped. */ }
    const name = rules.find(([,pattern]) => pattern.test(`${app.name} ${host}`))?.[0];
    if (!name) continue;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(app.id);
  }
  return validateGroups([...groups].map(([name,appIds]) => ({name,appIds})), apps);
}

export function validateGroups(raw, apps) {
  const allowed = new Set(apps.filter(app => !app.system).map(app => app.id));
  const used = new Set(), groups = [];
  if (!Array.isArray(raw)) return groups;
  for (const entry of raw.slice(0,40)) {
    if (!entry || typeof entry.name !== 'string' || !Array.isArray(entry.appIds)) continue;
    const name = entry.name.trim().slice(0,32);
    if (!name) continue;
    const appIds = [...new Set(entry.appIds)].filter(id => typeof id === 'string' && allowed.has(id) && !used.has(id));
    if (appIds.length < 2) continue;
    appIds.forEach(id => used.add(id));
    groups.push({name,appIds});
  }
  return groups;
}

// Fit only complete app cells. Reserve the last cell for overflow, like a large phone folder.
export function folderMetrics(width, height, compact = false) {
  if (compact) return {columns:3,rows:3,capacity:9,icon:12};
  const padding = 10, header = 26, gap = 6;
  const usableWidth = Math.max(24,width-padding*2), usableHeight = Math.max(24,height-padding*2-header);
  const columns = Math.max(1,Math.floor((usableWidth+gap)/58));
  const rows = Math.max(1,Math.round((usableHeight+gap)/64));
  const cellWidth = (usableWidth-gap*(columns-1))/columns;
  const cellHeight = (usableHeight-gap*(rows-1))/rows;
  const labels = cellHeight >= 51;
  const icon = Math.max(18,Math.floor(Math.min(52,cellWidth-4,cellHeight-(labels?19:4))));
  return {columns,rows,capacity:columns*rows,icon,labels};
}
