(() => {
  'use strict';

  const STORAGE_KEY = 'qingyu-desktop-v1';
  const defaults = window.DEFAULT_DESKTOP_CONFIG;
  const $ = (selector, root = document) => root.querySelector(selector);
  const clone = value => JSON.parse(JSON.stringify(value));
  const pageIds = defaults.pages.map(page => page.id);
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
    data.apps = (Array.isArray(raw.apps) ? raw.apps : defaults.apps).filter(item => item && validUrl(item.url)).map(item => ({
      id: String(item.id || crypto.randomUUID()), name: String(item.name || '未命名').slice(0, 32),
      url: validUrl(item.url), icon: String(item.icon || '✦').slice(0, 180),
      color: /^#[\da-f]{6}$/i.test(item.color) ? item.color : '#6c9ca4',
      page: pageIds.includes(item.page) ? item.page : 'home', category: String(item.category || '常用').slice(0, 16)
    }));
    data.widgets = (Array.isArray(raw.widgets) ? raw.widgets : defaults.widgets).filter(Boolean).map(item => ({
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
  let suppressClickUntil = 0;
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
  function renderPages() {
    const track = $('#pageTrack'); track.replaceChildren();
    state.pages.forEach((page,index) => {
      const section = el('section','desktop-page'); section.dataset.page = page.id; section.setAttribute('aria-label',page.name);
      const inner = el('div','page-inner');
      const lead = el('header',index === 0 ? 'page-lead home-lead' : 'page-lead secondary-lead');
      if (index === 0) {
        const group = el('div','clock-group'); const clock = el('div','clock-big','--:--'); clock.id = 'clockText'; group.append(clock);
        const copy = el('div','home-lead-copy');
        copy.append(el('p','eyebrow',page.eyebrow),el('h1','',page.title));
        const date = el('p','', ''); date.id = 'clockDate'; copy.append(date); group.append(copy); lead.append(group);
      } else {
        const copy = el('div'); copy.append(el('p','eyebrow',page.eyebrow),el('h1','',page.title),el('p','',page.name));
        lead.append(copy,el('span','page-number',String(index+1).padStart(2,'0')));
      }
      inner.append(lead);
      const widgets = el('div','widget-grid'); widgets.dataset.widgetPage = page.id;
      state.widgets.filter(w => w.page === page.id).forEach(widget => widgets.append(renderWidget(widget)));
      inner.append(widgets);
      const appSection = el('section','apps-section');
      const head = el('div','apps-head'); head.append(el('h2','',index === 0 ? '常用 App' : '我的 App'),el('small','',`${state.apps.filter(app=>app.page===page.id).length} 个捷径 · 点击直达`));
      appSection.append(head);
      const grid = el('div','apps-grid'); grid.dataset.appPage = page.id;
      state.apps.filter(app => app.page === page.id).forEach(app => grid.append(renderApp(app)));
      appSection.append(grid); inner.append(appSection); section.append(inner); track.append(section);
    });
    renderDots(); updateClock(); setPage(currentPage,false);
    $('#desktopShell').classList.toggle('editing',editing);
  }
  function renderDots() {
    const dots = $('#pageDots'); dots.replaceChildren();
    state.pages.forEach((page,index) => { const button = el('button'); button.type = 'button'; button.title = page.name; button.setAttribute('aria-label',`切换到${page.name}`); button.addEventListener('click',() => setPage(index)); dots.append(button); });
  }
  function setPage(index, animate = true) {
    currentPage = Math.max(0,Math.min(state.pages.length-1,index));
    const track = $('#pageTrack');
    if (!animate) { track.classList.add('dragging'); requestAnimationFrame(() => track.classList.remove('dragging')); }
    track.style.transform = `translate3d(${-currentPage*100}%,0,0)`;
    [...$('#pageDots').children].forEach((dot,i) => { dot.classList.toggle('active',i===currentPage); dot.setAttribute('aria-current',String(i===currentPage)); });
  }
  function renderApp(app) {
    const wrap = el('div','app-shortcut'); wrap.dataset.id = app.id; wrap.draggable = editing;
    const link = el('a'); link.href = app.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.setAttribute('aria-label',`打开 ${app.name}`);
    link.draggable = false;
    link.append(appIcon(app),el('span','app-name',app.name));
    link.addEventListener('click',event => {
      if (editing || Date.now() < suppressClickUntil) { event.preventDefault(); if (editing) openEditor('app',app.id); return; }
      state.history = [app.id,...state.history.filter(id=>id!==app.id)].slice(0,12); save();
    });
    const edit = el('button','app-edit','✎'); edit.type='button'; edit.title=`编辑 ${app.name}`; edit.addEventListener('click',() => openEditor('app',app.id));
    wrap.append(link,edit); attachDrag(wrap,'app',app.id); return wrap;
  }
  function renderWidget(widget) {
    const card = el('article','widget-card'); card.dataset.id=widget.id; card.dataset.type=widget.type; card.dataset.size=widget.size; card.draggable=editing;
    const head=el('div','widget-head'); head.append(el('span','widget-label',widget.title || widgetLabel(widget.type)));
    const symbol=el('span','widget-symbol',widgetSymbol(widget.type)); head.append(symbol); card.append(head);
    const content=el('div','widget-content'); card.append(content);
    switch(widget.type) {
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
  function widgetLabel(type) { return ({weather:'今日天气',calendar:'本月日历',quote:'每日一句',todo:'今日计划',progress:'学习进度',recent:'最近访问',favorites:'收藏网站',watching:'继续观看',player:'迷你播放器',note:'便签',link:'快捷链接',quick:'快捷工具'})[type]||'Widget'; }
  function widgetSymbol(type) { return ({weather:'☀',calendar:'▦',quote:'✿',todo:'✓',progress:'↗',recent:'↗',favorites:'♡',watching:'▶',player:'♫',note:'✎',link:'↗',quick:'⌘'})[type]||'✦'; }
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
    state.dock.forEach(id=>{const app=appById(id);if(!app)return;const button=el('button','dock-app');button.type='button';button.title=app.name;button.setAttribute('aria-label',`打开 ${app.name}`);button.append(appIcon(app),el('span','dock-tooltip',app.name));button.addEventListener('click',()=>openApp(app));dock.append(button);});
    dock.append(el('span','dock-divider'));
    const more=el('button','dock-more','⋯');more.type='button';more.title='更多与设置';more.setAttribute('aria-label','更多与设置');more.addEventListener('click',openSettings);dock.append(more);
    dock.querySelectorAll('.dock-app').forEach((button,index,all)=>{
      button.addEventListener('mouseenter',()=>{if(all[index-1])all[index-1].classList.add('neighbor');if(all[index+1])all[index+1].classList.add('neighbor');});
      button.addEventListener('mouseleave',()=>all.forEach(item=>item.classList.remove('neighbor')));
    });
  }
  function attachDrag(node,type,id) {
    node.addEventListener('dragstart',event=>{if(!editing){event.preventDefault();return;}dragState={type,id};node.classList.add('is-dragging');event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',id);});
    node.addEventListener('dragend',()=>{node.classList.remove('is-dragging');document.querySelectorAll('.drag-target').forEach(item=>item.classList.remove('drag-target'));dragState=null;});
    node.addEventListener('dragover',event=>{if(dragState?.type!==type||dragState.id===id)return;event.preventDefault();node.classList.add('drag-target');});
    node.addEventListener('dragleave',()=>node.classList.remove('drag-target'));
    node.addEventListener('drop',event=>{event.preventDefault();node.classList.remove('drag-target');if(dragState?.type!==type||dragState.id===id)return;reorder(type,dragState.id,id);});
  }
  function reorder(type,fromId,toId) {
    const list=type==='app'?state.apps:state.widgets;
    const from=list.findIndex(item=>item.id===fromId),to=list.findIndex(item=>item.id===toId);
    if(from<0||to<0)return;const [item]=list.splice(from,1);list.splice(to,0,item);save();renderPages();if($('#settingsDialog').open)renderSettings();
  }
  function moveItem(type,id,direction) {
    const list=type==='app'?state.apps:state.widgets;const index=list.findIndex(item=>item.id===id);const next=index+direction;
    if(index<0||next<0||next>=list.length||list[next].page!==list[index].page)return;
    [list[index],list[next]]=[list[next],list[index]];save();renderPages();renderSettings();
  }
  function toggleEdit() {
    editing=!editing;$('#desktopShell').classList.toggle('editing',editing);$('#editModeButton').classList.toggle('active',editing);
    document.querySelectorAll('.app-shortcut,.widget-card').forEach(node=>node.draggable=editing);
    toast(editing?'整理模式：拖动图标或卡片排序':'桌面布局已保存');
  }
  function searchOpen() {
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
  function openSettings() {settingsTab='apps';renderSettings();$('#settingsDialog').showModal();}
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
      add('name','名称',item?.name||'');add('url','网站 URL',item?.url||'https://','url');add('icon','图标字符 / 图片 URL',item?.icon||'✦');add('color','图标背景色',item?.color||'#6c9ca4','color');add('category','分类',item?.category||'常用');add('page','桌面页面',item?.page||state.pages[currentPage].id,'select',state.pages.map(page=>[page.id,page.name]));
    }else{
      add('type','Widget 类型',item?.type||'note','select',['note','link','todo','calendar','quote','weather','progress','recent','favorites','watching','player','quick'].map(t=>[t,widgetLabel(t)]));
      add('title','标题',item?.title||'');add('content','内容 / 链接',item?.content||'','textarea');add('size','卡片尺寸',item?.size||'medium','select',[['small','小'],['medium','标准'],['wide','宽']]);add('page','桌面页面',item?.page||state.pages[currentPage].id,'select',state.pages.map(page=>[page.id,page.name]));
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
    if(event.key==='Escape'&&$('#searchOverlay').classList.contains('open')){searchClose();return;}
    if(document.activeElement?.matches('input,textarea,select')||$('#settingsDialog').open||$('#editorDialog').open||$('#searchOverlay').classList.contains('open'))return;
    if(event.key==='ArrowRight')setPage(currentPage+1);if(event.key==='ArrowLeft')setPage(currentPage-1);
  });
  $('#desktopViewport').addEventListener('wheel',event=>{
    if($('#settingsDialog').open||$('#searchOverlay').classList.contains('open')||editing)return;
    if(Math.abs(event.deltaX)+Math.abs(event.deltaY)<15)return;
    if(Date.now()-wheelAt<550){event.preventDefault();return;}
    wheelAt=Date.now();event.preventDefault();setPage(currentPage+(Math.abs(event.deltaX)>Math.abs(event.deltaY)?Math.sign(event.deltaX):Math.sign(event.deltaY)));
  },{passive:false});
  const viewport=$('#desktopViewport');
  viewport.addEventListener('pointerdown',event=>{if(editing||event.button!==0||event.target.closest('input,textarea,select,button'))return;pointerStart={x:event.clientX,y:event.clientY,page:currentPage,id:event.pointerId};});
  viewport.addEventListener('pointermove',event=>{if(!pointerStart||pointerStart.id!==event.pointerId)return;const dx=event.clientX-pointerStart.x,dy=event.clientY-pointerStart.y;if(Math.abs(dx)<8||Math.abs(dx)<Math.abs(dy)*1.2)return;const width=viewport.clientWidth;$('#pageTrack').classList.add('dragging');$('#pageTrack').style.transform=`translate3d(calc(${-pointerStart.page*100}% + ${Math.max(-width*.45,Math.min(width*.45,dx))}px),0,0)`;});
  function finishPointer(event){if(!pointerStart||pointerStart.id!==event.pointerId)return;const dx=event.clientX-pointerStart.x,dy=event.clientY-pointerStart.y;$('#pageTrack').classList.remove('dragging');if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.2){suppressClickUntil=Date.now()+400;setPage(pointerStart.page+(dx<0?1:-1));}else setPage(pointerStart.page);pointerStart=null;}
  viewport.addEventListener('pointerup',finishPointer);viewport.addEventListener('pointercancel',finishPointer);
  viewport.addEventListener('click',event=>{if(Date.now()<suppressClickUntil){event.preventDefault();event.stopPropagation();}},true);

  setWallpaper();renderPages();renderDock();loadWeather();updateClock();setInterval(updateClock,30000);
})();
