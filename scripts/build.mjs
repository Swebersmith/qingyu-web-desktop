import { cp, mkdir, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const path of ['index.html', 'styles.css', 'script.js', 'config.js', 'organizer.js', 'desktop-model.js', 'desktop-import.js', 'widget-model.js', 'icon-client.js', 'icon-model.js', 'wallpaper-client.js', 'wallpaper-model.js', 'sync-model.js', 'sync-client.js']) {
  await cp(path, `dist/${path}`);
}
await cp('assets', 'dist/assets', { recursive: true });
console.log('Built static desktop in dist/');
