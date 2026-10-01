import {folderMetrics, validateGroups} from './organizer.js';
import {reconcileDesktop} from './desktop-model.js';

export const LAYOUT_MODES = ['desktop', 'tablet', 'mobile'];
const clone = value => JSON.parse(JSON.stringify(value));
const widgetOrder = ['clock', 'weather', 'todo', 'progress', 'player', 'watching', 'calendar', 'recent', 'favorites', 'quick', 'note', 'quote'];

export function desktopTileSize(item, mode, {columns, rows}) {
  if (item.kind === 'app') return {w: 1, h: 1};
  if (item.kind === 'folder') {
    const size = item.data.sizes?.[mode] || {w: 2, h: 2};
    return {w: Math.max(1, Math.min(columns, Math.round(Number(size.w) || 2))), h: Math.max(1, Math.min(rows, Math.round(Number(size.h) || 2)))};
  }
  const {type, size} = item.data;
  let w, h;
  if (mode === 'mobile') {
    w = type === 'clock' || type === 'watching' || type === 'calendar' || size === 'wide' ? 4 : 2;
    h = type === 'clock' ? 1 : ['watching', 'calendar', 'todo', 'player'].includes(type) ? 3 : 2;
    // Todo and player remain half-width on phones, including legacy "wide" cards.
    if (['todo', 'player'].includes(type)) w = 2;
  } else {
    w = type === 'clock' || size === 'wide' ? 4 : mode === 'tablet' || size === 'small' ? 2 : 3;
    h = ['calendar', 'todo'].includes(type) ? 3 : 2;
  }
  return {w: Math.min(columns, w), h: Math.min(rows, h)};
}

export function desktopItems(data, pageId, mode, rows) {
  const dock = new Set(data.dock), members = new Set(data.folders.flatMap(folder => folder.appIds));
  const widgets = data.widgets.filter(item => item.page === pageId).map(data => ({kind: 'widget', data, id: data.id}));
  const folders = data.folders.filter(item => item.page === pageId).map(data => ({kind: 'folder', data, id: data.id}));
  const apps = data.apps.filter(item => item.page === pageId && !dock.has(item.id) && !members.has(item.id)).map(data => ({kind: 'app', data, id: data.id}));
  const prominentTypes = mode === 'mobile' ? rows <= 6 ? ['clock'] : ['clock', 'weather', 'todo', 'player', 'watching'] : rows <= 5 ? ['clock', 'weather', 'todo', 'progress', 'watching', 'player'] : null;
  if (!prominentTypes) return [...widgets, ...folders, ...apps];
  return [...widgets.filter(item => prominentTypes.includes(item.data.type)), ...folders, ...apps, ...widgets.filter(item => !prominentTypes.includes(item.data.type))];
}

function fits(occupied, x, y, w, h, {columns, rows}) {
  if (x < 0 || y < 0 || x + w > columns || y % rows + h > rows) return false;
  for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) if (occupied.has(`${col},${row}`)) return false;
  return true;
}

function occupy(occupied, {x, y, w, h}) {
  for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) occupied.add(`${col},${row}`);
}

// Both the desktop renderer and the organizer use this resolver. A preview and
// its applied layout therefore obey the same screen boundaries and tile sizes.
export function resolveTilePositions(items, saved, pageId, mode, profile) {
  const occupied = new Set(), positions = new Map();
  const ordered = [...items].sort((a, b) => (Number(saved[b.id]?.priority) || 0) - (Number(saved[a.id]?.priority) || 0));
  const area = items.reduce((sum, item) => {const {w, h} = desktopTileSize(item, mode, profile); return sum + w * h;}, 0);
  const usefulRowLimit = Math.ceil(area / profile.columns) + profile.rows * 2;
  for (const item of ordered) {
    const {w, h} = desktopTileSize(item, mode, profile), pref = saved[item.id]?.page === pageId ? saved[item.id] : null;
    let x = Number(pref?.x), y = Number(pref?.y);
    if (!Number.isInteger(x) || !Number.isInteger(y) || y > usefulRowLimit || !fits(occupied, x, y, w, h, profile)) {
      outer: for (y = 0; ; y++) for (x = 0; x <= profile.columns - w; x++) if (fits(occupied, x, y, w, h, profile)) break outer;
    }
    const pos = {x, y, w, h};positions.set(item.id, pos);occupy(occupied, pos);
  }
  return positions;
}

function appPriority(data) {
  const scores = new Map(data.apps.map(app => [app.id, app.system ? -5 : 0]));
  (data.history || []).forEach((id, index) => scores.set(id, (scores.get(id) || 0) + Math.max(1, 20 - index)));
  (data.favoriteIds || []).forEach(id => scores.set(id, (scores.get(id) || 0) + 24));
  return scores;
}

function utilityPriority(item, scores) {
  if (item.kind === 'app') return scores.get(item.id) || 0;
  return Math.max(0, ...item.data.appIds.map(id => scores.get(id) || 0)) + 2;
}

function folderSize(folder, mode, profile, compact = false) {
  const cell = (profile.width - (profile.columns - 1) * profile.gap) / profile.columns;
  const target = Math.min(folder.appIds.length, 6), choices = [[2, 2], [3, 2], [2, 3], [3, 3]].filter(([w, h]) => w <= profile.columns && h <= profile.rows);
  return choices.map(([w, h]) => {
    const metrics = folderMetrics(w * cell + (w - 1) * profile.gap, h * profile.row + (h - 1) * profile.gap);
    const visible = metrics.capacity >= folder.appIds.length ? folder.appIds.length : Math.max(0, metrics.capacity - 1);
    const cost = Math.max(0, target - visible) * (compact ? .7 : 5) + w * h * (compact ? 3 : 1) + (metrics.labels ? 0 : .7) + Math.max(0, 28 - metrics.icon) * .2;
    return {w, h, cost};
  }).sort((a, b) => a.cost - b.cost || a.w - b.w)[0] || {w: 2, h: 2};
}

function screenTiles(items, positions, profile) {
  const screens = new Map();
  for (const item of items) {
    const pos = positions.get(item.id), segment = Math.floor(pos.y / profile.rows);
    if (!screens.has(segment)) screens.set(segment, []);
    screens.get(segment).push({id: item.id, kind: item.kind, ...pos, row: pos.y % profile.rows});
  }
  return [...screens].sort((a, b) => a[0] - b[0]).map(([segment, tiles]) => ({segment, tiles}));
}

function packPage(items, mode, profile, scores, variant) {
  const positions = new Map(), occupied = new Set();
  const widgets = items.filter(item => item.kind === 'widget').sort((a, b) => {
    const rank = item => {const index = widgetOrder.indexOf(item.data.type);return index < 0 ? widgetOrder.length : index;};
    return rank(a) - rank(b);
  });
  const utilities = items.filter(item => item.kind !== 'widget').sort((a, b) => utilityPriority(b, scores) - utilityPriority(a, scores));
  const lane = mode === 'mobile' ? 2 : Math.floor(profile.columns / 2);
  function place(item, region = item.kind === 'widget' ? 'left' : 'right') {
    const {w, h} = desktopTileSize(item, mode, profile);
    for (let segment = 0; ; segment++) {
      const candidates = [];
      for (let row = 0; row <= profile.rows - h; row++) for (let x = 0; x <= profile.columns - w; x++) {
        const y = segment * profile.rows + row;
        if (!fits(occupied, x, y, w, h, profile)) continue;
        const inLane = region === 'left' ? x + w <= lane : x >= lane;
        const laneCost = variant === 'compact' || inLane || w > lane && region === 'left' ? 0 : profile.rows * 3;
        const alignmentCost = item.kind === 'widget' && x !== 0 && x !== lane && x !== 3 && x !== 4 ? .4 : 0;
        candidates.push({x, y, w, h, cost: laneCost + row * 1.1 + (variant === 'compact' || region === 'left' ? x : x - lane) * .05 + alignmentCost});
      }
      if (!candidates.length) continue;
      candidates.sort((a, b) => a.cost - b.cost || a.y - b.y || a.x - b.x);
      const {cost, ...pos} = candidates[0];positions.set(item.id, pos);occupy(occupied, pos);return;
    }
  }
  let widgetArea = 0;
  const anchor = widgets.find(item => item.data.type === 'clock');
  if (anchor) {place(anchor);const {w, h} = desktopTileSize(anchor, mode, profile);widgetArea += w * h;}
  const firstWidgets = widgets.filter(item => item !== anchor && (variant === 'compact' || ['weather', 'todo', 'progress', 'player', 'watching'].includes(item.data.type)));
  if (variant === 'compact') firstWidgets.sort((a, b) => desktopTileSize(b, mode, profile).h - desktopTileSize(a, mode, profile).h);
  const budget = variant === 'compact' ? Infinity : profile.columns * profile.rows * (variant === 'widgets' ? .6 : .34);
  const prominent = [];
  for (const item of firstWidgets) {
    const {w, h} = desktopTileSize(item, mode, profile);
    if (widgetArea + w * h > budget) continue;
    place(item);prominent.push(item);widgetArea += w * h;
  }
  // Reserve useful entrances before decorative cards can consume the first screen.
  const hotCount = mode === 'mobile' ? 4 : mode === 'tablet' ? 6 : 8;
  utilities.slice(0, hotCount).forEach(item => place(item));
  widgets.filter(item => item !== anchor && !prominent.includes(item)).forEach(item => place(item));
  utilities.slice(hotCount).forEach(item => place(item));
  const screens = screenTiles(items, positions, profile);
  let cost = screens.length * 10000;
  for (const item of utilities) {
    const pos = positions.get(item.id), segment = Math.floor(pos.y / profile.rows);
    cost += segment * (20 + utilityPriority(item, scores) * 12);
    if (pos.x < lane) cost += 1;
  }
  for (const item of widgets) {const pos = positions.get(item.id);if (pos.x >= lane) cost += 2;}
  // Within the same screen count, prefer cohesive areas and modest empty space.
  cost += variant === 'compact' ? 3 : 0;
  return {positions, screens, cost};
}

export function planDesktopOrganization(data, rawGroups = [], options = {}) {
  const desktop = clone(data), scores = appPriority(desktop), initialPages = new Set(desktop.pages.map(page => page.id));
  const allowed = desktop.apps.filter(app => !app.system && !desktop.dock.includes(app.id));
  const groups = validateGroups(rawGroups.filter(group => group.enabled !== false), allowed);
  const touched = new Set(), groupedIds = new Set();
  groups.forEach((group, index) => {
    const raw = rawGroups.find(item => item.enabled !== false && item.appIds?.some(id => group.appIds.includes(id)));
    const page = initialPages.has(raw?.page) ? raw.page : desktop.apps.find(app => app.id === group.appIds[0]).page;
    let folder = desktop.folders.find(item => item.name === group.name && item.page === page);
    if (!folder) {
      const taken = new Set([...desktop.apps, ...desktop.widgets, ...desktop.folders].map(item => item.id));
      let id = raw?.folderId || `organized-folder-${index + 1}`, suffix = 1;
      while (taken.has(id)) id = `organized-folder-${index + 1}-${suffix++}`;
      folder = {id, name: group.name, page, appIds: [], sizes: {}};desktop.folders.push(folder);
    }
    touched.add(page);
    for (const id of group.appIds) {
      const app = desktop.apps.find(app => app.id === id);touched.add(app.page);groupedIds.add(id);
      desktop.folders.forEach(item => {item.appIds = item.appIds.filter(value => value !== id);});
      folder.appIds.push(id);app.page = page;
      for (const mode of LAYOUT_MODES) delete desktop.layout[mode][id];
    }
  });
  reconcileDesktop(desktop);
  const pageIds = new Set(options.pageIds || desktop.pages.map(page => page.id));
  touched.forEach(id => pageIds.add(id));
  const folderIds = options.folderIds ? new Set(options.folderIds) : null;
  if (folderIds) desktop.folders.filter(folder => folder.appIds.some(id => groupedIds.has(id))).forEach(folder => folderIds.add(folder.id));
  const modes = {}, resized = new Set(), ordered = new Set();
  if (options.arrange !== false) {
    desktop.folders.filter(folder => folderIds ? folderIds.has(folder.id) : pageIds.has(folder.page)).forEach(folder => {
      const original = [...folder.appIds];
      folder.appIds.sort((a, b) => (scores.get(b) || 0) - (scores.get(a) || 0));
      if (original.some((id, i) => folder.appIds[i] !== id)) ordered.add(folder.id);
    });
  }
  for (const mode of LAYOUT_MODES) {
    const profile = {...{columns: mode === 'mobile' ? 4 : mode === 'tablet' ? 8 : 12, rows: 6, width: mode === 'mobile' ? 364 : mode === 'tablet' ? 830 : 1152, row: mode === 'tablet' ? 76 : 78, gap: mode === 'mobile' ? 9 : mode === 'tablet' ? 10 : 12}, ...options.profiles?.[mode]};
    profile.rows = Math.max(3, Math.floor(profile.rows));
    const pages = [];let beforeScreenCount = 0;
    for (const page of desktop.pages) {
      if (!pageIds.has(page.id)) continue;
      const beforeItems = desktopItems(data, page.id, mode, profile.rows);
      beforeScreenCount += screenTiles(beforeItems, resolveTilePositions(beforeItems, data.layout[mode], page.id, mode, profile), profile).length;
      const pageFolders = desktop.folders.filter(folder => folder.page === page.id && (!folderIds || folderIds.has(folder.id)));
      const originalSizes = new Map(pageFolders.map(folder => [folder.id, folder.sizes?.[mode]]));
      if (options.arrange !== false) pageFolders.forEach(folder => {const {w, h} = folderSize(folder, mode, profile);folder.sizes ||= {};folder.sizes[mode] = {w, h};});
      const items = desktopItems(desktop, page.id, mode, profile.rows);
      let positions;
      if (options.arrange === false) positions = resolveTilePositions(items, desktop.layout[mode], page.id, mode, profile);
      else if (folderIds) {
        // A folder-scoped operation never moves unrelated tiles. Resolve locked
        // tiles first and let resized folders occupy the remaining free cells.
        const before = resolveTilePositions(beforeItems, data.layout[mode], page.id, mode, profile);
        const saved = {...desktop.layout[mode]};
        items.forEach(item => {if (before.has(item.id)) saved[item.id] = {page: page.id, ...before.get(item.id), priority: folderIds.has(item.id) ? 1 : 100};});
        positions = resolveTilePositions(items, saved, page.id, mode, profile);
      } else {
        const candidates = [];
        for (const compact of [false, true]) {
          pageFolders.forEach(folder => {const {w, h} = folderSize(folder, mode, profile, compact);folder.sizes[mode] = {w, h};});
          const sizes = Object.fromEntries(pageFolders.map(folder => [folder.id, {...folder.sizes[mode]}]));
          for (const variant of ['balanced', 'widgets', 'compact']) {
            const candidate = packPage(items, mode, profile, scores, variant);
            // Shrink folders only when it actually saves a screen or makes a
            // frequent entrance reachable sooner, not simply to fill space.
            candidate.cost += compact ? pageFolders.length * 8 : 0;
            candidates.push({...candidate, sizes});
          }
        }
        candidates.sort((a, b) => a.cost - b.cost);positions = candidates[0].positions;
        pageFolders.forEach(folder => {folder.sizes[mode] = candidates[0].sizes[folder.id];});
      }
      if (options.arrange !== false) pageFolders.forEach(folder => {const before = originalSizes.get(folder.id), after = folder.sizes[mode];if (before?.w !== after.w || before?.h !== after.h) resized.add(folder.id);});
      if (options.arrange !== false) for (const item of items) {
        const {x, y} = positions.get(item.id);desktop.layout[mode][item.id] = {page: page.id, x, y, priority: folderIds && !folderIds.has(item.id) ? 100 : 10};
      }
      pages.push({id: page.id, name: page.name, screens: screenTiles(items, positions, profile)});
    }
    modes[mode] = {profile, pages, screenCount: pages.reduce((sum, page) => sum + page.screens.length, 0), beforeScreenCount};
  }
  return {desktop, modes, stats: {groups: groups.length, groupedApps: groupedIds.size, pages: modes.desktop.pages.length, resizedFolders: resized.size, orderedFolders: ordered.size}};
}
