# 晴屿 Desktop

一个轻盈的个人 Web 桌面，基于 [browser-start-page-v2](https://github.com/Swebersmith/browser-start-page-v2) 的静态首页思路重新设计。保留了快捷方式、Widget、本地配置与 JSON 导入导出能力，并将界面改成四页平板桌面。

## 功能

- 四页桌面：鼠标拖动、触摸滑动、滚轮和方向键切换，自动吸附。
- App 图标一键打开网站，固定 Dock 可自定义。
- 搜索面板实时匹配 App、网址和搜索历史；支持 Google、Bing、百度、GitHub。
- 实时时钟、月历、可勾选和编辑的每日 Todo、每日一句、实时天气、最近访问、收藏、学习进度、继续观看和原创轻音乐播放器。
- 整理模式拖动 App 或 Widget 排序；设置面板增删改 App、Widget、Dock、壁纸和天气位置。
- 浏览器自动保存配置，支持 JSON 备份和导入，并兼容原项目的 `shortcuts` / `widgets` 导出结构。
- 桌面、平板与手机分别排版；尊重系统减少动态效果的偏好。

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
{ id: "github", name: "GitHub", url: "https://github.com", icon: "GH", color: "#252b3a", page: "home", category: "开发" }
```

图标可用文字、emoji，或以 `https://` 开头的图片 URL。自定义壁纸和布局保存在当前浏览器的 `localStorage` 中；跨设备迁移请在设置 → 数据中导出和导入 JSON。

天气由 [Open-Meteo](https://open-meteo.com/) 提供，无需 API Key；请求失败时显示不可用状态。迷你播放器使用浏览器 Web Audio 合成三段原创旋律，不会请求外部音乐文件。

## 来源与素材

项目结构与本地配置方案参考原仓库 [Swebersmith/browser-start-page-v2](https://github.com/Swebersmith/browser-start-page-v2)。新桌面界面、交互和默认配置已重新实现。`assets/sunny-town.png` 是为本项目生成的原创壁纸，不包含现成动漫角色或原仓库中的角色图片。
