// Match real domains and distinguish services on the same platform.
const rules = [
  ['AI 助手','chatgpt.com openai.com claude.ai gemini.google.com deepseek.com kimi.com kimi.moonshot.cn doubao.com perplexity.ai copilot.microsoft.com',/\b(chatgpt|claude|gemini|deepseek|kimi|copilot|perplexity)\b|通义|豆包|AI 助手/i],
  ['开发工具','github.com gitlab.com gitee.com gitcode.com cloudflare.com vscode.dev stackoverflow.com developer.mozilla.org codepen.io vercel.com npmjs.com',/\b(github|gitlab|gitee|gitcode|cloudflare|vscode|mdn|codepen|vercel)\b|VS Code|开发|编程/i],
  ['音乐','spotify.com music.163.com y.qq.com music.douban.com music.youtube.com soundcloud.com bandcamp.com',/\b(spotify|soundcloud|bandcamp)\b|音乐/i],
  ['游戏','steampowered.com epicgames.com itch.io',/\b(steam|epic games)\b|游戏/i],
  ['影音','bilibili.com youtube.com netflix.com iqiyi.com v.qq.com twitch.tv movie.douban.com',/\b(youtube|netflix|bilibili|twitch)\b|B站|视频|番剧|动漫|电影|漫画|爱奇艺/i],
  ['翻译工具','translate.google.com fanyi.baidu.com deepl.com',/\b(deepl|translator)\b|翻译/i],
  ['学习阅读','xuetangx.com worldcat.org scholar.google.com wolframalpha.com icourse163.org coursera.org arxiv.org wikipedia.org zhihu.com book.douban.com',/\b(scholar|arxiv|wikipedia|coursera|wolfram)\b|课程|图书|学术|计算|阅读|知乎/i],
  ['社交','x.com twitter.com telegram.org web.telegram.org discord.com weibo.com wx.qq.com qzone.qq.com',/^(X|Telegram|Twitter|Discord)$|微信|QQ空间|微博|社交/i],
  ['效率办公','notion.so notion.com mail.google.com outlook.live.com mail.qq.com todoist.com calendar.google.com keep.google.com docs.google.com drive.google.com feishu.cn dingtalk.com pan.baidu.com',/\b(notion|todoist|outlook|calendar)\b|邮箱|日历|网盘|云文档|飞书|钉钉|待办/i],
  ['生活','taobao.com jd.com maps.google.com amap.com meituan.com ctrip.com ele.me',/购物|外卖|地图|旅行|美团|携程/i],
  ['设计工具','figma.com unsplash.com squoosh.app tinypng.com canva.com',/\b(figma|unsplash|squoosh|tinypng|canva)\b|设计|压缩|截图/i],
  ['搜索','google.com bing.com baidu.com',/^(Google|Bing|百度|搜索)$/i]
];
const semanticSegments=new Set('anime bangumi manga movie movies music video videos watch live translate translator scholar books book library course courses learn learning study docs documentation calendar mail maps games game code developer tutorials ai chat copilot'.split(' '));
export function organizationSignals(app){
  let url;try{url=new URL(app.url);}catch{return {domain:'',path:''};}
  const path=url.pathname.toLowerCase().split('/').filter(part=>semanticSegments.has(part)).slice(0,4).join('/');
  return {domain:url.hostname.toLowerCase(),path:path?'/'+path:''};
}
function purpose(app){
  const {domain,path}=organizationSignals(app),scores=[];
  for(const [name,hosts,pattern] of rules){
    const matches=hosts.split(' ').filter(host=>domain===host||domain.endsWith('.'+host));
    let score=matches.length?100+Math.max(...matches.map(host=>host.split('.').length*5)):0;
    if(pattern.test(app.name))score=Math.max(score,80);
    if(name==='AI 助手'&&/\/(copilot|ai|chat)\b/.test(path)&&/(github\.com|bing\.com)$/.test(domain))score=150;
    if(name==='学习阅读'&&/\/(course|courses|learn|learning|study|tutorials)\b/.test(path))score=140;
    if(name==='音乐'&&/\/(music)\b/.test(path))score=140;
    if(name==='翻译工具'&&/\/(translate|translator)\b/.test(path))score=140;
    if(score>=80)scores.push({name,score});
  }
  scores.sort((a,b)=>b.score-a.score);
  if(!scores.length||scores[0].score===scores[1]?.score)return null;
  return scores[0].name;
}

export function suggestGroups(apps) {
  const groups = new Map();
  for (const app of apps) {
    if (app.system) continue;
    const name = purpose(app);
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
    if(entry.confidence!==undefined&&(!Number.isFinite(entry.confidence)||entry.confidence<.72||entry.confidence>1))continue;
    const name = entry.name.trim().slice(0,32);
    if (!name) continue;
    const appIds = [...new Set(entry.appIds)].filter(id => typeof id === 'string' && allowed.has(id) && !used.has(id));
    if (appIds.length < 2) continue;
    appIds.forEach(id => used.add(id));
    const group={name,appIds};
    if(typeof entry.reason==='string'&&entry.reason.trim())group.reason=entry.reason.trim().slice(0,120);
    if(entry.confidence!==undefined)group.confidence=entry.confidence;
    groups.push(group);
  }
  return groups;
}

// Fit only complete app cells. Reserve the last cell for overflow, like a large phone folder.
export function folderMetrics(width, height, compact = false) {
  if (compact) return {columns:3,rows:3,capacity:9,icon:12};
  const padding = 10, header = 26, gap = 6;
  const usableWidth = Math.max(24,width-padding*2), usableHeight = Math.max(24,height-padding*2-header);
  const columns = Math.max(1,Math.floor((usableWidth+gap)/58));
  const rows = Math.max(1,Math.round((usableHeight+gap)/84));
  const cellWidth = (usableWidth-gap*(columns-1))/columns;
  const cellHeight = (usableHeight-gap*(rows-1))/rows;
  const labels = cellHeight >= 66;
  const icon = Math.max(18,Math.floor(Math.min(52,cellWidth-4,cellHeight-(labels?39:4))));
  return {columns,rows,capacity:columns*rows,icon,labels};
}
