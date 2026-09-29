# 晴屿 Desktop

一个轻盈的个人 Web 桌面，基于 [browser-start-page-v2](https://github.com/Swebersmith/browser-start-page-v2) 的静态首页思路重新设计。保留了快捷方式、Widget、本地配置与 JSON 导入导出能力，并将界面改成四页平板桌面。

## 功能

- 四组桌面：鼠标拖动、触摸滑动、滚轮和方向键切换，自动吸附。每屏固定且不需要上下滚动；内容过多时自动续到下一张横向桌面。
- 每页默认 14 个 App 图标，一键打开网站；固定 Dock 可直接拖动排序。
- 搜索框从 Dock 上方的胶囊形入口向上展开为悬浮面板，实时匹配 App、网址和搜索历史；支持 Google、Bing、百度、GitHub。
- 实时时钟、月历、可勾选和编辑的每日 Todo、每日一句、实时天气、最近访问、收藏、学习进度、继续观看和原创轻音乐播放器。
- App 和 Widget 在同一张桌面网格内自由拖动：拖动时预览落点，同尺寸卡片平滑让位，松手后才保存位置，不会让整页突然重排；拖到左右边缘稍作停留可移到相邻页面。触屏长按拖动，点右上角 ✦ 可进入整理模式。
- App 默认根据网址自动获取网站图标；图标不可用时显示备用文字或 emoji，也可在编辑快捷方式时切换为手动图标。
- 右键点击 App 图标或 Dock 图标，可打开、编辑、复制链接、移动页面、加入或移出 Dock，以及删除快捷方式。
- 设置面板增删改 App、Widget、Dock、壁纸和天气位置。
- 浏览器自动保存配置，支持 JSON 备份和导入，并兼容原项目的 `shortcuts` / `widgets` 导出结构。
- 桌面、平板与手机分别保存布局；桌面内容与固定搜索、Dock 分区显示，避免遮挡；尊重系统减少动态效果的偏好。

## 本地运行

需要 Node.js 18+，没有第三方运行依赖。

```bash
npm run dev
```

访问 `http://localhost:4173`。也可以直接打开 `index.html`；此时天气等在线功能仍需要网络。

## 构建与部署

```bash
npm run check
npm run build
```

`dist/` 是可直接部署到 GitHub Pages、Cloudflare Pages、Vercel 或任意静态服务器的目录。GitHub Pages 也可直接发布仓库根目录。

## 自定义

直接在网页右上角的设置中编辑。首次加载的默认桌面数据位于 [`config.js`](./config.js)，采用 JSON 兼容的对象结构：

```js
{ id: "github", name: "GitHub", url: "https://github.com", icon: "GH", iconMode: "auto", color: "#252b3a", page: "home", category: "开发" }
```

`iconMode: "auto"` 根据 `url` 获取网站图标，`icon` 是加载失败时的备用标识；`iconMode: "custom"` 使用手动图标。手动图标可用文字、emoji，或以 `https://` 开头的图片 URL。自定义壁纸和布局保存在当前浏览器的 `localStorage` 中；跨设备迁移请在设置 → 数据中导出和导入 JSON。

天气由 [Open-Meteo](https://open-meteo.com/) 提供，无需 API Key；请求失败时显示不可用状态。迷你播放器使用浏览器 Web Audio 合成三段原创旋律，不会请求外部音乐文件。

## 来源与素材

项目结构与本地配置方案参考原仓库 [Swebersmith/browser-start-page-v2](https://github.com/Swebersmith/browser-start-page-v2)。新桌面界面、交互和默认配置已重新实现。`assets/sunny-town.png` 是为本项目生成的原创壁纸，不包含现成动漫角色或原仓库中的角色图片。
