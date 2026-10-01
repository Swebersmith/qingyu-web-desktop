import {suggestGroups, validateGroups, folderMetrics, organizationSignals} from './organizer.js';
import {normalizePages, reconcileDesktop} from './desktop-model.js';
import {CloudSync,SYNC_STORAGE_KEY} from './sync-client.js';
import {generateSyncKey,sameState} from './sync-model.js';
import {importDesktop} from './desktop-import.js';
import {normalizeProgress,progressSummary,monthGrid,weatherInfo} from './widget-model.js';
import {IconStore} from './icon-client.js';
import {loadDailyBing} from './wallpaper-client.js';
import {bingImageID,bingProxyURL} from './wallpaper-model.js';
import {planDesktopOrganization,desktopTileSize,resolveTilePositions} from './layout-organizer.js';

(() => {
  'use strict';

  const STORAGE_KEY = 'qingyu-desktop-v1';
  const defaults = window.DEFAULT_DESKTOP_CONFIG;
  const $ = (selector, root = document) => root.querySelector(selector);
  const clone = value => JSON.parse(JSON.stringify(value));
  const icons=new IconStore(),folderAppNodes=new Map(),iconPainters=new WeakMap();
  let deleteConfirmation=null;
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
    data.pages = normalizePages(raw.pages,defaults.pages);
    const pageIds=data.pages.map(page=>page.id),fallbackPage=pageIds[0];
    const sourceApps = Array.isArray(raw.apps) ? [...raw.apps] : [...defaults.apps];
    if (!sourceApps.some(app=>app?.id==='weboss-settings')) sourceApps.push(defaults.apps.find(app=>app.id==='weboss-settings'));
    if ((Number(raw.version) || 1) < 2) defaults.apps.forEach(app => { if (newDefaultAppIds.has(app.id) && !sourceApps.some(item => item.id === app.id)) sourceApps.push(app); });
    data.apps = sourceApps.filter(item => item && (validUrl(item.url) || item.id==='weboss-settings')).map(item => ({
      id: String(item.id || crypto.randomUUID()), name: String(item.name || '未命名').slice(0, 64),
      url: validUrl(item.url), system: item.id==='weboss-settings'?'settings':undefined, icon: String(item.icon || '✦').slice(0, 180),
      iconMode: item.iconMode === 'custom' || (!item.iconMode && (!defaults.apps.some(app => app.id === item.id && app.icon === item.icon) && item.id)) ? 'custom' : 'auto',
      color: /^#[\da-f]{6}$/i.test(item.color) ? item.color : '#6c9ca4',
      page: pageIds.includes(item.page) ? item.page : fallbackPage
    }));
    const grouped = new Set();
    data.folders = (Array.isArray(raw.folders)?raw.folders:[]).filter(Boolean).map(item=>({
      id:String(item.id||crypto.randomUUID()),name:String(item.name||'文件夹').slice(0,32),
      page:pageIds.includes(item.page)?item.page:fallbackPage,sizes:item.sizes&&typeof item.sizes==='object'?item.sizes:{},
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
      page: pageIds.includes(item.page) ? item.page : fallbackPage,
      size: ['small','medium','wide'].includes(item.size) ? item.size : 'medium',
      title: String(item.title || '').slice(0, 40), content: item.type==='progress'&&item.content==='本周已完成 4 / 6 个小目标'?'本周学习目标':String(item.content || '').slice(0, 4000),
      ...(item.type==='progress'?{progress:normalizeProgress(item.progress)}:{})
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
    reconcileDesktop(data);
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
  let weatherRequest = null;
  let quoteOffset = 0;
  let toastTimer = 0;
  let wheelAt = 0;
  let pointerStart = null;
  let dragState = null;
  let resizeState = null;
  let folderId = null;
  let folderPage = 0;
  let folderSwipe = null,folderWheelAt=0;
  let widgetId = null,widgetMonth = new Date(new Date().getFullYear(),new Date().getMonth(),1);
  let bingLoading = false,bingLoadedKey='',bingDisplayURL='';
  const surfaces = new Map();
  let dropSettling = false;
  let suppressClickUntil = 0;
  let viewPages = [];
  let rowsPerPage = 7;
  const tileSignatures = new WeakMap();
  let dockSignature = '';
  let resizeFrame = 0;
  let sizingFolderId = null;
  let organizerMode = 'bulk', organizerFolderId = null, organizerPlan = null, organizerBusy = false;
  let organizerRequest = null, organizationUndo = null;
  const selectedApps = new Set();
  let cloudSync,cloudStatus={phase:'off'},syncDraft='',syncCreateDraft='',syncChangeDraft='',syncKeyVisible=false,syncBackupId='',syncService='unknown',pendingExternalState=false;
  let bulkDraft = {action:'new',name:'常用 App',page:'home',folder:''};
  const folderResizeObserver = new ResizeObserver(entries => entries.forEach(entry => fitFolderTile(entry.target)));
  const music = { context: null, timer: null, frame: null, playing: false, track: 0, elapsed: 0, lastTick: 0, lastNote: -1 };

  function save() {
    const mode=layoutMode(),live={ [mode]:{} };
    document.querySelectorAll('.desktop-canvas>.folder-tile').forEach(node=>{live[mode][node.dataset.id]={page:node.dataset.page,...tilePosition(node),priority:Number(state.layout[mode][node.dataset.id]?.priority)||1};});
    const result=reconcileDesktop(state,viewPages[currentPage]?.pageId,live);
    if(folderId&&result.dissolved.includes(folderId))closeFolder();
    if(result.dissolved.includes(sizingFolderId))sizingFolderId=null;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { toast('浏览器存储空间不足，请导出配置备份'); }
    pendingExternalState=false;cloudSync?.localChanged();
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
  function unpinApp(id,page=viewPages[currentPage]?.pageId) {
    if(!state.dock.includes(id))return;
    state.dock=state.dock.filter(appId=>appId!==id);const app=appById(id);if(app){app.page=state.pages.some(item=>item.id===page)?page:state.pages[0].id;clearAppLayout(id);}
  }
  function itemById(type,id) { return type==='app'?appById(id):type==='folder'?folderById(id):state.widgets.find(widget=>widget.id===id); }
  function refreshDesktop() { save();renderPages();renderDock();if(folderId){if(folderById(folderId))renderFolderContents();else closeFolder();}if(widgetId)renderWidgetDetails();if($('#settingsDialog').open)renderSettings(); }
  function isLightColor(hex) {
    const rgb = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16));
    return rgb[0]*.299 + rgb[1]*.587 + rgb[2]*.114 > 185;
  }
  function appIcon(app, tiny = false, preview = false) {
    const icon = el('span', tiny ? 'tiny-app-icon' : 'app-icon');
    icon.dataset.appId=app.id;
    icon.style.setProperty('--app-color', app.color);
    if (tiny) { icon.style.background = app.color; icon.style.color = isLightColor(app.color) ? '#38545a' : '#fff'; }
    else if (isLightColor(app.color)) icon.classList.add('light');
    const fallbackText=/^https?:\/\//.test(app.icon) ? app.name.slice(0,1) : app.icon;
    const fallback=el('span','icon-fallback',fallbackText || app.name.slice(0,1) || '✦');icon.append(fallback);
    if(preview){const source=document.querySelector(`[data-id="${CSS.escape(app.id)}"] .has-favicon`);if(source){const snapshot=source.cloneNode(true);snapshot.classList.remove('app-icon','tiny-app-icon');snapshot.classList.add(tiny?'tiny-app-icon':'app-icon');return snapshot;}}
    const manual=app.iconMode==='custom';if(app.system||manual&&!validUrl(app.icon))return icon;
    const paint=value=>{if(!value||icon.dataset.favicon===value.src)return;const image=new Image();image.alt='';image.draggable=false;image.decoding='async';image.referrerPolicy='no-referrer';image.src=value.src;icon.querySelector('img')?.remove();icon.append(image);icon.classList.add('has-favicon');icon.classList.toggle('auto-favicon',value.source==='website');icon.classList.toggle('generated-icon',value.source==='ai'||value.source==='local');icon.dataset.iconMode=value.source==='custom'?'custom':'auto';icon.dataset.iconSource=value.source;icon.dataset.favicon=value.src;icon.title=value.source==='ai'?'AI 生成的备用图标':value.source==='local'?'本地备用图标':'';if(tiny&&value.source==='website')icon.style.background='rgba(255,255,255,.92)';};
    iconPainters.set(icon,paint);paint(icons.peek(app));
    if(!preview)requestAnimationFrame(()=>{if(!icon.isConnected)return;let retries=0;const resolve=()=>icons.resolve(app).then(value=>{if(!icon.isConnected)return;paint(value);if(value.retry&&retries++<6)setTimeout(()=>{if(icon.isConnected)resolve();},value.retry+1000);});if(tiny||!('IntersectionObserver' in window))resolve();else{const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();resolve();}},{rootMargin:'120px'});observer.observe(icon);}});
    return icon;
  }
  async function refreshAppIcon(app,forceAI=false){app.iconMode='auto';save();toast(forceAI?'正在生成备用图标…':'正在重新获取图标…');const value=await icons.resolve(app,{forceAI,refresh:true});document.querySelectorAll(`[data-app-id="${CSS.escape(app.id)}"]`).forEach(node=>iconPainters.get(node)?.(value));document.querySelectorAll('.desktop-canvas>[data-kind],.folder-app').forEach(node=>{const item=itemById(node.dataset.kind||'app',node.dataset.id);if(item)tileSignatures.set(node,tileSignature({kind:node.dataset.kind||'app',data:item}));});toast(value.source==='ai'?'AI 备用图标已生成':forceAI?'AI 暂不可用，已使用本地备用图标':'图标已更新');}
  function closeDeleteConfirmation(){if(!deleteConfirmation)return;const anchor=deleteConfirmation.anchor;$('#deletePopover').hidden=true;deleteConfirmation=null;if(anchor?.isConnected)(anchor.matches('a,button')?anchor:anchor.querySelector('a,button'))?.focus({preventScroll:true});}
  function showDeleteConfirmation(title,description,anchor,action,item=null){
    closeDeleteConfirmation();const popover=$('#deletePopover'),container=$('#editorDialog').open?$('#editorDialog'):document.body;container.append(popover);popover.replaceChildren();const head=el('div','delete-popover-head');if(item?.url)head.append(appIcon(item,true));const heading=el('strong','',title);heading.id='deleteTitle';head.append(heading);const detail=el('p','',description);detail.id='deleteDescription';const actions=el('div','delete-popover-actions'),cancel=el('button','button-secondary','取消'),remove=el('button','button-danger','确认删除');cancel.type=remove.type='button';cancel.addEventListener('click',closeDeleteConfirmation);remove.addEventListener('click',()=>{closeDeleteConfirmation();action();});actions.append(cancel,remove);popover.append(head,detail,actions);popover.hidden=false;
    const rect=anchor?.getBoundingClientRect()||{left:innerWidth/2,right:innerWidth/2,top:innerHeight/2,bottom:innerHeight/2,width:0,height:0},width=Math.min(292,innerWidth-24);popover.style.width=`${width}px`;const height=popover.offsetHeight;
    const beside=innerWidth-rect.right>width+20||rect.left>width+20;const left=beside?(innerWidth-rect.right>width+20?rect.right+12:rect.left-width-12):Math.max(12,Math.min(rect.left+rect.width/2-width/2,innerWidth-width-12)),top=beside?rect.top+rect.height/2-height/2:rect.bottom+height+20<innerHeight?rect.bottom+12:rect.top-height-12;
    Object.assign(popover.style,{width:`${width}px`,left:`${Math.max(12,Math.min(left,innerWidth-width-12))}px`,top:`${Math.max(12,Math.min(top,innerHeight-height-12))}px`});deleteConfirmation={anchor};cancel.focus({preventScroll:true});
  }
  function confirmItemDelete(type,id,anchor=null){const item=itemById(type,id);if(!item||item.system)return;anchor||=[...document.querySelectorAll(`#folderGrid>[data-id="${CSS.escape(id)}"],#dock>[data-id="${CSS.escape(id)}"],.desktop-canvas>[data-id="${CSS.escape(id)}"],.folder-tile [data-id="${CSS.escape(id)}"]`)].find(node=>{const rect=node.getBoundingClientRect();return rect.width>0&&rect.height>0&&rect.left>=0&&rect.right<=innerWidth&&rect.top>=0&&rect.bottom<=innerHeight&&getComputedStyle(node).visibility!=='hidden';})||$('#editorDelete');showDeleteConfirmation(`删除“${item.name||item.title||widgetLabel(item.type)}”？`,'确认后会从当前桌面移除。',anchor,()=>{if(type==='app'){state.apps=state.apps.filter(app=>app.id!==id);state.dock=state.dock.filter(value=>value!==id);state.history=state.history.filter(value=>value!==id);state.favoriteIds=state.favoriteIds.filter(value=>value!==id);removeFromFolders(id);folderAppNodes.delete(id);}else state.widgets=state.widgets.filter(widget=>widget.id!==id);for(const mode of ['desktop','tablet','mobile'])delete state.layout[mode][id];if(editorContext?.id===id)closeEditor();refreshDesktop();toast('已删除');},type==='app'?item:null);}
  function openApp(app,origin) {
    if (!app) return;
    if(app.system==='settings'){openSettings(origin);return;}
    rememberApp(app.id);
    window.open(app.url, '_blank', 'noopener,noreferrer');
  }
  function rememberApp(id){
    state.history=[id,...state.history.filter(value=>value!==id)].slice(0,12);save();
    document.querySelectorAll('.desktop-canvas>[data-type="recent"]').forEach(node=>{const root=$('.widget-content',node);root.replaceChildren();renderLinkList(root,state.history.slice(0,3),'recent');tileSignatures.set(node,tileSignature({kind:'widget',data:itemById('widget',node.dataset.id)}));});
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
    if(type==='widget')action('查看详情','↗',()=>openWidgetDetails(id));
    if(type==='app')action(item.system?'打开设置':'打开网站','↗',()=>openApp(item));
    action(type==='app'?'编辑快捷方式':type==='folder'?'编辑文件夹':'编辑 Widget','✎',()=>openEditor(type,id));
    if(type==='app'&&!item.system)action('复制链接','⧉',async()=>{
      try { await navigator.clipboard.writeText(item.url);toast('链接已复制'); }
      catch { toast('复制失败，请检查浏览器权限'); }
    });
    const inDock=state.dock.includes(id);
    if(type==='app')action(inDock?'从 Dock 移除':'加入 Dock',inDock?'−':'+',()=>{
      if(inDock)unpinApp(id);
      else if(state.dock.length>=12)return toast('Dock 最多放 12 个 App');
      else state.dock.push(id);
      refreshDesktop();toast(inDock?'已放回当前桌面':'已加入 Dock');
    });
    if(type==='app'&&!item.system){
      action('重新获取图标','↻',()=>refreshAppIcon(item));
      action('生成 AI 备用图标','✧',()=>refreshAppIcon(item,true));
      action(state.favoriteIds.includes(id)?'取消收藏':'加入收藏','♡',()=>{state.favoriteIds=state.favoriteIds.includes(id)?state.favoriteIds.filter(value=>value!==id):[...state.favoriteIds,id];save();updateWidgetCards('favorites');if(itemById('widget',widgetId)?.type==='favorites')renderWidgetDetails();});
      action('多选 / 批量整理','☑',()=>openOrganizer('bulk',id));
      const folder=folderOfApp(id);
      if(folder)action('移出文件夹','↗',()=>{removeFromFolders(id);refreshDesktop();});
      const choices=el('div','context-folder-choices');
      state.folders.filter(entry=>entry.id!==folder?.id).forEach(entry=>{
        const button=el('button','context-action',`▦  移入 ${entry.name}`);button.type='button';button.addEventListener('click',()=>{closeAppContext();unpinApp(id,entry.page);removeFromFolders(id);entry.appIds.push(id);item.page=entry.page;refreshDesktop();});choices.append(button);
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
      button.disabled=item.page===page.id&&!inDock;
      button.addEventListener('click',()=>{closeAppContext();item.page=page.id;
        if(type==='app'){unpinApp(id,page.id);removeFromFolders(id);}
        if(type==='folder')item.appIds.forEach(appId=>appById(appId).page=page.id);
        for(const mode of ['desktop','tablet','mobile'])delete state.layout[mode][id];
        refreshDesktop();toast(`已移动到${page.name}`);
      });pageChoices.append(button);
    });group.append(pageChoices);menu.append(group);
    if(type!=='folder'&&!item.system)action(type==='app'?'删除快捷方式':'删除 Widget','×',()=>confirmItemDelete(type,id),true);
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
    if(state.wallpaper==='bing'){wall.title=state.bingWallpaper?.copyright||'Bing 每日一图';loadBingWallpaper();if(bingDisplayURL){wall.dataset.wallpaper='bing';wall.style.backgroundImage=`url(${JSON.stringify(bingDisplayURL)})`;}return;}
    wall.dataset.wallpaper = state.wallpaper;
    const url=state.wallpaper==='custom'?state.customWallpaper:state.wallpaper==='bing'?state.bingWallpaper?.url:'';
    wall.style.backgroundImage=url?`url(${JSON.stringify(url)})`:'';
    wall.title=state.wallpaper==='bing'?(state.bingWallpaper?.copyright||'Bing 每日一图'):'';
    if(state.wallpaper==='bing')loadBingWallpaper();
  }
  function localDay() { return new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
  async function loadBingWallpaper(force=false) {
    const day=localDay();if(bingLoading||state.wallpaper!=='bing'||(!force&&bingLoadedKey===`${state.bingWallpaper?.url}:${day}`))return;
    bingLoading=true;
    try{
      const {value,src}=await loadDailyBing({cached:state.bingWallpaper,day,force});
      if(state.wallpaper==='bing'){state.bingWallpaper=value;bingLoadedKey=value.date===day?`${value.url}:${day}`:'';bingDisplayURL=src;save();$('#wallpaper').dataset.wallpaper='bing';$('#wallpaper').style.backgroundImage=`url(${JSON.stringify(src)})`;$('#wallpaper').title=value.copyright;if($('#settingsDialog').open&&settingsTab==='appearance')renderSettings();}
    }catch{if(!bingDisplayURL&&bingImageID(state.bingWallpaper?.url)){const image=new Image();image.onload=()=>{if(state.wallpaper==='bing'){bingDisplayURL=bingProxyURL(state.bingWallpaper.url,location.origin);$('#wallpaper').style.backgroundImage=`url(${JSON.stringify(bingDisplayURL)})`;$('#wallpaper').dataset.wallpaper='bing';}};image.src=bingProxyURL(state.bingWallpaper.url,location.origin);}toast('每日壁纸暂不可用，保留上一张壁纸');}
    finally{bingLoading=false;}
  }
  function updateClock() {
    const date = new Date();
    const time = new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
    const longDate = new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(date);
    const clock = $('#clockText'); if (clock) clock.textContent = time;
    const dateText = $('#clockDate'); if (dateText) dateText.textContent = longDate;
    $('#topDate').textContent = new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'short'}).format(date);
    const detailTime=$('.detail-local-time');if(detailTime)detailTime.textContent=time;
    document.querySelectorAll('.world-clock[data-zone]').forEach(node=>$('strong',node).textContent=new Intl.DateTimeFormat('zh-CN',{timeZone:node.dataset.zone,hour:'2-digit',minute:'2-digit'}).format(date));
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
    const {row,gap}=gridMetric(mode), heading=12;
    return Math.max(3,Math.floor((viewport.clientHeight-heading+gap-4)/(row+gap)));
  }
  function tileSize(item, mode) {
    return desktopTileSize(item,mode,{columns:gridColumns(mode),rows:rowsPerPage});
  }
  function pageItems(pageId, mode, maxRows=rowsPerPage) {
    const widgets = state.widgets.filter(item => item.page === pageId).map(data => ({ kind: 'widget', data, id: data.id }));
    const folders=state.folders.filter(item=>item.page===pageId).map(data=>({kind:'folder',data,id:data.id}));
    const apps = state.apps.filter(item => item.page === pageId && !state.dock.includes(item.id) && !folderOfApp(item.id)).map(data => ({ kind: 'app', data, id: data.id }));
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
    return resolveTilePositions(pageItems(pageId,mode,maxRows),state.layout[mode],pageId,mode,{columns:gridColumns(mode),rows:maxRows});
  }
  function appendDesktopView(page,segment,screenIndex,total,items,positions,mode,temporary=false) {
    viewPages.push({pageId:page.id,name:page.name,segment,screenIndex,total,temporary});
    const section=el('section',`desktop-page${temporary?' draft-page':''}`);section.dataset.page=page.id;section.dataset.segment=String(segment);
    section.setAttribute('aria-label',total>1?`${page.name}，第 ${screenIndex+1} 屏`:page.name);
    const inner=el('div','page-inner');
    if(temporary)inner.append(el('div','draft-page-hint','松手放到新桌面'));
    const canvas=el('div','desktop-canvas');canvas.dataset.page=page.id;canvas.dataset.segment=String(segment);canvas.dataset.mode=mode;
    items.forEach(item=>{
      const node=item.kind==='app'?renderApp(item.data):item.kind==='folder'?renderFolderTile(item.data):renderWidget(item.data),pos=positions.get(item.id);
      node.style.gridColumn=`${pos.x+1} / span ${pos.w}`;
      node.style.gridRow=`${pos.y%rowsPerPage+1} / span ${pos.h}`;
      node.dataset.kind=item.kind;node.dataset.page=page.id;canvas.append(node);
    });
    inner.append(canvas);section.append(inner);$('#pageTrack').append(section);return section;
  }
  function appendDraftPage(drag) {
    if(drag.draftPage)return viewPages.findIndex(view=>view.pageId===drag.draftPage.id);
    const page={id:crypto.randomUUID(),name:`桌面 ${state.pages.length+1}`,eyebrow:'YOUR SPACE',title:''};
    drag.draftPage=page;
    appendDesktopView(page,0,0,1,[],new Map(),layoutMode(),true);renderDots();return viewPages.length-1;
  }
  function discardDraftPage(drag) {
    if(!drag.draftPage)return;
    const index=viewPages.findIndex(view=>view.pageId===drag.draftPage.id);
    if(index>=0){$('#pageTrack').children[index]?.remove();viewPages.splice(index,1);if(currentPage>=index)currentPage=Math.max(0,currentPage-1);renderDots();setPage(currentPage);}
    drag.draftPage=null;
  }
  function tileSignature(item) {
    const {page,...data}=item.data;
    if(item.kind==='folder'){
      const {sizes,...folder}=data,size=tileSize(item,layoutMode());
      const {appIds,...frame}=folder;return JSON.stringify([frame,size.w===1&&size.h===1]);
    }
    const dependencies=item.kind!=='widget'?null:item.data.type==='todo'?state.todos:item.data.type==='weather'?[state.city,weather]:item.data.type==='watching'?state.watching:['recent','favorites','quick'].includes(item.data.type)?[item.data.type==='recent'?state.history:item.data.type==='favorites'?state.favoriteIds:null,state.apps.map(({page,...app})=>app)]:null;
    return JSON.stringify([data,dependencies]);
  }
  function renderPages() {
    closeAppContext();
    const track = $('#pageTrack'), previous=viewPages[currentPage],oldViews=JSON.stringify(viewPages);
    const sections=new Map([...track.children].map(node=>[`${node.dataset.page}:${node.dataset.segment}`,node]));
    const tiles=new Map([...track.querySelectorAll('.desktop-canvas>[data-kind]')].map(node=>[`${node.dataset.kind}:${node.dataset.id}`,node]));
    const retained=new Set(),retainedSections=new Set();
    const mode = layoutMode(); rowsPerPage=availableRows(mode); viewPages=[];
    state.pages.forEach(page => {
      const positions=layoutPage(page.id,mode,rowsPerPage), items=pageItems(page.id,mode,rowsPerPage);
      const segments=[...new Set([...positions.values()].map(pos=>Math.floor(pos.y/rowsPerPage)))].sort((a,b)=>a-b);
      if(!segments.length)segments.push(0);
      segments.forEach((segment,screenIndex)=>{
        const pageItemsInSegment=items.filter(item=>Math.floor(positions.get(item.id).y/rowsPerPage)===segment);
        const key=`${page.id}:${segment}`;
        let section=sections.get(key);
        if(!section)section=appendDesktopView(page,segment,screenIndex,segments.length,[],positions,mode);
        else viewPages.push({pageId:page.id,name:page.name,segment,screenIndex,total:segments.length,temporary:false});
        retainedSections.add(section);section.classList.remove('draft-page');
        section.setAttribute('aria-label',segments.length>1?`${page.name}，第 ${screenIndex+1} 屏`:page.name);
        $('.draft-page-hint',section)?.remove();
        const canvas=$('.desktop-canvas',section);canvas.dataset.mode=mode;
        pageItemsInSegment.forEach((item,index)=>{
          const signature=tileSignature(item),pos=positions.get(item.id);let node=tiles.get(`${item.kind}:${item.id}`);
          if(!node||tileSignatures.get(node)!==signature){
            if(node){folderResizeObserver.unobserve(node);node.remove();}
            node=item.kind==='app'?renderApp(item.data):item.kind==='folder'?renderFolderTile(item.data):renderWidget(item.data);
            tileSignatures.set(node,signature);
          }
          node.dataset.kind=item.kind;node.dataset.page=page.id;
          node.style.gridColumn=`${pos.x+1} / span ${pos.w}`;node.style.gridRow=`${pos.y%rowsPerPage+1} / span ${pos.h}`;
          if(canvas.children[index]!==node)canvas.insertBefore(node,canvas.children[index]||null);
          retained.add(node);
          if(item.kind==='folder')requestAnimationFrame(()=>fitFolderTile(node));
        });
        const index=viewPages.length-1;if(track.children[index]!==section)track.insertBefore(section,track.children[index]||null);
      });
    });
    for(const node of tiles.values())if(!retained.has(node)){folderResizeObserver.unobserve(node);node.remove();}
    for(const section of sections.values())if(!retainedSections.has(section))section.remove();
    if(previous){const match=viewPages.findIndex(view=>view.pageId===previous.pageId&&view.segment===previous.segment);currentPage=match>=0?match:Math.min(currentPage,viewPages.length-1);}
    if(oldViews!==JSON.stringify(viewPages))renderDots();updateClock();setPage(currentPage,false);
    $('#desktopShell').classList.toggle('editing',editing);
    syncSurfaceOrigins();
  }
  function renderDots() {
    const dots = $('#pageDots'); dots.replaceChildren();
    viewPages.forEach((view,index) => { const button = el('button'); button.type = 'button'; button.title = view.total>1?`${view.name} ${view.screenIndex+1}/${view.total}`:view.name; button.setAttribute('aria-label',`切换到${button.title}`); button.addEventListener('click',() => setPage(index)); dots.append(button); });
  }
  function setPage(index, animate = true) {
    currentPage = Math.max(0,Math.min(viewPages.length-1,index));closeAppContext();
    const track = $('#pageTrack');
    const view=viewPages[currentPage];
    if (!animate) { track.classList.add('dragging'); requestAnimationFrame(() => track.classList.remove('dragging')); }
    track.style.transform = `translate3d(${-currentPage*100}%,0,0)`;
    [...$('#pageDots').children].forEach((dot,i) => { dot.classList.toggle('active',i===currentPage); dot.setAttribute('aria-current',String(i===currentPage)); });
  }
  function renderApp(app, preview=false) {
    const wrap = el('div','app-shortcut'); wrap.dataset.id = app.id;
    const link = el('a'); link.href = app.url||'#'; if(!app.system)link.target = '_blank'; link.rel = 'noopener noreferrer'; link.setAttribute('aria-label',`打开 ${app.name}`);
    link.draggable = false;link.title=app.name;
    link.append(appIcon(app,false,preview),el('span','app-name',app.name));
    if(preview){wrap.append(link);return wrap;}
    link.addEventListener('click',event => {
      if(Date.now()<suppressClickUntil){event.preventDefault();return;}
      if(editing){event.preventDefault();openEditor('app',app.id);return;}
      if(app.system){event.preventDefault();openApp(app,$('.app-icon',wrap));return;}
      rememberApp(app.id);
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
    card.tabIndex=0;card.setAttribute('aria-label',`${widget.title||widgetLabel(widget.type)}，单击查看详情`);
    card.addEventListener('click',event=>{if(event.defaultPrevented||Date.now()<suppressClickUntil||event.target.closest('button,a,input,label,select,textarea,.player-progress'))return;if(editing)openEditor('widget',widget.id);else openWidgetDetails(widget.id,card);});
    card.addEventListener('keydown',event=>{if(event.target===card&&['Enter',' '].includes(event.key)){event.preventDefault();openWidgetDetails(widget.id,card);}});
    card.addEventListener('contextmenu',event=>{event.preventDefault();event.stopPropagation();openItemContext('widget',widget.id,event.clientX,event.clientY);});
    attachDrag(card,'widget',widget.id); return card;
  }
  function renderFolderTile(folder, preview=false) {
    const size=tileSize({kind:'folder',data:folder},layoutMode()),compact=size.w===1&&size.h===1;
    const tile=el('article',`folder-tile${compact?' compact':''}${sizingFolderId===folder.id?' folder-sizing':''}`);tile.dataset.id=folder.id;tile.dataset.kind='folder';
    if(preview)tile.dataset.preview='true';
    if(!preview){tile.tabIndex=0;tile.setAttribute('aria-label',`文件夹 ${folder.name}，单击空白处打开`);tile.addEventListener('click',event=>{if(event.defaultPrevented||Date.now()<suppressClickUntil||event.target.closest('button,a,input,.folder-app'))return;openFolder(folder.id,tile);});tile.addEventListener('keydown',event=>{if(event.target===tile&&['Enter',' '].includes(event.key)){event.preventDefault();openFolder(folder.id,tile);}});}
    const head=el('button','folder-tile-head');head.type='button';head.append(el('strong','',folder.name),el('span','',`${folder.appIds.length}  ↗`));head.addEventListener('click',()=>{if(Date.now()<suppressClickUntil)return;openFolder(folder.id,tile);});tile.append(head);
    const grid=el('div','folder-tile-grid');
    if(compact){const open=el('button','folder-mini-open');open.type='button';open.setAttribute('aria-label',`打开 ${folder.name}`);open.append(grid);open.addEventListener('click',()=>{if(Date.now()<suppressClickUntil)return;openFolder(folder.id,tile);});tile.append(open,el('span','app-name',folder.name));}
    else tile.append(grid);
    const handle=el('button','folder-resize-handle','⌟');handle.type='button';handle.title='拖动调整文件夹大小';handle.setAttribute('aria-label','调整文件夹大小');handle.addEventListener('pointerdown',event=>startFolderResize(event,tile,folderById(folder.id)));tile.append(handle);
    const edge=el('button','folder-resize-edge');edge.type='button';edge.title='拖动调整宽度';edge.setAttribute('aria-label','调整文件夹宽度');edge.addEventListener('pointerdown',event=>startFolderResize(event,tile,folderById(folder.id),'width'));tile.append(edge);
    tile.addEventListener('contextmenu',event=>{event.preventDefault();event.stopPropagation();openItemContext('folder',folder.id,event.clientX,event.clientY);});attachDrag(tile,'folder',folder.id);
    requestAnimationFrame(()=>{if(tile.isConnected){fitFolderTile(tile);folderResizeObserver.observe(tile);}});return tile;
  }
  function fitFolderTile(tile) {
    const folder=folderById(tile.dataset.id);if(!folder||!tile.isConnected)return;
    const compact=tile.classList.contains('compact'),metrics=folderMetrics(tile.clientWidth,tile.clientHeight,compact);
    const signature=JSON.stringify([metrics,folder.appIds,folder.appIds.map(appById)]);if(tile.dataset.fit===signature)return;tile.dataset.fit=signature;$('.folder-tile-head span',tile).textContent=`${folder.appIds.length}  ↗`;
    const grid=$('.folder-tile-grid',tile),existing=new Map([...grid.querySelectorAll('.folder-app[data-id]')].map(node=>[node.dataset.id,node])),mini=new Map([...grid.querySelectorAll(':scope>.tiny-app-icon')].map(node=>[node.dataset.appId,node])),next=[];
    tile.style.setProperty('--folder-cols',metrics.columns);tile.style.setProperty('--folder-rows',metrics.rows);tile.style.setProperty('--folder-icon',`${metrics.icon}px`);tile.classList.toggle('folder-no-labels',!compact&&!metrics.labels);
    const overflow=!compact&&folder.appIds.length>metrics.capacity,visible=overflow?metrics.capacity-1:metrics.capacity;
    folder.appIds.slice(0,visible).forEach(id=>{const app=appById(id);if(!app)return;
      if(compact){let node=mini.get(id);const signature=JSON.stringify(app);if(!node||node.dataset.visualSignature!==signature){node=appIcon(app,true,tile.dataset.preview==='true');node.dataset.visualSignature=signature;}next.push(node);}else{const signature=tileSignature({kind:'app',data:app});let node=existing.get(id);if(!node||tileSignatures.get(node)!==signature){node=renderApp(app,tile.dataset.preview==='true');tileSignatures.set(node,signature);}node.classList.add('folder-app');node.dataset.folder=folder.id;next.push(node);}
    });
    if(overflow){const moreSignature=JSON.stringify([folder.appIds.slice(visible),folder.name]);let more=$('.folder-more',grid);
      if(!more||more.dataset.members!==moreSignature){more=el('button','folder-more');more.dataset.members=moreSignature;more.type='button';more.setAttribute('aria-label',`打开 ${folder.name}，还有 ${folder.appIds.length-visible} 个 App`);
        const stack=el('span','folder-more-stack');folder.appIds.slice(visible,visible+4).forEach(id=>stack.append(appIcon(appById(id),true,tile.dataset.preview==='true')));
        more.append(stack,el('span','app-name',`+${folder.appIds.length-visible}`));more.addEventListener('click',event=>{event.stopPropagation();if(Date.now()>=suppressClickUntil)openFolder(folder.id,tile);});}
      next.push(more);
    }
    if(!folder.appIds.length)next.push(el('span','folder-empty','拖入 App'));
    const retained=new Set(next);for(const node of [...grid.children])if(!retained.has(node))node.remove();next.forEach((node,index)=>{if(grid.children[index]!==node)grid.insertBefore(node,grid.children[index]||null);});
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
    if(ids.length<2){openEditor('folder',null,ids);return null;}
    const folder={id:crypto.randomUUID(),name:suggestGroups(ids.map(appById))[0]?.name||'文件夹',page,appIds:[...ids],sizes:{}};
    ids.forEach(id=>{unpinApp(id,page);removeFromFolders(id);appById(id).page=page;});state.folders.push(folder);
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
    closeAppContext();folderId=id;folderPage=0;$('#folderName').hidden=true;$('#folderTitle').hidden=false;renderFolderContents();
    openSurface('folder',origin||document.querySelector(`.desktop-canvas>.folder-tile[data-id="${CSS.escape(id)}"]`));
  }
  function closeFolder(forDrag=false) {finishFolderRename();cancelFolderSwipe();closeSurface('folder',()=>{folderId=null;},forDrag);}
  function startFolderRename(){const folder=folderById(folderId);if(!folder)return;const input=$('#folderName');input.value=folder.name;$('#folderTitle').hidden=true;input.hidden=false;input.focus();input.select();}
  function finishFolderRename(cancel=false){const input=$('#folderName'),folder=folderById(folderId);if(input.hidden)return;input.hidden=true;$('#folderTitle').hidden=false;if(folder&&!cancel){const name=input.value.trim().slice(0,32);if(name&&name!==folder.name){folder.name=name;refreshDesktop();}}if(folder){input.value=folder.name;$('#folderTitle').textContent=folder.name;}}
  function renderFolderContents() {
    const folder=folderById(folderId);if(!folder)return;
    $('#folderTitle').textContent=folder.name;if($('#folderName').hidden)$('#folderName').value=folder.name;$('#folderDialog').dataset.id=folder.id;
    const target=surfaceTarget('folder'),columns=target.width<=520?3:4,rows=Math.max(1,Math.min(3,Math.floor((target.height-220)/110))),count=columns*rows,total=Math.max(1,Math.ceil(folder.appIds.length/count)),track=$('#folderTrack');folderPage=Math.min(folderPage,total-1);
    while(track.children.length>total)track.lastElementChild.remove();while(track.children.length<total)track.append(el('div','folder-app-grid'));
    [...track.children].forEach((grid,index)=>{grid.style.gridTemplateColumns=`repeat(${columns},minmax(0,1fr))`;grid.style.gridTemplateRows=`repeat(${rows},minmax(0,1fr))`;const next=[];folder.appIds.slice(index*count,(index+1)*count).forEach(id=>{
      const app=appById(id);if(!app)return;const {page,...visual}=app,signature=JSON.stringify(visual);let cached=folderAppNodes.get(id);if(!cached||cached.signature!==signature){cached={signature,node:renderApp(app)};folderAppNodes.set(id,cached);}const node=cached.node;node.classList.add('folder-app');node.dataset.folder=folder.id;next.push(node);
    });for(const node of [...grid.children])if(!next.includes(node))node.remove();next.forEach((node,index)=>{if(grid.children[index]!==node)grid.insertBefore(node,grid.children[index]||null);});});for(const id of folderAppNodes.keys())if(!appById(id))folderAppNodes.delete(id);
    const pages=$('#folderPagination');if(Number(pages.dataset.count)!==total){pages.replaceChildren();pages.dataset.count=total;for(let index=0;index<total;index++){const button=el('button');button.type='button';button.setAttribute('aria-label',`文件夹第 ${index+1} 页`);button.addEventListener('click',()=>setFolderPage(index));pages.append(button);}}
    setFolderPage(folderPage,false);
  }
  function setFolderPage(index,animate=true){const track=$('#folderTrack'),grids=[...track.children];folderPage=Math.max(0,Math.min(grids.length-1,index));track.classList.toggle('folder-track-dragging',!animate);track.style.transform=`translate3d(${-folderPage*100}%,0,0)`;grids.forEach((grid,i)=>{grid.id=i===folderPage?'folderGrid':'';grid.inert=i!==folderPage;grid.setAttribute('aria-hidden',String(i!==folderPage));});[...$('#folderPagination').children].forEach((button,i)=>{button.classList.toggle('active',i===folderPage);button.setAttribute('aria-current',String(i===folderPage));});if(!animate)requestAnimationFrame(()=>{if(!folderSwipe?.active)track.classList.remove('folder-track-dragging');});}
  function cancelFolderSwipe(){if(folderSwipe){try{$('#folderViewport').releasePointerCapture(folderSwipe.id);}catch{}folderSwipe=null;setFolderPage(folderPage);}}
  function widgetLabel(type) { return ({clock:'此刻',weather:'今日天气',calendar:'本月日历',quote:'每日一句',todo:'今日计划',progress:'学习进度',recent:'最近访问',favorites:'收藏网站',watching:'继续观看',player:'迷你播放器',note:'便签',link:'快捷链接',quick:'快捷工具'})[type]||'Widget'; }
  function widgetSymbol(type) { return ({clock:'◷',weather:'☀',calendar:'▦',quote:'✿',todo:'✓',progress:'↗',recent:'↗',favorites:'♡',watching:'▶',player:'♫',note:'✎',link:'↗',quick:'⌘'})[type]||'✦'; }
  function openWidgetDetails(id,origin=null){
    const widget=itemById('widget',id);if(!widget)return;
    closeAppContext();widgetId=id;widgetMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);renderWidgetDetails();
    openSurface('widget',origin||document.querySelector(`.desktop-canvas>.widget-card[data-id="${CSS.escape(id)}"]`));
  }
  function closeWidgetDetails(){closeSurface('widget',()=>{widgetId=null;});}
  function detailButton(label,handler,className='button-secondary'){const button=el('button',className,label);button.type='button';button.addEventListener('click',handler);return button;}
  function updateTodoSummary(){document.querySelectorAll('.widget-todo-count').forEach(node=>node.textContent=`${state.todos.filter(todo=>todo.done).length} / ${state.todos.length} 已完成`);}
  function updateWidgetCards(type){
    document.querySelectorAll(`.desktop-canvas>.widget-card[data-type="${type}"]`).forEach(node=>{const widget=itemById('widget',node.dataset.id),root=$('.widget-content',node);root.replaceChildren();if(type==='todo')renderTodos(root);if(type==='progress')renderProgress(root,widget);if(type==='watching')renderWatching(root);if(type==='favorites')renderLinkList(root,state.favoriteIds.slice(0,3),'favorite');if(type==='quote')renderQuote(root);if(type==='note')root.append(el('p','note-content',widget.content));tileSignatures.set(node,tileSignature({kind:'widget',data:widget}));});
  }
  function detailAppList(root,ids){
    const grid=el('div','widget-detail-app-grid');ids.map(appById).filter(Boolean).forEach(app=>grid.append(renderApp(app)));root.append(grid);
    if(!grid.children.length)root.append(el('p','widget-empty','这里还没有 App。可在快捷方式右键菜单中加入收藏。'));
  }
  function renderWidgetDetails(){
    const widget=itemById('widget',widgetId);if(!widget){closeWidgetDetails();return;}
    const root=$('#widgetDetails'),scroll=root.scrollTop;root.replaceChildren();root.dataset.type=widget.type;
    $('#widgetTitle').textContent=widget.title||widgetLabel(widget.type);$('#widgetDialog').setAttribute('aria-label',`${widget.title||widgetLabel(widget.type)}详情`);
    const hints={clock:'不同城市，此刻的时间',weather:'天气数据来自 Open-Meteo',calendar:'浏览月份 · 今天的计划',todo:'勾选、添加，完成你的今天',progress:'真实计数 · 自动保存',note:'最长支持 4000 字',quote:'换一句，换个好心情',recent:'最近打开的 12 个 App',favorites:'收藏常用网站，一点即达',watching:'继续观看，或加入新内容',player:'Weboss 原创轻音乐',link:'你的快捷链接',quick:'常用开发与设计工具'};
    $('#widgetDetailHint').textContent=hints[widget.type]||'你的生活，在这里继续';
    if(widget.type==='clock'){
      root.append(el('div','detail-local-time',new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})),el('p','detail-clock-date',new Date().toLocaleDateString('zh-CN',{dateStyle:'full'})));
      const grid=el('div','world-clock-grid');for(const [name,zone] of [['北京','Asia/Shanghai'],['东京','Asia/Tokyo'],['伦敦','Europe/London'],['纽约','America/New_York']]){const card=el('div','world-clock');card.dataset.zone=zone;card.append(el('span','',name),el('strong','',new Intl.DateTimeFormat('zh-CN',{timeZone:zone,hour:'2-digit',minute:'2-digit'}).format(new Date())));grid.append(card);}root.append(grid);
    }else if(widget.type==='weather'){
      renderWeather(root);const metrics=el('div','weather-detail-metrics');for(const [label,value] of [['体感',Number.isFinite(weather?.feels)?Math.round(weather.feels)+'°':'—'],['湿度',Number.isFinite(weather?.humidity)?weather.humidity+'%':'—'],['风速',Number.isFinite(weather?.wind)?Math.round(weather.wind)+' km/h':'—']]){const card=el('div');card.append(el('small','',label),el('strong','',value));metrics.append(card);}root.append(metrics,el('h3','detail-section-title','未来七天'));
      const list=el('div','weather-forecast');for(const day of weather?.forecast||[]){const info=weatherInfo(day.code),row=el('div','weather-forecast-row');row.append(el('span','',new Date(day.date+'T12:00:00').toLocaleDateString('zh-CN',{weekday:'short',month:'numeric',day:'numeric'})),el('span','',info.symbol+' '+info.label),el('strong','',`${Math.round(day.min)}° / ${Math.round(day.max)}°`),el('small','',Number.isFinite(day.rain)?`降水 ${day.rain}%`:'—'));list.append(row);}root.append(list);
      if(!list.children.length)root.append(el('p','widget-empty','天气暂不可用，联网后可重新获取。'));root.append(detailButton('刷新天气',loadWeather));
    }else if(widget.type==='calendar'){
      const nav=el('div','detail-calendar-nav');nav.append(detailButton('‹ 上个月',()=>{widgetMonth=new Date(widgetMonth.getFullYear(),widgetMonth.getMonth()-1,1);renderWidgetDetails();}),el('strong','',`${widgetMonth.getFullYear()}年 ${widgetMonth.getMonth()+1}月`),detailButton('下个月 ›',()=>{widgetMonth=new Date(widgetMonth.getFullYear(),widgetMonth.getMonth()+1,1);renderWidgetDetails();}));root.append(nav);
      const week=el('div','calendar-week');'一二三四五六日'.split('').forEach(day=>week.append(el('span','',day)));const grid=el('div','calendar-days detail-calendar-days'),today=new Date();monthGrid(widgetMonth.getFullYear(),widgetMonth.getMonth()).cells.forEach(day=>grid.append(el('span',day===today.getDate()&&widgetMonth.getMonth()===today.getMonth()&&widgetMonth.getFullYear()===today.getFullYear()?'today':'',day===null?'':String(day))));root.append(week,grid,detailButton('回到本月',()=>{widgetMonth=new Date(today.getFullYear(),today.getMonth(),1);renderWidgetDetails();}),el('h3','detail-section-title','今天的计划'));renderTodos(root,Infinity);
    }else if(widget.type==='todo'){
      root.append(el('p','widget-todo-count',''));updateTodoSummary();renderTodos(root,Infinity);if(!state.todos.length)root.append(el('p','widget-empty','从一件小事开始，写下今天的计划。'));
      const form=el('form','widget-inline-form'),input=el('input');input.placeholder='添加今天要做的事…';input.maxLength=80;input.setAttribute('aria-label','新的待办任务');const submit=el('button','button-primary','添加');submit.type='submit';form.append(input,submit);form.addEventListener('submit',event=>{event.preventDefault();const text=input.value.trim();if(!text)return;if(state.todos.length>=500)return toast('最多保存 500 个任务');state.todos.push({id:crypto.randomUUID(),text,done:false});save();updateWidgetCards('todo');renderWidgetDetails();$('#widgetDetails .widget-inline-form input').focus();});root.append(form);
    }else if(widget.type==='progress'){
      const progress=progressSummary(widget.progress);root.append(el('div','detail-progress-number',`${progress.percent}%`));renderProgress(root,widget);
      const form=el('form','detail-progress-form'),value=field('已完成数量',progress.value,'number'),total=field('目标数量',progress.total,'number'),unit=field('计数单位',progress.unit);value.input.min='0';total.input.min='1';value.input.max=total.input.max='100000';value.input.step=total.input.step='any';value.input.required=total.input.required=true;unit.input.maxLength=16;form.append(value.wrap,total.wrap,unit.wrap);const button=el('button','button-primary','保存进度');button.type='submit';form.append(button);form.addEventListener('submit',event=>{event.preventDefault();if(!Number.isFinite(Number(value.input.value))||!Number.isFinite(Number(total.input.value))||Number(total.input.value)<1||Number(value.input.value)<0||Number(value.input.value)>Number(total.input.value))return toast('请输入有效的完成数量和目标');widget.progress=normalizeProgress({value:value.input.value,total:total.input.value,unit:unit.input.value});save();updateWidgetCards('progress');renderWidgetDetails();toast('进度已保存');});root.append(form);
    }else if(widget.type==='quote'){
      renderQuote(root);root.append(detailButton('复制这句话',async()=>{const index=(Math.floor(Date.now()/86400000)+quoteOffset)%quotes.length;try{await navigator.clipboard.writeText(quotes[index]);toast('文案已复制');}catch{toast('请选中文案手动复制');}}),el('h3','detail-section-title','给今天的你'));const list=el('div','quote-collection');quotes.forEach((quote,index)=>list.append(detailButton(quote,()=>{quoteOffset=(index-Math.floor(Date.now()/86400000)%quotes.length+quotes.length)%quotes.length;updateWidgetCards('quote');renderWidgetDetails();},'quote-collection-item')));root.append(list);
    }else if(widget.type==='recent'||widget.type==='favorites'){
      detailAppList(root,widget.type==='recent'?state.history:state.favoriteIds);
    }else if(widget.type==='watching'){
      renderWatching(root,Infinity);const form=el('form','watching-add-form'),title=field('内容名称','','text'),url=field('观看链接','','url');title.input.maxLength=80;title.input.required=url.input.required=true;url.input.placeholder='https://';const button=el('button','button-primary','加入观看列表');button.type='submit';form.append(title.wrap,url.wrap,button);form.addEventListener('submit',event=>{event.preventDefault();const link=validUrl(url.input.value);if(!link)return toast('请输入有效的观看链接');if(state.watching.length>=100)return toast('最多保存 100 条观看内容');state.watching.push({title:title.input.value.trim().slice(0,80),url:link,subtitle:'我的观看列表',tone:'blue',mark:'▶'});save();updateWidgetCards('watching');renderWidgetDetails();});root.append(el('h3','detail-section-title','想看什么？'),form);
    }else if(widget.type==='player'){
      const player=el('div','widget-content detail-player');renderPlayer(player);root.append(player);const list=el('div','widget-playlist');musicTracks.forEach((track,index)=>{const button=detailButton(`${String(index+1).padStart(2,'0')}   ${track.title}`,()=>switchTrack(index-music.track),'widget-playlist-item');button.classList.toggle('active',index===music.track);button.dataset.track=index;list.append(button);});root.append(el('h3','detail-section-title','播放列表'),list);
    }else if(widget.type==='quick'){
      detailAppList(root,['github','vscode','figma','cloudflare','gitlab','mdn','stackoverflow','codepen','vercel','unsplash','compress'].filter(id=>appById(id)));
    }else if(widget.type==='link'){
      root.append(el('p','detail-note',widget.content));const link=el('a','button-primary detail-open-link','打开链接 ↗');link.href=validUrl(widget.content)||'#';link.target='_blank';link.rel='noopener noreferrer';root.append(link);
    }else{
      const content=el('textarea','detail-note-editor');content.value=widget.content||'';content.maxLength=4000;content.setAttribute('aria-label','便签全文');content.placeholder='把你的想法写在这里…';root.append(content,detailButton('保存便签',()=>{widget.content=content.value.slice(0,4000);save();updateWidgetCards('note');toast('便签已保存');},'button-primary'));
    }
    root.scrollTop=scroll;
  }
  function renderWeather(root) {
    const top=el('div','weather-top'); const left=el('div'); left.append(el('div','weather-degree',weather ? `${Math.round(weather.temp)}°` : '--°'),el('div','widget-empty',state.city.name));
    top.append(left,el('div','weather-art',weather?.symbol||'☀️')); root.append(top);
    root.append(el('p','weather-bottom',weather ? `${weather.label} · ${Math.round(weather.min)}° / ${Math.round(weather.max)}°` : weatherRequest?'正在获取实时天气…':'天气暂不可用 · 请稍后刷新'));
  }
  async function loadWeather() {
    weatherRequest?.abort();const controller=new AbortController();weatherRequest=controller;const timer=setTimeout(()=>controller.abort(),6500);
    try {
      const { latitude,longitude }=state.city;
      const url=`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,apparent_temperature,relative_humidity_2m,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&timezone=auto&forecast_days=7&wind_speed_unit=kmh`;
      const response=await fetch(url,{signal:controller.signal});
      if (!response.ok) throw Error('weather');
      const data=await response.json();if(!Number.isFinite(data.current?.temperature_2m))throw Error('weather');if(weatherRequest!==controller)return;
      weather={temp:data.current.temperature_2m,min:data.daily?.temperature_2m_min?.[0]??data.current.temperature_2m,max:data.daily?.temperature_2m_max?.[0]??data.current.temperature_2m,...weatherInfo(data.current.weather_code),feels:data.current.apparent_temperature,humidity:data.current.relative_humidity_2m,wind:data.current.wind_speed_10m,forecast:(Array.isArray(data.daily?.time)?data.daily.time:[]).slice(0,7).map((date,index)=>({date,min:data.daily.temperature_2m_min?.[index],max:data.daily.temperature_2m_max?.[index],code:data.daily.weather_code?.[index],rain:data.daily.precipitation_probability_max?.[index]})).filter(day=>/^\d{4}-\d{2}-\d{2}$/.test(day.date)&&Number.isFinite(day.min)&&Number.isFinite(day.max))};
    } catch {if(weatherRequest!==controller)return;weather=null;}
    finally{clearTimeout(timer);}
    if(weatherRequest!==controller)return;weatherRequest=null;
    document.querySelectorAll('.desktop-canvas>[data-type="weather"]').forEach(node => {const root=$('.widget-content',node);root.replaceChildren();renderWeather(root);if(!weather)$('.weather-bottom',root).textContent='天气暂不可用 · 请稍后刷新';tileSignatures.set(node,tileSignature({kind:'widget',data:itemById('widget',node.dataset.id)}));});
    if(itemById('widget',widgetId)?.type==='weather')renderWidgetDetails();
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
    change.addEventListener('click',()=>{quoteOffset++;updateWidgetCards('quote');if(itemById('widget',widgetId)?.type==='quote')renderWidgetDetails();});root.append(change);
  }
  function renderTodos(root,limit=4) {
    const list=el('div','todo-list');
    state.todos.slice(0,limit).forEach(item=>{
      const label=el('label',`todo-item${item.done?' done':''}`); const check=el('input');check.type='checkbox';check.checked=item.done;
      check.dataset.todo=item.id;
      check.addEventListener('change',()=>{const todo=state.todos.find(todo=>todo.id===item.id);if(todo)todo.done=check.checked;save();document.querySelectorAll('.todo-item input[data-todo]').forEach(input=>{input.checked=!!state.todos.find(todo=>todo.id===input.dataset.todo)?.done;input.closest('.todo-item').classList.toggle('done',input.checked);});document.querySelectorAll('.desktop-canvas>[data-type="todo"]').forEach(node=>tileSignatures.set(node,tileSignature({kind:'widget',data:itemById('widget',node.dataset.id)})));updateTodoSummary();});label.append(check,el('span','',item.text));list.append(label);
    });root.append(list);
  }
  function renderProgress(root,widget) {
    const progress=progressSummary(widget.progress);root.append(el('h3','',widget.content||'每一步，都离目标更近'),el('span','progress-illustration','✎'));
    const bar=el('div','progress-line'),fill=el('i');fill.style.width=`${progress.percent}%`;bar.append(fill);root.append(bar);
    const foot=el('p','progress-foot');foot.append(el('span','',`${progress.value} / ${progress.total} ${progress.unit}`),el('span','',`${progress.percent}%`));root.append(foot);
  }
  function renderLinkList(root,ids,kind) {
    const list=el('div',`${kind}-list`);let count=0;
    ids.forEach(id=>{const app=appById(id);if(!app)return;count++;const link=el('a',`${kind}-link`);link.href=app.url;link.target='_blank';link.rel='noopener noreferrer';link.append(appIcon(app,true),el('span','',app.name));link.addEventListener('click',()=>rememberApp(app.id));list.append(link);});
    root.append(count?list:el('p','widget-empty','打开一个 App，这里会留下足迹。'));
  }
  function renderWatching(root,limit=3) {
    const row=el('div','watching-row');state.watching.slice(0,limit).forEach(item=>{const link=el('a',`watch-card ${['blue','lavender','peach'].includes(item.tone)?item.tone:'blue'}`);link.href=validUrl(item.url)||'#';link.target='_blank';link.rel='noopener noreferrer';link.append(el('b','',item.mark||'▶'));const copy=el('div');copy.append(el('strong','',item.title),el('small','',item.subtitle));link.append(copy);row.append(link);});root.append(row);
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
    const row=el('div','quick-links');['github','vscode','figma','cloudflare'].forEach(id=>{const app=appById(id);if(!app)return;const link=el('a','',app.name+' ↗');link.href=app.url;link.target='_blank';link.rel='noopener noreferrer';link.addEventListener('click',()=>rememberApp(app.id));row.append(link);});root.append(row);
  }
  function renderDock() {
    const signature=JSON.stringify(state.dock.map(id=>{const {page,...app}=appById(id)||{};return app;}));
    if(signature===dockSignature)return;dockSignature=signature;
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
      if (event.button !== 0 || dragState || resizeState || dropSettling || $('#settingsDialog').open || $('#editorDialog').open || surfaces.has('search') || surfaces.has('widget')) return;
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
      if (dragState.touch && (!editing||sourceFolder)) dragState.timer=setTimeout(()=>{
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
    const folderPreview=()=>renderFolderTile({...drag.folder,sizes:{...drag.folder.sizes,[layoutMode()]:{w:target.w,h:target.h}}},true);
    if(!drag.previewNode){drag.previewNode=resizing?folderPreview():drag.node.cloneNode(true);drag.previewNode.removeAttribute('id');drag.previewNode.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));drag.previewNode.classList.remove('is-dragging');drag.previewNode.classList.add('drop-preview');document.body.append(drag.previewNode);}
    else if(resizing&&drag.previewNode.classList.contains('compact')!==compact){const next=folderPreview();drag.previewNode.className=`${next.className} drop-preview`;drag.previewNode.replaceChildren(...next.childNodes);delete drag.previewNode.dataset.fit;}
    Object.assign(drag.previewNode.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`});drag.previewTarget={...target,rect};
    if(resizing)requestAnimationFrame(()=>{if(drag.previewNode)fitFolderTile(drag.previewNode);});
  }
  function insideRect(event,rect,padding=0) { return event.clientX>=rect.left-padding&&event.clientX<=rect.right+padding&&event.clientY>=rect.top-padding&&event.clientY<=rect.bottom+padding; }
  function folderLandingRect(tile,id){const folder=folderById(tile.dataset.id),grid=$('.folder-tile-grid',tile),bounds=grid.getBoundingClientRect(),compact=tile.classList.contains('compact'),metrics=folderMetrics(tile.clientWidth,tile.clientHeight,compact);let index=folder.appIds.indexOf(id);if(index<0)index=folder.appIds.length;index=Math.min(index,metrics.capacity-1);const gap=compact?3:6,cellWidth=(bounds.width-gap*(metrics.columns-1))/metrics.columns,cellHeight=(bounds.height-gap*(metrics.rows-1))/metrics.rows,side=metrics.icon;return {left:bounds.left+(index%metrics.columns)*(cellWidth+gap)+(cellWidth-side)/2,top:bounds.top+Math.floor(index/metrics.columns)*(cellHeight+gap)+(cellHeight-side-(metrics.labels?16:0))/2,width:side,height:side};}
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
    if(folderTarget){clearDragPreview(drag);resetGroupCandidate(drag);folderTarget.classList.add('folder-drop-ready');const rect=folderLandingRect(folderTarget,drag.id);drawDropPreview(drag,rect,{action:'folder-add',folder:folderTarget.dataset.id});drag.previewNode.classList.add('folder-insert-preview');return;}
    const overlaps=(x,y,node)=>{const pos=tilePosition(node),localY=pos.y%rowsPerPage;return x<pos.x+pos.w&&x+w>pos.x&&y<localY+pos.h&&y+h>localY;};
    let x=wantedX,y=wantedY,collisions=nodes.filter(node=>overlaps(x,y,node)),swap=null;
    if(collisions.length===1){const pos=tilePosition(collisions[0]);
      if(drag.sourcePos&&collisions[0].dataset.kind===drag.type&&pos.w===w&&pos.h===h&&pos.x===x&&pos.y%rowsPerPage===y)swap=collisions[0];
    }
    const groupApp=drag.type==='app'&&!item.data.system&&collisions.length===1&&collisions[0].dataset.kind==='app'&&!appById(collisions[0].dataset.id).system?collisions[0]:null;
    if(groupApp){
      if(drag.groupCandidate!==groupApp.dataset.id){resetGroupCandidate(drag);drag.groupCandidate=groupApp.dataset.id;drag.groupTimer=setTimeout(()=>{if(dragState===drag){drag.groupReady=true;updateDragPreview(drag,{clientX:drag.lastX,clientY:drag.lastY});}},520);}
      if(drag.groupReady){clearDragPreview(drag);groupApp.classList.add('folder-group-ready');const icon=$('.app-icon',groupApp).getBoundingClientRect(),side=12;drag.previewTarget={action:'folder-create',with:groupApp.dataset.id,pageId:view.pageId,position:tilePosition(groupApp),rect:{left:icon.left+icon.width/2-side/2,top:icon.top+3,width:side,height:side}};return;}
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
    const settle=()=>{clearDragPreview(drag);discardDraftPage(drag);drag.ghost?.remove();drag.node.classList.remove('is-dragging');$('#desktopShell').classList.remove('drag-active');document.body.classList.remove('drag-active');dropSettling=false;};
    if(canceled||!target||sameSpot){settle();return;}
    dropSettling=true;
    const mode=layoutMode(),item=itemById(drag.type,drag.id);let createdFolder=null,message='位置已保存';
    if(drag.draftPage&&target.pageId===drag.draftPage.id){state.pages.push(drag.draftPage);drag.draftPage=null;message='已移入新桌面';}
    else discardDraftPage(drag);
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
    const intoFolder=target.action==='folder-add'||target.action==='folder-create',duration=intoFolder?320:220;
    let transfer=null;if(intoFolder){const source=$('.app-icon',drag.ghost)||drag.ghost,rect=source.getBoundingClientRect();transfer=source.cloneNode(true);transfer.classList.add('folder-transfer');document.body.append(transfer);Object.assign(transfer.style,geometry(rect,parseFloat(getComputedStyle(source).borderRadius)||18));drag.ghost.style.opacity='0';transfer.animate([geometry(rect,18),{...geometry(target.rect,Math.max(4,target.rect.width*.28)),opacity:.3}],{duration,easing:'cubic-bezier(.22,.75,.2,1)',fill:'forwards'});}else drag.ghost.animate([{left:drag.ghost.style.left,top:drag.ghost.style.top,opacity:1},{left:`${target.rect.left}px`,top:`${target.rect.top}px`,opacity:.45}],{duration,easing:'cubic-bezier(.2,.7,.2,1)',fill:'forwards'});
    setTimeout(()=>{transfer?.remove();settle();renderPages();renderDock();if(folderId)renderFolderContents();if(createdFolder)openFolder(createdFolder.id);if(intoFolder)requestAnimationFrame(()=>{const tile=document.querySelector(`.desktop-canvas>.folder-tile[data-id="${CSS.escape(target.folder||createdFolder.id)}"]`);tile?.animate([{transform:'scale(1)'},{transform:'scale(1.035)',offset:.45},{transform:'scale(1)'}],{duration:260,easing:'ease-out'});const icon=tile?.querySelector(`[data-app-id="${CSS.escape(drag.id)}"]`);icon?.animate([{opacity:.4,transform:'scale(.75)'},{opacity:1,transform:'scale(1)'}],{duration:240,easing:'ease-out'});});toast(message);},duration+10);
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
    const width=Math.min(['settings','organizer'].includes(name)?880:name==='widget'?760:name==='folder'?620:650,innerWidth-24);
    const preferredHeight=name==='organizer'&&innerWidth<=700?innerHeight-24:['settings','organizer','widget'].includes(name)?660:name==='folder'?580:480;
    const height=Math.min(preferredHeight,innerHeight-(name==='search'?innerHeight-$('#searchTrigger').getBoundingClientRect().bottom+24:name==='organizer'&&innerWidth<=700?24:40));
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
      context.seed=el('div',`surface-seed ${name}-seed`);context.seed.setAttribute('aria-hidden','true');
      if(name==='search')context.seed.append(el('span','search-glyph','⌕'),el('span','',state.searchLabel));
      else if(name==='settings'||name==='widget'){const seed=origin.cloneNode(true);seed.removeAttribute('id');seed.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));seed.classList.remove('surface-origin-hidden');context.seed.append(seed);}
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
    setTimeout(()=>{if(surfaces.get(name)===context&&context.status!=='closing')$(name==='search'?'#searchInput':name==='folder'?'#folderTitle':name==='widget'?'#widgetTitle':`#${name}Close`).focus({preventScroll:true});},duration*.6);
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
    if(!query){
      const recent=state.history.map(appById).filter(Boolean).slice(0,6);
      return [...(recent.length?recent:state.dock.map(appById).filter(Boolean).slice(0,4)).map(app=>({type:'app',app,section:recent.length?'最近打开':'常用捷径'})),...state.searchHistory.slice(0,6).map(text=>({type:'history',text,section:'最近搜索'}))];
    }
    const hits=state.apps.filter(app=>`${app.name} ${app.url}`.toLocaleLowerCase().includes(query));
    const history=state.searchHistory.filter(text=>text.toLocaleLowerCase().includes(query)).slice(0,2).map(text=>({type:'history',text}));
    return [...hits.slice(0,7).map(app=>({type:'app',app})),...history,{type:'web',text:$('#searchInput').value.trim()}];
  }
  function renderSearch() {
    const query=$('#searchInput').value.trim();$('#searchResultLabel').textContent=query?'搜索结果':'从上次的地方继续';
    const results=queryResults(),root=$('#searchResults');root.classList.toggle('search-recents',!query);root.replaceChildren();selectedSearch=Math.min(selectedSearch,Math.max(0,results.length-1));
    let section='';
    const heading=label=>{const head=el('div','search-section-heading');head.append(el('span','',label));if(label==='最近打开'||label==='最近搜索'){const clear=el('button','','清空');clear.type='button';clear.setAttribute('aria-label',`清空${label}`);clear.addEventListener('click',()=>{state[label==='最近打开'?'history':'searchHistory']=[];save();selectedSearch=0;renderSearch();});head.append(clear);}root.append(head);};
    if(!query&&!state.history.some(id=>appById(id))){heading('最近打开');root.append(el('p','search-empty','打开过的 App 会显示在这里'));}
    results.forEach((result,index)=>{
      if(!query&&result.section!==section){section=result.section;heading(section);}
      const row=el('button',`search-result${result.type==='history'?' search-history':''}${index===selectedSearch?' selected':''}`);row.type='button';
      if(result.type==='app') {row.append(appIcon(result.app,true));const copy=el('span');copy.append(el('strong','',result.app.name),el('small','',result.app.system?'Weboss 桌面设置':result.app.url.replace(/^https?:\/\//,'')));row.append(copy);}
      else {row.append(el('span','tiny-app-icon',result.type==='history'?'↺':'⌕'));const copy=el('span');copy.append(el('strong','',result.type==='history'?result.text:`用 ${engines.find(e=>e.id===activeEngine).name} 搜索“${result.text}”`),el('small','',result.type==='history'?'搜索历史':'按 Enter 搜索网页'));row.append(copy);}
      if(result.type==='web')$('strong',row).dataset.webSearch='';row.append(el('span','result-arrow','↗'));row.addEventListener('click',()=>runResult(result));root.append(row);
    });
    if(!query&&!state.searchHistory.length){heading('最近搜索');root.append(el('p','search-empty','搜索过的关键词会显示在这里'));}
    const choices=$('#engineChoices');if(!choices.children.length)engines.forEach(engine=>{const button=el('button','engine-choice',engine.name);button.type='button';button.dataset.engine=engine.id;button.addEventListener('click',()=>{activeEngine=engine.id;state.searchEngine=engine.id;save();updateEngineChoices();const web=$('#searchResults [data-web-search]');if(web)web.textContent=`用 ${engine.name} 搜索“${$('#searchInput').value.trim()}”`;});choices.append(button);});updateEngineChoices();
  }
  function updateEngineChoices(){document.querySelectorAll('#engineChoices button').forEach(button=>{const active=button.dataset.engine===activeEngine;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});}
  function runResult(result) {
    if(result.type==='app') {openApp(result.app);searchClose();return;}
    const query=result.text.trim();if(!query)return;
    state.searchHistory=[query,...state.searchHistory.filter(x=>x!==query)].slice(0,12);save();
    const url=validUrl(query.startsWith('http')?query:`https://${query}`);
    const looksLikeDomain=/^(?:[\w-]+\.)+[a-z]{2,}(?:\/\S*)?$/i.test(query);
    window.open(looksLikeDomain&&url?url:engines.find(e=>e.id===activeEngine).url+encodeURIComponent(query),'_blank','noopener,noreferrer');searchClose();
  }
  function organizationSnapshot() {return clone({pages:state.pages,apps:state.apps,widgets:state.widgets,folders:state.folders,layout:state.layout,dock:state.dock,history:state.history,favoriteIds:state.favoriteIds});}
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
    closeAppContext();organizerRequest?.abort();if(folderId)closeFolder();if(widgetId)closeWidgetDetails();if(surfaces.has('settings'))closeSettings();
    organizerMode=mode;organizerFolderId=sourceFolder;organizerPlan=null;organizerBusy=false;selectedApps.clear();if(selectedId)selectedApps.add(selectedId);
    bulkDraft={action:'new',name:'常用 App',page:viewPages[currentPage].pageId,folder:state.folders[0]?.id||''};
    const scope=$('#organizerScope');scope.replaceChildren();[['all','全部桌面'],['current','当前桌面'],...(sourceFolder?[['folder','当前文件夹']]:[])].forEach(([value,label])=>{const option=el('option','',label);option.value=value;scope.append(option);});scope.value=sourceFolder?'folder':'all';
    $('#organizerFilter').value='';$('#organizerExisting').checked=mode==='bulk';$('#organizerGrouping').checked=true;$('#organizerLayout').checked=true;renderOrganizer();openSurface('organizer',$('#organizeButton'));
  }
  function closeOrganizer() {organizerRequest?.abort();organizerRequest=null;organizerBusy=false;closeSurface('organizer');}
  function organizerApps() {
    const query=$('#organizerFilter').value.trim().toLocaleLowerCase(),scope=$('#organizerScope').value;
    return state.apps.filter(app=>!app.system&&(organizerMode!=='ai'||!state.dock.includes(app.id))&&(scope!=='current'||app.page===viewPages[currentPage].pageId)&&(scope!=='folder'||folderById(organizerFolderId)?.appIds.includes(app.id))&&($('#organizerExisting').checked||scope==='folder'||!folderOfApp(app.id))&&`${app.name} ${app.url}`.toLocaleLowerCase().includes(query));
  }
  function organizerButton(label,handler,className='chip-button') {const button=el('button',className,label);button.type='button';button.addEventListener('click',handler);return button;}
  function organizationScope() {
    const scope=$('#organizerScope').value;
    return {pageIds:scope==='all'?state.pages.map(page=>page.id):[scope==='folder'?folderById(organizerFolderId)?.page:viewPages[currentPage]?.pageId].filter(Boolean),...(scope==='folder'?{folderIds:[organizerFolderId]}:{})};
  }
  function organizationLayoutCount() {
    const {pageIds,folderIds}=organizationScope();if(folderIds)return folderById(organizerFolderId)?.appIds.length?1:0;
    return state.widgets.filter(item=>pageIds.includes(item.page)).length+state.folders.filter(item=>pageIds.includes(item.page)).length+state.apps.filter(app=>pageIds.includes(app.page)&&!state.dock.includes(app.id)&&!folderOfApp(app.id)).length;
  }
  function organizationBaseState() {
    const base=clone(state),mode=layoutMode();
    document.querySelectorAll('.desktop-canvas>[data-id]').forEach(node=>{const {x,y}=tilePosition(node);base.layout[mode][node.dataset.id]={page:node.dataset.page,x,y,priority:Number(base.layout[mode][node.dataset.id]?.priority)||1};});return base;
  }
  function organizationProfiles() {
    const profiles={desktop:{columns:12,rows:7,width:1296,row:78,gap:12},tablet:{columns:8,rows:7,width:922,row:76,gap:10},mobile:{columns:4,rows:7,width:364,row:75,gap:9}},mode=layoutMode();
    const canvas=$('.desktop-canvas'),width=canvas?.getBoundingClientRect().width||innerWidth-26;
    profiles[mode]={columns:gridColumns(mode),rows:availableRows(mode),width,...gridMetric(mode)};return profiles;
  }
  function updateOrganizationDraft() {
    if(!organizerPlan)return;
    organizerPlan.result=planDesktopOrganization(organizerPlan.base,organizerPlan.groups,{...organizerPlan.scope,profiles:organizationProfiles(),arrange:$('#organizerLayout').checked});
  }
  function renderOrganizer() {
    if(organizerMode==='ai')for(const id of selectedApps)if(state.dock.includes(id))selectedApps.delete(id);
    $('#organizerDialog').classList.toggle('organizer-review',!!organizerPlan&&organizerMode==='ai');
    $('#organizerBulkTab').classList.toggle('active',organizerMode==='bulk');$('#organizerAITab').classList.toggle('active',organizerMode==='ai');
    $('#organizerPreference').hidden=organizerMode!=='ai'||!$('#organizerGrouping').checked||!!organizerPlan;$('#organizerInstruction').disabled=organizerBusy;
    $('#organizerOptions').hidden=organizerMode!=='ai';$('#organizerGrouping').disabled=$('#organizerLayout').disabled=organizerBusy;
    $('#organizerLayoutHint').textContent=$('#organizerScope').value==='folder'?'调整此文件夹的尺寸与常用 App 顺序，其他桌面元素保留位置。':'布局会整理范围内整个桌面及分组的目标桌面；分组只作用于所选 App。';
    $('#organizerExisting').closest('label').hidden=organizerMode!=='ai'||$('#organizerScope').value==='folder';
    $('#organizerFilter').disabled=organizerBusy;$('#organizerScope').disabled=organizerBusy;$('#organizerExisting').disabled=organizerBusy;
    $('#organizerBulkTab').disabled=$('#organizerAITab').disabled=organizerBusy;
    const content=$('#organizerContent');content.replaceChildren();
    if(organizerPlan&&organizerMode==='ai'){renderOrganizationPreview(content);renderOrganizerFooter();return;}
    if(organizerMode==='ai'&&!$('#organizerGrouping').checked){
      const intro=el('div','organization-layout-intro');intro.append(el('span','','▦'),el('h3','','让桌面留出呼吸感'),el('p','','小组件形成清晰分区，收藏和最近使用的入口优先放在首屏。大文件夹按内容调整尺寸，多余内容横向分屏显示。'),el('small','',`当前范围 ${organizationLayoutCount()} 个桌面元素 · 保留现有文件夹分组`));content.append(intro);renderOrganizerFooter();return;
    }
    const apps=organizerApps(),bar=el('div','organizer-selection-bar');
    bar.append(el('p','',organizerMode==='ai'?'相同用途自动分组，同时规划 App、文件夹和小组件的位置。':'选择 App，一次完成移动、合并或清理。'),organizerButton('全选当前结果',()=>{apps.forEach(app=>selectedApps.add(app.id));renderOrganizer();}),organizerButton('清空选择',()=>{selectedApps.clear();renderOrganizer();}));content.append(bar);
    const grid=el('div','organizer-app-grid');apps.forEach(app=>{
      const label=el('label',`organizer-app${selectedApps.has(app.id)?' selected':''}`),check=el('input');check.type='checkbox';check.checked=selectedApps.has(app.id);check.disabled=organizerBusy;check.setAttribute('aria-label',`选择 ${app.name}`);
      check.addEventListener('change',()=>{if(check.checked)selectedApps.add(app.id);else selectedApps.delete(app.id);label.classList.toggle('selected',check.checked);renderOrganizerFooter();});
      const copy=el('span','organizer-app-copy');copy.append(el('strong','',app.name),el('small','',state.dock.includes(app.id)?'Dock':folderOfApp(app.id)?.name||state.pages.find(page=>page.id===app.page)?.name));label.append(check,appIcon(app,true),copy);grid.append(label);
    });content.append(grid);if(!apps.length)content.append(el('p','organizer-empty','这里没有符合条件的 App，试试其他范围。'));renderOrganizerFooter();
  }
  function renderOrganizerFooter() {
    const footer=$('#organizerFooter');footer.replaceChildren();
    if(organizerMode==='ai'){
      const grouping=$('#organizerGrouping').checked,arrange=$('#organizerLayout').checked;
      const copy=el('div','organizer-footer-copy');copy.append(el('strong','',organizerBusy?'正在理解用途并生成预览…':organizerPlan?organizerPlan.source:grouping?`${selectedApps.size?`已选择 ${selectedApps.size} 个`:`当前范围 ${organizerApps().length} 个`} App`:`${organizationLayoutCount()} 个元素 · 仅整理布局`),el('small','',organizerPlan?arrange?'布局和文件夹一起应用，可撤销；Dock 保持不变。':'可修改文件夹；桌面元素保留现有位置。':grouping?'按用途分组；布局在本机规划，服务不可用时仍可整理。':'为手机、平板和桌面分别规划布局，无需连接 AI 服务。'));footer.append(copy);
      if(organizerPlan){footer.append(organizerButton('重新选择',()=>{organizerPlan=null;renderOrganizer();},'button-secondary'));const apply=organizerButton('应用整理',applyAIOrganization,'button-primary');apply.disabled=!organizerPlan.result?.stats.groups&&!(arrange&&organizerPlan.result?.modes[layoutMode()].screenCount);footer.append(apply);}
      else{const button=organizerButton(organizerBusy?'整理中…':'生成整理预览',generateOrganization,'button-primary');button.disabled=organizerBusy||(!grouping&&!arrange)||((!grouping||(selectedApps.size||organizerApps().length)<2)&&!(arrange&&organizationLayoutCount()));footer.append(button);}return;
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
    if(draft.action==='new'&&ids.length<2)return toast('至少选择两个 App 才能创建文件夹');
    if(draft.action==='dock-add'&&new Set([...state.dock,...ids]).size>12)return toast('Dock 最多 12 个 App，请减少选择');
    if(draft.action==='delete'&&!bulkDraft.confirmed){showDeleteConfirmation(`删除选中的 ${ids.length} 个 App？`,'本次批量整理完成后仍可撤销。',$('#organizerFooter .button-primary'),()=>{bulkDraft.confirmed=true;applyBulkOrganization();});return;}
    delete bulkDraft.confirmed;
    applyOrganization(()=>{
      const previous=new Set(state.folders.filter(folder=>folder.appIds.length).map(folder=>folder.id));
      if(['new','folder','desktop'].includes(draft.action)){
        const target=draft.action==='new'?{id:crypto.randomUUID(),name:draft.name.trim().slice(0,32),page:draft.page,appIds:[],sizes:{}}:draft.action==='folder'?folderById(draft.folder):null;
        if(draft.action==='new')state.folders.push(target);
        apps.forEach(app=>{unpinApp(app.id,target?target.page:draft.page);removeFromFolders(app.id);clearAppLayout(app.id);app.page=target?target.page:draft.page;if(target)target.appIds.push(app.id);});pruneEmptiedFolders(previous);
      }
      if(draft.action==='dock-add')state.dock=[...new Set([...state.dock,...ids])];
      if(draft.action==='dock-remove')ids.forEach(id=>unpinApp(id,draft.page));
      if(draft.action==='delete'){state.apps=state.apps.filter(app=>!ids.includes(app.id));state.dock=state.dock.filter(id=>!ids.includes(id));state.history=state.history.filter(id=>!ids.includes(id));state.favoriteIds=state.favoriteIds.filter(id=>!ids.includes(id));ids.forEach(id=>{removeFromFolders(id);clearAppLayout(id);});pruneEmptiedFolders(previous);}
    },`已整理 ${ids.length} 个 App`);
  }
  async function generateOrganization() {
    const apps=(selectedApps.size?[...selectedApps].map(appById):organizerApps()).filter(app=>app&&!app.system&&!state.dock.includes(app.id));
    if(!$('#organizerGrouping').checked||apps.length<2){
      if(!$('#organizerLayout').checked||!organizationLayoutCount())return toast('请选择至少两个 App，或开启布局整理');
      organizerPlan={groups:[],source:'本地布局规划 · 保留现有分组',base:organizationBaseState(),signature:JSON.stringify(organizationSnapshot()),scope:organizationScope(),previewMode:layoutMode()};renderOrganizer();return;
    }
    organizerRequest?.abort();const controller=new AbortController();organizerRequest=controller;organizerBusy=true;renderOrganizer();const timer=setTimeout(()=>controller.abort(),30000);
    let groups,source='本地智能整理 · 未连接 AI 服务';
    try{
      if(apps.length>120)throw Error('too-many');
      const response=await fetch('/api/organize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({instruction:$('#organizerInstruction').value.trim(),apps:apps.map(app=>({id:app.id,name:app.name,url:new URL(app.url).origin+organizationSignals(app).path,existingFolder:folderOfApp(app.id)?.name||''}))}),signal:controller.signal});
      if(!response.ok)throw Error('unavailable');const data=await response.json();if(!Array.isArray(data.groups))throw Error('invalid');groups=validateGroups(data.groups,apps);source='Workers AI 整理预览';
    }catch{groups=suggestGroups(apps);source=controller.signal.aborted?'本地智能整理 · AI 请求超时':apps.length>120?'本地智能整理 · 当前范围超过 120 个 App':'本地智能整理 · AI 不可用';}
    finally{clearTimeout(timer);}
    if(organizerRequest!==controller)return;organizerRequest=null;organizerBusy=false;
    groups.forEach(group=>{const counts=new Map();group.appIds.forEach(id=>{const page=appById(id).page;counts.set(page,(counts.get(page)||0)+1);});group.page=[...counts].sort((a,b)=>b[1]-a[1])[0][0];group.enabled=true;group.folderId=crypto.randomUUID();});
    organizerPlan={groups,source,base:organizationBaseState(),signature:JSON.stringify(organizationSnapshot()),scope:organizationScope(),previewMode:layoutMode()};renderOrganizer();
  }
  function renderOrganizationPreview(root) {
    updateOrganizationDraft();const preview=el('section','organization-layout-preview');preview.id='organizationLayoutPreview';root.append(preview);renderOrganizationLayout(preview);
    const groups=organizerPlan.groups,used=new Set(groups.filter(group=>group.enabled).flatMap(group=>group.appIds));if(groups.length)root.append(el('p','organizer-preview-summary',`建议 ${groups.length} 个文件夹 · ${used.size} 个 App · 分组修改后布局同步更新`));
    groups.forEach(group=>{
      const card=el('section',`organization-group${group.enabled?'':' disabled'}`),head=el('div','organization-group-head'),check=el('input');check.type='checkbox';check.checked=group.enabled;check.setAttribute('aria-label',`采用 ${group.name} 文件夹`);check.addEventListener('change',()=>{group.enabled=check.checked;card.classList.toggle('disabled',!check.checked);refreshOrganizationLayout();});
      const name=el('input');name.value=group.name;name.maxLength=32;name.setAttribute('aria-label','建议文件夹名称');name.addEventListener('input',()=>{group.name=name.value;refreshOrganizationLayout();});
      const page=el('select');page.setAttribute('aria-label',`${group.name} 的目标桌面`);state.pages.forEach(item=>{const option=el('option','',item.name);option.value=item.id;page.append(option);});page.value=group.page;page.addEventListener('change',()=>{group.page=page.value;refreshOrganizationLayout();});head.append(check,el('span','organization-folder-icon','▦'),name,page);card.append(head);
      card.append(el('p','organization-reason',group.reason||'根据网站名称与具体服务用途匹配。'));
      const members=el('div','organization-members');group.appIds.forEach(id=>{const app=appById(id);if(!app)return;const chip=el('span','organization-member');chip.append(appIcon(app,true),el('span','',app.name));const remove=organizerButton('×',()=>{group.appIds=group.appIds.filter(value=>value!==id);renderOrganizer();},'member-remove');remove.setAttribute('aria-label',`从建议中移除 ${app.name}`);chip.append(remove);members.append(chip);});card.append(members);root.append(card);
    });
    const untouched=(selectedApps.size?[...selectedApps].map(appById):organizerApps()).filter(app=>app&&!used.has(app.id));if(untouched.length)root.append(el('p','settings-note',`${untouched.length} 个 App 保留现有归属${$('#organizerLayout').checked?'，位置随布局整理调整':''}：${untouched.map(app=>app.name).join('、')}`));
    if(!groups.length&&$('#organizerGrouping').checked)root.append(el('p','settings-note','没有适合合并的 App，仍可应用布局整理。'));
  }
  function refreshOrganizationLayout() {updateOrganizationDraft();const root=$('#organizationLayoutPreview');if(root)renderOrganizationLayout(root);renderOrganizerFooter();}
  function renderOrganizationLayout(root) {
    root.replaceChildren();const mode=organizerPlan.previewMode,result=organizerPlan.result,plan=result.modes[mode],arrange=$('#organizerLayout').checked;
    const head=el('div','organization-layout-head'),copy=el('div');copy.append(el('strong','',arrange?'整理后的桌面':'分组后的桌面'),el('small','',`${result.stats.pages} 个桌面 · ${plan.screenCount} 屏${plan.beforeScreenCount>plan.screenCount?` · 少 ${plan.beforeScreenCount-plan.screenCount} 屏`:''}${arrange&&result.stats.resizedFolders?` · ${result.stats.resizedFolders} 个文件夹自动调节大小`:''}`));head.append(copy);
    const tabs=el('div','organization-layout-tabs');tabs.setAttribute('aria-label','预览设备尺寸');[['desktop','桌面'],['tablet','平板'],['mobile','手机']].forEach(([value,label])=>{const button=organizerButton(label,()=>{organizerPlan.previewMode=value;renderOrganizationLayout(root);},value===mode?'active':'');button.setAttribute('aria-pressed',String(value===mode));tabs.append(button);});head.append(tabs);root.append(head);
    const pages=el('div',`organization-layout-pages preview-${mode}`);pages.dataset.mode=mode;
    plan.pages.forEach(page=>page.screens.forEach((screen,index)=>{
      const card=el('figure','organization-layout-screen'),caption=el('figcaption','',`${page.name}${page.screens.length>1?` · 第 ${index+1} 屏`:''}`),canvas=el('div','organization-mini-canvas');canvas.dataset.page=page.id;canvas.dataset.segment=screen.segment;canvas.style.setProperty('--preview-columns',plan.profile.columns);canvas.style.setProperty('--preview-rows',plan.profile.rows);canvas.style.aspectRatio=`${plan.profile.width} / ${plan.profile.rows*(plan.profile.row+plan.profile.gap)-plan.profile.gap}`;
      screen.tiles.forEach(tile=>{
        const item=(tile.kind==='widget'?result.desktop.widgets:tile.kind==='folder'?result.desktop.folders:result.desktop.apps).find(item=>item.id===tile.id),name=tile.kind==='widget'?item.title||widgetLabel(item.type):item.name;
        const node=el('div',`organization-mini-tile mini-${tile.kind}`);node.dataset.id=tile.id;node.dataset.x=tile.x;node.dataset.y=tile.y;node.style.gridColumn=`${tile.x+1} / span ${tile.w}`;node.style.gridRow=`${tile.row+1} / span ${tile.h}`;node.title=tile.kind==='folder'?`${name} · ${item.appIds.length} 个 App · ${tile.w}×${tile.h}`:name;
        if(tile.kind==='app')node.append(appIcon(item,true));
        else if(tile.kind==='folder'){const grid=el('div','organization-mini-folder');item.appIds.slice(0,6).forEach(id=>{const app=result.desktop.apps.find(app=>app.id===id);if(app)grid.append(appIcon(app,true));});node.append(grid);}
        else node.append(el('span','organization-mini-symbol',widgetSymbol(item.type)));
        node.append(el('span','organization-mini-name',name));canvas.append(node);
      });card.append(caption,canvas,el('small','organization-screen-count',`${screen.tiles.filter(tile=>tile.kind==='app').length} App · ${screen.tiles.filter(tile=>tile.kind==='folder').length} 文件夹 · ${screen.tiles.filter(tile=>tile.kind==='widget').length} 小组件`));pages.append(card);
    }));root.append(pages);
    root.append(el('p','organization-layout-note',arrange?`${mode===layoutMode()?'按当前窗口预览':'按标准尺寸预览，实际窗口会自动适配'} · 小组件分区，收藏与最近使用优先 · 内容过多时横向分屏`:'仅合并文件夹，已有元素保留位置。'));
  }
  function applyAIOrganization() {
    if(!organizerPlan)return;
    if(organizerPlan.signature!==JSON.stringify(organizationSnapshot())){organizerPlan.base=organizationBaseState();organizerPlan.signature=JSON.stringify(organizationSnapshot());renderOrganizer();return toast('桌面内容已变化，整理预览已更新');}
    updateOrganizationDraft();const result=organizerPlan.result,arrange=$('#organizerLayout').checked;
    if(!result.stats.groups&&!(arrange&&result.modes[layoutMode()].screenCount))return toast('没有可应用的整理');
    applyOrganization(()=>{const {pages,apps,folders,layout}=result.desktop;Object.assign(state,clone({pages,apps,folders,layout}));},`${arrange?`已整理 ${result.stats.pages} 个桌面的布局`:`已整理为 ${result.stats.groups} 组文件夹`}`);
  }
  function openSettings(origin=null,tab='apps') {closeAppContext();if(folderId)closeFolder();if(widgetId)closeWidgetDetails();settingsTab=tab;renderSettings();openSurface('settings',origin);}
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
    if(settingsTab==='sync')renderSyncSettings(root);
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
      const actions=el('div','row-actions');[['↑',-1],['↓',1]].forEach(([label,direction])=>{const button=el('button','',label);button.type='button';button.addEventListener('click',()=>{const next=index+direction;if(next<0||next>=state.dock.length)return;[state.dock[index],state.dock[next]]=[state.dock[next],state.dock[index]];save();renderDock();renderSettings();});actions.append(button);});const remove=el('button','','移除');remove.type='button';remove.addEventListener('click',()=>{unpinApp(id);refreshDesktop();});actions.append(remove);row.append(actions);list.append(row);});root.append(list);
    root.append(el('p','section-eyebrow','添加到 Dock'));const choices=el('div','quick-links');choices.style.marginTop='12px';state.apps.filter(app=>!state.dock.includes(app.id)).forEach(app=>{const button=el('button','chip-button',`+ ${app.name}`);button.type='button';button.addEventListener('click',()=>{if(state.dock.length>=12)return toast('Dock 最多放 12 个 App');state.dock.push(app.id);refreshDesktop();});choices.append(button);});root.append(choices);
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
    const importLabel=el('label','button-secondary','导入 JSON / 旧快捷方式');importLabel.style.cursor='pointer';const input=el('input');input.type='file';input.accept='.json,application/json';input.setAttribute('aria-label','导入 JSON 或旧快捷方式');input.addEventListener('change',async()=>{if(!input.files?.[0])return;try{if(input.files[0].size>1000000)throw Error('JSON 文件超过 1 MB，请缩小后导入。');const data=JSON.parse(await input.files[0].text());const imported=importDesktop(data,state,defaults,{pageId:viewPages[currentPage].pageId});state=normalize(imported.state);save();updateSearchPreferences();setWallpaper();renderPages();renderDock();renderSettings();loadWeather();if(widgetId)renderWidgetDetails();const report=imported.report;toast(report.kind==='backup'?'桌面备份已恢复':`已添加 ${report.added} 个 · 去重 ${report.reused} 个${report.skipped?' · 跳过 '+report.skipped+' 个无效链接':''}${report.dockOverflow?' · '+report.dockOverflow+' 个置顶已加入收藏':''}`);}catch(error){toast(error instanceof SyntaxError?'JSON 格式不正确':error.message||'无法导入此文件');}});importLabel.append(input);actions.append(importLabel);root.append(actions);
    const reset=el('button','text-danger','恢复默认桌面');reset.type='button';reset.addEventListener('click',()=>{if(!confirm('确定恢复默认桌面？当前自定义布局会被覆盖。'))return;state=normalize(defaults);save();setWallpaper();renderPages();renderDock();renderSettings();loadWeather();updateSearchPreferences();toast('已恢复默认桌面');});root.append(reset);
    root.append(el('p','settings-note','支持快捷方式数组、shortcuts / widgets 旧版导出和 Weboss 完整备份。旧快捷方式按 order 排序、按 URL 去重追加；pinned 加入 Dock，空图标自动获取。完整备份恢复桌面；已连接云同步时导入结果也会同步。'));
  }
  function downloadJSON(value,name) {
    const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),link=el('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function syncBusy(){return !!(deleteConfirmation||dragState||resizeState||dropSettling||$('#editorDialog').open||surfaces.has('organizer')||document.activeElement?.matches('#settingsContent input:not([readonly]):not([type="checkbox"]):not([type="radio"]):not([type="file"]),#settingsContent textarea,#settingsContent select,#folderName,#widgetDetails input:not([type="checkbox"]),#widgetDetails textarea'));}
  function applySyncedState(raw) {
    const oldCity=JSON.stringify(state.city);state=normalize(raw);
    if(state.todoDate!==todayKey){state.todos.forEach(todo=>todo.done=false);state.todoDate=todayKey;}
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{toast('浏览器存储空间不足，请导出桌面备份');}
    pendingExternalState=false;organizationUndo=null;$('#undoOrganize').hidden=true;closeAppContext();
    if(folderId&&!folderById(folderId))closeFolder();updateSearchPreferences();setWallpaper();renderPages();renderDock();
    if(folderId)renderFolderContents();if(surfaces.has('search'))renderSearch();if($('#settingsDialog').open)renderSettings();if(JSON.stringify(state.city)!==oldCity)loadWeather();
    if(widgetId)renderWidgetDetails();
  }
  function updateSyncStatus(status) {
    cloudStatus=status;const captions={off:'云同步',syncing:'正在同步',synced:'已同步',pending:'等待同步',offline:'离线 · 改动已保存',conflict:'同步冲突',error:'同步暂不可用',reconnect:'重新连接云桌面'};
    const button=$('#cloudSyncButton');button.dataset.phase=status.phase;button.title=captions[status.phase]||'云同步';button.setAttribute('aria-label',`云同步：${button.title}`);
    if($('#settingsDialog').open&&settingsTab==='sync'&&!document.activeElement?.matches('#settingsContent input:not([readonly]),#settingsContent textarea'))renderSettings();
  }
  async function checkSyncService() {
    try{const response=await fetch('/api/sync/status',{cache:'no-store'});syncService=response.ok?(await response.json()).configured?'ready':'missing':'static';}catch{syncService='unknown';}
    if($('#settingsDialog').open&&settingsTab==='sync')renderSettings();
  }
  function syncFieldLabel(path) {
    if(path.startsWith('layout.'))return '图标或组件位置';if(path.startsWith('apps.'))return 'App 信息或所在桌面';if(path.startsWith('folders.'))return '文件夹信息、成员或排序';
    if(path.startsWith('widgets.'))return '小组件内容';if(path.startsWith('todos.'))return '今日计划';if(path.startsWith('pages.'))return '桌面页面';if(path.startsWith('dock'))return 'Dock 图标或排序';
    return ({wallpaper:'壁纸主题',customWallpaper:'自定义壁纸',searchEngine:'搜索引擎',searchLabel:'搜索框',city:'天气城市'})[path]||'桌面内容';
  }
  function syncDifference(path,data) {
    const parts=path.split('.');let value=data;
    for(const part of parts){if(Array.isArray(value))value=value.find(item=>item?.id===part);else value=value?.[part];}
    if(value===undefined)return '已移除';
    if(path.endsWith('.page'))return data.pages.find(page=>page.id===value)?.name||String(value);
    if(typeof value==='boolean')return value?'已完成':'未完成';
    if(Array.isArray(value))return value.map(id=>data.apps.find(app=>app.id===id)?.name||String(id)).join('、').slice(0,90)||'无';
    if(value&&typeof value==='object')return String(value.name||value.title||value.text||'已修改位置或内容');
    const text=String(value);return text.startsWith('data:image/')?'自定义图片':text.slice(0,90);
  }
  function renderSyncSettings(root) {
    settingsHeader(root,'云同步','让每台设备，都打开同一个自己的桌面');
    const phase=cloudStatus.phase,working=phase==='syncing',connected=!!cloudSync?.key;
    const captions={off:'仅保存在此设备',syncing:'正在同步…',synced:'内容和布局已同步',pending:'本机改动待同步',offline:'离线，改动已保存在本机',conflict:'有修改需要你选择',error:'同步暂不可用',reconnect:'需要重新连接'};
    const status=el('div',`sync-status-card ${phase}`);status.setAttribute('role','status');status.append(el('span','sync-status-icon','☁'));
    const copy=el('div');copy.append(el('strong','',captions[phase]||'云同步'),el('p','',cloudStatus.detail||(phase==='reconnect'?'本机同步记录已丢失；重新连接前会备份当前桌面。':connected?`云端版本 ${cloudStatus.revision||'—'}${cloudStatus.updatedAt?' · '+new Date(cloudStatus.updatedAt).toLocaleString('zh-CN'):''}`:'同步快捷方式、文件夹、小组件、Dock、Todo、壁纸和布局。')));status.append(copy);root.append(status);
    root.append(el('p','settings-note','桌面、平板和手机各自的网格布局都会保存。未关闭的搜索、播放器和窗口状态只留在当前设备。'));
    const action=(label,fn,className='button-secondary')=>{const button=el('button',className,label);button.type='button';button.disabled=working||!cloudSync?.ready;button.addEventListener('click',async()=>{try{await fn();}catch(error){toast(error.message||'暂时无法同步');}});return button;};
    if(!connected){
      const setup=el('div','sync-connect-card');setup.append(el('h4','','第一次使用'),el('p','','用当前桌面创建云桌面，再将同步密钥复制到其他设备。'));
      const custom=field('自定义同步密钥（可选）',syncCreateDraft,'password');custom.input.autocomplete='new-password';custom.input.maxLength=128;custom.input.placeholder='12～128 个字符，留空自动生成';custom.input.addEventListener('input',()=>syncCreateDraft=custom.input.value);setup.append(custom.wrap);
      const create=action('创建云桌面',async()=>{const ok=await cloudSync.connect(syncCreateDraft.trim()||generateSyncKey(),true);if(ok){syncDraft=syncCreateDraft='';toast('云桌面已创建，其他设备可输入相同密钥连接');}},'button-primary');setup.append(create);root.append(setup);
      const connect=el('div','sync-connect-card');connect.append(el('h4','','连接已有云桌面'),el('p','','输入另一设备的同步密钥。连接后使用云端桌面，当前桌面会自动备份。'));
      const key=field('同步密钥',syncDraft,'password');key.input.autocomplete='off';key.input.spellcheck=false;key.input.placeholder='自定义密钥，或另一设备复制的连接码';key.input.maxLength=128;key.input.addEventListener('input',()=>syncDraft=key.input.value);connect.append(key.wrap);
      const join=action('连接并使用云桌面',async()=>{const ok=await cloudSync.connect(syncDraft.trim());if(ok){syncDraft='';toast('已连接云桌面');}},'button-primary');connect.append(join);root.append(connect);
      if(['missing','static'].includes(syncService)){create.disabled=join.disabled=true;root.append(el('p','sync-service-note',syncService==='missing'?'尚未绑定数据库：在 Cloudflare 的 Worker 绑定中添加 D1，变量名填写 DB，保存后重新打开此面板。':'当前是静态预览。请在部署的 Cloudflare Workers 地址中启用云同步。'));}
    }else{
      const key=field('此云桌面的设备连接码',cloudSync.key,syncKeyVisible?'text':'password');key.input.readOnly=true;key.input.autocomplete='off';key.input.spellcheck=false;root.append(key.wrap);
      const actions=el('div','sync-actions');actions.append(action('复制密钥',async()=>{try{await navigator.clipboard.writeText(cloudSync.key);toast('密钥已复制');}catch{syncKeyVisible=true;renderSettings();toast('请手动复制同步密钥');}}),action(syncKeyVisible?'隐藏':'显示',()=>{syncKeyVisible=!syncKeyVisible;renderSettings();}));root.append(actions);
      root.append(el('p','settings-note','其他设备可输入你设置的密钥，或复制上方连接码。两者连接同一桌面；自定义密钥原文不保存，连接码不写入桌面 JSON 备份。'));
      const controls=el('div','sync-actions');controls.append(action(phase==='reconnect'?'重新连接并使用云端':'立即同步',()=>phase==='reconnect'?cloudSync.connect(cloudSync.key):cloudSync.run(true),'button-primary'),action('断开此设备',()=>{cloudSync.disconnect();syncKeyVisible=false;toast('已断开，当前桌面保留在本机');}));root.append(controls);
      const change=el('details','sync-key-change');change.append(el('summary','','更换自定义密钥'));
      const next=field('新的同步密钥',syncChangeDraft,'password');next.input.autocomplete='new-password';next.input.maxLength=128;next.input.placeholder='12～128 个字符';next.input.addEventListener('input',()=>syncChangeDraft=next.input.value);change.append(next.wrap,el('p','settings-note','更换会保留全部桌面数据，使旧密钥失效；其他设备需使用新密钥重新连接。'));
      const rotate=action('保存新密钥',async()=>{if(await cloudSync.changeKey(syncChangeDraft)){syncChangeDraft='';renderSettings();toast('密钥已更换，桌面内容已保留');}},'button-primary');rotate.disabled=rotate.disabled||!!cloudStatus.conflict||!cloudSync.base;change.append(rotate);root.append(change);
      const reconnect=el('details','sync-key-change');reconnect.open=phase==='error'&&cloudStatus.detail?.includes('找不到');reconnect.append(el('summary','','使用其他密钥连接'));
      const replacement=field('重新连接的同步密钥',syncDraft,'password');replacement.input.autocomplete='off';replacement.input.maxLength=128;replacement.input.placeholder='另一设备更换后的密钥，或设备连接码';replacement.input.addEventListener('input',()=>syncDraft=replacement.input.value);reconnect.append(replacement.wrap,el('p','settings-note','另一设备更换密钥后，可在这里重新连接。接入前自动备份当前桌面。'),action('连接此密钥',async()=>{if(await cloudSync.connect(syncDraft.trim())){syncDraft='';toast('已使用新密钥连接');}},'button-primary'));root.append(reconnect);
    }
    if(cloudStatus.conflict){
      const conflict=el('div','sync-conflict-card'),remote=cloudStatus.conflict.remote;
      conflict.append(el('h4','','两台设备修改了同一处'),el('p','','已暂停自动覆盖。选择需要保留的版本，另一版本会自动备份。'));
      const descriptions=[...new Set(cloudStatus.conflict.fields.map(syncFieldLabel))];conflict.append(el('p','sync-conflict-fields',descriptions.slice(0,4).join(' · ')));
      const versions=el('div','sync-versions');for(const [label,data] of [['本机',state],['云端',remote.state]]){const item=el('div');item.append(el('strong','',label),el('small','',`${data.apps.length} 个 App · ${data.folders.length} 个文件夹 · ${data.pages.length} 张桌面`));versions.append(item);}conflict.append(versions);
      const differences=el('div','sync-differences');for(const path of cloudStatus.conflict.fields.slice(0,4)){
        if(path==='App 或组件的位置'){differences.append(el('p','',`本机分组：${state.folders.map(folder=>folder.name).join('、')||'无'}；云端分组：${remote.state.folders.map(folder=>folder.name).join('、')||'无'}`));continue;}
        const row=el('div','sync-difference');row.append(el('strong','',syncFieldLabel(path)),el('span','',`本机：${syncDifference(path,state)}`),el('span','',`云端：${syncDifference(path,remote.state)}`));differences.append(row);
      }conflict.append(differences);
      const choices=el('div','sync-actions');choices.append(action('使用云端版本',()=>cloudSync.resolve('cloud'),'button-primary'),action('保留本机版本',()=>cloudSync.resolve('local')),action('下载两个版本',()=>downloadJSON({local:clone(state),cloud:remote.state,cloudRevision:remote.revision},'weboss-sync-conflict.json')));conflict.append(choices);root.append(conflict);
    }
    if(cloudStatus.backups?.length){
      const backup=el('div','sync-backup-card');backup.append(el('h4','','本机恢复备份'),el('p','','保留最近三份同步前的桌面，仅存于此设备。恢复后可继续同步。'));
      const select=field('选择备份',syncBackupId,'select',cloudStatus.backups.map(item=>[item.id,`${new Date(item.savedAt).toLocaleString('zh-CN')} · ${item.label}`]));if(!select.input.value)select.input.value=cloudStatus.backups[0].id;syncBackupId=select.input.value;select.input.addEventListener('change',()=>syncBackupId=select.input.value);backup.append(select.wrap);
      const buttons=el('div','sync-actions');buttons.append(action('恢复此备份',()=>cloudSync.restoreBackup(syncBackupId)),action('下载此备份',()=>{const item=cloudSync.backups.find(item=>item.id===syncBackupId);if(item)downloadJSON(item.state,'weboss-local-backup.json');}));backup.append(buttons);root.append(backup);
    }
  }
  function field(label,value,type='text',options) {
    const wrap=el('label','field',label);let input;
    if(options){input=el('select');options.forEach(([value,text])=>{const option=el('option','',text);option.value=value;input.append(option);});input.value=value;}
    else if(type==='textarea'){input=el('textarea');input.value=value||'';}
    else{input=el('input');input.type=type;input.value=value??'';}
    wrap.append(input);return {wrap,input};
  }
  function openEditor(type,id=null,memberIds=[]) {
    editorContext={type,id};const item=id?itemById(type,id):null;
    $('#editorTitle').textContent=type==='search'?'编辑搜索':`${id?'编辑':'添加'} ${type==='app'?'App':type==='folder'?'文件夹':'Widget'}`;$('#editorDelete').hidden=!id||!!item?.system;$('#editorDelete').textContent=type==='folder'?'解散文件夹':'删除';
    const root=$('#editorFields');root.replaceChildren();const fields={};
    const add=(key,label,value,inputType='text',options)=>{const entry=field(label,value,inputType,options);entry.input.name=key;root.append(entry.wrap);fields[key]=entry.input;};
    if(type==='app'){
      add('name','名称',item?.name||'');fields.name.maxLength=64;if(!item?.system)add('url','网站 URL',item?.url||'https://','url');
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
      state.apps.filter(app=>!app.system).forEach(app=>{const label=el('label','folder-member');const check=el('input');check.type='checkbox';check.value=app.id;check.checked=item?.appIds.includes(app.id)||memberIds.includes(app.id);fields.memberChecks.push(check);label.append(check,appIcon(app,true),el('span','',app.name));members.append(label);});root.append(el('p','settings-note','选择至少两个 App。已有文件夹或 Dock 中的 App 会移入这里；只剩一个 App 的文件夹会自动解散。'),members);
    }else if(type==='search'){
      add('name','搜索框文字',state.searchLabel);add('engine','默认搜索引擎',state.searchEngine,'select',engines.map(engine=>[engine.id,engine.name]));
    }else{
      add('type','Widget 类型',item?.type||'note','select',['clock','note','link','todo','calendar','quote','weather','progress','recent','favorites','watching','player','quick'].map(t=>[t,widgetLabel(t)]));
      add('title','标题',item?.title||'');add('content','内容 / 链接',item?.content||'','textarea');add('size','卡片尺寸',item?.size||'medium','select',[['small','小'],['medium','标准'],['wide','宽']]);add('page','桌面页面',item?.page||viewPages[currentPage].pageId,'select',state.pages.map(page=>[page.id,page.name]));
      fields.content.maxLength=4000;const progress=normalizeProgress(item?.progress);add('progressValue','已完成数量',progress.value,'number');add('progressTotal','目标数量',progress.total,'number');add('progressUnit','计数单位',progress.unit);fields.progressValue.min='0';fields.progressTotal.min='1';fields.progressValue.max=fields.progressTotal.max='100000';fields.progressValue.step=fields.progressTotal.step='any';fields.progressUnit.maxLength=16;
      const visibility=()=>['progressValue','progressTotal','progressUnit'].forEach(key=>fields[key].closest('label').hidden=fields.type.value!=='progress');fields.type.addEventListener('change',visibility);visibility();
    }
    editorContext.fields=fields;if(!$('#editorDialog').open)$('#editorDialog').showModal();fields.name?.focus();
  }
  function closeEditor() {closeDeleteConfirmation();$('#editorDialog').close();editorContext=null;}
  function saveEditor() {
    if(!editorContext)return;const {type,id,fields}=editorContext;
    if(type==='app'){
      const existing=appById(id),url=existing?.system?'':validUrl(fields.url.value.trim());if(!existing?.system&&!url)return toast('请输入以 http 或 https 开头的网址');
      const name=fields.name.value.trim();if(!name)return toast('请输入 App 名称');
      const app={id:id||crypto.randomUUID(),system:existing?.system,name:name.slice(0,64),url,icon:fields.icon.value.trim().slice(0,180)||'✦',iconMode:fields.iconMode.value,color:fields.color.value,page:fields.page.value};
      if(existing&&existing.page!==app.page){unpinApp(id,app.page);removeFromFolders(id);}
      const index=state.apps.findIndex(item=>item.id===id);if(index>=0)state.apps[index]=app;else state.apps.push(app);
    }else if(type==='folder'){
      const name=fields.name.value.trim();if(!name)return toast('请输入文件夹名称');
      const w=Math.round(Number(fields.width.value)),h=Math.round(Number(fields.height.value));if(w<1||w>gridColumns(layoutMode())||h<1||h>rowsPerPage||!Number.isFinite(w+h))return toast('请输入范围内的文件夹大小');
      if(!id&&fields.memberChecks.filter(check=>check.checked).length<2)return toast('至少选择两个 App 才能创建文件夹');
      const folder=folderById(id)||{id:crypto.randomUUID(),sizes:{},appIds:[]};freezeLayout(layoutMode());
      folder.name=name.slice(0,32);folder.page=fields.page.value;folder.appIds=fields.memberChecks.filter(check=>check.checked).map(check=>check.value);folder.sizes[layoutMode()]={w,h};
      folder.appIds.forEach(appId=>{unpinApp(appId,folder.page);state.folders.filter(other=>other.id!==folder.id).forEach(other=>other.appIds=other.appIds.filter(value=>value!==appId));appById(appId).page=folder.page;});if(!id)state.folders.push(folder);
      state.layout[layoutMode()][folder.id]={...(state.layout[layoutMode()][folder.id]||{}),page:folder.page,priority:Date.now()};
    }else if(type==='search'){
      state.searchLabel=fields.name.value.trim().slice(0,80)||defaults.searchLabel;state.searchEngine=fields.engine.value;updateSearchPreferences();
    }else{
      const widget={id:id||crypto.randomUUID(),type:fields.type.value,title:fields.title.value.trim().slice(0,40),content:fields.content.value.trim().slice(0,4000),size:fields.size.value,page:fields.page.value};
      if(widget.type==='progress')widget.progress=normalizeProgress({value:fields.progressValue.value,total:fields.progressTotal.value,unit:fields.progressUnit.value});
      if(widget.type==='link'&&!validUrl(widget.content))return toast('链接 Widget 需要有效的 http 或 https 地址');
      const index=state.widgets.findIndex(item=>item.id===id);if(index>=0)state.widgets[index]=widget;else state.widgets.push(widget);
    }
    closeEditor();refreshDesktop();toast('已保存到桌面');
  }
  function deleteEditor() {
    if(!editorContext?.id)return;const {type,id}=editorContext;
    if(type==='folder'){closeEditor();dissolveFolder(id);return;}
    confirmItemDelete(type,id,$('#editorDelete'));
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
  function updatePlayer() {document.querySelectorAll('[data-type="player"] .widget-content').forEach(root=>{root.replaceChildren();renderPlayer(root);});document.querySelectorAll('.widget-playlist-item').forEach(node=>node.classList.toggle('active',Number(node.dataset.track)===music.track));}

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
  $('#undoOrganize').addEventListener('click',undoOrganization);
  $('#organizerClose').addEventListener('click',closeOrganizer);
  $('#organizerBackdrop').addEventListener('click',closeOrganizer);
  $('#organizerBulkTab').addEventListener('click',()=>{organizerMode='bulk';organizerPlan=null;$('#organizerExisting').checked=true;renderOrganizer();});
  $('#organizerAITab').addEventListener('click',()=>{organizerMode='ai';organizerPlan=null;$('#organizerExisting').checked=false;renderOrganizer();});
  ['organizerScope','organizerExisting'].forEach(id=>$(`#${id}`).addEventListener('change',()=>{selectedApps.clear();organizerPlan=null;renderOrganizer();}));
  $('#organizerFilter').addEventListener('input',()=>{organizerPlan=null;renderOrganizer();});
  $('#organizerInstruction').addEventListener('input',()=>{if(organizerPlan){organizerPlan=null;renderOrganizer();}});
  $('#organizerGrouping').addEventListener('change',()=>{organizerPlan=null;renderOrganizer();});
  $('#organizerLayout').addEventListener('change',()=>{if(organizerPlan)refreshOrganizationLayout();else renderOrganizerFooter();});
  $('#settingsClose').addEventListener('click',closeSettings);
  $('#settingsBackdrop').addEventListener('click',closeSettings);
  $('#folderClose').addEventListener('click',()=>closeFolder());
  $('#folderBackdrop').addEventListener('click',()=>closeFolder());
  $('#folderManage').addEventListener('click',()=>openEditor('folder',folderId));
  $('#folderBatch').addEventListener('click',()=>openOrganizer('bulk',null,folderId));
  $('#folderRename').addEventListener('click',startFolderRename);
  $('#folderName').addEventListener('blur',()=>finishFolderRename());
  $('#folderName').addEventListener('keydown',event=>{if(['Enter','Escape'].includes(event.key)){event.preventDefault();event.stopPropagation();finishFolderRename(event.key==='Escape');$('#folderTitle').focus();}});
  $('#folderDialog').addEventListener('contextmenu',event=>{if(event.defaultPrevented)return;event.preventDefault();openItemContext('folder',folderId,event.clientX,event.clientY);});
  $('#widgetClose').addEventListener('click',closeWidgetDetails);
  $('#widgetBackdrop').addEventListener('click',closeWidgetDetails);
  $('#widgetManage').addEventListener('click',()=>openEditor('widget',widgetId));
  $('#widgetDialog').addEventListener('contextmenu',event=>{if(event.defaultPrevented)return;event.preventDefault();openItemContext('widget',widgetId,event.clientX,event.clientY);});
  $('#searchTrigger').addEventListener('contextmenu',event=>openDesktopContext(event,'search'));
  $('#dock').addEventListener('contextmenu',event=>{if(!event.defaultPrevented)openDesktopContext(event,'dock');});
  $('#desktopShell').addEventListener('dragstart',event=>event.preventDefault());
  $('#folderDialog').addEventListener('dragstart',event=>event.preventDefault());
  $('#widgetDialog').addEventListener('dragstart',event=>event.preventDefault());
  $('#editorDialog').addEventListener('cancel',event=>{event.preventDefault();closeEditor();});
  $('#settingsTabs').addEventListener('click',event=>{const tab=event.target.closest('[data-tab]');if(!tab)return;settingsTab=tab.dataset.tab;renderSettings();if(settingsTab==='sync')checkSyncService();});
  $('#cloudSyncButton').addEventListener('click',event=>{openSettings(event.currentTarget,'sync');checkSyncService();});
  $('#editorClose').addEventListener('click',closeEditor);
  $('#editorCancel').addEventListener('click',closeEditor);
  $('#editorDelete').addEventListener('click',deleteEditor);
  $('#editorForm').addEventListener('submit',event=>{event.preventDefault();saveEditor();});
  document.addEventListener('keydown',event=>{
    if(deleteConfirmation){if(event.key==='Escape'){event.preventDefault();closeDeleteConfirmation();return;}if(event.key==='Tab'){const buttons=$('#deletePopover').querySelectorAll('button'),next=event.shiftKey?buttons[0]:buttons[1];if(document.activeElement===next){event.preventDefault();(event.shiftKey?buttons[1]:buttons[0]).focus();}return;}}
    if(event.key==='Escape'&&(dragState?.active||resizeState)){event.preventDefault();if(dragState)stopTileDrag({pointerId:dragState.pointerId},true);if(resizeState)finishFolderResize({pointerId:resizeState.pointerId},true);return;}
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'&&!$('#editorDialog').open){event.preventDefault();if($('#settingsDialog').open)closeSettings();if(folderId)closeFolder();if(widgetId)closeWidgetDetails();searchOpen();return;}
    if(event.key==='Escape'&&!$('#appContextMenu').hidden){closeAppContext();return;}
    if(surfaces.has('folder')&&!$('#editorDialog').open&&event.target.closest('#folderDialog')&&!event.target.matches('input,textarea,select')&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();setFolderPage(folderPage+(event.key==='ArrowRight'?1:-1));return;}
    if(event.key==='Escape'&&!$('#editorDialog').open){if(surfaces.has('organizer'))closeOrganizer();else if(surfaces.has('search'))searchClose();else if(surfaces.has('settings'))closeSettings();else if(surfaces.has('widget'))closeWidgetDetails();else if(surfaces.has('folder'))closeFolder();else if(sizingFolderId){sizingFolderId=null;document.querySelectorAll('.folder-sizing').forEach(node=>node.classList.remove('folder-sizing'));}return;}
    if(event.key==='Tab'&&surfaces.size&&!$('#editorDialog').open){const context=[...surfaces.values()].filter(item=>item.status!=='closing').at(-1);if(context){const focusable=[...context.panel.querySelectorAll('button,input,a,select,textarea')].filter(node=>!node.disabled&&!node.closest('[inert]')&&node.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}}
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
    if(!drag.active && distance>7 && (!drag.touch || editing&&!drag.sourceFolder))startTileDrag(drag);
    if(!drag.active)return;
    event.preventDefault(); drag.lastX=event.clientX;drag.lastY=event.clientY;
    drag.ghost.style.left=`${event.clientX-drag.offsetX}px`;drag.ghost.style.top=`${event.clientY-drag.offsetY}px`;
    updateDragPreview(drag,event);
    const viewportRect=$('#desktopViewport').getBoundingClientRect();
    if(!insideRect(event,viewportRect)||drag.previewTarget?.action==='folder-order'){clearTimeout(drag.edgeTimer);drag.edgeDestination=null;return;}
    const edge=event.clientX<viewportRect.left+38?-1:event.clientX>viewportRect.right-38?1:0;
    const destination=currentPage+edge;
    const canAdd=edge===1&&destination===viewPages.length&&!viewPages[currentPage].temporary;
    if(edge && destination>=0 && (destination<viewPages.length||canAdd)){
      if(drag.edgeDestination!==destination){clearTimeout(drag.edgeTimer);drag.edgeDestination=destination;
        drag.edgeTimer=setTimeout(()=>{if(dragState===drag){clearDragPreview(drag);resetGroupCandidate(drag);setPage(canAdd?appendDraftPage(drag):destination);drag.edgeDestination=null;
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
    if(deleteConfirmation&&!$('#deletePopover').contains(event.target))closeDeleteConfirmation();
    if(sizingFolderId&&!event.target.closest('.folder-tile,.app-context-menu')){sizingFolderId=null;document.querySelectorAll('.folder-sizing').forEach(node=>node.classList.remove('folder-sizing'));}
  },true);
  document.addEventListener('contextmenu',event=>{if(event.defaultPrevented)return;if(event.target.closest('#desktopShell'))openDesktopContext(event);else closeAppContext();});
  window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{if(dragState||resizeState)return;renderPages();if(folderId)renderFolderContents();if(organizerPlan&&$('#organizerDialog').open)refreshOrganizationLayout();for(const context of surfaces.values())if(context.status!=='closing')openSurface(context.name,context.origin);});});
  const folderViewport=$('#folderViewport');
  folderViewport.addEventListener('pointerdown',event=>{if(event.button!==0||$('#editorDialog').open||dragState?.active||event.pointerType!=='touch'&&event.target.closest('.app-shortcut,button,a'))return;folderSwipe={id:event.pointerId,x:event.clientX,y:event.clientY,page:folderPage,lastX:event.clientX,at:performance.now(),velocity:0,active:false};},true);
  window.addEventListener('pointermove',event=>{const swipe=folderSwipe;if(!swipe||swipe.id!==event.pointerId)return;if(dragState?.active){folderSwipe=null;return;}const dx=event.clientX-swipe.x,dy=event.clientY-swipe.y;if(!swipe.active){if(Math.abs(dx)<8||Math.abs(dx)<Math.abs(dy)*1.2)return;swipe.active=true;if(dragState?.pointerId===event.pointerId){clearTimeout(dragState.timer);dragState=null;}try{folderViewport.setPointerCapture(event.pointerId);}catch{}$('#folderTrack').classList.add('folder-track-dragging');}
    event.preventDefault();const now=performance.now();swipe.velocity=(event.clientX-swipe.lastX)/Math.max(1,now-swipe.at);swipe.lastX=event.clientX;swipe.at=now;const edge=swipe.page===0&&dx>0||swipe.page===$('#folderTrack').children.length-1&&dx<0,offset=Math.max(-folderViewport.clientWidth,Math.min(folderViewport.clientWidth,edge?dx*.2:dx));$('#folderTrack').style.transform=`translate3d(calc(${-swipe.page*100}% + ${offset}px),0,0)`;
  },{capture:true,passive:false});
  function finishFolderSwipe(event,cancelled=false){const swipe=folderSwipe;if(!swipe||swipe.id!==event.pointerId)return;const dx=event.clientX-swipe.x,flip=!cancelled&&swipe.active&&(Math.abs(dx)>Math.min(70,folderViewport.clientWidth*.2)||Math.abs(dx)>18&&performance.now()-swipe.at<100&&Math.abs(swipe.velocity)>.45);folderSwipe=null;if(swipe.active){suppressClickUntil=Date.now()+450;event.preventDefault();}try{folderViewport.releasePointerCapture(event.pointerId);}catch{}setFolderPage(swipe.page+(flip?(dx<0?1:-1):0));}
  window.addEventListener('pointerup',event=>finishFolderSwipe(event),{capture:true,passive:false});window.addEventListener('pointercancel',event=>finishFolderSwipe(event,true),true);
  folderViewport.addEventListener('wheel',event=>{if(dragState||folderSwipe?.active||$('#folderTrack').children.length<2)return;event.preventDefault();const delta=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;if(Math.abs(delta)<12||Date.now()-folderWheelAt<420)return;folderWheelAt=Date.now();setFolderPage(folderPage+(delta>0?1:-1));},{passive:false});
  folderViewport.addEventListener('click',event=>{if(Date.now()<suppressClickUntil){event.preventDefault();event.stopPropagation();}},true);
  setInterval(()=>{if(state.wallpaper==='bing')loadBingWallpaper();},3600000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.wallpaper==='bing')loadBingWallpaper();});

  cloudSync=new CloudSync({getState:()=>clone(state),applyState:applySyncedState,isBusy:syncBusy,onStatus:updateSyncStatus,version:defaults.version});
  window.addEventListener('storage',event=>{
    if(event.key===SYNC_STORAGE_KEY&&event.newValue!==cloudSync.key){cloudSync.disconnect(false);cloudSync.init();}
    if(event.key===STORAGE_KEY&&event.newValue){pendingExternalState=true;if(!syncBusy()){try{const next=JSON.parse(event.newValue);if(!sameState(next,state))applySyncedState(next);cloudSync.localChanged();}catch{}}}
  });
  setInterval(()=>{if(pendingExternalState&&!syncBusy()){try{const next=JSON.parse(localStorage.getItem(STORAGE_KEY));if(next&&!sameState(next,state))applySyncedState(next);pendingExternalState=false;cloudSync.localChanged();}catch{}}},1000);
  setInterval(()=>{if(!document.hidden)cloudSync.run();},12000);
  window.addEventListener('online',()=>cloudSync.run());window.addEventListener('offline',()=>{if(cloudSync.key)cloudSync.status('offline');});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)cloudSync.run();});
  updateSearchPreferences();setWallpaper();renderPages();renderDock();save();loadWeather();updateClock();setInterval(updateClock,30000);cloudSync.init();
})();
