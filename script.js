import {suggestGroups, validateGroups, folderMetrics} from './organizer.js';

(() => {
  'use strict';

  const STORAGE_KEY = 'qingyu-desktop-v1';
  const defaults = window.DEFAULT_DESKTOP_CONFIG;
  const $ = (selector, root = document) => root.querySelector(selector);
  const clone = value => JSON.parse(JSON.stringify(value));
  const pageIds = defaults.pages.map(page => page.id);
  const newDefaultAppIds = new Set(['x','telegram','baidu','douban','maps','taobao','mooc','coursera','arxiv','wikipedia','deepl','keep','qqmusic','twitch','doubanmovie','doubanmusic','bilibangumi','epic','stackoverflow','mdn','codepen','vercel','unsplash','tinypng']);
  const quotes = [
    '生活嘛，就是要开心一点。',
    '今天也有值得期待的小事。',
    '把日子过成喜欢的样子。',
    '慢一点，风景会更清楚。',
    '认真生活，也别忘了玩。'
  ];
  const engines = [
    { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=' },
    { id: 'bing', name: 'Bing', url: 'https://www.bing.com/search?q=' },
    { id: 'baidu', name: '百度', url: 'https://www.baidu.com/s?wd=' },
    { id: 'github', name: 'GitHub', url: 'https://github.com/search?q=' }
  ];
  const musicTracks = [
    { title: '晴天漫游', caption: 'Weboss 原创 · 轻音乐', notes: [262,330,392,523,392,330,294,349,440,523,440,349,262,330,392,330] },
    { title: '午后微风', caption: 'Weboss 原创 · 轻音乐', notes: [294,370,440,587,440,370,330,392,494,587,494,392,294,370,440,370] },
    { title: '慢慢的日子', caption: 'Weboss 原创 · 轻音乐', notes: [247,330,370,494,370,330,277,330,415,494,415,330,247,330,370,330] }
  ];

  function validUrl(value) {
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; }
    catch { return ''; }
  }
  function normalize(raw) {
    if (!raw || typeof raw !== 'object') raw = clone(defaults);
    const data = { ...clone(defaults), ...raw };
    data.pages = clone(defaults.pages);
    const sourceApps = Array.isArray(raw.apps) ? [...raw.apps] : [...defaults.apps];
    if (!sourceApps.some(app=>app?.id==='weboss-settings')) sourceApps.push(defaults.apps.find(app=>app.id==='weboss-settings'));
    if ((Number(raw.version) || 1) < 2) defaults.apps.forEach(app => { if (newDefaultAppIds.has(app.id) && !sourceApps.some(item => item.id === app.id)) sourceApps.push(app); });
    data.apps = sourceApps.filter(item => item && (validUrl(item.url) || item.id==='weboss-settings')).map(item => ({
      id: String(item.id || crypto.randomUUID()), name: String(item.name || '未命名').slice(0, 32),
      url: validUrl(item.url), system: item.id==='weboss-settings'?'settings':undefined, icon: String(item.icon || '✦').slice(0, 180),
      iconMode: item.iconMode === 'custom' || (!item.iconMode && (!defaults.apps.some(app => app.id === item.id && app.icon === item.icon) && item.id)) ? 'custom' : 'auto',
      color: /^#[\da-f]{6}$/i.test(item.color) ? item.color : '#6c9ca4',
      page: pageIds.includes(item.page) ? item.page : 'home'
    }));
    const grouped = new Set();
    data.folders = (Array.isArray(raw.folders)?raw.folders:[]).filter(Boolean).map(item=>({
      id:String(item.id||crypto.randomUUID()),name:String(item.name||'文件夹').slice(0,32),
      page:pageIds.includes(item.page)?item.page:'home',sizes:item.sizes&&typeof item.sizes==='object'?item.sizes:{},
      appIds:(Array.isArray(item.appIds)?item.appIds:[]).filter(id=>{
        const app=data.apps.find(app=>app.id===id);if(!app||app.system||grouped.has(id))return false;
        grouped.add(id);return true;
      })
    }));
    data.folders.forEach(folder=>folder.appIds.forEach(id=>{data.apps.find(app=>app.id===id).page=folder.page;}));
    const sourceWidgets = Array.isArray(raw.widgets) ? [...raw.widgets] : [...defaults.widgets];
    if ((Number(raw.version) || 1) < 2 && !sourceWidgets.some(item => item.id === 'clock')) sourceWidgets.unshift(defaults.widgets[0]);
    data.widgets = sourceWidgets.filter(Boolean).map(item => ({
      id: String(item.id || crypto.randomUUID()), type: String(item.type || 'note'),
      page: pageIds.includes(item.page) ? item.page : 'home',
      size: ['small','medium','wide'].includes(item.size) ? item.size : 'medium',
      title: String(item.title || '').slice(0, 40), content: String(item.content || '').slice(0, 400)
    }));
    data.todos = (Array.isArray(raw.todos) ? raw.todos : defaults.todos).map(item => ({ id: String(item.id || crypto.randomUUID()), text: String(item.text || '').slice(0, 80), done: !!item.done }));
    data.dock = (Array.isArray(raw.dock) ? raw.dock : defaults.dock).filter(id => data.apps.some(app => app.id === id)).slice(0, 12);
    data.history = Array.isArray(raw.history) ? raw.history.slice(0, 12).filter(id => data.apps.some(app => app.id === id)) : [];
    data.searchHistory = Array.isArray(raw.searchHistory) ? raw.searchHistory.slice(0, 12).map(String) : [];
    data.favoriteIds = Array.isArray(raw.favoriteIds) ? raw.favoriteIds : defaults.favoriteIds;
    data.wallpaper = ['sunny','peach','sage','night','custom','bing'].includes(raw.wallpaper) ? raw.wallpaper : 'sunny';
    data.customWallpaper = typeof raw.customWallpaper === 'string' && (raw.customWallpaper.startsWith('data:image/')||validUrl(raw.customWallpaper)) ? raw.customWallpaper : '';
    data.bingWallpaper = raw.bingWallpaper && validUrl(raw.bingWallpaper.url) ? {url:validUrl(raw.bingWallpaper.url),date:String(raw.bingWallpaper.date||''),copyright:String(raw.bingWallpaper.copyright||'Bing 每日一图').slice(0,200)} : null;
    data.searchLabel=String(raw.searchLabel||defaults.searchLabel).slice(0,80);
    data.searchEngine=engines.some(engine=>engine.id===raw.searchEngine)?raw.searchEngine:'google';
    data.city = raw.city && Number.isFinite(Number(raw.city.latitude)) && Number.isFinite(Number(raw.city.longitude))
      ? { name: String(raw.city.name || '北京').slice(0, 24), latitude: Number(raw.city.latitude), longitude: Number(raw.city.longitude) }
      : clone(defaults.city);
    data.layout = raw.layout && typeof raw.layout === 'object' ? raw.layout : { desktop: {}, tablet: {}, mobile: {} };
    for (const mode of ['desktop','tablet','mobile']) if (!data.layout[mode] || typeof data.layout[mode] !== 'object') data.layout[mode] = {};
    data.version = defaults.version;
    return data;
  }
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { /* Ignore invalid local data. */ }
  let state = normalize(stored);
  const todayKey = new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if (state.todoDate !== todayKey) {
    state.todos.forEach(item => { item.done = false; });
    state.todoDate = todayKey;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* The desktop still works in memory. */ }
  }
  let currentPage = 0;
  let editing = false;
  let settingsTab = 'apps';
  let editorContext = null;
  let selectedSearch = 0;
  let activeEngine = state.searchEngine;
  let weather = null;
  let quoteOffset = 0;
  let toastTimer = 0;
  let wheelAt = 0;
  let pointerStart = null;
  let dragState = null;
  let resizeState = null;
  let folderId = null;
  let folderPage = 0;
  let bingLoading = false;
  const surfaces = new Map();
  let dropSettling = false;
  let suppressClickUntil = 0;
  let viewPages = [];
  let rowsPerPage = 7;
  let resizeFrame = 0;
  let sizingFolderId = null;
  let organizerMode = 'bulk', organizerFolderId = null, organizerPlan = null, organizerBusy = false;
  let organizerRequest = null, organizationUndo = null;
  const selectedApps = new Set();
  let bulkDraft = {action:'new',name:'常用 App',page:'home',folder:''};
  const folderResizeObserver = new ResizeObserver(entries => entries.forEach(entry => fitFolderTile(entry.target)));
  const music = { context: null, timer: null, frame: null, playing: false, track: 0, elapsed: 0, lastTick: 0, lastNote: -1 };

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { toast('浏览器存储空间不足，请导出配置备份'); }
  }
  function toast(message) {
    const el = $('#toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function appById(id) { return state.apps.find(app => app.id === id); }
  function folderById(id) { return state.folders.find(folder=>folder.id===id); }
  function folderOfApp(id) { return state.folders.find(folder=>folder.appIds.includes(id)); }
  function removeFromFolders(id) { state.folders.forEach(folder=>folder.appIds=folder.appIds.filter(appId=>appId!==id)); }
  function itemById(type,id) { return type==='app'?appById(id):type==='folder'?folderById(id):state.widgets.find(widget=>widget.id===id); }
  function refreshDesktop() { save();renderPages();renderDock();if(folderId)renderFolderContents();if($('#settingsDialog').open)renderSettings(); }
  function isLightColor(hex) {
    const rgb = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16));
    return rgb[0]*.299 + rgb[1]*.587 + rgb[2]*.114 > 185;
  }
  function appIcon(app, tiny = false) {
    const icon = el('span', tiny ? 'tiny-app-icon' : 'app-icon');
    icon.style.setProperty('--app-color', app.color);
    if (tiny) { icon.style.background = app.color; icon.style.color = isLightColor(app.color) ? '#38545a' : '#fff'; }
    else if (isLightColor(app.color)) icon.classList.add('light');
    const fallbackText=/^https?:\/\//.test(app.icon) ? app.name.slice(0,1) : app.icon;
    const fallback=el('span','icon-fallback',fallbackText || app.name.slice(0,1) || '✦');icon.append(fallback);
    const manual=app.iconMode==='custom' || (!app.iconMode && /^https?:\/\//.test(app.icon));
    const site=app.system?null:new URL(app.url),host=site?.hostname;
    const sources=app.system?[]:manual ? [validUrl(app.icon)].filter(Boolean) : [
      `${site.origin}/favicon.ico?wd=1`,
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`,
      `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`
    ];
    if(sources.length){
      icon.dataset.iconMode=manual?'custom':'auto';icon.dataset.favicon=sources[0];
      const image=new Image();image.alt='';image.draggable=false;image.decoding='async';image.referrerPolicy='no-referrer';
      let sourceIndex=0,timer=0;
      const advance=()=>{clearTimeout(timer);sourceIndex++;if(sourceIndex<sources.length)trySource();};
      const scheduleCheck=()=>{
        timer=setTimeout(()=>{
          if(!icon.isConnected)return;
          if(!image.complete)advance();
        },1800);
      };
      const trySource=()=>{image.src=sources[sourceIndex];scheduleCheck();};
      image.addEventListener('load',()=>{clearTimeout(timer);if(image.naturalWidth>0&&icon.isConnected){icon.append(image);icon.classList.add('has-favicon');if(!manual){icon.classList.add('auto-favicon');if(tiny)icon.style.background='rgba(255,255,255,.92)';}}});
      image.addEventListener('error',advance);
      requestAnimationFrame(()=>{
        if(!icon.isConnected)return;
        if(tiny||!('IntersectionObserver' in window)){trySource();return;}
        const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();trySource();}},{rootMargin:'180px'});
        observer.observe(icon);
      });
    }
    return icon;
  }
  function openApp(app,origin) {
    if (!app) return;
    if(app.system==='settings'){openSettings(origin);return;}
    state.history = [app.id, ...state.history.filter(id => id !== app.id)].slice(0,12);
    save();
    window.open(app.url, '_blank', 'noopener,noreferrer');
  }
  function closeAppContext() { const menu=$('#appContextMenu');menu.hidden=true;menu.replaceChildren(); }
  function openAppContext(appId,x,y) { openItemContext('app',appId,x,y); }
  function openItemContext(type,id,x,y) {
    if(dragState?.active||resizeState)return;
    const item=itemById(type,id);if(!item)return;
    const menu=$('#appContextMenu');menu.replaceChildren();menu.hidden=false;
    const title=el('div','context-title');title.append(type==='app'?appIcon(item,true):el('span','tiny-app-icon',type==='folder'?'▦':widgetSymbol(item.type)),el('span','',item.name||item.title||widgetLabel(item.type)));menu.append(title);
    const action=(label,icon,handler,danger=false)=>{
      const button=el('button',`context-action${danger?' danger':''}`);button.type='button';button.setAttribute('role','menuitem');
      button.append(el('span','context-glyph',icon),el('span','',label));
      button.addEventListener('click',()=>{closeAppContext();handler();});menu.append(button);
    };
    if(type==='folder')action('打开文件夹','▦',()=>openFolder(id));
    if(type==='app')action(item.system?'打开设置':'打开网站','↗',()=>openApp(item));
    action(type==='app'?'编辑快捷方式':type==='folder'?'编辑文件夹':'编辑 Widget','✎',()=>openEditor(type,id));
    if(type==='app'&&!item.system)action('复制链接','⧉',async()=>{
      try { await navigator.clipboard.writeText(item.url);toast('链接已复制'); }
      catch { toast('复制失败，请检查浏览器权限'); }
    });
    const inDock=state.dock.includes(id);
    if(type==='app')action(inDock?'从 Dock 移除':'加入 Dock',inDock?'−':'+',()=>{
      if(inDock)state.dock=state.dock.filter(appId=>appId!==id);
      else if(state.dock.length>=12)return toast('Dock 最多放 12 个 App');
      else state.dock.push(id);
      save();renderDock();toast(inDock?'已从 Dock 移除':'已加入 Dock');
    });
    if(type==='app'&&!item.system){
      action('多选 / 批量整理','☑',()=>openOrganizer('bulk',id));
      const folder=folderOfApp(id);
      if(folder)action('移出文件夹','↗',()=>{removeFromFolders(id);refreshDesktop();});
      const choices=el('div','context-folder-choices');
      state.folders.filter(entry=>entry.id!==folder?.id).forEach(entry=>{
        const button=el('button','context-action',`▦  移入 ${entry.name}`);button.type='button';button.addEventListener('click',()=>{closeAppContext();removeFromFolders(id);entry.appIds.push(id);item.page=entry.page;refreshDesktop();});choices.append(button);
      });menu.append(choices);
      action('新建文件夹并移入','+',()=>createFolder([id],item.page));
    }
    if(type==='folder'){
      menu.append(el('span','context-group-label','文件夹大小'));
      renderFolderSizePicker(menu,item,(w,h)=>{closeAppContext();setFolderSize(id,w,h);});
      action('拖动边角调整大小','↗',()=>armFolderResize(id));
      action('批量整理文件夹里的 App','☑',()=>openOrganizer('bulk',null,id));
      action('解散文件夹','⇱',()=>dissolveFolder(id));
    }
    const group=el('div','context-page-group');group.append(el('span','context-group-label','移动到桌面'));
    const pageChoices=el('div','context-page-choices');
    state.pages.forEach(page=>{
      const button=el('button',`context-page-choice${item.page===page.id?' active':''}`,page.name);button.type='button';button.setAttribute('role','menuitem');
      button.disabled=item.page===page.id;
      button.addEventListener('click',()=>{closeAppContext();item.page=page.id;
        if(type==='app')removeFromFolders(id);
        if(type==='folder')item.appIds.forEach(appId=>appById(appId).page=page.id);
        for(const mode of ['desktop','tablet','mobile'])delete state.layout[mode][id];
        refreshDesktop();toast(`已移动到${page.name}`);
      });pageChoices.append(button);
    });group.append(pageChoices);menu.append(group);
    if(type!=='folder'&&!item.system)action(type==='app'?'删除快捷方式':'删除 Widget','×',()=>{if(!confirm(`删除“${item.name||item.title||widgetLabel(item.type)}”？`))return;
      if(type==='app'){state.apps=state.apps.filter(app=>app.id!==id);state.dock=state.dock.filter(appId=>appId!==id);state.history=state.history.filter(appId=>appId!==id);removeFromFolders(id);}
      else state.widgets=state.widgets.filter(widget=>widget.id!==id);
      for(const mode of ['desktop','tablet','mobile'])delete state.layout[mode][id];
      refreshDesktop();toast('已删除');
    },true);
    positionContext(x,y);
  }
  function positionContext(x,y) {
    const menu=$('#appContextMenu');
    menu.style.left='0px';menu.style.top='0px';
    const rect=menu.getBoundingClientRect();
    menu.style.left=`${Math.max(8,Math.min(x,innerWidth-rect.width-8))}px`;
    menu.style.top=`${Math.max(8,Math.min(y,innerHeight-rect.height-8))}px`;
  }
  function openDesktopContext(event,target='desktop') {
    event.preventDefault();if(dragState?.active||resizeState)return;
    const menu=$('#appContextMenu');menu.replaceChildren();menu.hidden=false;
    menu.append(el('div','context-title',target==='search'?'搜索':target==='dock'?'Dock':'Weboss 桌面'));
    const action=(text,fn)=>{const button=el('button','context-action',text);button.type='button';button.addEventListener('click',()=>{closeAppContext();fn();});menu.append(button);};
    if(target==='search')action('✎  编辑搜索',()=>openEditor('search'));
    if(target==='dock')action('✎  编辑 Dock',()=>openSettings(null,'dock'));
    action('+  添加快捷方式',()=>openEditor('app'));action('▦  新建文件夹',()=>openEditor('folder'));action('+  添加 Widget',()=>openEditor('widget'));
    action('✧  AI 自动整理',()=>openOrganizer('ai'));action('☑  批量整理 App',()=>openOrganizer('bulk'));
    action(editing?'✓  完成整理':'✦  整理桌面',toggleEdit);action('▧  更换壁纸',()=>openSettings(null,'appearance'));action('⚙  桌面设置',()=>openSettings());positionContext(event.clientX,event.clientY);
  }
  function setWallpaper() {
    const wall = $('#wallpaper');
    if(state.wallpaper==='bing'&&!state.bingWallpaper?.url){loadBingWallpaper();return;}
    wall.dataset.wallpaper = state.wallpaper;
    const url=state.wallpaper==='custom'?state.customWallpaper:state.wallpaper==='bing'?state.bingWallpaper?.url:'';
    wall.style.backgroundImage=url?`url(${JSON.stringify(url)})`:'';
    wall.title=state.wallpaper==='bing'?(state.bingWallpaper?.copyright||'Bing 每日一图'):'';
    if(state.wallpaper==='bing')loadBingWallpaper();
  }
  function localDay() { return new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
  async function loadBingWallpaper(force=false) {
    if(bingLoading||state.wallpaper!=='bing'||(!force&&state.bingWallpaper?.date===localDay()))return;
    bingLoading=true;const day=localDay(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);
    const endpoint='https://bing.biturl.top/?resolution=1920&index=0&mkt=zh-CN';
    try{
      let data;
      try{const response=await fetch(`${endpoint}&format=json`,{signal:controller.signal});if(!response.ok)throw Error('Bing');data=await response.json();if(!validUrl(data.url))throw Error('image');}
      catch{data={url:`${endpoint}&format=image&day=${day}`,copyright:'Bing 每日一图'};}
      await new Promise((resolve,reject)=>{const image=new Image();const timeout=setTimeout(()=>reject(Error('image timeout')),8000);image.onload=()=>{clearTimeout(timeout);resolve();};image.onerror=()=>{clearTimeout(timeout);reject(Error('image'));};image.src=data.url;});
      if(state.wallpaper==='bing'){state.bingWallpaper={url:validUrl(data.url),date:day,copyright:String(data.copyright||'Bing 每日一图').slice(0,200)};save();$('#wallpaper').dataset.wallpaper='bing';$('#wallpaper').style.backgroundImage=`url(${JSON.stringify(state.bingWallpaper.url)})`;$('#wallpaper').title=state.bingWallpaper.copyright;if($('#settingsDialog').open&&settingsTab==='appearance')renderSettings();}
    }catch{toast('每日壁纸暂不可用，保留上一张壁纸');}
    finally{clearTimeout(timer);bingLoading=false;}
  }
  function updateClock() {
    const date = new Date();
    const time = new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
    const longDate = new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(date);
    const clock = $('#clockText'); if (clock) clock.textContent = time;
    const dateText = $('#clockDate'); if (dateText) dateText.textContent = longDate;
    $('#topDate').textContent = new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'short'}).format(date);
  }
  function layoutMode() { return innerWidth <= 700 ? 'mobile' : innerWidth <= 1100 ? 'tablet' : 'desktop'; }
  function gridColumns(mode) { return mode === 'mobile' ? 4 : mode === 'tablet' ? 8 : 12; }
  function gridMetric(mode) {
    if (mode === 'mobile') return innerHeight <= 620 ? {row:50,gap:5} : innerHeight <= 740 ? {row:58,gap:6} : {row:75,gap:9};
    if (innerHeight <= 680) return {row:65,gap:8};
    return mode === 'tablet' ? {row:76,gap:10} : {row:78,gap:12};
  }
  function availableRows(mode) {
    const viewport=$('#desktopViewport');
    const {row,gap}=gridMetric(mode), heading=mode==='mobile'?34:39;
    return Math.max(3,Math.floor((viewport.clientHeight-heading+gap-4)/(row+gap)));
  }
  function tileSize(item, mode) {
    if (item.kind === 'app') return { w: 1, h: 1 };
    if(item.kind==='folder'){
      const size=item.data.sizes[mode]||{w:2,h:2};
      return {w:Math.max(1,Math.min(gridColumns(mode),Math.round(Number(size.w)||2))),h:Math.max(1,Math.min(rowsPerPage,Math.round(Number(size.h)||2)))};
    }
    const type = item.data.type;
    if (mode === 'mobile') {
      if (type === 'clock') return { w: 4, h: 1 };
      if (type === 'watching' || type === 'calendar') return { w: 4, h: 3 };
      if (type === 'todo' || type === 'player') return { w: 2, h: 3 };
      return { w: item.data.size === 'wide' ? 4 : 2, h: 2 };
    }
    if (mode === 'tablet') return { w: type === 'clock' || item.data.size === 'wide' ? 4 : 2, h: type === 'calendar' || type === 'todo' ? 3 : 2 };
    return { w: type === 'clock' || item.data.size === 'wide' ? 4 : item.data.size === 'small' ? 2 : 3, h: type === 'calendar' || type === 'todo' ? 3 : 2 };
  }
  function pageItems(pageId, mode, maxRows=rowsPerPage) {
    const widgets = state.widgets.filter(item => item.page === pageId).map(data => ({ kind: 'widget', data, id: data.id }));
    const folders=state.folders.filter(item=>item.page===pageId).map(data=>({kind:'folder',data,id:data.id}));
    const apps = state.apps.filter(item => item.page === pageId && !folderOfApp(item.id)).map(data => ({ kind: 'app', data, id: data.id }));
    if (mode === 'mobile') {
      const priorityTypes=maxRows<=6?['clock']:['clock','weather','todo','player','watching'];
      const prominent = widgets.filter(item => priorityTypes.includes(item.data.type));
      const rest = widgets.filter(item => !prominent.includes(item));
      return [...prominent, ...folders, ...apps, ...rest];
    }
    if (maxRows<=5) {
      const prominent=widgets.filter(item => ['clock','weather','todo','progress','watching','player'].includes(item.data.type));
      return [...prominent,...folders,...apps,...widgets.filter(item=>!prominent.includes(item))];
    }
    return [...widgets, ...folders, ...apps];
  }
  function layoutPage(pageId, mode, maxRows) {
    const columns = gridColumns(mode), occupied = new Set(), positions = new Map();
    const saved = state.layout[mode];
    const items = pageItems(pageId, mode,maxRows).sort((a,b) => (Number(saved[b.id]?.priority)||0) - (Number(saved[a.id]?.priority)||0));
    const area=items.reduce((sum,item)=>{const {w,h}=tileSize(item,mode);return sum+w*h;},0);
    const usefulRowLimit=Math.ceil(area/columns)+maxRows;
    const canFit = (x,y,w,h) => {
      if (x < 0 || y < 0 || x + w > columns || y%maxRows+h>maxRows) return false;
      for (let row=y;row<y+h;row++) for(let col=x;col<x+w;col++) if(occupied.has(`${col},${row}`)) return false;
      return true;
    };
    items.forEach(item => {
      const {w,h} = tileSize(item,mode), pref = saved[item.id]?.page === pageId ? saved[item.id] : null;
      let x = Number(pref?.x), y = Number(pref?.y);
      if (y>usefulRowLimit) y=NaN;
      if (!Number.isInteger(x) || !Number.isInteger(y) || !canFit(x,y,w,h)) {
        outer: for(y=0;y<Math.max(120,usefulRowLimit+maxRows);y++) for(x=0;x<=columns-w;x++) if(canFit(x,y,w,h)) break outer;
      }
      positions.set(item.id,{x,y,w,h});
      for(let row=y;row<y+h;row++) for(let col=x;col<x+w;col++) occupied.add(`${col},${row}`);
    });
    return positions;
  }
  function renderPages() {
    closeAppContext();
    folderResizeObserver.disconnect();
    const track = $('#pageTrack'), previous=viewPages[currentPage]; track.replaceChildren();
    const mode = layoutMode(); rowsPerPage=availableRows(mode); viewPages=[];
    state.pages.forEach(page => {
      const positions=layoutPage(page.id,mode,rowsPerPage), items=pageItems(page.id,mode,rowsPerPage);
      const segments=Math.max(1,...[...positions.values()].map(pos=>Math.floor(pos.y/rowsPerPage)+1));
      for(let segment=0;segment<segments;segment++) {
        const pageItemsInSegment=items.filter(item=>Math.floor(positions.get(item.id).y/rowsPerPage)===segment);
        const view={pageId:page.id,name:page.name,segment,total:segments};viewPages.push(view);
        const section=el('section','desktop-page');section.dataset.page=page.id;section.dataset.segment=String(segment);
        section.setAttribute('aria-label',segments>1?`${page.name}，第 ${segment+1} 屏`:page.name);
        const inner=el('div','page-inner'),heading=el('div','desktop-heading');
        const appCount=pageItemsInSegment.filter(item=>item.kind==='app').length;
        heading.append(el('span','desktop-heading-name',segments>1?`${page.name} · ${segment+1}/${segments}`:page.name),
          el('span','desktop-heading-hint',appCount?`${appCount} 个 App · 右键管理`:`${pageItemsInSegment.length} 个 Widget · 左右切换`));
        inner.append(heading);
        const canvas=el('div','desktop-canvas');canvas.dataset.page=page.id;canvas.dataset.segment=String(segment);canvas.dataset.mode=mode;
        pageItemsInSegment.forEach(item=>{
          const node=item.kind==='app'?renderApp(item.data):item.kind==='folder'?renderFolderTile(item.data):renderWidget(item.data),pos=positions.get(item.id);
          node.style.gridColumn=`${pos.x+1} / span ${pos.w}`;
          node.style.gridRow=`${pos.y%rowsPerPage+1} / span ${pos.h}`;
          node.dataset.kind=item.kind;node.dataset.page=page.id;canvas.append(node);
        });
        inner.append(canvas);section.append(inner);track.append(section);
      }
    });
    if(previous){const match=viewPages.findIndex(view=>view.pageId===previous.pageId&&view.segment===previous.segment);currentPage=match>=0?match:Math.min(currentPage,viewPages.length-1);}
    renderDots(); updateClock(); setPage(currentPage,false);
    $('#desktopShell').classList.toggle('editing',editing);
    syncSurfaceOrigins();
  }
  function renderDots() {
    const dots = $('#pageDots'); dots.replaceChildren();
    viewPages.forEach((view,index) => { const button = el('button'); button.type = 'button'; button.title = view.total>1?`${view.name} ${view.segment+1}/${view.total}`:view.name; button.setAttribute('aria-label',`切换到${button.title}`); button.addEventListener('click',() => setPage(index)); dots.append(button); });
  }
  function setPage(index, animate = true) {
    currentPage = Math.max(0,Math.min(viewPages.length-1,index));closeAppContext();
    const track = $('#pageTrack');
    const view=viewPages[currentPage];
    $('#topPageName').textContent = view.name;
    if (!animate) { track.classList.add('dragging'); requestAnimationFrame(() => track.classList.remove('dragging')); }
    track.style.transform = `translate3d(${-currentPage*100}%,0,0)`;
    [...$('#pageDots').children].forEach((dot,i) => { dot.classList.toggle('active',i===currentPage); dot.setAttribute('aria-current',String(i===currentPage)); });
  }
  function renderApp(app) {
    const wrap = el('div','app-shortcut'); wrap.dataset.id = app.id;
    const link = el('a'); link.href = app.url||'#'; if(!app.system)link.target = '_blank'; link.rel = 'noopener noreferrer'; link.setAttribute('aria-label',`打开 ${app.name}`);
    link.draggable = false;
    link.append(appIcon(app),el('span','app-name',app.name));
    link.addEventListener('click',event => {
      if(Date.now()<suppressClickUntil){event.preventDefault();return;}
      if(editing){event.preventDefault();openEditor('app',app.id);return;}
      if(app.system){event.preventDefault();openApp(app,$('.app-icon',wrap));return;}
      state.history = [app.id,...state.history.filter(id=>id!==app.id)].slice(0,12); save();
    });
    const edit = el('button','app-edit','✎'); edit.type='button'; edit.title=`编辑 ${app.name}`; edit.addEventListener('click',() => openEditor('app',app.id));
    wrap.append(link,edit); attachDrag(wrap,'app',app.id);
    wrap.addEventListener('contextmenu',event=>{event.preventDefault();event.stopPropagation();openAppContext(app.id,event.clientX,event.clientY);});
    return wrap;
  }
  function renderWidget(widget) {
    const card = el('article','widget-card'); card.dataset.id=widget.id; card.dataset.type=widget.type; card.dataset.size=widget.size;
    const head=el('div','widget-head'); head.append(el('span','widget-label',widget.title || widgetLabel(widget.type)));
    const symbol=el('span','widget-symbol',widgetSymbol(widget.type)); head.append(symbol); card.append(head);
    const content=el('div','widget-content'); card.append(content);
    switch(widget.type) {
      case 'clock': {
        content.append(el('div','clock-big','--:--'),el('p','clock-date',''));
        $('.clock-big',content).id='clockText'; $('.clock-date',content).id='clockDate';
        content.append(el('p','clock-message','今天也要开心呀！ ☀️')); break;
      }
      case 'weather': renderWeather(content); break;
      case 'calendar': renderCalendar(content); break;
      case 'quote': renderQuote(content); card.classList.add('quote-card'); break;
      case 'todo': renderTodos(content); break;
      case 'progress': renderProgress(content,widget); break;
      case 'recent': renderLinkList(content,state.history.slice(0,3),'recent'); break;
      case 'favorites': renderLinkList(content,state.favoriteIds.slice(0,3),'favorite'); break;
      case 'watching': renderWatching(content); break;
      case 'player': renderPlayer(content); break;
      case 'quick': renderQuick(content); break;
      case 'link': { const link=el('a','note-content',widget.content||'打开链接 ↗'); link.href=validUrl(widget.content)||'#'; link.target='_blank'; link.rel='noopener noreferrer'; content.append(link); break; }
      default: content.append(el('p','note-content',widget.content||'双击卡片，写下你的想法。'));
    }
    const edit=el('button','widget-edit','✎'); edit.type='button'; edit.title='编辑 Widget'; edit.addEventListener('click',() => openEditor('widget',widget.id)); card.append(edit);
    if (['note','link','progress'].includes(widget.type)) card.addEventListener('dblclick',() => openEditor('widget',widget.id));
    card.addEventListener('contextmenu',event=>{event.preventDefault();event.stopPropagation();openItemContext('widget',widget.id,event.clientX,event.clientY);});
    attachDrag(card,'widget',widget.id); return card;
  }
  function renderFolderTile(folder) {
    const size=tileSize({kind:'folder',data:folder},layoutMode()),compact=size.w===1&&size.h===1;
    const tile=el('article',`folder-tile${compact?' compact':''}${sizingFolderId===folder.id?' folder-sizing':''}`);tile.dataset.id=folder.id;tile.dataset.kind='folder';
    const head=el('button','folder-tile-head');head.type='button';head.append(el('strong','',folder.name),el('span','',`${folder.appIds.length}  ↗`));head.addEventListener('click',()=>{if(Date.now()<suppressClickUntil)return;openFolder(folder.id,tile);});tile.append(head);
    const grid=el('div','folder-tile-grid');
    if(compact){const open=el('button','folder-mini-open');open.type='button';open.setAttribute('aria-label',`打开 ${folder.name}`);open.append(grid);open.addEventListener('click',()=>{if(Date.now()<suppressClickUntil)return;openFolder(folder.id,tile);});tile.append(open,el('span','app-name',folder.name));}
    else tile.append(grid);
    const handle=el('button','folder-resize-handle','⌟');handle.type='button';handle.title='拖动调整文件夹大小';handle.setAttribute('aria-label','调整文件夹大小');handle.addEventListener('pointerdown',event=>startFolderResize(event,tile,folder));tile.append(handle);
    const edge=el('button','folder-resize-edge');edge.type='button';edge.title='拖动调整宽度';edge.setAttribute('aria-label','调整文件夹宽度');edge.addEventListener('pointerdown',event=>startFolderResize(event,tile,folder,'width'));tile.append(edge);
    tile.addEventListener('contextmenu',event=>{event.preventDefault();event.stopPropagation();openItemContext('folder',folder.id,event.clientX,event.clientY);});attachDrag(tile,'folder',folder.id);
    requestAnimationFrame(()=>{if(tile.isConnected){fitFolderTile(tile);folderResizeObserver.observe(tile);}});return tile;
  }
  function fitFolderTile(tile) {
    const folder=folderById(tile.dataset.id);if(!folder||!tile.isConnected)return;
    const compact=tile.classList.contains('compact'),metrics=folderMetrics(tile.clientWidth,tile.clientHeight,compact);
    const signature=JSON.stringify([metrics,folder.appIds]);if(tile.dataset.fit===signature)return;tile.dataset.fit=signature;
    const grid=$('.folder-tile-grid',tile);grid.replaceChildren();
    tile.style.setProperty('--folder-cols',metrics.columns);tile.style.setProperty('--folder-rows',metrics.rows);tile.style.setProperty('--folder-icon',`${metrics.icon}px`);tile.classList.toggle('folder-no-labels',!compact&&!metrics.labels);
    const overflow=!compact&&folder.appIds.length>metrics.capacity,visible=overflow?metrics.capacity-1:metrics.capacity;
    folder.appIds.slice(0,visible).forEach(id=>{const app=appById(id);if(!app)return;
      if(compact)grid.append(appIcon(app,true));else{const node=renderApp(app);node.classList.add('folder-app');node.dataset.folder=folder.id;grid.append(node);}
    });
    if(overflow){const more=el('button','folder-more');more.type='button';more.setAttribute('aria-label',`打开 ${folder.name}，还有 ${folder.appIds.length-visible} 个 App`);
      const stack=el('span','folder-more-stack');folder.appIds.slice(visible,visible+4).forEach(id=>stack.append(appIcon(appById(id),true)));
      more.append(stack,el('span','app-name',`+${folder.appIds.length-visible}`));more.addEventListener('click',event=>{event.stopPropagation();if(Date.now()>=suppressClickUntil)openFolder(folder.id,tile);});grid.append(more);
    }
    if(!folder.appIds.length)grid.append(el('span','folder-empty','拖入 App'));
  }
  function renderFolderSizePicker(root,folder,onSelect) {
    const picker=el('div','folder-size-picker'),size=tileSize({kind:'folder',data:folder},layoutMode());
    [['小',1,1],['大',2,2],['宽',3,2],['超大',3,3]].forEach(([name,w,h])=>{const button=el('button',`folder-size-option${size.w===w&&size.h===h?' active':''}`);button.type='button';button.append(el('span','size-shape'),el('span','',`${name} ${w}×${h}`));button.style.setProperty('--size-w',w);button.style.setProperty('--size-h',h);button.disabled=w>gridColumns(layoutMode())||h>rowsPerPage;button.addEventListener('click',()=>{picker.querySelectorAll('button').forEach(node=>node.classList.toggle('active',node===button));onSelect(w,h);});picker.append(button);});root.append(picker);
  }
  function armFolderResize(id) {
    if(folderId)closeFolder();sizingFolderId=id;document.querySelectorAll('.folder-sizing').forEach(node=>node.classList.remove('folder-sizing'));
    document.querySelector(`.desktop-canvas>.folder-tile[data-id="${CSS.escape(id)}"]`)?.classList.add('folder-sizing');toast('拖动右侧或右下角；点击空白处完成');
  }
  function setFolderSize(id,w,h) {
    const folder=folderById(id),node=document.querySelector(`.desktop-canvas>.folder-tile[data-id="${CSS.escape(id)}"]`);if(!folder||!node)return;
    if(folderId)closeFolder();const rect=node.getBoundingClientRect();
    startFolderResize({button:0,pointerId:-1,clientX:rect.right,clientY:rect.bottom,preventDefault(){},stopPropagation(){},currentTarget:node},node,folder);
    const resize=resizeState;if(!resize)return;
    const end={pointerId:-1,clientX:rect.right+(w-resize.pos.w)*(resize.columnWidth+resize.gapX),clientY:rect.bottom+(h-resize.pos.h)*(resize.rowHeight+resize.gapY),preventDefault(){}};
    finishFolderResize(end);
  }
  function createFolder(ids=[],page=viewPages[currentPage].pageId,position=null) {
    const folder={id:crypto.randomUUID(),name:suggestGroups(ids.map(appById))[0]?.name||'文件夹',page,appIds:[...ids],sizes:{}};
    ids.forEach(id=>{removeFromFolders(id);appById(id).page=page;});state.folders.push(folder);
    if(position)state.layout[layoutMode()][folder.id]={page,...position,priority:Date.now()};
    refreshDesktop();openFolder(folder.id);return folder;
  }
  function dissolveFolder(id) {
    const folder=folderById(id);if(!folder)return;
    folder.appIds.forEach(appId=>{appById(appId).page=folder.page;for(const mode of ['desktop','tablet','mobile'])delete state.layout[mode][appId];});
    state.folders=state.folders.filter(item=>item.id!==id);for(const mode of ['desktop','tablet','mobile'])delete state.layout[mode][id];
    if(folderId===id)closeFolder();refreshDesktop();toast('文件夹已解散，App 已回到桌面');
  }
  function openFolder(id,origin) {
    const folder=folderById(id);if(!folder)return;
    if(surfaces.has('folder')&&folderId!==id){closeSurface('folder',()=>{folderId=null;openFolder(id,origin);});return;}
    closeAppContext();folderId=id;folderPage=0;renderFolderContents();
    openSurface('folder',origin||document.querySelector(`.desktop-canvas>.folder-tile[data-id="${CSS.escape(id)}"]`));
  }
  function closeFolder(forDrag=false) { closeSurface('folder',()=>{folderId=null;},forDrag); }
  function renderFolderContents() {
    const folder=folderById(folderId);if(!folder)return;
    $('#folderName').value=folder.name;$('#folderDialog').dataset.id=folder.id;
    const columns=innerWidth<=700?3:4,rows=Math.max(1,Math.min(3,Math.floor((surfaceTarget('folder').height-210+18)/86))),count=columns*rows,total=Math.max(1,Math.ceil(folder.appIds.length/count));folderPage=Math.min(folderPage,total-1);
    const grid=$('#folderGrid');grid.style.gridTemplateRows=`repeat(${rows},minmax(0,1fr))`;grid.replaceChildren();folder.appIds.slice(folderPage*count,(folderPage+1)*count).forEach(id=>{
      const app=appById(id);if(!app)return;const node=renderApp(app);node.classList.add('folder-app');node.dataset.folder=folder.id;grid.append(node);
    });
    if(!folder.appIds.length){const button=el('button','folder-empty-add','+ 添加 App');button.type='button';button.addEventListener('click',()=>openEditor('folder',folder.id));grid.append(button);}
    const pages=$('#folderPagination');pages.replaceChildren();for(let index=0;index<total;index++){const button=el('button',index===folderPage?'active':'');button.type='button';button.setAttribute('aria-label',`文件夹第 ${index+1} 页`);button.addEventListener('click',()=>{folderPage=index;renderFolderContents();});pages.append(button);}
  }
  function widgetLabel(type) { return ({clock:'此刻',weather:'今日天气',calendar:'本月日历',quote:'每日一句',todo:'今日计划',progress:'学习进度',recent:'最近访问',favorites:'收藏网站',watching:'继续观看',player:'迷你播放器',note:'便签',link:'快捷链接',quick:'快捷工具'})[type]||'Widget'; }
  function widgetSymbol(type) { return ({clock:'◷',weather:'☀',calendar:'▦',quote:'✿',todo:'✓',progress:'↗',recent:'↗',favorites:'♡',watching:'▶',player:'♫',note:'✎',link:'↗',quick:'⌘'})[type]||'✦'; }
  function renderWeather(root) {
    const top=el('div','weather-top'); const left=el('div'); left.append(el('div','weather-degree',weather ? `${Math.round(weather.temp)}°` : '--°'),el('div','widget-empty',state.city.name));
    top.append(left,el('div','weather-art',weather?.symbol||'☀️')); root.append(top);
    root.append(el('p','weather-bottom',weather ? `${weather.label} · ${Math.round(weather.min)}° / ${Math.round(weather.max)}°` : '正在获取实时天气…'));
  }
  async function loadWeather() {
    try {
      const { latitude,longitude }=state.city;
      const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),6500);
      const url=`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`;
      const response=await fetch(url,{signal:controller.signal}); clearTimeout(timer);
      if (!response.ok) throw Error('weather');
      const data=await response.json(); const code=data.current.weather_code;
      const rainy=code>=51&&code<=82, snowy=code>=71&&code<=77;
      weather={temp:data.current.temperature_2m,min:data.daily.temperature_2m_min[0],max:data.daily.temperature_2m_max[0],label:snowy?'雪':rainy?'雨':code>=95?'雷雨':code>=2?'多云':'晴',symbol:snowy?'❄️':rainy?'🌧️':code>=95?'⛈️':code>=2?'⛅':'☀️'};
    } catch { weather=null; }
    document.querySelectorAll('[data-type="weather"] .widget-content').forEach(root => { root.replaceChildren(); renderWeather(root); if(!weather) $('.weather-bottom',root).textContent='天气暂不可用 · 请稍后刷新'; });
  }
  function renderCalendar(root) {
    const date=new Date(), year=date.getFullYear(), month=date.getMonth(), count=new Date(year,month+1,0).getDate(), offset=(new Date(year,month,1).getDay()+6)%7;
    root.append(el('div','calendar-month',`${year}年 ${month+1}月`));
    const week=el('div','calendar-week'); ['一','二','三','四','五','六','日'].forEach(day=>week.append(el('span','',day))); root.append(week);
    const days=el('div','calendar-days'); for(let i=0;i<offset;i++) days.append(el('span'));
    for(let day=1;day<=count;day++){const cell=el('span',day===date.getDate()?'today':'',String(day));days.append(cell);} root.append(days);
  }
  function renderQuote(root) {
    const index=(Math.floor(Date.now()/86400000)+quoteOffset)%quotes.length;
    root.append(el('p','quote-body',`“${quotes[index]}”`),el('p','quote-foot','— 给今天的你'));
    const change=el('button','chip-button','换一句'); change.type='button'; change.style.marginTop='10px';
    change.addEventListener('click',()=>{quoteOffset++;root.replaceChildren();renderQuote(root);}); root.append(change);
  }
  function renderTodos(root) {
    const list=el('div','todo-list');
    state.todos.slice(0,4).forEach(item=>{
      const label=el('label',`todo-item${item.done?' done':''}`); const check=el('input');check.type='checkbox';check.checked=item.done;
      check.addEventListener('change',()=>{item.done=check.checked;save();renderPages();});label.append(check,el('span','',item.text));list.append(label);
    });root.append(list);
  }
  function renderProgress(root,widget) {
    root.append(el('h3','',widget.content||'本周已完成 4 / 6 个小目标'),el('span','progress-illustration','✎'));
    const bar=el('div','progress-line');bar.append(el('i'));root.append(bar);
    const foot=el('p','progress-foot');foot.append(el('span','','继续加油，每一步都算数'),el('span','','67%'));root.append(foot);
  }
  function renderLinkList(root,ids,kind) {
    const list=el('div',`${kind}-list`);let count=0;
    ids.forEach(id=>{const app=appById(id);if(!app)return;count++;const link=el('a',`${kind}-link`);link.href=app.url;link.target='_blank';link.rel='noopener noreferrer';link.append(appIcon(app,true),el('span','',app.name));link.addEventListener('click',()=>{state.history=[app.id,...state.history.filter(x=>x!==app.id)].slice(0,12);save();});list.append(link);});
    root.append(count?list:el('p','widget-empty','打开一个 App，这里会留下足迹。'));
  }
  function renderWatching(root) {
    const row=el('div','watching-row');state.watching.slice(0,3).forEach(item=>{const link=el('a',`watch-card ${item.tone||'blue'}`);link.href=validUrl(item.url)||'#';link.target='_blank';link.rel='noopener noreferrer';link.append(el('b','',item.mark||'▶'));const copy=el('div');copy.append(el('strong','',item.title),el('small','',item.subtitle));link.append(copy);row.append(link);});root.append(row);
  }
  function renderPlayer(root) {
    const track=musicTracks[music.track];const main=el('div','player-main');main.append(el('div','album-art','♫'));
    const title=el('div','player-title');title.append(el('strong','',track.title),el('small','',track.caption));main.append(title);root.append(main);
    const controls=el('div','player-controls');
    const prev=el('button','','◀');prev.type='button';prev.title='上一首';prev.addEventListener('click',()=>switchTrack(-1));
    const play=el('button','play-button',music.playing?'Ⅱ':'▶');play.type='button';play.title=music.playing?'暂停':'播放';play.addEventListener('click',toggleMusic);
    const next=el('button','','▶');next.type='button';next.title='下一首';next.addEventListener('click',()=>switchTrack(1));controls.append(prev,play,next);root.append(controls);
    const progress=el('div','player-progress');progress.title='点击调整进度';const fill=el('i');fill.style.width=`${music.elapsed/32*100}%`;progress.append(fill);progress.addEventListener('click',event=>{music.elapsed=Math.max(0,Math.min(32,(event.clientX-progress.getBoundingClientRect().left)/progress.clientWidth*32));music.lastNote=-1;updatePlayer();});root.append(progress);
  }
  function renderQuick(root) {
    const row=el('div','quick-links');['github','vscode','figma','cloudflare'].forEach(id=>{const app=appById(id);if(!app)return;const link=el('a','',app.name+' ↗');link.href=app.url;link.target='_blank';link.rel='noopener noreferrer';row.append(link);});root.append(row);
  }
  function renderDock() {
    const dock=$('#dock');dock.replaceChildren();dock.style.setProperty('--dock-count',Math.max(1,state.dock.length));
    state.dock.forEach(id=>{const app=appById(id);if(!app)return;const button=el('button','dock-app');button.type='button';button.dataset.id=id;button.dataset.kind='app';button.title=app.name;button.setAttribute('aria-label',`打开 ${app.name}`);button.append(appIcon(app),el('span','dock-tooltip',app.name));button.addEventListener('click',event=>{if(editing||Date.now()<suppressClickUntil){event.preventDefault();return;}openApp(app,$('.app-icon',button));});button.addEventListener('contextmenu',event=>{event.preventDefault();event.stopPropagation();openAppContext(app.id,event.clientX,event.clientY);});attachDrag(button,'app',id);dock.append(button);});
    dock.append(el('span','dock-divider'));
    const more=el('button','dock-more','+');more.type='button';more.title='添加到桌面';more.setAttribute('aria-label','添加到桌面');more.addEventListener('click',event=>openDesktopContext(event));dock.append(more);
    dock.querySelectorAll('.dock-app').forEach((button,index,all)=>{
      button.addEventListener('mouseenter',()=>{if(all[index-1])all[index-1].classList.add('neighbor');if(all[index+1])all[index+1].classList.add('neighbor');});
      button.addEventListener('mouseleave',()=>all.forEach(item=>item.classList.remove('neighbor')));
    });
  }
  function attachDrag(node,type,id) {
    node.addEventListener('pointerdown',event => {
      if (event.button !== 0 || dragState || resizeState || dropSettling || $('#settingsDialog').open || $('#editorDialog').open || surfaces.has('search')) return;
      if (event.target.closest('.app-edit,.widget-edit,.folder-resize-handle,.folder-resize-edge,.folder-more')) return;
      if(type==='folder'&&event.target.closest('.folder-app'))return;
      if (type === 'widget' && event.target.closest('button,a,input,label,.player-progress')) return;
      const rect=node.getBoundingClientRect();
      const sourceDock=node.classList.contains('dock-app'),sourceFolder=node.dataset.folder||null;
      const desktopNode=sourceDock?document.querySelector(`.desktop-canvas>[data-id="${CSS.escape(id)}"]`):sourceFolder?null:node;
      dragState={node,type,id,sourceDock,sourceFolder,sourcePage:itemById(type,id).page,sourceCanvas:desktopNode?.closest('.desktop-canvas'),sourcePos:desktopNode?tilePosition(desktopNode):null,
        sourceRect:desktopNode?.getBoundingClientRect()||rect,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,
        offsetX:event.clientX-rect.left,offsetY:event.clientY-rect.top,width:rect.width,height:rect.height,active:false,touch:event.pointerType==='touch'};
      dragState.lastX=event.clientX;dragState.lastY=event.clientY;
      if (dragState.touch && !editing) dragState.timer=setTimeout(()=>{
        if(type==='folder'){dragState=null;pointerStart=null;suppressClickUntil=Date.now()+700;armFolderResize(id);openItemContext(type,id,event.clientX,event.clientY);}
        else startTileDrag(dragState);
      },380);
    });
  }
  function tilePosition(node) {
    const column=node.style.gridColumn.match(/(\d+)\s*\/\s*span\s*(\d+)/),row=node.style.gridRow.match(/(\d+)\s*\/\s*span\s*(\d+)/);
    const segment=Number(node.closest('.desktop-canvas')?.dataset.segment)||0;
    return {x:Number(column?.[1]||1)-1,y:segment*rowsPerPage+Number(row?.[1]||1)-1,w:Number(column?.[2]||1),h:Number(row?.[2]||1)};
  }
  function freezeLayout(mode) {
    document.querySelectorAll('.desktop-canvas>.app-shortcut,.desktop-canvas>.widget-card,.desktop-canvas>.folder-tile').forEach(node=>{
      const pos=tilePosition(node),old=state.layout[mode][node.dataset.id];
      state.layout[mode][node.dataset.id]={page:node.dataset.page,x:pos.x,y:pos.y,priority:Number(old?.priority)||1};
    });
  }
  function clearDragPreview(drag) {
    if(drag.shifted instanceof Element){drag.shifted.style.transform='';drag.shifted.classList.remove('preview-shift','preview-swap-away');drag.shifted=null;}
    if(drag.previewNode)folderResizeObserver.unobserve(drag.previewNode);drag.previewNode?.remove();drag.previewNode=null;drag.previewTarget=null;
    document.querySelectorAll('.folder-drop-ready,.dock-drop-ready,.folder-group-ready,.folder-slot-target').forEach(node=>node.classList.remove('folder-drop-ready','dock-drop-ready','folder-group-ready','folder-slot-target'));
    $('.dock-insert-marker')?.remove();
  }
  function resetGroupCandidate(drag) { clearTimeout(drag.groupTimer);drag.groupCandidate=null;drag.groupReady=false; }
  function drawDropPreview(drag,rect,target) {
    const resizing=target.action==='resize',compact=resizing&&target.w===1&&target.h===1;
    const folderPreview=()=>renderFolderTile({...drag.folder,sizes:{...drag.folder.sizes,[layoutMode()]:{w:target.w,h:target.h}}});
    if(!drag.previewNode){drag.previewNode=resizing?folderPreview():drag.node.cloneNode(true);drag.previewNode.removeAttribute('id');drag.previewNode.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));drag.previewNode.classList.remove('is-dragging');drag.previewNode.classList.add('drop-preview');document.body.append(drag.previewNode);}
    else if(resizing&&drag.previewNode.classList.contains('compact')!==compact){const next=folderPreview();drag.previewNode.className=`${next.className} drop-preview`;drag.previewNode.replaceChildren(...next.childNodes);delete drag.previewNode.dataset.fit;}
    Object.assign(drag.previewNode.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`});drag.previewTarget={...target,rect};
    if(resizing)requestAnimationFrame(()=>{if(drag.previewNode)fitFolderTile(drag.previewNode);});
  }
  function insideRect(event,rect,padding=0) { return event.clientX>=rect.left-padding&&event.clientX<=rect.right+padding&&event.clientY>=rect.top-padding&&event.clientY<=rect.bottom+padding; }
  function updateDragPreview(drag,event) {
    const dock=$('#dock'),dockRect=dock.getBoundingClientRect();
    if(drag.type==='app'&&insideRect(event,dockRect,12)){
      if(drag.sourceFolder&&surfaces.get('folder')?.status!=='closing')closeFolder(true);
      clearDragPreview(drag);resetGroupCandidate(drag);dock.classList.add('dock-drop-ready');
      if(!state.dock.includes(drag.id)&&state.dock.length>=12)return;
      const nodes=[...dock.querySelectorAll('.dock-app')].filter(node=>node.dataset.id!==drag.id);
      const index=nodes.filter(node=>event.clientX>node.getBoundingClientRect().left+node.getBoundingClientRect().width/2).length;
      const reference=nodes[index]?.getBoundingClientRect(),last=nodes.at(-1)?.getBoundingClientRect();
      const left=reference?reference.left-3:last?last.right+3:dockRect.left+10;
      const marker=el('span','dock-insert-marker');marker.style.left=`${left-dockRect.left}px`;dock.append(marker);
      drag.previewTarget={action:'dock',index,rect:{left:Math.max(dockRect.left,Math.min(left,dockRect.right-46)),top:dockRect.top+8,width:46,height:46}};return;
    }
    const folderSurface=surfaces.get('folder');
    const inlineFolder=drag.sourceFolder&&!folderSurface?drag.node.closest('.folder-tile'):null;
    if(inlineFolder&&insideRect(event,inlineFolder.getBoundingClientRect())){
      clearDragPreview(drag);resetGroupCandidate(drag);const nodes=[...inlineFolder.querySelectorAll('.folder-tile-grid>.folder-app')].filter(node=>node.dataset.id!==drag.id);
      const closest=nodes.map(node=>({node,rect:node.getBoundingClientRect()})).sort((a,b)=>Math.hypot(event.clientX-a.rect.left-a.rect.width/2,event.clientY-a.rect.top-a.rect.height/2)-Math.hypot(event.clientX-b.rect.left-b.rect.width/2,event.clientY-b.rect.top-b.rect.height/2))[0];
      if(closest){closest.node.classList.add('folder-slot-target');drawDropPreview(drag,closest.rect,{action:'folder-order',folder:drag.sourceFolder,before:closest.node.dataset.id});}return;
    }
    if(drag.sourceFolder&&folderSurface&&folderSurface.status!=='closing'&&insideRect(event,$('#folderDialog').getBoundingClientRect())){
      clearDragPreview(drag);resetGroupCandidate(drag);const nodes=[...$('#folderGrid').children].filter(node=>node.dataset.id!==drag.id);
      const closest=nodes.map(node=>({node,rect:node.getBoundingClientRect()})).sort((a,b)=>Math.hypot(event.clientX-a.rect.left-a.rect.width/2,event.clientY-a.rect.top-a.rect.height/2)-Math.hypot(event.clientX-b.rect.left-b.rect.width/2,event.clientY-b.rect.top-b.rect.height/2))[0];
      if(closest){closest.node.classList.add('folder-slot-target');drawDropPreview(drag,closest.rect,{action:'folder-order',folder:drag.sourceFolder,before:closest.node.dataset.id});}return;
    }
    if(drag.sourceFolder&&folderSurface&&folderSurface.status!=='closing')closeFolder(true);
    dock.classList.remove('dock-drop-ready');$('.dock-insert-marker')?.remove();
    if(!insideRect(event,$('#desktopViewport').getBoundingClientRect())){clearDragPreview(drag);resetGroupCandidate(drag);return;}
    const view=viewPages[currentPage],canvas=$('.desktop-canvas',$('#pageTrack').children[currentPage]);
    if(!canvas)return;
    const mode=layoutMode(),columns=gridColumns(mode),item={kind:drag.type,data:itemById(drag.type,drag.id)};
    if(!item.data)return;
    const {w,h}=tileSize(item,mode),bounds=canvas.getBoundingClientRect(),style=getComputedStyle(canvas);
    const gapX=parseFloat(style.columnGap)||0,gapY=parseFloat(style.rowGap)||0,rowHeight=parseFloat(style.gridAutoRows)||75;
    const columnWidth=(bounds.width-gapX*(columns-1))/columns,pitchX=columnWidth+gapX,pitchY=rowHeight+gapY;
    const wantedX=Math.max(0,Math.min(columns-w,Math.round((event.clientX-drag.offsetX-bounds.left)/pitchX)));
    const wantedY=Math.max(0,Math.min(rowsPerPage-h,Math.round((event.clientY-drag.offsetY-bounds.top)/pitchY)));
    const nodes=[...canvas.children].filter(node=>node.matches('.app-shortcut,.widget-card,.folder-tile')&&node.dataset.id!==drag.id);
    const folderTarget=drag.type==='app'&&!item.data.system?nodes.find(node=>node.dataset.kind==='folder'&&insideRect(event,node.getBoundingClientRect())):null;
    document.querySelectorAll('.folder-drop-ready,.folder-group-ready,.folder-slot-target').forEach(node=>node.classList.remove('folder-drop-ready','folder-group-ready','folder-slot-target'));
    if(folderTarget){clearDragPreview(drag);resetGroupCandidate(drag);folderTarget.classList.add('folder-drop-ready');drag.previewTarget={action:'folder-add',folder:folderTarget.dataset.id,rect:folderTarget.getBoundingClientRect()};return;}
    const overlaps=(x,y,node)=>{const pos=tilePosition(node),localY=pos.y%rowsPerPage;return x<pos.x+pos.w&&x+w>pos.x&&y<localY+pos.h&&y+h>localY;};
    let x=wantedX,y=wantedY,collisions=nodes.filter(node=>overlaps(x,y,node)),swap=null;
    if(collisions.length===1){const pos=tilePosition(collisions[0]);
      if(drag.sourcePos&&collisions[0].dataset.kind===drag.type&&pos.w===w&&pos.h===h&&pos.x===x&&pos.y%rowsPerPage===y)swap=collisions[0];
    }
    const groupApp=drag.type==='app'&&!item.data.system&&collisions.length===1&&collisions[0].dataset.kind==='app'&&!appById(collisions[0].dataset.id).system?collisions[0]:null;
    if(groupApp){
      if(drag.groupCandidate!==groupApp.dataset.id){resetGroupCandidate(drag);drag.groupCandidate=groupApp.dataset.id;drag.groupTimer=setTimeout(()=>{if(dragState===drag){drag.groupReady=true;updateDragPreview(drag,{clientX:drag.lastX,clientY:drag.lastY});}},520);}
      if(drag.groupReady){clearDragPreview(drag);groupApp.classList.add('folder-group-ready');drag.previewTarget={action:'folder-create',with:groupApp.dataset.id,pageId:view.pageId,position:tilePosition(groupApp),rect:groupApp.getBoundingClientRect()};return;}
    }else resetGroupCandidate(drag);
    if(collisions.length&&!swap){
      const choices=[];
      for(let row=0;row<=rowsPerPage-h;row++)for(let col=0;col<=columns-w;col++)
        if(!nodes.some(node=>overlaps(col,row,node)))choices.push({x:col,y:row,score:Math.abs(col-wantedX)+Math.abs(row-wantedY)});
      choices.sort((a,b)=>a.score-b.score||a.y-b.y||a.x-b.x);
      if(!choices.length){clearDragPreview(drag);return;}
      ({x,y}=choices[0]);
    }
    if(drag.shifted&&drag.shifted!==swap){drag.shifted.style.transform='';drag.shifted.classList.remove('preview-shift','preview-swap-away');drag.shifted=null;}
    if(swap&&!drag.shifted){
      drag.shifted=swap;swap.classList.add('preview-shift');
      if(canvas===drag.sourceCanvas){const from=drag.sourceRect,to=swap.getBoundingClientRect();swap.style.transform=`translate3d(${from.left-to.left}px,${from.top-to.top}px,0)`;}
      else swap.classList.add('preview-swap-away');
    }
    const rect={left:bounds.left+x*pitchX,top:bounds.top+y*pitchY,width:w*columnWidth+(w-1)*gapX,height:h*rowHeight+(h-1)*gapY};
    drawDropPreview(drag,rect,{action:'desktop',pageId:view.pageId,segment:view.segment,x,y:view.segment*rowsPerPage+y,swap});
  }
  function startTileDrag(drag) {
    if (!drag || drag !== dragState || drag.active) return;
    try{drag.node.setPointerCapture(drag.pointerId);}catch{ /* Synthetic pointers may not have capture. */ }
    drag.active=true; clearTimeout(drag.timer); drag.node.classList.add('is-dragging');
    const ghost=drag.node.cloneNode(true); ghost.removeAttribute('id'); ghost.querySelectorAll('[id]').forEach(child=>child.removeAttribute('id'));
    ghost.classList.add('drag-ghost'); ghost.classList.remove('is-dragging');
    ghost.style.width=`${drag.width}px`; ghost.style.height=`${drag.height}px`;
    ghost.style.left=`${drag.startX-drag.offsetX}px`; ghost.style.top=`${drag.startY-drag.offsetY}px`;
    document.body.append(ghost); drag.ghost=ghost;
    $('#desktopShell').classList.add('drag-active');
    document.body.classList.add('drag-active');closeAppContext();
    updateDragPreview(drag,{clientX:drag.startX,clientY:drag.startY});
  }
  function stopTileDrag(event, canceled=false) {
    const drag=dragState;
    if (!drag || drag.pointerId!==event.pointerId) return;
    clearTimeout(drag.timer); clearTimeout(drag.edgeTimer);
    if (!drag.active){dragState=null;return;}
    if(!canceled)updateDragPreview(drag,event);
    clearTimeout(drag.groupTimer);
    dragState=null;
    if(canceled)pointerStart=null;
    try{drag.node.releasePointerCapture(event.pointerId);}catch{}
    suppressClickUntil=Date.now()+450;
    const target=drag.previewTarget;
    const sameSpot=target?.action==='desktop'&&!drag.sourceDock&&!drag.sourceFolder&&target.pageId===drag.sourcePage&&target.x===drag.sourcePos?.x&&target.y===drag.sourcePos?.y&&!target.swap;
    const settle=()=>{clearDragPreview(drag);drag.ghost?.remove();drag.node.classList.remove('is-dragging');$('#desktopShell').classList.remove('drag-active');document.body.classList.remove('drag-active');dropSettling=false;};
    if(canceled||!target||sameSpot){settle();return;}
    dropSettling=true;
    const mode=layoutMode(),item=itemById(drag.type,drag.id);let createdFolder=null,message='位置已保存';
    freezeLayout(mode);
    const priority=Date.now();
    if(target.action==='dock'){
      state.dock=state.dock.filter(id=>id!==drag.id);state.dock.splice(target.index,0,drag.id);message='已固定到 Dock';
    }else if(target.action==='folder-order'){
      const folder=folderById(target.folder);folder.appIds=folder.appIds.filter(id=>id!==drag.id);const index=folder.appIds.indexOf(target.before);folder.appIds.splice(index<0?folder.appIds.length:index,0,drag.id);message='文件夹顺序已保存';
    }else if(target.action==='folder-add'){
      const folder=folderById(target.folder);removeFromFolders(drag.id);folder.appIds.push(drag.id);item.page=folder.page;message=`已移入 ${folder.name}`;
    }else if(target.action==='folder-create'){
      const other=appById(target.with);removeFromFolders(drag.id);removeFromFolders(other.id);
      createdFolder={id:crypto.randomUUID(),name:suggestGroups([item,other])[0]?.name||'文件夹',page:target.pageId,appIds:[other.id,drag.id],sizes:{[mode]:{w:1,h:1}}};
      state.folders.push(createdFolder);item.page=other.page=target.pageId;
      state.layout[mode][createdFolder.id]={page:target.pageId,x:target.position.x,y:target.position.y,priority};message='已创建文件夹';
    }else{
      if(drag.type==='app')removeFromFolders(drag.id);item.page=target.pageId;
      if(drag.type==='folder')item.appIds.forEach(id=>appById(id).page=target.pageId);
      state.layout[mode][drag.id]={page:target.pageId,x:target.x,y:target.y,priority};
    }
    if(drag.sourceDock&&target.action!=='dock')state.dock=state.dock.filter(id=>id!==drag.id);
    if(target.swap){const other=itemById(target.swap.dataset.kind,target.swap.dataset.id);
      if(other){other.page=drag.sourcePage;if(target.swap.dataset.kind==='folder')other.appIds.forEach(id=>appById(id).page=drag.sourcePage);state.layout[mode][other.id]={page:drag.sourcePage,x:drag.sourcePos.x,y:drag.sourcePos.y,priority:priority-1};}
    }
    save();
    drag.ghost.animate([{left:drag.ghost.style.left,top:drag.ghost.style.top,opacity:1},{left:`${target.rect.left}px`,top:`${target.rect.top}px`,opacity:.45}],{duration:220,easing:'cubic-bezier(.2,.7,.2,1)',fill:'forwards'});
    setTimeout(()=>{settle();renderPages();renderDock();if(folderId)renderFolderContents();if(createdFolder)openFolder(createdFolder.id);toast(message);},230);
  }
  function startFolderResize(event,node,folder,axis='both') {
    if(event.button!==0||dragState||resizeState||dropSettling)return;event.preventDefault();event.stopPropagation();
    const canvas=node.closest('.desktop-canvas'),bounds=canvas.getBoundingClientRect(),style=getComputedStyle(canvas),columns=gridColumns(layoutMode());
    const gapX=parseFloat(style.columnGap),gapY=parseFloat(style.rowGap),columnWidth=(bounds.width-gapX*(columns-1))/columns,rowHeight=parseFloat(style.gridAutoRows);
    resizeState={node,folder,axis,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,pos:tilePosition(node),rect:node.getBoundingClientRect(),columnWidth,rowHeight,gapX,gapY,columns,shifted:[]};
    node.classList.add('is-dragging');try{event.currentTarget.setPointerCapture(event.pointerId);}catch{}updateFolderResize(event);
  }
  function updateFolderResize(event) {
    const resize=resizeState;if(!resize||resize.pointerId!==event.pointerId)return;event.preventDefault();
    const {pos,columns,columnWidth,rowHeight,gapX,gapY}=resize,pitchX=columnWidth+gapX,pitchY=rowHeight+gapY;
    const w=Math.max(1,Math.min(columns,Math.round(pos.w+(event.clientX-resize.startX)/pitchX)));
    const h=resize.axis==='width'?pos.h:Math.max(1,Math.min(rowsPerPage,Math.round(pos.h+(event.clientY-resize.startY)/pitchY)));
    const nodes=[...document.querySelectorAll(`.desktop-canvas[data-page="${CSS.escape(resize.folder.page)}"]> [data-kind]`)].filter(node=>node.dataset.id!==resize.folder.id);
    const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
    const target={x:Math.min(pos.x,columns-w),y:Math.floor(pos.y/rowsPerPage)*rowsPerPage+Math.min(pos.y%rowsPerPage,rowsPerPage-h),w,h},affected=nodes.filter(node=>overlaps(target,tilePosition(node))),fixed=nodes.filter(node=>!affected.includes(node)).map(tilePosition),occupied=[target,...fixed],moves=[];
    for(const node of affected){
      const old=tilePosition(node),choices=[];
      for(let y=0;y<pos.y+rowsPerPage*3;y++)for(let x=0;x<=columns-old.w;x++){
        const candidate={x,y,w:old.w,h:old.h};if(y%rowsPerPage+old.h>rowsPerPage||occupied.some(rect=>overlaps(candidate,rect)))continue;
        choices.push({...candidate,score:Math.abs(x-old.x)+Math.abs(y-old.y)+Math.abs(Math.floor(y/rowsPerPage)-Math.floor(old.y/rowsPerPage))*columns});
      }
      choices.sort((a,b)=>a.score-b.score||a.y-b.y||a.x-b.x);const next=choices[0];if(!next)return;occupied.push(next);moves.push({node,pos:next});
    }
    resize.shifted.forEach(node=>{node.style.transform='';node.classList.remove('preview-shift','preview-swap-away');});resize.shifted=[];
    moves.forEach(move=>{move.node.classList.add('preview-shift');if(Math.floor(move.pos.y/rowsPerPage)!==Math.floor(pos.y/rowsPerPage))move.node.classList.add('preview-swap-away');else{const old=tilePosition(move.node);move.node.style.transform=`translate3d(${(move.pos.x-old.x)*pitchX}px,${(move.pos.y-old.y)*pitchY}px,0)`;}resize.shifted.push(move.node);});
    resize.plan={...target,moves};drawDropPreview(resize,{left:resize.rect.left+(target.x-pos.x)*pitchX,top:resize.rect.top+(target.y-pos.y)*pitchY,width:w*columnWidth+(w-1)*gapX,height:h*rowHeight+(h-1)*gapY},{action:'resize',w,h});
  }
  function finishFolderResize(event,canceled=false) {
    const resize=resizeState;if(!resize||resize.pointerId!==event.pointerId)return;
    if(!canceled)updateFolderResize(event);resizeState=null;
    resize.shifted.forEach(node=>{node.style.transform='';node.classList.remove('preview-shift','preview-swap-away');});clearDragPreview(resize);resize.node.classList.remove('is-dragging');suppressClickUntil=Date.now()+450;
    if(canceled||!resize.plan)return;
    freezeLayout(layoutMode());resize.folder.sizes[layoutMode()]={w:resize.plan.w,h:resize.plan.h};
    resize.plan.moves.forEach(move=>{state.layout[layoutMode()][move.node.dataset.id]={page:resize.folder.page,x:move.pos.x,y:move.pos.y,priority:Date.now()-1};});
    state.layout[layoutMode()][resize.folder.id]={page:resize.folder.page,x:resize.plan.x,y:resize.plan.y,priority:Date.now()};
    animateDesktopMutation(()=>{});toast('文件夹大小已保存');
  }
  function moveItem(type,id,direction) {
    const list=type==='app'?state.apps:state.widgets;const index=list.findIndex(item=>item.id===id);const next=index+direction;
    if(index<0||next<0||next>=list.length||list[next].page!==list[index].page)return;
    [list[index],list[next]]=[list[next],list[index]];save();renderPages();renderSettings();
  }
  function toggleEdit() {
    editing=!editing;$('#desktopShell').classList.toggle('editing',editing);$('#editModeButton').classList.toggle('active',editing);
    toast(editing?'整理模式：拖动 App 或卡片，点击 ✎ 编辑':'桌面布局已保存');
  }
  function searchOpen() {
    if(surfaces.get('search')?.status==='open'||surfaces.get('search')?.status==='opening')return;
    closeAppContext();if(!surfaces.has('search')){$('#searchInput').value='';selectedSearch=0;renderSearch();}
    openSurface('search',$('#searchTrigger'));
  }
  function searchClose() { closeSurface('search'); }
  function surfaceNodes(name) {
    return {panel:name==='search'?$('.search-panel'):$(`#${name}Dialog`),overlay:$(`#${name}Overlay`),content:name==='search'?[$('.search-field'),$('.search-body'),$('.engine-bar')]:[$(`.${name}-frame`)]};
  }
  function surfaceTarget(name) {
    const width=Math.min(['settings','organizer'].includes(name)?880:name==='folder'?620:650,innerWidth-24);
    const height=Math.min(['settings','organizer'].includes(name)?660:name==='folder'?500:480,innerHeight-(name==='search'?innerHeight-$('#searchTrigger').getBoundingClientRect().bottom+24:40));
    return {left:(innerWidth-width)/2,top:name==='search'?$('#searchTrigger').getBoundingClientRect().bottom-height:(innerHeight-height)/2,width,height};
  }
  function geometry(rect,radius) { return {left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,borderRadius:`${radius}px`}; }
  function syncSurfaceOrigins() {
    for(const context of surfaces.values()){
      if(!context.origin?.isConnected&&context.originSelector)context.origin=$(context.originSelector);
      context.origin?.classList.add('surface-origin-hidden');
    }
  }
  function syncSurfaceFocus() { $('#desktopShell').inert=[...surfaces.values()].some(context=>context.status!=='closing'); }
  function openSurface(name,origin) {
    const nodes=surfaceNodes(name);let context=surfaces.get(name);
    const from=context?nodes.panel.getBoundingClientRect():null,startRadius=context?parseFloat(getComputedStyle(nodes.panel).borderRadius):name==='search'?100:18;
    if(!context){
      if(!(origin instanceof Element))origin=name==='settings'?document.querySelector(`#pageTrack>.desktop-page:nth-child(${currentPage+1}) [data-id="weboss-settings"] .app-icon`)||$('.dock-more'):$('#searchTrigger');
      const rect=origin?.getBoundingClientRect();
      if(!rect||rect.right<0||rect.left>innerWidth)origin=$('.dock-more');
      const owner=origin.closest('[data-id]'),area=owner?.classList.contains('dock-app')?'#dock':'.desktop-canvas';
      context={...nodes,name,origin,originRect:origin.getBoundingClientRect(),originSelector:owner?`${area} [data-id="${CSS.escape(owner.dataset.id)}"]${origin.classList.contains('app-icon')?' .app-icon':''}`:origin.id?`#${origin.id}`:null};surfaces.set(name,context);
      context.seed=el('div',`surface-seed ${name}-seed`);
      if(name==='search')context.seed.append(el('span','search-glyph','⌕'),el('span','',state.searchLabel));
      else if(name==='settings')context.seed.append(origin.cloneNode(true));
      else context.seed.append(el('span','folder-seed-icon','▦'));
      nodes.panel.append(context.seed);if(nodes.panel instanceof HTMLDialogElement)nodes.panel.show();
    }
    context.animation?.cancel();context.status='opening';context.panel.classList.remove('surface-closing');
    nodes.overlay.classList.add('open');nodes.overlay.classList.remove('closing');nodes.overlay.setAttribute('aria-hidden','false');nodes.panel.setAttribute('aria-modal','true');
    const target=surfaceTarget(name),start=from||context.originRect;Object.assign(nodes.panel.style,geometry(target,27));
    context.origin?.classList.add('surface-origin-hidden');syncSurfaceFocus();
    const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?1:420;
    context.content.forEach(node=>{const opacity=from?getComputedStyle(node).opacity:0;node.getAnimations().forEach(animation=>animation.cancel());node.animate([{opacity},{opacity:1}],{duration:duration*.7,delay:duration*.15,fill:'both',easing:'ease'});});
    const seedOpacity=from?getComputedStyle(context.seed).opacity:1;context.seed.getAnimations().forEach(animation=>animation.cancel());context.seed.animate([{opacity:seedOpacity},{opacity:0}],{duration:duration*.5,fill:'forwards'});
    const animation=nodes.panel.animate([geometry(start,startRadius),geometry(target,27)],{duration,fill:'forwards',easing:'cubic-bezier(.22,.7,.2,1)'});context.animation=animation;
    animation.finished.then(()=>{if(context.animation!==animation)return;Object.assign(nodes.panel.style,geometry(target,27));animation.cancel();context.animation=null;context.status='open';}).catch(()=>{});
    setTimeout(()=>{if(surfaces.get(name)===context&&context.status!=='closing')$(name==='search'?'#searchInput':`#${name}Close`).focus({preventScroll:true});},duration*.6);
  }
  function closeSurface(name,onClosed,forDrag=false) {
    const context=surfaces.get(name);if(!context||context.status==='closing')return;
    const from=context.panel.getBoundingClientRect(),radius=parseFloat(getComputedStyle(context.panel).borderRadius)||27;context.animation?.cancel();context.status='closing';
    syncSurfaceOrigins();const originRect=context.origin?.getBoundingClientRect(),target=originRect&&originRect.left>=0&&originRect.right<=innerWidth?originRect:context.originRect;
    context.overlay.classList.add('closing');context.panel.classList.add('surface-closing');syncSurfaceFocus();if(forDrag)$('#desktopShell').inert=false;
    const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?1:380;
    context.content.forEach(node=>{const opacity=getComputedStyle(node).opacity;node.getAnimations().forEach(animation=>animation.cancel());node.animate([{opacity},{opacity:0}],{duration:duration*.5,fill:'forwards'});});
    const seedOpacity=getComputedStyle(context.seed).opacity;context.seed.getAnimations().forEach(animation=>animation.cancel());context.seed.animate([{opacity:seedOpacity},{opacity:1}],{duration:duration*.6,delay:duration*.3,fill:'both'});
    const animation=context.panel.animate([geometry(from,radius),geometry(target,name==='search'?100:18)],{duration,fill:'forwards',easing:'cubic-bezier(.4,0,.2,1)'});context.animation=animation;
    animation.finished.then(()=>{
      if(context.animation!==animation)return;context.origin?.classList.remove('surface-origin-hidden');context.overlay.classList.remove('open','closing');context.overlay.setAttribute('aria-hidden','true');
      if(context.panel instanceof HTMLDialogElement)context.panel.close();context.panel.getAnimations().forEach(item=>item.cancel());context.content.forEach(node=>node.getAnimations().forEach(item=>item.cancel()));context.seed.remove();surfaces.delete(name);syncSurfaceFocus();onClosed?.();
      if(!forDrag&&!surfaces.size&&!$('#editorDialog').open)context.origin?.focus({preventScroll:true});
    }).catch(()=>{});
  }
  function queryResults() {
    const query=$('#searchInput').value.trim().toLocaleLowerCase();
    if(!query)return state.dock.map(id=>appById(id)).filter(Boolean).slice(0,6).map(app=>({type:'app',app}));
    const hits=state.apps.filter(app=>`${app.name} ${app.url}`.toLocaleLowerCase().includes(query));
    const history=state.searchHistory.filter(text=>text.toLocaleLowerCase().includes(query)).slice(0,2).map(text=>({type:'history',text}));
    return [...hits.slice(0,7).map(app=>({type:'app',app})),...history,{type:'web',text:$('#searchInput').value.trim()}];
  }
  function renderSearch() {
    const query=$('#searchInput').value.trim();$('#searchResultLabel').textContent=query?'搜索结果':'常用捷径';
    const results=queryResults(),root=$('#searchResults');root.replaceChildren();selectedSearch=Math.min(selectedSearch,Math.max(0,results.length-1));
    results.forEach((result,index)=>{
      const row=el('button',`search-result${index===selectedSearch?' selected':''}`);row.type='button';
      if(result.type==='app') {row.append(appIcon(result.app,true));const copy=el('span');copy.append(el('strong','',result.app.name),el('small','',result.app.system?'Weboss 桌面设置':result.app.url.replace(/^https?:\/\//,'')));row.append(copy);}
      else {row.append(el('span','tiny-app-icon',result.type==='history'?'↺':'⌕'));const copy=el('span');copy.append(el('strong','',result.type==='history'?result.text:`用 ${engines.find(e=>e.id===activeEngine).name} 搜索“${result.text}”`),el('small','',result.type==='history'?'搜索历史':'按 Enter 搜索网页'));row.append(copy);}
      row.append(el('span','result-arrow','↗'));row.addEventListener('click',()=>runResult(result));root.append(row);
    });
    const choices=$('#engineChoices');choices.replaceChildren();engines.forEach(engine=>{const button=el('button',`engine-choice${engine.id===activeEngine?' active':''}`,engine.name);button.type='button';button.addEventListener('click',()=>{activeEngine=engine.id;state.searchEngine=engine.id;save();renderSearch();});choices.append(button);});
  }
  function runResult(result) {
    if(result.type==='app') {openApp(result.app);searchClose();return;}
    const query=result.text.trim();if(!query)return;
    state.searchHistory=[query,...state.searchHistory.filter(x=>x!==query)].slice(0,12);save();
    const url=validUrl(query.startsWith('http')?query:`https://${query}`);
    const looksLikeDomain=/^(?:[\w-]+\.)+[a-z]{2,}(?:\/\S*)?$/i.test(query);
    window.open(looksLikeDomain&&url?url:engines.find(e=>e.id===activeEngine).url+encodeURIComponent(query),'_blank','noopener,noreferrer');searchClose();
  }
  function organizationSnapshot() {return clone({apps:state.apps,folders:state.folders,layout:state.layout,dock:state.dock,history:state.history,favoriteIds:state.favoriteIds});}
  function animateDesktopMutation(action) {
    const old=new Map([...document.querySelectorAll('.desktop-canvas>[data-id]')].map(node=>[node.dataset.id,node.getBoundingClientRect()]));
    action();refreshDesktop();
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    document.querySelectorAll('.desktop-canvas>[data-id]').forEach(node=>{const before=old.get(node.dataset.id),after=node.getBoundingClientRect();
      if(before&&Math.abs(before.left-after.left)<innerWidth*.7)node.animate([{transform:`translate(${before.left-after.left}px,${before.top-after.top}px) scale(${before.width/after.width},${before.height/after.height})`,transformOrigin:'top left'},{transform:'translate(0,0) scale(1,1)',transformOrigin:'top left'}],{duration:320,easing:'cubic-bezier(.22,.7,.2,1)'});
      else if(!before)node.animate([{opacity:0,transform:'scale(.9)'},{opacity:1,transform:'scale(1)'}],{duration:300,easing:'ease-out'});
    });
  }
  function applyOrganization(action,message) {
    const before=organizationSnapshot();
    animateDesktopMutation(()=>{freezeLayout(layoutMode());action();});
    organizationUndo={before,after:JSON.stringify(organizationSnapshot())};$('#undoOrganize').hidden=false;closeOrganizer();toast(`${message} · 可撤销`);
  }
  function undoOrganization() {
    if(!organizationUndo)return;
    if(JSON.stringify(organizationSnapshot())!==organizationUndo.after){organizationUndo=null;$('#undoOrganize').hidden=true;return toast('桌面已有其他修改，无法撤销上一次整理');}
    const before=organizationUndo.before;organizationUndo=null;$('#undoOrganize').hidden=true;animateDesktopMutation(()=>Object.assign(state,before));toast('已恢复整理前的桌面');
  }
  function clearAppLayout(id) {for(const mode of ['desktop','tablet','mobile'])delete state.layout[mode][id];}
  function pruneEmptiedFolders(previous) {
    state.folders=state.folders.filter(folder=>{if(folder.appIds.length||!previous.has(folder.id))return true;clearAppLayout(folder.id);return false;});
  }
  function openOrganizer(mode='bulk',selectedId=null,sourceFolder=null) {
    closeAppContext();organizerRequest?.abort();if(folderId)closeFolder();if(surfaces.has('settings'))closeSettings();
    organizerMode=mode;organizerFolderId=sourceFolder;organizerPlan=null;organizerBusy=false;selectedApps.clear();if(selectedId)selectedApps.add(selectedId);
    bulkDraft={action:'new',name:'常用 App',page:viewPages[currentPage].pageId,folder:state.folders[0]?.id||''};
    const scope=$('#organizerScope');scope.replaceChildren();[['all','全部桌面'],['current','当前桌面'],...(sourceFolder?[['folder','当前文件夹']]:[])].forEach(([value,label])=>{const option=el('option','',label);option.value=value;scope.append(option);});scope.value=sourceFolder?'folder':'all';
    $('#organizerFilter').value='';$('#organizerExisting').checked=mode==='bulk';renderOrganizer();openSurface('organizer',mode==='ai'?$('#organizeButton'):$('#batchButton'));
  }
  function closeOrganizer() {organizerRequest?.abort();organizerRequest=null;organizerBusy=false;closeSurface('organizer');}
  function organizerApps() {
    const query=$('#organizerFilter').value.trim().toLocaleLowerCase(),scope=$('#organizerScope').value;
    return state.apps.filter(app=>!app.system&&(scope!=='current'||app.page===viewPages[currentPage].pageId)&&(scope!=='folder'||folderById(organizerFolderId)?.appIds.includes(app.id))&&($('#organizerExisting').checked||scope==='folder'||!folderOfApp(app.id))&&`${app.name} ${app.url}`.toLocaleLowerCase().includes(query));
  }
  function organizerButton(label,handler,className='chip-button') {const button=el('button',className,label);button.type='button';button.addEventListener('click',handler);return button;}
  function renderOrganizer() {
    $('#organizerBulkTab').classList.toggle('active',organizerMode==='bulk');$('#organizerAITab').classList.toggle('active',organizerMode==='ai');
    $('#organizerExisting').closest('label').hidden=organizerMode!=='ai'||$('#organizerScope').value==='folder';
    $('#organizerFilter').disabled=organizerBusy;$('#organizerScope').disabled=organizerBusy;$('#organizerExisting').disabled=organizerBusy;
    $('#organizerBulkTab').disabled=$('#organizerAITab').disabled=organizerBusy;
    const content=$('#organizerContent');content.replaceChildren();
    if(organizerPlan&&organizerMode==='ai'){renderOrganizationPreview(content);renderOrganizerFooter();return;}
    const apps=organizerApps(),bar=el('div','organizer-selection-bar');
    bar.append(el('p','',organizerMode==='ai'?'相同用途的 App 放进同一个文件夹，先预览再应用。':'选择 App，一次完成移动、合并或清理。'),organizerButton('全选当前结果',()=>{apps.forEach(app=>selectedApps.add(app.id));renderOrganizer();}),organizerButton('清空选择',()=>{selectedApps.clear();renderOrganizer();}));content.append(bar);
    const grid=el('div','organizer-app-grid');apps.forEach(app=>{
      const label=el('label',`organizer-app${selectedApps.has(app.id)?' selected':''}`),check=el('input');check.type='checkbox';check.checked=selectedApps.has(app.id);check.disabled=organizerBusy;check.setAttribute('aria-label',`选择 ${app.name}`);
      check.addEventListener('change',()=>{if(check.checked)selectedApps.add(app.id);else selectedApps.delete(app.id);label.classList.toggle('selected',check.checked);renderOrganizerFooter();});
      const copy=el('span','organizer-app-copy');copy.append(el('strong','',app.name),el('small','',folderOfApp(app.id)?.name||state.pages.find(page=>page.id===app.page)?.name));label.append(check,appIcon(app,true),copy);grid.append(label);
    });content.append(grid);if(!apps.length)content.append(el('p','organizer-empty','这里没有符合条件的 App，试试其他范围。'));renderOrganizerFooter();
  }
  function renderOrganizerFooter() {
    const footer=$('#organizerFooter');footer.replaceChildren();
    if(organizerMode==='ai'){
      const copy=el('div','organizer-footer-copy');copy.append(el('strong','',organizerBusy?'正在生成整理预览…':organizerPlan?organizerPlan.source:`${selectedApps.size?`已选择 ${selectedApps.size} 个`:`当前范围 ${organizerApps().length} 个`} App`),el('small','',organizerPlan?'可改名、调整成员和目标桌面；未归组的 App 保持原位。':'AI 仅接收 App 名称和域名；服务不可用时使用本地规则。'));footer.append(copy);
      if(organizerPlan){footer.append(organizerButton('重新选择',()=>{organizerPlan=null;renderOrganizer();},'button-secondary'));const apply=organizerButton('应用整理',applyAIOrganization,'button-primary');apply.disabled=!validateGroups(organizerPlan.groups.filter(group=>group.enabled),state.apps).length;footer.append(apply);}
      else{const button=organizerButton(organizerBusy?'整理中…':'生成整理预览',generateOrganization,'button-primary');button.disabled=organizerBusy||(selectedApps.size||organizerApps().length)<2;footer.append(button);}return;
    }
    const count=el('strong','batch-count',`已选 ${selectedApps.size} 个`),command=el('select');command.id='batchCommand';command.setAttribute('aria-label','批量操作');
    [['new','合并为新文件夹'],['folder','移入已有文件夹'],['desktop','移到桌面'],['dock-add','加入 Dock'],['dock-remove','移出 Dock'],['delete','删除快捷方式']].forEach(([value,label])=>{const option=el('option','',label);option.value=value;command.append(option);});command.value=bulkDraft.action;command.addEventListener('change',()=>{bulkDraft.action=command.value;renderOrganizerFooter();});footer.append(count,command);
    if(bulkDraft.action==='new'){const name=el('input');name.id='batchFolderName';name.value=bulkDraft.name;name.maxLength=32;name.placeholder='文件夹名称';name.setAttribute('aria-label','新文件夹名称');name.addEventListener('input',()=>bulkDraft.name=name.value);footer.append(name);}
    if(bulkDraft.action==='folder'){const target=el('select');target.id='batchTargetFolder';target.setAttribute('aria-label','目标文件夹');state.folders.forEach(folder=>{const option=el('option','',folder.name);option.value=folder.id;target.append(option);});target.value=bulkDraft.folder;target.addEventListener('change',()=>bulkDraft.folder=target.value);footer.append(target);}
    if(['new','desktop'].includes(bulkDraft.action)){const page=el('select');page.id='batchTargetPage';page.setAttribute('aria-label','目标桌面');state.pages.forEach(item=>{const option=el('option','',item.name);option.value=item.id;page.append(option);});page.value=bulkDraft.page;page.addEventListener('change',()=>bulkDraft.page=page.value);footer.append(page);}
    const apply=organizerButton('执行',applyBulkOrganization,'button-primary');apply.disabled=!selectedApps.size||(bulkDraft.action==='folder'&&!state.folders.length);footer.append(apply);
  }
  function applyBulkOrganization() {
    const apps=[...selectedApps].map(appById).filter(app=>app&&!app.system),ids=apps.map(app=>app.id),draft={...bulkDraft};if(!ids.length)return;
    if(draft.action==='new'&&!draft.name.trim())return toast('请输入文件夹名称');
    if(draft.action==='dock-add'&&new Set([...state.dock,...ids]).size>12)return toast('Dock 最多 12 个 App，请减少选择');
    if(draft.action==='delete'&&!confirm(`删除选中的 ${ids.length} 个快捷方式？可撤销本次整理。`))return;
    applyOrganization(()=>{
      const previous=new Set(state.folders.filter(folder=>folder.appIds.length).map(folder=>folder.id));
      if(['new','folder','desktop'].includes(draft.action)){
        const target=draft.action==='new'?{id:crypto.randomUUID(),name:draft.name.trim().slice(0,32),page:draft.page,appIds:[],sizes:{}}:draft.action==='folder'?folderById(draft.folder):null;
        if(draft.action==='new')state.folders.push(target);
        apps.forEach(app=>{removeFromFolders(app.id);clearAppLayout(app.id);app.page=target?target.page:draft.page;if(target)target.appIds.push(app.id);});pruneEmptiedFolders(previous);
      }
      if(draft.action==='dock-add')state.dock=[...new Set([...state.dock,...ids])];
      if(draft.action==='dock-remove')state.dock=state.dock.filter(id=>!ids.includes(id));
      if(draft.action==='delete'){state.apps=state.apps.filter(app=>!ids.includes(app.id));state.dock=state.dock.filter(id=>!ids.includes(id));state.history=state.history.filter(id=>!ids.includes(id));state.favoriteIds=state.favoriteIds.filter(id=>!ids.includes(id));ids.forEach(id=>{removeFromFolders(id);clearAppLayout(id);});pruneEmptiedFolders(previous);}
    },`已整理 ${ids.length} 个 App`);
  }
  async function generateOrganization() {
    const apps=(selectedApps.size?[...selectedApps].map(appById):organizerApps()).filter(app=>app&&!app.system);if(apps.length<2)return toast('至少选择两个 App');
    organizerRequest?.abort();const controller=new AbortController();organizerRequest=controller;organizerBusy=true;renderOrganizer();const timer=setTimeout(()=>controller.abort(),30000);
    let groups,source='本地智能整理 · 未连接 AI 服务';
    try{
      if(apps.length>120)throw Error('too-many');
      const response=await fetch('/api/organize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apps:apps.map(app=>({id:app.id,name:app.name,url:new URL(app.url).origin}))}),signal:controller.signal});
      if(!response.ok)throw Error('unavailable');const data=await response.json();groups=validateGroups(data.groups,apps);if(!groups.length)throw Error('empty');source='Workers AI 整理预览';
    }catch{groups=suggestGroups(apps);source=controller.signal.aborted?'本地智能整理 · AI 请求超时':apps.length>120?'本地智能整理 · 当前范围超过 120 个 App':'本地智能整理 · AI 不可用';}
    finally{clearTimeout(timer);}
    if(organizerRequest!==controller)return;organizerRequest=null;organizerBusy=false;
    groups.forEach(group=>{const counts=new Map();group.appIds.forEach(id=>{const page=appById(id).page;counts.set(page,(counts.get(page)||0)+1);});group.page=[...counts].sort((a,b)=>b[1]-a[1])[0][0];group.enabled=true;});
    organizerPlan={groups,source};renderOrganizer();
  }
  function renderOrganizationPreview(root) {
    const groups=organizerPlan.groups,used=new Set(groups.flatMap(group=>group.appIds));root.append(el('p','organizer-preview-summary',`建议 ${groups.length} 个文件夹 · ${used.size} 个 App · 先看看是否合你心意`));
    groups.forEach(group=>{
      const card=el('section',`organization-group${group.enabled?'':' disabled'}`),head=el('div','organization-group-head'),check=el('input');check.type='checkbox';check.checked=group.enabled;check.setAttribute('aria-label',`采用 ${group.name} 文件夹`);check.addEventListener('change',()=>{group.enabled=check.checked;card.classList.toggle('disabled',!check.checked);renderOrganizerFooter();});
      const name=el('input');name.value=group.name;name.maxLength=32;name.setAttribute('aria-label','建议文件夹名称');name.addEventListener('input',()=>{group.name=name.value;renderOrganizerFooter();});
      const page=el('select');page.setAttribute('aria-label',`${group.name} 的目标桌面`);state.pages.forEach(item=>{const option=el('option','',item.name);option.value=item.id;page.append(option);});page.value=group.page;page.addEventListener('change',()=>group.page=page.value);head.append(check,el('span','organization-folder-icon','▦'),name,page);card.append(head);
      const members=el('div','organization-members');group.appIds.forEach(id=>{const app=appById(id);if(!app)return;const chip=el('span','organization-member');chip.append(appIcon(app,true),el('span','',app.name));const remove=organizerButton('×',()=>{group.appIds=group.appIds.filter(value=>value!==id);renderOrganizer();},'member-remove');remove.setAttribute('aria-label',`从建议中移除 ${app.name}`);chip.append(remove);members.append(chip);});card.append(members);root.append(card);
    });
    const untouched=(selectedApps.size?[...selectedApps].map(appById):organizerApps()).filter(app=>app&&!used.has(app.id));if(untouched.length)root.append(el('p','settings-note',`${untouched.length} 个 App 保持原位：${untouched.map(app=>app.name).join('、')}`));
    if(!groups.length)root.append(el('p','organizer-empty','没有找到适合合并的 App，可以切换到批量整理手动组合。'));
  }
  function applyAIOrganization() {
    const proposed=organizerPlan?.groups.filter(group=>group.enabled),groups=validateGroups(proposed,state.apps);if(!groups.length)return toast('没有可应用的文件夹，至少需要两个 App');
    applyOrganization(()=>{
      const previous=new Set(state.folders.filter(folder=>folder.appIds.length).map(folder=>folder.id));
      groups.forEach(group=>{
        const page=proposed.find(item=>item.appIds.some(id=>group.appIds.includes(id)))?.page||viewPages[currentPage].pageId;
        // Merge same-name suggestions into an existing folder instead of creating duplicates.
        let folder=state.folders.find(item=>item.name===group.name&&item.page===page);
        if(!folder){folder={id:crypto.randomUUID(),name:group.name,page,appIds:[],sizes:{}};state.folders.push(folder);}
        group.appIds.forEach(id=>{removeFromFolders(id);folder.appIds.push(id);appById(id).page=page;clearAppLayout(id);});
      });pruneEmptiedFolders(previous);
    },`已整理为 ${groups.length} 组文件夹`);
  }
  function openSettings(origin=null,tab='apps') {closeAppContext();if(folderId)closeFolder();settingsTab=tab;renderSettings();openSurface('settings',origin);}
  function closeSettings() {closeSurface('settings');}
  function updateSearchPreferences() { $('#searchTrigger>span:nth-child(2)').textContent=state.searchLabel;activeEngine=state.searchEngine; }
  function renderSettings() {
    $('#settingsTabs').querySelectorAll('button').forEach(button=>button.classList.toggle('active',button.dataset.tab===settingsTab));
    const root=$('#settingsContent');root.replaceChildren();
    if(settingsTab==='apps')renderAppSettings(root);
    if(settingsTab==='widgets')renderWidgetSettings(root);
    if(settingsTab==='folders')renderFolderSettings(root);
    if(settingsTab==='todos')renderTodoSettings(root);
    if(settingsTab==='dock')renderDockSettings(root);
    if(settingsTab==='appearance')renderAppearanceSettings(root);
    if(settingsTab==='data')renderDataSettings(root);
  }
  function settingsHeader(root,title,subtitle,buttonText,action) {
    const bar=el('div','settings-toolbar');const copy=el('div');copy.append(el('h3','',title),el('p','',subtitle));bar.append(copy);
    if(buttonText){const button=el('button','button-primary',buttonText);button.type='button';button.addEventListener('click',action);bar.append(button);}root.append(bar);
  }
  function renderAppSettings(root) {
    settingsHeader(root,'App 快捷方式','自由放置在桌面或文件夹，支持多选和自动整理','+ 添加 App',()=>openEditor('app'));
    const toolbar=el('div','settings-organize-actions');toolbar.append(organizerButton('☑ 批量整理',()=>openOrganizer('bulk')),organizerButton('✧ AI 自动整理',()=>openOrganizer('ai')));root.append(toolbar);
    const list=el('div','settings-list');state.apps.forEach(app=>{
        const row=el('div','settings-row');row.append(appIcon(app,true));const meta=el('div','row-meta');meta.append(el('strong','',app.name),el('small','',app.url));row.append(meta);
        const actions=el('div','row-actions');[['↑',()=>moveItem('app',app.id,-1)],['↓',()=>moveItem('app',app.id,1)],['编辑',()=>openEditor('app',app.id)]].forEach(([label,fn])=>{const button=el('button','',label);button.type='button';button.addEventListener('click',fn);actions.append(button);});row.append(actions);list.append(row);
    });root.append(list);
  }
  function renderWidgetSettings(root) {
    settingsHeader(root,'Widget 卡片','支持调整页面、大小和排列顺序','+ 添加 Widget',()=>openEditor('widget'));
    state.pages.forEach(page=>{root.append(el('p','section-eyebrow',page.name));const list=el('div','settings-list');list.style.margin='9px 0 19px';
      state.widgets.filter(w=>w.page===page.id).forEach(w=>{const row=el('div','settings-row');row.append(el('span','tiny-app-icon',widgetSymbol(w.type)));
        const meta=el('div','row-meta');meta.append(el('strong','',w.title||widgetLabel(w.type)),el('small','',`${widgetLabel(w.type)} · ${w.size==='wide'?'宽卡片':w.size==='small'?'小卡片':'标准卡片'}`));row.append(meta);
        const actions=el('div','row-actions');[['↑',()=>moveItem('widget',w.id,-1)],['↓',()=>moveItem('widget',w.id,1)],['编辑',()=>openEditor('widget',w.id)]].forEach(([label,fn])=>{const button=el('button','',label);button.type='button';button.addEventListener('click',fn);actions.append(button);});row.append(actions);list.append(row);});root.append(list);});
  }
  function renderFolderSettings(root) {
    settingsHeader(root,'文件夹','右键选择大小，或直接拖边角；大图标直达网站，叠放入口查看其余 App','+ 新建文件夹',()=>openEditor('folder'));
    const list=el('div','settings-list');state.folders.forEach(folder=>{
      const row=el('div','settings-row');row.append(el('span','tiny-app-icon','▦'));const meta=el('div','row-meta');meta.append(el('strong','',folder.name),el('small','',`${folder.appIds.length} 个 App · ${state.pages.find(page=>page.id===folder.page).name}`));row.append(meta);
      const edit=el('button','chip-button','编辑');edit.type='button';edit.addEventListener('click',()=>openEditor('folder',folder.id));row.append(edit);list.append(row);
    });root.append(list);if(!state.folders.length)root.append(el('p','settings-note','把常用 App 放在一起。文件夹名称、成员和大小都可以随时调整。'));
  }
  function renderTodoSettings(root) {
    settingsHeader(root,'今日计划','每天自动清空完成状态，任务内容会保留');
    const list=el('div','settings-list');
    state.todos.forEach((todo,index)=>{
      const row=el('div','settings-row');
      const check=el('input');check.type='checkbox';check.checked=todo.done;check.setAttribute('aria-label',`完成 ${todo.text}`);
      check.addEventListener('change',()=>{todo.done=check.checked;save();renderPages();});row.append(check);
      const input=el('input');input.type='text';input.value=todo.text;input.maxLength=80;input.style.cssText='flex:1;min-width:0;border:0;background:transparent;color:#35565c;font-size:12px;outline:0';
      input.setAttribute('aria-label',`任务 ${index+1}`);input.addEventListener('change',()=>{todo.text=input.value.trim()||todo.text;save();renderPages();});row.append(input);
      const remove=el('button','chip-button','删除');remove.type='button';remove.addEventListener('click',()=>{state.todos=state.todos.filter(item=>item.id!==todo.id);save();renderPages();renderSettings();});row.append(remove);list.append(row);
    });root.append(list);
    const add=el('div','settings-toolbar');add.style.marginTop='16px';const input=el('input');input.type='text';input.placeholder='写下一个今天要做的小目标';input.maxLength=80;input.style.cssText='flex:1;min-width:0;border:1px solid #dce8e5;border-radius:11px;padding:10px 11px;background:#fff;color:#2c4c51';
    const button=el('button','button-primary','添加任务');button.type='button';const submit=()=>{const text=input.value.trim();if(!text)return;state.todos.push({id:crypto.randomUUID(),text,done:false});save();renderPages();renderSettings();toast('任务已添加');};button.addEventListener('click',submit);input.addEventListener('keydown',event=>{if(event.key==='Enter')submit();});add.append(input,button);root.append(add);
    root.append(el('p','settings-note','首页 Widget 展示前四项任务；完整列表可在这里管理。'));
  }
  function renderDockSettings(root) {
    settingsHeader(root,'Dock 栏','最多放 12 个最常使用的 App；箭头可调整位置');
    const list=el('div','settings-list');state.dock.forEach((id,index)=>{const app=appById(id);if(!app)return;const row=el('div','settings-row');row.append(appIcon(app,true));const meta=el('div','row-meta');meta.append(el('strong','',app.name),el('small','',`Dock 位置 ${index+1}`));row.append(meta);
      const actions=el('div','row-actions');[['↑',-1],['↓',1]].forEach(([label,direction])=>{const button=el('button','',label);button.type='button';button.addEventListener('click',()=>{const next=index+direction;if(next<0||next>=state.dock.length)return;[state.dock[index],state.dock[next]]=[state.dock[next],state.dock[index]];save();renderDock();renderSettings();});actions.append(button);});const remove=el('button','','移除');remove.type='button';remove.addEventListener('click',()=>{state.dock=state.dock.filter(x=>x!==id);save();renderDock();renderSettings();});actions.append(remove);row.append(actions);list.append(row);});root.append(list);
    root.append(el('p','section-eyebrow','添加到 Dock'));const choices=el('div','quick-links');choices.style.marginTop='12px';state.apps.filter(app=>!state.dock.includes(app.id)).forEach(app=>{const button=el('button','chip-button',`+ ${app.name}`);button.type='button';button.addEventListener('click',()=>{if(state.dock.length>=12)return toast('Dock 最多放 12 个 App');state.dock.push(app.id);save();renderDock();renderSettings();});choices.append(button);});root.append(choices);
  }
  function renderAppearanceSettings(root) {
    settingsHeader(root,'桌面外观','选一张喜欢的壁纸，让这里更像你的空间');
    const options=el('div','wallpaper-options');[['sunny','晴天小镇'],['peach','蜜桃云朵'],['sage','薄荷绿洲'],['night','暮色夜空'],['bing','Bing 每日一图']].forEach(([id,name])=>{const button=el('button',`wallpaper-option${state.wallpaper===id?' active':''}`);button.type='button';button.append(el('div',`wallpaper-swatch ${id}`),el('span','',name));if(id==='bing')$('.wallpaper-swatch',button).textContent='每日风景 ↗';button.addEventListener('click',()=>{state.wallpaper=id;save();setWallpaper();renderSettings();});options.append(button);});root.append(options);
    const upload=el('label','button-secondary','上传自己的壁纸');upload.style.display='inline-block';upload.style.cursor='pointer';const input=el('input');input.type='file';input.accept='image/*';input.hidden=true;input.addEventListener('change',async()=>{if(!input.files?.[0])return;try{state.customWallpaper=await compressImage(input.files[0]);state.wallpaper='custom';save();setWallpaper();renderSettings();toast('壁纸已更新');}catch{toast('无法读取这张图片');}});upload.append(input);root.append(upload);
    root.append(el('p','settings-note','自定义壁纸会压缩后保存在当前浏览器。导出配置可用于备份。'));
    const imageUrl=field('或使用壁纸图片 URL',validUrl(state.customWallpaper)||'','url');root.append(imageUrl.wrap);const useUrl=el('button','button-secondary','使用图片地址');useUrl.type='button';useUrl.style.marginTop='10px';useUrl.addEventListener('click',()=>{const url=validUrl(imageUrl.input.value.trim());if(!url)return toast('请输入有效的图片地址');state.customWallpaper=url;state.wallpaper='custom';save();setWallpaper();renderSettings();});root.append(useUrl);
    if(state.wallpaper==='bing'){root.append(el('p','settings-note',state.bingWallpaper?.copyright||'正在获取今日风景…'));const refresh=el('button','chip-button','刷新每日壁纸');refresh.type='button';refresh.addEventListener('click',()=>loadBingWallpaper(true));root.append(refresh);}
    const fields=el('div','field-grid');fields.style.marginTop='19px';const city=field('天气城市',state.city.name,'text');const lat=field('纬度',state.city.latitude,'number');const lon=field('经度',state.city.longitude,'number');fields.append(city.wrap,lat.wrap,lon.wrap);root.append(fields);
    const saveCity=el('button','button-primary','保存天气位置');saveCity.type='button';saveCity.style.marginTop='12px';saveCity.addEventListener('click',()=>{const latitude=Number(lat.input.value),longitude=Number(lon.input.value);if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)return toast('请输入有效的经纬度');state.city={name:city.input.value.trim()||'我的城市',latitude,longitude};save();weather=null;renderPages();loadWeather();toast('天气位置已保存');});root.append(saveCity);
  }
  function compressImage(file) {
    return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const image=new Image();image.onerror=reject;image.onload=()=>{const scale=Math.min(1,1800/image.width,1200/image.height);const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.8));};image.src=reader.result;};reader.readAsDataURL(file);});
  }
  function renderDataSettings(root) {
    settingsHeader(root,'布局与数据','所有改动默认保存在当前浏览器');const actions=el('div','data-actions');
    const exportButton=el('button','button-primary','导出 JSON 备份');exportButton.type='button';exportButton.addEventListener('click',()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=el('a');link.href=url;link.download='weboss-backup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});actions.append(exportButton);
    const importLabel=el('label','button-secondary','导入 JSON 备份');importLabel.style.cursor='pointer';const input=el('input');input.type='file';input.accept='.json,application/json';input.addEventListener('change',async()=>{if(!input.files?.[0])return;try{const data=JSON.parse(await input.files[0].text());const imported=importLegacy(data);state=normalize(imported);save();updateSearchPreferences();setWallpaper();renderPages();renderDock();renderSettings();loadWeather();toast('桌面配置已导入');}catch{toast('JSON 格式不正确');}});importLabel.append(input);actions.append(importLabel);root.append(actions);
    const reset=el('button','text-danger','恢复默认桌面');reset.type='button';reset.addEventListener('click',()=>{if(!confirm('确定恢复默认桌面？当前自定义布局会被覆盖。'))return;state=normalize(defaults);save();setWallpaper();renderPages();renderDock();renderSettings();loadWeather();updateSearchPreferences();toast('已恢复默认桌面');});root.append(reset);
    root.append(el('p','settings-note','兼容导入原 browser-start-page-v2 导出的 shortcuts / widgets JSON。网站配置只存于本机浏览器，清除浏览器数据前请先导出备份。'));
  }
  function importLegacy(data) {
    if(Array.isArray(data.apps))return data;
    if(!Array.isArray(data.shortcuts))throw Error('unknown format');
    const base=clone(defaults);base.apps=data.shortcuts.filter(item=>validUrl(item.url)).map((item,index)=>({id:String(item.id||crypto.randomUUID()),name:String(item.name||'快捷方式'),url:validUrl(item.url),icon:String(item.icon||item.name?.slice(0,2)||'✦'),color:/^#[\da-f]{6}$/i.test(item.color)?item.color:'#6c9ca4',page:pageIds[index%4]}));
    base.widgets=[...defaults.widgets,...(Array.isArray(data.widgets)?data.widgets:[]).map(item=>({id:String(item.id||crypto.randomUUID()),type:item.type==='link'?'link':'note',page:'personal',size:'medium',title:String(item.title||'旧版便签'),content:String(item.content||'')}))];
    base.apps.forEach(app=>app.iconMode='custom');base.dock=base.apps.slice(0,8).map(app=>app.id);return base;
  }
  function field(label,value,type='text',options) {
    const wrap=el('label','field',label);let input;
    if(options){input=el('select');options.forEach(([value,text])=>{const option=el('option','',text);option.value=value;input.append(option);});input.value=value;}
    else if(type==='textarea'){input=el('textarea');input.value=value||'';}
    else{input=el('input');input.type=type;input.value=value??'';}
    wrap.append(input);return {wrap,input};
  }
  function openEditor(type,id=null) {
    editorContext={type,id};const item=id?itemById(type,id):null;
    $('#editorTitle').textContent=type==='search'?'编辑搜索':`${id?'编辑':'添加'} ${type==='app'?'App':type==='folder'?'文件夹':'Widget'}`;$('#editorDelete').hidden=!id||!!item?.system;$('#editorDelete').textContent=type==='folder'?'解散文件夹':'删除';
    const root=$('#editorFields');root.replaceChildren();const fields={};
    const add=(key,label,value,inputType='text',options)=>{const entry=field(label,value,inputType,options);entry.input.name=key;root.append(entry.wrap);fields[key]=entry.input;};
    if(type==='app'){
      add('name','名称',item?.name||'');if(!item?.system)add('url','网站 URL',item?.url||'https://','url');
      add('iconMode','图标来源',item?.iconMode||'auto','select',[['auto','自动获取网站图标'],['custom','手动设置']]);
      add('icon','手动图标字符 / 图片 URL（自动模式下作为备用）',item?.icon||'✦');
      add('color','备用图标背景色',item?.color||'#6c9ca4','color');add('page','桌面页面',item?.page||viewPages[currentPage].pageId,'select',state.pages.map(page=>[page.id,page.name]));
    }else if(type==='folder'){
      add('name','文件夹名称',item?.name||'文件夹');add('page','桌面页面',item?.page||viewPages[currentPage].pageId,'select',state.pages.map(page=>[page.id,page.name]));
      const size=item?tileSize({kind:'folder',data:item},layoutMode()):{w:2,h:2};
      const advanced=el('details','folder-advanced-size');advanced.append(el('summary','','自定义大小'));
      [['width','宽度',size.w,gridColumns(layoutMode())],['height','高度',size.h,rowsPerPage]].forEach(([key,label,value,max])=>{const entry=field(label,value,'number');entry.input.name=key;entry.input.min='1';entry.input.max=String(max);fields[key]=entry.input;advanced.append(entry.wrap);});
      root.append(el('p','settings-note','选择大小，也可以保存后直接拖边角调整。'));renderFolderSizePicker(root,item||{sizes:{[layoutMode()]:size}},(w,h)=>{fields.width.value=w;fields.height.value=h;});root.append(advanced);
      const members=el('div','folder-member-list');fields.memberChecks=[];
      state.apps.filter(app=>!app.system).forEach(app=>{const label=el('label','folder-member');const check=el('input');check.type='checkbox';check.value=app.id;check.checked=item?.appIds.includes(app.id)||false;fields.memberChecks.push(check);label.append(check,appIcon(app,true),el('span','',app.name));members.append(label);});root.append(el('p','settings-note','选择要组合的 App。已在其他文件夹中的 App 会移入这里。'),members);
    }else if(type==='search'){
      add('name','搜索框文字',state.searchLabel);add('engine','默认搜索引擎',state.searchEngine,'select',engines.map(engine=>[engine.id,engine.name]));
    }else{
      add('type','Widget 类型',item?.type||'note','select',['clock','note','link','todo','calendar','quote','weather','progress','recent','favorites','watching','player','quick'].map(t=>[t,widgetLabel(t)]));
      add('title','标题',item?.title||'');add('content','内容 / 链接',item?.content||'','textarea');add('size','卡片尺寸',item?.size||'medium','select',[['small','小'],['medium','标准'],['wide','宽']]);add('page','桌面页面',item?.page||viewPages[currentPage].pageId,'select',state.pages.map(page=>[page.id,page.name]));
    }
    editorContext.fields=fields;if(!$('#editorDialog').open)$('#editorDialog').showModal();fields.name?.focus();
  }
  function closeEditor() {$('#editorDialog').close();editorContext=null;}
  function saveEditor() {
    if(!editorContext)return;const {type,id,fields}=editorContext;
    if(type==='app'){
      const existing=appById(id),url=existing?.system?'':validUrl(fields.url.value.trim());if(!existing?.system&&!url)return toast('请输入以 http 或 https 开头的网址');
      const name=fields.name.value.trim();if(!name)return toast('请输入 App 名称');
      const app={id:id||crypto.randomUUID(),system:existing?.system,name:name.slice(0,32),url,icon:fields.icon.value.trim().slice(0,180)||'✦',iconMode:fields.iconMode.value,color:fields.color.value,page:fields.page.value};
      if(existing&&existing.page!==app.page)removeFromFolders(id);
      const index=state.apps.findIndex(item=>item.id===id);if(index>=0)state.apps[index]=app;else state.apps.push(app);
    }else if(type==='folder'){
      const name=fields.name.value.trim();if(!name)return toast('请输入文件夹名称');
      const w=Math.round(Number(fields.width.value)),h=Math.round(Number(fields.height.value));if(w<1||w>gridColumns(layoutMode())||h<1||h>rowsPerPage||!Number.isFinite(w+h))return toast('请输入范围内的文件夹大小');
      const folder=folderById(id)||{id:crypto.randomUUID(),sizes:{},appIds:[]};freezeLayout(layoutMode());
      folder.name=name.slice(0,32);folder.page=fields.page.value;folder.appIds=fields.memberChecks.filter(check=>check.checked).map(check=>check.value);folder.sizes[layoutMode()]={w,h};
      folder.appIds.forEach(appId=>{state.folders.filter(other=>other.id!==folder.id).forEach(other=>other.appIds=other.appIds.filter(value=>value!==appId));appById(appId).page=folder.page;});if(!id)state.folders.push(folder);
      state.layout[layoutMode()][folder.id]={...(state.layout[layoutMode()][folder.id]||{}),page:folder.page,priority:Date.now()};
    }else if(type==='search'){
      state.searchLabel=fields.name.value.trim().slice(0,80)||defaults.searchLabel;state.searchEngine=fields.engine.value;updateSearchPreferences();
    }else{
      const widget={id:id||crypto.randomUUID(),type:fields.type.value,title:fields.title.value.trim().slice(0,40),content:fields.content.value.trim().slice(0,400),size:fields.size.value,page:fields.page.value};
      if(widget.type==='link'&&!validUrl(widget.content))return toast('链接 Widget 需要有效的 http 或 https 地址');
      const index=state.widgets.findIndex(item=>item.id===id);if(index>=0)state.widgets[index]=widget;else state.widgets.push(widget);
    }
    closeEditor();refreshDesktop();toast('已保存到桌面');
  }
  function deleteEditor() {
    if(!editorContext?.id)return;const {type,id}=editorContext;
    if(type==='folder'){closeEditor();dissolveFolder(id);return;}
    if(type==='app'){state.apps=state.apps.filter(item=>item.id!==id);state.dock=state.dock.filter(x=>x!==id);state.history=state.history.filter(x=>x!==id);removeFromFolders(id);}
    else state.widgets=state.widgets.filter(item=>item.id!==id);
    closeEditor();refreshDesktop();toast('已删除');
  }
  function toggleMusic() {
    if(music.playing){music.playing=false;clearInterval(music.timer);music.timer=null;cancelAnimationFrame(music.frame);}
    else{
      const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)return toast('浏览器不支持音频播放');
      music.context ||= new AudioContext();music.context.resume();music.playing=true;music.lastTick=performance.now();
      music.timer=setInterval(playNote,500);playNote();music.frame=requestAnimationFrame(tickMusic);
    }updatePlayer();
  }
  function playNote() {
    if(!music.playing||!music.context)return;const noteIndex=Math.floor(music.elapsed*2)%musicTracks[music.track].notes.length;
    if(noteIndex===music.lastNote)return;music.lastNote=noteIndex;
    const ctx=music.context,osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.value=musicTracks[music.track].notes[noteIndex];
    gain.gain.setValueAtTime(.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.04,ctx.currentTime+.04);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.43);
    osc.connect(gain).connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.45);
  }
  function tickMusic(now) {
    if(!music.playing)return;music.elapsed+=(now-music.lastTick)/1000;music.lastTick=now;if(music.elapsed>=32)switchTrack(1);
    document.querySelectorAll('.player-progress i').forEach(fill=>fill.style.width=`${music.elapsed/32*100}%`);
    music.frame=requestAnimationFrame(tickMusic);
  }
  function switchTrack(direction) {music.track=(music.track+direction+musicTracks.length)%musicTracks.length;music.elapsed=0;music.lastNote=-1;music.lastTick=performance.now();updatePlayer();}
  function updatePlayer() {document.querySelectorAll('[data-type="player"] .widget-content').forEach(root=>{root.replaceChildren();renderPlayer(root);});}

  $('#searchTrigger').addEventListener('click',searchOpen);
  $('#searchClose').addEventListener('click',searchClose);
  $('#searchBackdrop').addEventListener('click',searchClose);
  $('#searchInput').addEventListener('input',()=>{selectedSearch=0;renderSearch();});
  $('#searchInput').addEventListener('keydown',event=>{
    const results=queryResults();
    if(event.key==='ArrowDown'){event.preventDefault();selectedSearch=Math.min(results.length-1,selectedSearch+1);renderSearch();}
    if(event.key==='ArrowUp'){event.preventDefault();selectedSearch=Math.max(0,selectedSearch-1);renderSearch();}
    if(event.key==='Enter'){event.preventDefault();const query=$('#searchInput').value.trim();if((event.ctrlKey||event.metaKey)&&query)runResult({type:'web',text:query});else if(!query&&results[0])runResult(results[selectedSearch]);else if(results[selectedSearch]?.type==='app')runResult(results[selectedSearch]);else runResult({type:'web',text:query});}
  });
  $('#editModeButton').addEventListener('click',toggleEdit);
  $('#organizeButton').addEventListener('click',()=>openOrganizer('ai'));
  $('#batchButton').addEventListener('click',()=>openOrganizer('bulk'));
  $('#undoOrganize').addEventListener('click',undoOrganization);
  $('#organizerClose').addEventListener('click',closeOrganizer);
  $('#organizerBackdrop').addEventListener('click',closeOrganizer);
  $('#organizerBulkTab').addEventListener('click',()=>{organizerMode='bulk';organizerPlan=null;$('#organizerExisting').checked=true;renderOrganizer();});
  $('#organizerAITab').addEventListener('click',()=>{organizerMode='ai';organizerPlan=null;$('#organizerExisting').checked=false;renderOrganizer();});
  ['organizerScope','organizerExisting'].forEach(id=>$(`#${id}`).addEventListener('change',()=>{selectedApps.clear();organizerPlan=null;renderOrganizer();}));
  $('#organizerFilter').addEventListener('input',()=>{organizerPlan=null;renderOrganizer();});
  $('#settingsClose').addEventListener('click',closeSettings);
  $('#settingsBackdrop').addEventListener('click',closeSettings);
  $('#folderClose').addEventListener('click',()=>closeFolder());
  $('#folderBackdrop').addEventListener('click',()=>closeFolder());
  $('#folderManage').addEventListener('click',()=>openEditor('folder',folderId));
  $('#folderBatch').addEventListener('click',()=>openOrganizer('bulk',null,folderId));
  $('#folderName').addEventListener('change',()=>{const folder=folderById(folderId);if(!folder)return;folder.name=$('#folderName').value.trim().slice(0,32)||folder.name;refreshDesktop();});
  $('#folderName').addEventListener('keydown',event=>{if(event.key==='Enter')event.target.blur();});
  $('#folderDialog').addEventListener('contextmenu',event=>{if(event.defaultPrevented)return;event.preventDefault();openItemContext('folder',folderId,event.clientX,event.clientY);});
  $('#searchTrigger').addEventListener('contextmenu',event=>openDesktopContext(event,'search'));
  $('#dock').addEventListener('contextmenu',event=>{if(!event.defaultPrevented)openDesktopContext(event,'dock');});
  $('#desktopShell').addEventListener('dragstart',event=>event.preventDefault());
  $('#folderDialog').addEventListener('dragstart',event=>event.preventDefault());
  $('#editorDialog').addEventListener('cancel',event=>{event.preventDefault();closeEditor();});
  $('#settingsTabs').addEventListener('click',event=>{const tab=event.target.closest('[data-tab]');if(!tab)return;settingsTab=tab.dataset.tab;renderSettings();});
  $('#editorClose').addEventListener('click',closeEditor);
  $('#editorCancel').addEventListener('click',closeEditor);
  $('#editorDelete').addEventListener('click',deleteEditor);
  $('#editorForm').addEventListener('submit',event=>{event.preventDefault();saveEditor();});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&(dragState?.active||resizeState)){event.preventDefault();if(dragState)stopTileDrag({pointerId:dragState.pointerId},true);if(resizeState)finishFolderResize({pointerId:resizeState.pointerId},true);return;}
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'&&!$('#editorDialog').open){event.preventDefault();if($('#settingsDialog').open)closeSettings();if(folderId)closeFolder();searchOpen();return;}
    if(event.key==='Escape'&&!$('#appContextMenu').hidden){closeAppContext();return;}
    if(event.key==='Escape'&&!$('#editorDialog').open){if(surfaces.has('organizer'))closeOrganizer();else if(surfaces.has('search'))searchClose();else if(surfaces.has('settings'))closeSettings();else if(surfaces.has('folder'))closeFolder();else if(sizingFolderId){sizingFolderId=null;document.querySelectorAll('.folder-sizing').forEach(node=>node.classList.remove('folder-sizing'));}return;}
    if(event.key==='Tab'&&surfaces.size&&!$('#editorDialog').open){const context=[...surfaces.values()].filter(item=>item.status!=='closing').at(-1);if(context){const focusable=[...context.panel.querySelectorAll('button,input,a,select,textarea')].filter(node=>!node.disabled&&node.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}}
    if(document.activeElement?.matches('input,textarea,select')||$('#editorDialog').open||surfaces.size)return;
    if(event.key==='ArrowRight')setPage(currentPage+1);if(event.key==='ArrowLeft')setPage(currentPage-1);
  });
  $('#desktopViewport').addEventListener('wheel',event=>{
    if(surfaces.size||$('#editorDialog').open||dragState?.active||resizeState)return;
    if(Math.abs(event.deltaX)+Math.abs(event.deltaY)<15)return;
    if(Date.now()-wheelAt<550){event.preventDefault();return;}
    wheelAt=Date.now();event.preventDefault();setPage(currentPage+(Math.abs(event.deltaX)>Math.abs(event.deltaY)?Math.sign(event.deltaX):Math.sign(event.deltaY)));
  },{passive:false});
  const viewport=$('#desktopViewport');
  window.addEventListener('pointermove',event=>{
    if(resizeState){updateFolderResize(event);return;}
    const drag=dragState; if(!drag || drag.pointerId!==event.pointerId)return;
    const distance=Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY);
    if(drag.touch && distance>12 && !drag.active)clearTimeout(drag.timer);
    if(!drag.active && distance>7 && (!drag.touch || editing))startTileDrag(drag);
    if(!drag.active)return;
    event.preventDefault(); drag.lastX=event.clientX;drag.lastY=event.clientY;
    drag.ghost.style.left=`${event.clientX-drag.offsetX}px`;drag.ghost.style.top=`${event.clientY-drag.offsetY}px`;
    updateDragPreview(drag,event);
    if(drag.previewTarget?.action!=='desktop'&&drag.previewTarget?.action!=='folder-create'){clearTimeout(drag.edgeTimer);drag.edgeDestination=null;return;}
    const edge=event.clientX<38?-1:event.clientX>innerWidth-38?1:0;
    const destination=currentPage+edge;
    if(edge && destination>=0 && destination<viewPages.length){
      if(drag.edgeDestination!==destination){clearTimeout(drag.edgeTimer);drag.edgeDestination=destination;
        drag.edgeTimer=setTimeout(()=>{if(dragState===drag){clearDragPreview(drag);setPage(destination);drag.edgeDestination=null;
          setTimeout(()=>{if(dragState===drag)updateDragPreview(drag,{clientX:drag.lastX,clientY:drag.lastY});},470);}},560);}
    }else{clearTimeout(drag.edgeTimer);drag.edgeDestination=null;}
  },{passive:false});
  window.addEventListener('pointerup',event=>{finishFolderResize(event);stopTileDrag(event);});
  window.addEventListener('pointercancel',event=>{finishFolderResize(event,true);stopTileDrag(event,true);});
  viewport.addEventListener('pointerdown',event=>{if(editing||event.button!==0||event.target.closest('input,textarea,select,button'))return;
    if(event.pointerType!=='touch' && event.target.closest('.app-shortcut,.widget-card,.folder-tile'))return;
    pointerStart={x:event.clientX,y:event.clientY,page:currentPage,id:event.pointerId};});
  viewport.addEventListener('pointermove',event=>{if(!pointerStart||pointerStart.id!==event.pointerId||dragState?.active)return;const dx=event.clientX-pointerStart.x,dy=event.clientY-pointerStart.y;if(Math.abs(dx)<8||Math.abs(dx)<Math.abs(dy)*1.2)return;const width=viewport.clientWidth;$('#pageTrack').classList.add('dragging');$('#pageTrack').style.transform=`translate3d(calc(${-pointerStart.page*100}% + ${Math.max(-width*.45,Math.min(width*.45,dx))}px),0,0)`;});
  function finishPointer(event){if(!pointerStart||pointerStart.id!==event.pointerId)return;if(dragState?.active){pointerStart=null;$('#pageTrack').classList.remove('dragging');setPage(currentPage);return;}const dx=event.clientX-pointerStart.x,dy=event.clientY-pointerStart.y;$('#pageTrack').classList.remove('dragging');if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.2){suppressClickUntil=Date.now()+400;setPage(pointerStart.page+(dx<0?1:-1));}else setPage(pointerStart.page);pointerStart=null;}
  viewport.addEventListener('pointerup',finishPointer);viewport.addEventListener('pointercancel',finishPointer);
  viewport.addEventListener('click',event=>{if(Date.now()<suppressClickUntil){event.preventDefault();event.stopPropagation();}},true);
  document.addEventListener('pointerdown',event=>{const menu=$('#appContextMenu');if(!menu.hidden&&!menu.contains(event.target))closeAppContext();
    if(sizingFolderId&&!event.target.closest('.folder-tile,.app-context-menu')){sizingFolderId=null;document.querySelectorAll('.folder-sizing').forEach(node=>node.classList.remove('folder-sizing'));}
  },true);
  document.addEventListener('contextmenu',event=>{if(event.defaultPrevented)return;if(event.target.closest('#desktopShell'))openDesktopContext(event);else closeAppContext();});
  window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{if(dragState||resizeState)return;renderPages();if(folderId)renderFolderContents();for(const context of surfaces.values())if(context.status!=='closing')openSurface(context.name,context.origin);});});
  let folderSwipe=null;
  $('#folderGrid').addEventListener('pointerdown',event=>{if(event.pointerType==='touch')folderSwipe={x:event.clientX,y:event.clientY};});
  $('#folderGrid').addEventListener('pointerup',event=>{if(!folderSwipe)return;const dx=event.clientX-folderSwipe.x,dy=event.clientY-folderSwipe.y;folderSwipe=null;if(dragState?.active)return;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.2){folderPage=Math.max(0,folderPage+(dx<0?1:-1));suppressClickUntil=Date.now()+450;renderFolderContents();}});
  setInterval(()=>{if(state.wallpaper==='bing')loadBingWallpaper();},3600000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.wallpaper==='bing')loadBingWallpaper();});

  updateSearchPreferences();setWallpaper();renderPages();renderDock();loadWeather();updateClock();setInterval(updateClock,30000);
})();
