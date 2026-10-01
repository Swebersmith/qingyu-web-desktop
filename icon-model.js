import {appPurpose} from './organizer.js';

export const ICON_DESIGN_VERSION=2;
export const ICON_SYMBOLS=['globe','code','book','play','music','chat','mail','cloud','folder','chart','camera','game','tools','science','map','cart','calendar','star','shield','sparkles','bot','translate','search','document','design','download','news','flight'];
const shapes={globe:'<circle cx="48" cy="48" r="23"/><ellipse cx="48" cy="48" rx="10" ry="23"/><path d="M25 48h46M29 36h38M29 60h38"/>',code:'<path d="m37 33-15 15 15 15m22-30 15 15-15 15M53 27 43 69"/>',book:'<path d="M48 32c-9-7-19-8-28-5v38c10-3 20-2 28 5 8-7 18-8 28-5V27c-9-3-19-2-28 5v38"/>',play:'<rect x="21" y="26" width="54" height="44" rx="12"/><path d="m42 37 17 11-17 11Z"/>',music:'<path d="M42 62V29l28-6v33M42 40l28-6"/><ellipse cx="33" cy="64" rx="9" ry="7"/><ellipse cx="61" cy="58" rx="9" ry="7"/>',chat:'<path d="M23 28h50v33H42L27 72V61h-4Z"/><path d="M34 40h28M34 50h18"/>',mail:'<rect x="20" y="29" width="56" height="39" rx="9"/><path d="m23 33 25 20 25-20"/>',cloud:'<path d="M30 65h39a13 13 0 0 0 1-26 21 21 0 0 0-40-4 15 15 0 0 0 0 30Z"/>',folder:'<path d="M20 34v32a6 6 0 0 0 6 6h44a6 6 0 0 0 6-6V36a6 6 0 0 0-6-6H46l-6-7H26a6 6 0 0 0-6 6Zm0 8h56"/>',chart:'<path d="M22 23v50h54M33 60V47m15 13V35m15 25V26"/>',camera:'<path d="M20 34h13l6-10h18l6 10h13v38H20Z"/><circle cx="48" cy="52" r="13"/>',game:'<path d="M32 33h32c9 0 18 27 13 35-5 7-13-5-19-9H38c-6 4-14 16-19 9-5-8 4-35 13-35Z"/><path d="M33 42v14m-7-7h14M61 44h.1M68 52h.1"/>',tools:'<path d="m23 23 15 15m-10 2 12-12M61 24l-8 8 11 11 8-8c8 16-5 28-19 22L31 77 19 65l22-22c-7-15 6-29 20-19Z"/>',science:'<path d="M37 20h22M40 20v22L22 70c-2 4 1 6 5 6h42c4 0 7-2 5-6L56 42V20M32 56h32"/>',map:'<path d="m20 30 19-7 18 7 19-7v43l-19 7-18-7-19 7Zm19-7v43m18-36v43"/>',cart:'<path d="M18 23h9l10 38h31l9-27H31M40 72h.1M66 72h.1"/>',calendar:'<rect x="22" y="28" width="52" height="45" rx="8"/><path d="M34 21v14m28-14v14M22 42h52M34 53h10m8 0h10M34 63h10"/>',star:'<path d="m48 21 9 18 20 3-15 15 4 21-18-10-18 10 4-21-15-15 20-3Z"/>',shield:'<path d="m48 20 24 10v19c0 12-10 23-24 28-14-5-24-16-24-28V30ZM36 48l9 9 16-20"/>',sparkles:'<path d="m48 21 7 20 20 7-20 7-7 20-7-20-20-7 20-7ZM72 18v14m-7-7h14M23 66v12m-6-6h12"/>'};
const luminance=color=>{const [r,g,b]=[1,3,5].map(at=>parseInt(color.slice(at,at+2),16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);return .2126*r+.7152*g+.0722*b;};
Object.assign(shapes,{
 bot:'<rect x="24" y="31" width="48" height="38" rx="11"/><path d="M48 21v10M18 43v15m60-15v15M36 57h24"/><circle cx="37" cy="45" r="2"/><circle cx="59" cy="45" r="2"/>',
 translate:'<path d="M18 31h34M35 22v9M25 38c5 15 13 24 28 29M47 31C44 48 33 62 20 68M54 70l12-34 12 34M59 59h14"/>',
 search:'<circle cx="42" cy="42" r="22"/><path d="m59 59 18 18"/>',
 document:'<path d="M26 20h29l16 17v39H26ZM55 20v17h16M36 49h24M36 60h20"/>',
 design:'<path d="m48 20 24 28-24 28-24-28ZM48 20v20"/><circle cx="48" cy="48" r="7"/>',
 download:'<path d="M48 20v39M32 44l16 16 16-16M23 62v14h50V62"/>',
 news:'<rect x="21" y="25" width="54" height="48" rx="5"/><path d="M31 37h14v13H31ZM54 37h12M54 47h12M31 61h35"/>',
 flight:'<path d="m48 20 5 23 25 16v8L53 56l-1 14 9 7v5l-13-5-13 5v-5l9-7-1-14-25 11v-8l25-16Z"/>'
});
const cleanText=(value,max)=>Array.from(String(value||'').normalize('NFKC').replace(/[^\p{L}\p{N}]/gu,'')).slice(0,max).join('');
const contrastRatio=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
export function validateIconDesign(value){
 if(!value||!ICON_SYMBOLS.includes(value.symbol)||!/^#[\da-f]{6}$/i.test(value.background)||!/^#[\da-f]{6}$/i.test(value.foreground))return null;
 let foreground=value.foreground;
 if(contrastRatio(value.background,foreground)<4.5)foreground=contrastRatio(value.background,'#203E48')>=4.5?'#203E48':contrastRatio(value.background,'#FFFFFF')>=4.5?'#FFFFFF':contrastRatio(value.background,'#10232B')>=4.5?'#10232B':'#000000';
 const label=cleanText(value.label,/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(String(value.label))?2:4),caption=cleanText(value.caption,12);
 return {symbol:value.symbol,background:value.background,foreground,label,...(caption?{caption}:{}),...(value.version===ICON_DESIGN_VERSION?{version:ICON_DESIGN_VERSION}:{})};
}

// Exact domains and their subdomains identify sites; similar-looking domain
// substrings do not. These are independent fallback designs, not copied logos.
const siteProfiles=[
 ['scholar.google.com','学术','Scholar','#4165AC','book'],['translate.google.com','译','Translate','#3B70D0','translate'],['calendar.google.com','日历','Calendar','#2877BC','calendar'],['mail.google.com','GM','Gmail','#B9403C','mail'],['drive.google.com','GD','Drive','#237A55','cloud'],
 ['pan.baidu.com','度盘','百度网盘','#2A65B1','cloud'],['tieba.baidu.com','贴吧','百度贴吧','#316CCC','chat'],['music.youtube.com','YM','YTMusic','#B32335','music'],['music.apple.com','AM','AppleMusic','#BE364F','music'],['movie.douban.com','豆影','豆瓣电影','#277644','play'],['music.douban.com','豆音','豆瓣音乐','#277644','music'],['book.douban.com','豆书','豆瓣读书','#277644','book'],
 ['github.com','GH','GitHub','#24292F','code'],['gitlab.com','GL','GitLab','#B84920','code'],['gitee.com','码云','Gitee','#BF303B','code'],['gitcode.com','GC','GitCode','#C72D46','code'],
 ['chatgpt.com','GPT','ChatGPT','#167D65','bot'],['openai.com','OA','OpenAI','#216B60','bot'],['claude.ai','CL','Claude','#995E3D','bot'],['deepseek.com','DS','DeepSeek','#3266C1','bot'],['gemini.google.com','GM','Gemini','#5E50B6','bot'],['kimi.com','K','Kimi','#35466B','bot'],['kimi.moonshot.cn','K','Kimi','#35466B','bot'],['doubao.com','豆包','Doubao','#315ED0','bot'],['poe.com','POE','Poe','#6243A6','bot'],
 ['bilibili.com','哔哩','B站','#B93568','play'],['youtube.com','YT','YouTube','#C7272D','play'],['netflix.com','N','Netflix','#AD1727','play'],['iqiyi.com','爱奇','爱奇艺','#257E3B','play'],['v.qq.com','腾讯','腾讯视频','#24766B','play'],['twitch.tv','TW','Twitch','#7544B1','play'],
 ['music.163.com','云音','网易云音乐','#B92D38','music'],['open.spotify.com','SP','Spotify','#167C3D','music'],['spotify.com','SP','Spotify','#167C3D','music'],['y.qq.com','QQ','QQ音乐','#168068','music'],
 ['zhihu.com','知','知乎','#225CCC','book'],['douban.com','豆','豆瓣','#277644','book'],['wikipedia.org','W','Wikipedia','#41494C','book'],['cnki.net','知网','CNKI','#376598','book'],['arxiv.org','AX','arXiv','#995142','science'],['wolframalpha.com','WA','Wolfram','#AC3E2B','science'],
 ['notion.so','N','Notion','#252E32','document'],['notion.com','N','Notion','#252E32','document'],['feishu.cn','飞书','Feishu','#3762CF','document'],['yuque.com','语雀','Yuque','#237C50','document'],['docs.qq.com','腾讯','腾讯文档','#2D64BD','document'],['outlook.live.com','OL','Outlook','#236EB6','mail'],
 ['telegram.org','TG','Telegram','#257FAD','chat'],['web.telegram.org','TG','Telegram','#257FAD','chat'],['x.com','X','X','#202329','chat'],['twitter.com','X','X','#202329','chat'],['discord.com','DC','Discord','#5453BB','chat'],['wx.qq.com','微信','WeChat','#237D41','chat'],
 ['figma.com','FIG','Figma','#974C49','design'],['canva.com','CV','Canva','#21798C','design'],['developer.mozilla.org','MDN','MDN','#263A40','code'],['stackoverflow.com','SO','StackOverflow','#AD5724','code'],['codepen.io','CP','CodePen','#25353E','code'],['vercel.com','V','Vercel','#24282D','code'],
 ['taobao.com','淘','淘宝','#B64B12','cart'],['jd.com','京东','JD','#BC2835','cart'],['amap.com','高德','高德地图','#2874B4','map'],['maps.google.com','地图','GoogleMaps','#2C7A50','map'],['deepl.com','DL','DeepL','#173D57','translate'],
 ['google.com','G','Google','#386ACA','search'],['bing.com','B','Bing','#176D7C','search'],['baidu.com','百度','Baidu','#305CCB','search']
];
const genericLabels=new Set(['网站','网页','官网','首页','工具','资料','学习','阅读','视频','音乐','搜索','开发','在线','我的','收藏','常用','网盘','邮箱','日历','文件','翻译','电影','漫画','游戏','导航','效率','应用','文档','笔记','论坛','社区','相册','商城','购物','WEB','WWW','HTTP','AI','APP','TOOL']);
function domainWord(host){const suffix=['pages.dev','workers.dev','github.io','gitlab.io','gitee.io','vercel.app','netlify.app','notion.site','appspot.com'].find(domain=>host.endsWith('.'+domain));if(suffix)return host.slice(0,-suffix.length-1).split('.').at(-1);const parts=host.replace(/^www\d*\./,'').split('.');return parts.length>2&&['com','net','org','co','ac','edu','gov'].includes(parts.at(-2))?parts.at(-3):parts.length>1?parts.at(-2):parts[0];}
function purposeSymbol(app){
 const name=String(app.name||'');
 for(const [pattern,symbol]of [[/邮箱|邮件|\bmail\b/i,'mail'],[/地图|\bmaps?\b/i,'map'],[/相册|摄影|\bphotos?\b/i,'camera'],[/日历|\bcalendar\b/i,'calendar'],[/下载|\bdownload\b/i,'download'],[/新闻|\bnews\b/i,'news'],[/旅行|航班|\btravel\b/i,'flight'],[/笔记|文档|\b(notes?|docs?|documents?)\b/i,'document'],[/音乐|\bmusic\b/i,'music'],[/阅读|图书|\b(reader|reading|books?|library|courses?|study)\b/i,'book'],[/\bAI\b|智能助手/i,'bot']])if(pattern.test(name))return symbol;
 try{return {'AI 助手':'bot','开发工具':'code','学习阅读':'book','翻译工具':'translate','影音':'play','音乐':'music','社交':'chat','效率办公':'document','生活':'cart','设计工具':'design','搜索':'search','游戏':'game'}[appPurpose(app)]||'globe';}catch{return 'globe';}
}
export function siteIconIdentity(app){
 let host='';try{host=new URL(app.url).hostname.toLowerCase();}catch{}
 let profile=siteProfiles.find(([domain])=>host===domain||host.endsWith('.'+domain));
 if((host==='google.com'||host==='www.google.com')&&/地图|Google Maps/i.test(app.name||''))profile=siteProfiles.find(([domain])=>domain==='maps.google.com');
 if(profile){const [,label,caption,background,symbol]=profile;return {label,caption,background,foreground:'#FFFFFF',symbol,known:true};}
 const name=String(app.name||'').normalize('NFKC').replace(/^(?:我的|常用|收藏的|官方)/,'').replace(/(?:官方网站|官方站点|官网|首页)$/,'').trim(),word=domainWord(host),letters=cleanText(name,64),latin=name.match(/[A-Za-z][A-Za-z0-9]*/g)||[];
 let label;
 if(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(name))label=cleanText(name,2);
 else if(latin.length>1)label=latin.slice(0,4).map(part=>part[0]).join('').toUpperCase();
 else{const capitals=latin[0]?.match(/[A-Z]/g)||[];label=capitals.length>=2?capitals.slice(0,4).join(''):cleanText(latin[0]||letters||word,4).toUpperCase();}
 if(!label||genericLabels.has(label.toUpperCase()))label=cleanText(word,4).toUpperCase()||'站';
 const caption=cleanText(genericLabels.has(letters.toUpperCase())?word:letters&&letters.length<=12?letters:word||letters,/[\p{Script=Han}]/u.test(letters)&&!genericLabels.has(letters.toUpperCase())?6:12);
 return {label,caption,symbol:purposeSymbol(app),known:false};
}
export function recognizableIconDesign(design,app){
 const value=validateIconDesign(design);if(!value)return null;const identity=siteIconIdentity(app);
 if(identity.known)return validateIconDesign({...value,...identity,version:ICON_DESIGN_VERSION});
 const context=cleanText(`${app.name||''}${identity.label}${new URL(app.url).hostname}`,200).toLocaleUpperCase(),candidate=value.label;
 const associated=candidate&&(Array.from(candidate).length>=2||Array.from(identity.label).length===1)&&Array.from(candidate.toLocaleUpperCase()).every(char=>context.includes(char))&&!genericLabels.has(candidate.toLocaleUpperCase());
 return validateIconDesign({...value,symbol:value.symbol==='globe'&&identity.symbol!=='globe'?identity.symbol:value.symbol,label:associated?candidate:identity.label,caption:identity.caption,version:ICON_DESIGN_VERSION});
}
export function iconSVG(design){
 const value=validateIconDesign(design);if(!value)throw Error('invalid_icon_design');const {background,foreground,symbol,label,caption}=value;
 const length=Array.from(label).length,isCJK=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(label),fontSize=isCJK?length===1?48:35:length<=1?53:length===2?42:length===3?33:27;
 const main=label?`<text x="48" y="${caption?55:60}" text-anchor="middle" fill="${foreground}" font-size="${fontSize}" font-weight="800" letter-spacing="${isCJK?0:-1}" font-family="system-ui,-apple-system,Segoe UI,Microsoft YaHei,PingFang SC,sans-serif">${label}</text>`:`<g fill="none" stroke="${foreground}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">${shapes[symbol]}</g>`;
 const badge=label?`<rect x="66" y="66" width="24" height="24" rx="8" fill="${foreground}" fill-opacity=".16"/><g transform="translate(66 66) scale(.25)" fill="none" stroke="${foreground}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">${shapes[symbol]}</g>`:'';
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><title>${caption||label||symbol}</title><rect width="96" height="96" rx="27" fill="${background}"/>${main}${caption?`<text x="${label?35:48}" y="80" text-anchor="middle" fill="${foreground}" font-size="${Array.from(caption).length>9?8:10}" font-weight="650" font-family="system-ui,Microsoft YaHei,PingFang SC,sans-serif">${caption}</text>`:''}${badge}</svg>`;
}
export const iconDataURL=design=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(iconSVG(design));
export function localIconDesign(app){let hash=0;for(const char of new URL(app.url).hostname)hash=(hash*31+char.charCodeAt(0))>>>0;const colors=['#326C78','#625891','#955B3E','#386F59','#3A618F','#954667'],identity=siteIconIdentity(app);return validateIconDesign({background:colors[hash%colors.length],foreground:'#FFFFFF',...identity,version:ICON_DESIGN_VERSION});}
export function publicSite(value){try{const url=new URL(value),host=url.hostname.toLowerCase();if(!['http:','https:'].includes(url.protocol)||url.username||url.password||(url.port&&!['80','443'].includes(url.port))||!host.includes('.')||host.endsWith('.local')||host.endsWith('.internal')||host==='localhost'||host.endsWith('.localhost')||host.includes(':')||/^[\d.]+$/.test(host))return null;return url;}catch{return null;}}
export function discoverIconLinks(html,base){const links=[];for(const tag of html.match(/<link\b[^>]{0,4096}>/gi)||[]){const attrs={};for(const attr of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))attrs[attr[1].toLowerCase()]=(attr[2]??attr[3]??attr[4]).replace(/&amp;/g,'&');if(!/(?:^|\s)(?:icon|apple-touch-icon|apple-touch-icon-precomposed)(?:\s|$)/i.test(attrs.rel||''))continue;try{const url=new URL(attrs.href,base);if(!attrs.href||!publicSite(url.href))continue;links.push({url:url.href,score:/apple-touch/i.test(attrs.rel)?180:parseInt(attrs.sizes)||32});}catch{}}return [...new Set(links.sort((a,b)=>b.score-a.score).map(item=>item.url))].slice(0,5);}
