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
    { title: '晴天漫游', caption: '晴屿原创 · 轻音乐', notes: [262,330,392,523,392,330,294,349,440,523,440,349,262,330,392,330] },
    { title: '午后微风', caption: '晴屿原创 · 轻音乐', notes: [294,370,440,587,440,370,330,392,494,587,494,392,294,370,440,370] },
    { title: '慢慢的日子', caption: '晴屿原创 · 轻音乐', notes: [247,330,370,494,370,330,277,330,415,494,415,330,247,330,370,330] }
  ];

  function validUrl(value) {
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; }
    catch { return ''; }
  }
  function normalize(raw) {
    if (!raw || typeof raw !== 'object') return clone(defaults);
    const data = { ...clone(defaults), ...raw };
    data.pages = clone(defaults.pages);
    const sourceApps = Array.isArray(raw.apps) ? [...raw.apps] : [...defaults.apps];
    if ((Number(raw.version) || 1) < 2) defaults.apps.forEach(app => { if (newDefaultAppIds.has(app.id) && !sourceApps.some(item => item.id === app.id)) sourceApps.push(app); });
    data.apps = sourceApps.filter(item => item && validUrl(item.url)).map(item => ({
      id: String(item.id || crypto.randomUUID()), name: String(item.name || '未命名').slice(0, 32),
      url: validUrl(item.url), icon: String(item.icon || '✦').slice(0, 180),
      color: /^#[\da-f]{6}$/i.test(item.color) ? item.color : '#6c9ca4',
      page: pageIds.includes(item.page) ? item.page : 'home', category: String(item.category || '常用').slice(0, 16)
    }));
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
    data.wallpaper = ['sunny','peach','sage','night','custom'].includes(raw.wallpaper) ? raw.wallpaper : 'sunny';
    data.customWallpaper = typeof raw.customWallpaper === 'string' && raw.customWallpaper.startsWith('data:image/') ? raw.customWallpaper : '';
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
  let activeEngine = 'google';
  let weather = null;
  let quoteOffset = 0;
  let toastTimer = 0;
  let wheelAt = 0;
  let pointerStart = null;
  let dragState = null;
  let dockDrag = null;
  let suppressClickUntil = 0;
  let viewPages = [];
  let rowsPerPage = 7;
  let resizeFrame = 0;
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
  function isLightColor(hex) {
    const rgb = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16));
    return rgb[0]*.299 + rgb[1]*.587 + rgb[2]*.114 > 185;
  }
  function appIcon(app, tiny = false) {
    const icon = el('span', tiny ? 'tiny-app-icon' : 'app-icon');
    icon.style.setProperty('--app-color', app.color);
    if (tiny) { icon.style.background = app.color; icon.style.color = isLightColor(app.color) ? '#38545a' : '#fff'; }
    else if (isLightColor(app.color)) icon.classList.add('light');
    if (/^https?:\/\//.test(app.icon)) {
      const url = validUrl(app.icon);
      if (url) { const image = el('img'); image.src = url; image.alt = ''; image.loading = 'lazy'; icon.append(image); }
      else icon.textContent = '✦';
    } else icon.textContent = app.icon || '✦';
    return icon;
  }
  function openApp(app) {
    if (!app) return;
    state.history = [app.id, ...state.history.filter(id => id !== app.id)].slice(0,12);
    save();
    window.open(app.url, '_blank', 'noopener,noreferrer');
  }
  function closeAppContext() { const menu=$('#appContextMenu');menu.hidden=true;menu.replaceChildren(); }
  function openAppContext(appId,x,y) {
    const app=appById(appId);if(!app)return;
    const menu=$('#appContextMenu');menu.replaceChildren();menu.hidden=false;
    const title=el('div','context-title');title.append(appIcon(app,true),el('span','',app.name));menu.append(title);
    const action=(label,icon,handler,danger=false)=>{
      const button=el('button',`context-action${danger?' danger':''}`);button.type='button';button.setAttribute('role','menuitem');
      button.append(el('span','context-glyph',icon),el('span','',label));
      button.addEventListener('click',()=>{closeAppContext();handler();});menu.append(button);
    };
    action('打开网站','↗',()=>openApp(app));
    action('编辑快捷方式','✎',()=>openEditor('app',app.id));
    action('复制链接','⧉',async()=>{
      try { await navigator.clipboard.writeText(app.url);toast('链接已复制'); }
      catch { toast('复制失败，请检查浏览器权限'); }
    });
    const inDock=state.dock.includes(app.id);
    action(inDock?'从 Dock 移除':'加入 Dock',inDock?'−':'+',()=>{
      if(inDock)state.dock=state.dock.filter(id=>id!==app.id);
      else if(state.dock.length>=12)return toast('Dock 最多放 12 个 App');
      else state.dock.push(app.id);
      save();renderDock();toast(inDock?'已从 Dock 移除':'已加入 Dock');
    });
    const group=el('div','context-page-group');group.append(el('span','context-group-label','移动到桌面'));
    const pageChoices=el('div','context-page-choices');
    state.pages.forEach(page=>{
      const button=el('button',`context-page-choice${app.page===page.id?' active':''}`,page.name);button.type='button';button.setAttribute('role','menuitem');
      button.disabled=app.page===page.id;
      button.addEventListener('click',()=>{closeAppContext();app.page=page.id;
        for(const mode of ['desktop','tablet','mobile'])delete state.layout[mode][app.id];
        save();renderPages();toast(`已移动到${page.name}`);
      });pageChoices.append(button);
    });group.append(pageChoices);menu.append(group);
    action('删除快捷方式','×',()=>{if(!confirm(`删除“${app.name}”快捷方式？`))return;
      state.apps=state.apps.filter(item=>item.id!==app.id);state.dock=state.dock.filter(id=>id!==app.id);
      state.history=state.history.filter(id=>id!==app.id);
      for(const mode of ['desktop','tablet','mobile'])delete state.layout[mode][app.id];
      save();renderPages();renderDock();toast('快捷方式已删除');
    },true);
    menu.style.left='0px';menu.style.top='0px';
    const rect=menu.getBoundingClientRect();
    menu.style.left=`${Math.max(8,Math.min(x,innerWidth-rect.width-8))}px`;
    menu.style.top=`${Math.max(8,Math.min(y,innerHeight-rect.height-8))}px`;
  }
  function setWallpaper() {
    const wall = $('#wallpaper'); wall.dataset.wallpaper = state.wallpaper;
    wall.style.backgroundImage = state.wallpaper === 'custom' && state.customWallpaper ? `url("${state.customWallpaper}")` : '';
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
    const apps = state.apps.filter(item => item.page === pageId).map(data => ({ kind: 'app', data, id: data.id }));
    if (mode === 'mobile') {
      const priorityTypes=maxRows<=6?['clock']:['clock','weather','todo','player','watching'];
      const prominent = widgets.filter(item => priorityTypes.includes(item.data.type));
      const rest = widgets.filter(item => !prominent.includes(item));
      return [...prominent, ...apps, ...rest];
    }
    if (maxRows<=5) {
      const prominent=widgets.filter(item => ['clock','weather','todo','progress','watching','player'].includes(item.data.type));
      return [...prominent,...apps,...widgets.filter(item=>!prominent.includes(item))];
    }
    return [...widgets, ...apps];
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
          const node=item.kind==='app'?renderApp(item.data):renderWidget(item.data),pos=positions.get(item.id);
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
    const link = el('a'); link.href = app.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.setAttribute('aria-label',`打开 ${app.name}`);
    link.draggable = false;
    link.append(appIcon(app),el('span','app-name',app.name));
    link.addEventListener('click',event => {
      if (editing || Date.now() < suppressClickUntil) { event.preventDefault(); if (editing) openEditor('app',app.id); return; }
      state.history = [app.id,...state.history.filter(id=>id!==app.id)].slice(0,12); save();
    });
    const edit = el('button','app-edit','✎'); edit.type='button'; edit.title=`编辑 ${app.name}`; edit.addEventListener('click',() => openEditor('app',app.id));
    wrap.append(link,edit); attachDrag(wrap,'app',app.id);
    wrap.addEventListener('contextmenu',event=>{event.preventDefault();openAppContext(app.id,event.clientX,event.clientY);});
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
    attachDrag(card,'widget',widget.id); return card;
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
    const dock=$('#dock');dock.replaceChildren();
    state.dock.forEach(id=>{const app=appById(id);if(!app)return;const button=el('button','dock-app');button.type='button';button.dataset.id=id;button.title=app.name;button.setAttribute('aria-label',`打开 ${app.name}`);button.append(appIcon(app),el('span','dock-tooltip',app.name));button.addEventListener('click',event=>{if(Date.now()<suppressClickUntil){event.preventDefault();return;}openApp(app);});button.addEventListener('contextmenu',event=>{event.preventDefault();openAppContext(app.id,event.clientX,event.clientY);});dock.append(button);});
    dock.append(el('span','dock-divider'));
    const more=el('button','dock-more','⋯');more.type='button';more.title='更多与设置';more.setAttribute('aria-label','更多与设置');more.addEventListener('click',openSettings);dock.append(more);
    dock.querySelectorAll('.dock-app').forEach((button,index,all)=>{
      button.addEventListener('mouseenter',()=>{if(all[index-1])all[index-1].classList.add('neighbor');if(all[index+1])all[index+1].classList.add('neighbor');});
      button.addEventListener('mouseleave',()=>all.forEach(item=>item.classList.remove('neighbor')));
      button.addEventListener('pointerdown',event=>{if(event.button!==0)return;dockDrag={id:button.dataset.id,button,x:event.clientX,y:event.clientY,pointerId:event.pointerId,active:false};});
    });
  }
  window.addEventListener('pointermove',event=>{
    const drag=dockDrag;if(!drag||drag.pointerId!==event.pointerId)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(!drag.active&&Math.hypot(dx,dy)<7)return;
    drag.active=true;event.preventDefault();drag.button.classList.add('dock-dragging');
    drag.button.style.transform=`translate(${dx}px,${dy}px) scale(1.08)`;
    document.querySelectorAll('.dock-drop-target').forEach(node=>node.classList.remove('dock-drop-target'));
    const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('.dock-app');
    if(target&&target!==drag.button)target.classList.add('dock-drop-target');
  },{passive:false});
  function finishDockDrag(event){
    const drag=dockDrag;if(!drag||drag.pointerId!==event.pointerId)return;dockDrag=null;
    drag.button.style.transform='';drag.button.classList.remove('dock-dragging');
    const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('.dock-app');
    document.querySelectorAll('.dock-drop-target').forEach(node=>node.classList.remove('dock-drop-target'));
    if(!drag.active)return;
    suppressClickUntil=Date.now()+450;
    if(!target||target===drag.button)return;
    const from=state.dock.indexOf(drag.id),to=state.dock.indexOf(target.dataset.id);
    if(from<0||to<0)return;
    state.dock.splice(from,1);state.dock.splice(to,0,drag.id);save();renderDock();toast('Dock 顺序已保存');
  }
  window.addEventListener('pointerup',finishDockDrag);
  window.addEventListener('pointercancel',finishDockDrag);
  function attachDrag(node,type,id) {
    node.addEventListener('pointerdown',event => {
      if (event.button !== 0 || dragState || $('#settingsDialog').open || $('#searchOverlay').classList.contains('open')) return;
      if (event.target.closest('.app-edit,.widget-edit')) return;
      if (type === 'widget' && event.target.closest('button,a,input,label,.player-progress')) return;
      const rect=node.getBoundingClientRect();
      dragState={node,type,id,page:node.dataset.page,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,
        offsetX:event.clientX-rect.left,offsetY:event.clientY-rect.top,width:rect.width,height:rect.height,active:false,touch:event.pointerType==='touch'};
      if (dragState.touch && !editing) dragState.timer=setTimeout(()=>startTileDrag(dragState),320);
    });
  }
  function startTileDrag(drag) {
    if (!drag || drag !== dragState || drag.active) return;
    drag.active=true; clearTimeout(drag.timer); drag.node.classList.add('is-dragging');
    const ghost=drag.node.cloneNode(true); ghost.removeAttribute('id'); ghost.querySelectorAll('[id]').forEach(child=>child.removeAttribute('id'));
    ghost.classList.add('drag-ghost'); ghost.classList.remove('is-dragging');
    ghost.style.width=`${drag.width}px`; ghost.style.height=`${drag.height}px`;
    ghost.style.left=`${drag.startX-drag.offsetX}px`; ghost.style.top=`${drag.startY-drag.offsetY}px`;
    document.body.append(ghost); drag.ghost=ghost;
    $('#desktopShell').classList.add('drag-active');
  }
  function stopTileDrag(event, canceled=false) {
    const drag=dragState;
    if (!drag || drag.pointerId!==event.pointerId) return;
    clearTimeout(drag.timer); clearTimeout(drag.edgeTimer); dragState=null;
    if (!drag.active) return;
    drag.node.classList.remove('is-dragging'); drag.ghost?.remove(); $('#desktopShell').classList.remove('drag-active');
    suppressClickUntil=Date.now()+450;
    if (canceled) return;
    const view=viewPages[currentPage],pageId=view.pageId;
    const canvas=$('.desktop-canvas',$('#pageTrack').children[currentPage]); if (!canvas) return;
    const mode=layoutMode(), columns=gridColumns(mode), item={kind:drag.type,data:drag.type==='app'?appById(drag.id):state.widgets.find(w=>w.id===drag.id)};
    if (!item.data) return;
    const {w,h}=tileSize(item,mode), rect=canvas.getBoundingClientRect(), style=getComputedStyle(canvas);
    const gap=parseFloat(style.columnGap)||0, pitchX=(rect.width-gap*(columns-1))/columns+gap;
    const pitchY=parseFloat(style.gridAutoRows)+ (parseFloat(style.rowGap)||0);
    const x=Math.max(0,Math.min(columns-w,Math.round((event.clientX-drag.offsetX-rect.left)/pitchX)));
    const localY=Math.max(0,Math.min(rowsPerPage-h,Math.round((event.clientY-drag.offsetY-rect.top)/pitchY)));
    const y=view.segment*rowsPerPage+localY;
    item.data.page=pageId;
    state.layout[mode][drag.id]={page:pageId,x,y,priority:Date.now()};
    save(); renderPages(); toast('位置已保存');
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
    closeAppContext();
    $('#searchOverlay').classList.add('open');$('#searchOverlay').setAttribute('aria-hidden','false');$('#searchInput').value='';selectedSearch=0;renderSearch();setTimeout(()=>$('#searchInput').focus(),70);
  }
  function searchClose() {$('#searchOverlay').classList.remove('open');$('#searchOverlay').setAttribute('aria-hidden','true');$('#searchTrigger').focus();}
  function queryResults() {
    const query=$('#searchInput').value.trim().toLocaleLowerCase();
    if(!query)return state.dock.map(id=>appById(id)).filter(Boolean).slice(0,6).map(app=>({type:'app',app}));
    const hits=state.apps.filter(app=>`${app.name} ${app.url} ${app.category}`.toLocaleLowerCase().includes(query));
    const history=state.searchHistory.filter(text=>text.toLocaleLowerCase().includes(query)).slice(0,2).map(text=>({type:'history',text}));
    return [...hits.slice(0,7).map(app=>({type:'app',app})),...history,{type:'web',text:$('#searchInput').value.trim()}];
  }
  function renderSearch() {
    const query=$('#searchInput').value.trim();$('#searchResultLabel').textContent=query?'搜索结果':'常用捷径';
    const results=queryResults(),root=$('#searchResults');root.replaceChildren();selectedSearch=Math.min(selectedSearch,Math.max(0,results.length-1));
    results.forEach((result,index)=>{
      const row=el('button',`search-result${index===selectedSearch?' selected':''}`);row.type='button';
      if(result.type==='app') {row.append(appIcon(result.app,true));const copy=el('span');copy.append(el('strong','',result.app.name),el('small','',result.app.url.replace(/^https?:\/\//,'')));row.append(copy);}
      else {row.append(el('span','tiny-app-icon',result.type==='history'?'↺':'⌕'));const copy=el('span');copy.append(el('strong','',result.type==='history'?result.text:`用 ${engines.find(e=>e.id===activeEngine).name} 搜索“${result.text}”`),el('small','',result.type==='history'?'搜索历史':'按 Enter 搜索网页'));row.append(copy);}
      row.append(el('span','result-arrow','↗'));row.addEventListener('click',()=>runResult(result));root.append(row);
    });
    const choices=$('#engineChoices');choices.replaceChildren();engines.forEach(engine=>{const button=el('button',`engine-choice${engine.id===activeEngine?' active':''}`,engine.name);button.type='button';button.addEventListener('click',()=>{activeEngine=engine.id;renderSearch();});choices.append(button);});
  }
  function runResult(result) {
    if(result.type==='app') {openApp(result.app);searchClose();return;}
    const query=result.text.trim();if(!query)return;
    state.searchHistory=[query,...state.searchHistory.filter(x=>x!==query)].slice(0,12);save();
    const url=validUrl(query.startsWith('http')?query:`https://${query}`);
    const looksLikeDomain=/^(?:[\w-]+\.)+[a-z]{2,}(?:\/\S*)?$/i.test(query);
    window.open(looksLikeDomain&&url?url:engines.find(e=>e.id===activeEngine).url+encodeURIComponent(query),'_blank','noopener,noreferrer');searchClose();
  }
  function openSettings() {closeAppContext();settingsTab='apps';renderSettings();$('#settingsDialog').showModal();}
  function closeSettings() {$('#settingsDialog').close();}
  function renderSettings() {
    $('#settingsTabs').querySelectorAll('button').forEach(button=>button.classList.toggle('active',button.dataset.tab===settingsTab));
    const root=$('#settingsContent');root.replaceChildren();
    if(settingsTab==='apps')renderAppSettings(root);
    if(settingsTab==='widgets')renderWidgetSettings(root);
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
    settingsHeader(root,'App 快捷方式','点击直达 · 整理模式可在桌面拖动排序','+ 添加 App',()=>openEditor('app'));
    state.pages.forEach(page=>{
      root.append(el('p','section-eyebrow',page.name));const list=el('div','settings-list');list.style.margin='9px 0 19px';
      state.apps.filter(app=>app.page===page.id).forEach(app=>{
        const row=el('div','settings-row');row.append(appIcon(app,true));const meta=el('div','row-meta');meta.append(el('strong','',app.name),el('small','',app.url));row.append(meta);
        const actions=el('div','row-actions');[['↑',()=>moveItem('app',app.id,-1)],['↓',()=>moveItem('app',app.id,1)],['编辑',()=>openEditor('app',app.id)]].forEach(([label,fn])=>{const button=el('button','',label);button.type='button';button.addEventListener('click',fn);actions.append(button);});row.append(actions);list.append(row);
      });root.append(list);
    });
  }
  function renderWidgetSettings(root) {
    settingsHeader(root,'Widget 卡片','支持调整页面、大小和排列顺序','+ 添加 Widget',()=>openEditor('widget'));
    state.pages.forEach(page=>{root.append(el('p','section-eyebrow',page.name));const list=el('div','settings-list');list.style.margin='9px 0 19px';
      state.widgets.filter(w=>w.page===page.id).forEach(w=>{const row=el('div','settings-row');row.append(el('span','tiny-app-icon',widgetSymbol(w.type)));
        const meta=el('div','row-meta');meta.append(el('strong','',w.title||widgetLabel(w.type)),el('small','',`${widgetLabel(w.type)} · ${w.size==='wide'?'宽卡片':w.size==='small'?'小卡片':'标准卡片'}`));row.append(meta);
        const actions=el('div','row-actions');[['↑',()=>moveItem('widget',w.id,-1)],['↓',()=>moveItem('widget',w.id,1)],['编辑',()=>openEditor('widget',w.id)]].forEach(([label,fn])=>{const button=el('button','',label);button.type='button';button.addEventListener('click',fn);actions.append(button);});row.append(actions);list.append(row);});root.append(list);});
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
    const options=el('div','wallpaper-options');[['sunny','晴天小镇'],['peach','蜜桃云朵'],['sage','薄荷绿洲'],['night','暮色夜空']].forEach(([id,name])=>{const button=el('button',`wallpaper-option${state.wallpaper===id?' active':''}`);button.type='button';button.append(el('div',`wallpaper-swatch ${id}`),el('span','',name));button.addEventListener('click',()=>{state.wallpaper=id;save();setWallpaper();renderSettings();});options.append(button);});root.append(options);
    const upload=el('label','button-secondary','上传自己的壁纸');upload.style.display='inline-block';upload.style.cursor='pointer';const input=el('input');input.type='file';input.accept='image/*';input.hidden=true;input.addEventListener('change',async()=>{if(!input.files?.[0])return;try{state.customWallpaper=await compressImage(input.files[0]);state.wallpaper='custom';save();setWallpaper();renderSettings();toast('壁纸已更新');}catch{toast('无法读取这张图片');}});upload.append(input);root.append(upload);
    root.append(el('p','settings-note','自定义壁纸会压缩后保存在当前浏览器。导出配置可用于备份。'));
    const fields=el('div','field-grid');fields.style.marginTop='19px';const city=field('天气城市',state.city.name,'text');const lat=field('纬度',state.city.latitude,'number');const lon=field('经度',state.city.longitude,'number');fields.append(city.wrap,lat.wrap,lon.wrap);root.append(fields);
    const saveCity=el('button','button-primary','保存天气位置');saveCity.type='button';saveCity.style.marginTop='12px';saveCity.addEventListener('click',()=>{const latitude=Number(lat.input.value),longitude=Number(lon.input.value);if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)return toast('请输入有效的经纬度');state.city={name:city.input.value.trim()||'我的城市',latitude,longitude};save();weather=null;renderPages();loadWeather();toast('天气位置已保存');});root.append(saveCity);
  }
  function compressImage(file) {
    return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const image=new Image();image.onerror=reject;image.onload=()=>{const scale=Math.min(1,1800/image.width,1200/image.height);const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.8));};image.src=reader.result;};reader.readAsDataURL(file);});
  }
  function renderDataSettings(root) {
    settingsHeader(root,'布局与数据','所有改动默认保存在当前浏览器');const actions=el('div','data-actions');
    const exportButton=el('button','button-primary','导出 JSON 备份');exportButton.type='button';exportButton.addEventListener('click',()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=el('a');link.href=url;link.download='qingyu-desktop-backup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});actions.append(exportButton);
    const importLabel=el('label','button-secondary','导入 JSON 备份');importLabel.style.cursor='pointer';const input=el('input');input.type='file';input.accept='.json,application/json';input.addEventListener('change',async()=>{if(!input.files?.[0])return;try{const data=JSON.parse(await input.files[0].text());const imported=importLegacy(data);state=normalize(imported);save();setWallpaper();renderPages();renderDock();renderSettings();loadWeather();toast('桌面配置已导入');}catch{toast('JSON 格式不正确');}});importLabel.append(input);actions.append(importLabel);root.append(actions);
    const reset=el('button','text-danger','恢复默认桌面');reset.type='button';reset.addEventListener('click',()=>{if(!confirm('确定恢复默认桌面？当前自定义布局会被覆盖。'))return;state=clone(defaults);save();setWallpaper();renderPages();renderDock();renderSettings();loadWeather();toast('已恢复默认桌面');});root.append(reset);
    root.append(el('p','settings-note','兼容导入原 browser-start-page-v2 导出的 shortcuts / widgets JSON。网站配置只存于本机浏览器，清除浏览器数据前请先导出备份。'));
  }
  function importLegacy(data) {
    if(Array.isArray(data.apps))return data;
    if(!Array.isArray(data.shortcuts))throw Error('unknown format');
    const base=clone(defaults);base.apps=data.shortcuts.filter(item=>validUrl(item.url)).map((item,index)=>({id:String(item.id||crypto.randomUUID()),name:String(item.name||'快捷方式'),url:validUrl(item.url),icon:String(item.icon||item.name?.slice(0,2)||'✦'),color:/^#[\da-f]{6}$/i.test(item.color)?item.color:'#6c9ca4',page:pageIds[index%4],category:String(item.category||'常用')}));
    base.widgets=[...defaults.widgets,...(Array.isArray(data.widgets)?data.widgets:[]).map(item=>({id:String(item.id||crypto.randomUUID()),type:item.type==='link'?'link':'note',page:'personal',size:'medium',title:String(item.title||'旧版便签'),content:String(item.content||'')}))];
    base.dock=base.apps.slice(0,8).map(app=>app.id);return base;
  }
  function field(label,value,type='text',options) {
    const wrap=el('label','field',label);let input;
    if(options){input=el('select');options.forEach(([value,text])=>{const option=el('option','',text);option.value=value;input.append(option);});input.value=value;}
    else if(type==='textarea'){input=el('textarea');input.value=value||'';}
    else{input=el('input');input.type=type;input.value=value??'';}
    wrap.append(input);return {wrap,input};
  }
  function openEditor(type,id=null) {
    editorContext={type,id};const item=id?(type==='app'?appById(id):state.widgets.find(w=>w.id===id)):null;
    $('#editorTitle').textContent=`${id?'编辑':'添加'} ${type==='app'?'App':'Widget'}`;$('#editorDelete').hidden=!id;
    const root=$('#editorFields');root.replaceChildren();const fields={};
    const add=(key,label,value,inputType='text',options)=>{const entry=field(label,value,inputType,options);entry.input.name=key;root.append(entry.wrap);fields[key]=entry.input;};
    if(type==='app'){
      add('name','名称',item?.name||'');add('url','网站 URL',item?.url||'https://','url');add('icon','图标字符 / 图片 URL',item?.icon||'✦');add('color','图标背景色',item?.color||'#6c9ca4','color');add('category','分类',item?.category||'常用');add('page','桌面页面',item?.page||viewPages[currentPage].pageId,'select',state.pages.map(page=>[page.id,page.name]));
    }else{
      add('type','Widget 类型',item?.type||'note','select',['clock','note','link','todo','calendar','quote','weather','progress','recent','favorites','watching','player','quick'].map(t=>[t,widgetLabel(t)]));
      add('title','标题',item?.title||'');add('content','内容 / 链接',item?.content||'','textarea');add('size','卡片尺寸',item?.size||'medium','select',[['small','小'],['medium','标准'],['wide','宽']]);add('page','桌面页面',item?.page||viewPages[currentPage].pageId,'select',state.pages.map(page=>[page.id,page.name]));
    }
    editorContext.fields=fields;$('#editorDialog').showModal();fields.name?.focus();
  }
  function closeEditor() {$('#editorDialog').close();editorContext=null;}
  function saveEditor() {
    if(!editorContext)return;const {type,id,fields}=editorContext;
    if(type==='app'){
      const url=validUrl(fields.url.value.trim());if(!url)return toast('请输入以 http 或 https 开头的网址');
      const name=fields.name.value.trim();if(!name)return toast('请输入 App 名称');
      const app={id:id||crypto.randomUUID(),name:name.slice(0,32),url,icon:fields.icon.value.trim().slice(0,180)||'✦',color:fields.color.value,page:fields.page.value,category:fields.category.value.trim().slice(0,16)||'常用'};
      const index=state.apps.findIndex(item=>item.id===id);if(index>=0)state.apps[index]=app;else state.apps.push(app);
    }else{
      const widget={id:id||crypto.randomUUID(),type:fields.type.value,title:fields.title.value.trim().slice(0,40),content:fields.content.value.trim().slice(0,400),size:fields.size.value,page:fields.page.value};
      if(widget.type==='link'&&!validUrl(widget.content))return toast('链接 Widget 需要有效的 http 或 https 地址');
      const index=state.widgets.findIndex(item=>item.id===id);if(index>=0)state.widgets[index]=widget;else state.widgets.push(widget);
    }
    save();closeEditor();renderPages();renderDock();if($('#settingsDialog').open)renderSettings();toast('已保存到桌面');
  }
  function deleteEditor() {
    if(!editorContext?.id)return;const {type,id}=editorContext;
    if(type==='app'){state.apps=state.apps.filter(item=>item.id!==id);state.dock=state.dock.filter(x=>x!==id);state.history=state.history.filter(x=>x!==id);}
    else state.widgets=state.widgets.filter(item=>item.id!==id);
    save();closeEditor();renderPages();renderDock();if($('#settingsDialog').open)renderSettings();toast('已删除');
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
  $('#settingsButton').addEventListener('click',openSettings);
  $('#editModeButton').addEventListener('click',toggleEdit);
  $('#settingsClose').addEventListener('click',closeSettings);
  $('#settingsTabs').addEventListener('click',event=>{const tab=event.target.closest('[data-tab]');if(!tab)return;settingsTab=tab.dataset.tab;renderSettings();});
  $('#editorClose').addEventListener('click',closeEditor);
  $('#editorCancel').addEventListener('click',closeEditor);
  $('#editorDelete').addEventListener('click',deleteEditor);
  $('#editorForm').addEventListener('submit',event=>{event.preventDefault();saveEditor();});
  document.addEventListener('keydown',event=>{
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();searchOpen();return;}
    if(event.key==='Escape'&&!$('#appContextMenu').hidden){closeAppContext();return;}
    if(event.key==='Escape'&&$('#searchOverlay').classList.contains('open')){searchClose();return;}
    if(document.activeElement?.matches('input,textarea,select')||$('#settingsDialog').open||$('#editorDialog').open||$('#searchOverlay').classList.contains('open'))return;
    if(event.key==='ArrowRight')setPage(currentPage+1);if(event.key==='ArrowLeft')setPage(currentPage-1);
  });
  $('#desktopViewport').addEventListener('wheel',event=>{
    if($('#settingsDialog').open||$('#searchOverlay').classList.contains('open'))return;
    if(Math.abs(event.deltaX)+Math.abs(event.deltaY)<15)return;
    if(Date.now()-wheelAt<550){event.preventDefault();return;}
    wheelAt=Date.now();event.preventDefault();setPage(currentPage+(Math.abs(event.deltaX)>Math.abs(event.deltaY)?Math.sign(event.deltaX):Math.sign(event.deltaY)));
  },{passive:false});
  const viewport=$('#desktopViewport');
  window.addEventListener('pointermove',event=>{
    const drag=dragState; if(!drag || drag.pointerId!==event.pointerId)return;
    const distance=Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY);
    if(drag.touch && distance>12 && !drag.active)clearTimeout(drag.timer);
    if(!drag.active && distance>7 && (!drag.touch || editing))startTileDrag(drag);
    if(!drag.active)return;
    event.preventDefault(); drag.ghost.style.left=`${event.clientX-drag.offsetX}px`;drag.ghost.style.top=`${event.clientY-drag.offsetY}px`;
    const edge=event.clientX<38?-1:event.clientX>innerWidth-38?1:0;
    const destination=currentPage+edge;
    if(edge && destination>=0 && destination<viewPages.length){
      if(drag.edgeDestination!==destination){clearTimeout(drag.edgeTimer);drag.edgeDestination=destination;
        drag.edgeTimer=setTimeout(()=>{if(dragState===drag){setPage(destination);drag.edgeDestination=null;}},560);}
    }else{clearTimeout(drag.edgeTimer);drag.edgeDestination=null;}
  },{passive:false});
  window.addEventListener('pointerup',event=>stopTileDrag(event));
  window.addEventListener('pointercancel',event=>stopTileDrag(event,true));
  viewport.addEventListener('pointerdown',event=>{if(editing||event.button!==0||event.target.closest('input,textarea,select,button'))return;
    if(event.pointerType!=='touch' && event.target.closest('.app-shortcut,.widget-card'))return;
    pointerStart={x:event.clientX,y:event.clientY,page:currentPage,id:event.pointerId};});
  viewport.addEventListener('pointermove',event=>{if(!pointerStart||pointerStart.id!==event.pointerId||dragState?.active)return;const dx=event.clientX-pointerStart.x,dy=event.clientY-pointerStart.y;if(Math.abs(dx)<8||Math.abs(dx)<Math.abs(dy)*1.2)return;const width=viewport.clientWidth;$('#pageTrack').classList.add('dragging');$('#pageTrack').style.transform=`translate3d(calc(${-pointerStart.page*100}% + ${Math.max(-width*.45,Math.min(width*.45,dx))}px),0,0)`;});
  function finishPointer(event){if(!pointerStart||pointerStart.id!==event.pointerId)return;if(dragState?.active){pointerStart=null;$('#pageTrack').classList.remove('dragging');setPage(currentPage);return;}const dx=event.clientX-pointerStart.x,dy=event.clientY-pointerStart.y;$('#pageTrack').classList.remove('dragging');if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.2){suppressClickUntil=Date.now()+400;setPage(pointerStart.page+(dx<0?1:-1));}else setPage(pointerStart.page);pointerStart=null;}
  viewport.addEventListener('pointerup',finishPointer);viewport.addEventListener('pointercancel',finishPointer);
  viewport.addEventListener('click',event=>{if(Date.now()<suppressClickUntil){event.preventDefault();event.stopPropagation();}},true);
  document.addEventListener('pointerdown',event=>{const menu=$('#appContextMenu');if(!menu.hidden&&!menu.contains(event.target))closeAppContext();},true);
  document.addEventListener('contextmenu',event=>{const menu=$('#appContextMenu');if(!menu.hidden&&!event.target.closest('.app-shortcut,.dock-app'))closeAppContext();});
  window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(renderPages);});

  setWallpaper();renderPages();renderDock();loadWeather();updateClock();setInterval(updateClock,30000);
})();
