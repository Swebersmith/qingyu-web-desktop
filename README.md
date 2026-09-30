# Weboss

一个轻盈的个人 Web 平板桌面，基于 [browser-start-page-v2](https://github.com/Swebersmith/browser-start-page-v2) 重新设计。App、Widget 和文件夹可以组合、拖动和保存，常用网站一键打开。

## 功能

- 四组桌面：鼠标拖动、触摸滑动、滚轮和方向键切换，自动吸附。每屏固定且不需要上下滚动；内容过多时自动续到下一张横向桌面。
- 每组默认至少 14 个 App 图标，一键打开网站；固定 Dock 支持拖入、拖出和排序，最多 12 个 App。
- 搜索框从 Dock 上方的胶囊入口连续展开为悬浮面板，关闭时收回原处，中途可反向展开；实时匹配 App、网址和搜索历史，支持 Google、Bing、百度、GitHub。
- 实时时钟、月历、可勾选和编辑的每日 Todo、每日一句、实时天气、最近访问、收藏、学习进度、继续观看和原创轻音乐播放器。
- App、Widget 和文件夹在同一张网格内拖动：落点和同尺寸交换会提前预览，松手后才保存；拖到左右边缘稍作停留可移到相邻页面。触屏长按拖动，点右上角 ✦ 进入整理模式。
- 把一个 App 拖到另一个 App 上方停留片刻可创建文件夹，也可拖入已有文件夹、从打开的文件夹拖出。支持内部排序、直接改名、选择成员和解散；整理模式拖动右下角可按网格调整文件夹大小，并预览受影响图标的位置。小文件夹显示预览，较大的文件夹可直接点击内部 App。
- App 默认根据网址自动获取网站图标；图标不可用时显示备用文字或 emoji，也可在编辑快捷方式时切换为手动图标。
- 右键编辑 App、Widget、文件夹、搜索入口和 Dock，桌面空白处提供添加和整理操作；App 还支持复制链接、移动页面、加入文件夹和删除。
- 桌面「设置」App 从图标连续展开，关闭时收回图标；可管理 App、文件夹、Widget、Dock、壁纸、天气位置和备份。
- 支持上传本地壁纸、填写图片 URL，以及 Bing 每日一图；每日壁纸加载成功后缓存，网络失败时保留上一张。
- 浏览器自动保存配置，支持 JSON 备份和导入，并兼容原项目的 `shortcuts` / `widgets` 导出结构。
- 桌面、平板与手机分别保存布局；桌面内容与固定搜索、Dock 分区显示，避免遮挡；尊重系统减少动态效果的偏好。

## 本地运行

静态构建需要 Node.js 18+。Workers 部署需要使用 Wrangler 支持的 Node.js 版本，建议 Node.js 22 或 24；网页本身没有第三方运行依赖。

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

### Cloudflare Workers

仓库已包含 `worker.js` 和 `wrangler.jsonc`。`assets.directory` 指向 `./dist`，页面资源由 Workers Static Assets 托管，Worker 入口通过 `ASSETS` 绑定处理其余请求。

在 Cloudflare 的 Workers & Pages 中导入本仓库，按以下配置部署：

| 配置项 | 值 |
| --- | --- |
| Worker 名称 | `weboss`（与 `wrangler.jsonc` 中的 `name` 一致） |
| 生产分支 | `main` |
| 构建命令 | `npm run build` |
| 部署命令 | `npm run deploy`（等价于 `wrangler deploy`） |
| 根目录 / 高级设置 → 路径 | 留空 |

不需要另填构建输出目录；`dist` 已在 Wrangler 配置里声明。部署成功后访问控制台提供的 `workers.dev` 地址。

在本地检查 Workers 构建或预览：

```bash
npm ci
npm run check
npm run check:worker
npm run dev:worker
```

`check:worker` 只进行部署构建检查，不会发布到 Cloudflare。手动发布前运行 `npx wrangler login`，随后执行 `npm run build` 和 `npm run deploy`。

### 新 D1 数据库

数据库通过 Cloudflare 控制台绑定，不需要把 Database ID 写入代码或 GitHub 仓库：

1. 在 Storage & databases → D1 SQL Database 中创建全新数据库，例如 `weboss-db`。如果已经创建，直接使用新库。
2. 部署 Worker 后，进入 Workers & Pages → `weboss` → Bindings（绑定）→ Add binding（添加绑定）。
3. 选择 D1 database，变量名称填写 **`DB`**，从列表中选择新数据库并保存。

`wrangler.jsonc` 使用 Wrangler 的 `unsafe.metadata.keep_bindings` 上传元数据配置，保留控制台已有的 D1 绑定，以及 Wrangler 默认保留的密钥类型。因此后续通过本仓库的 `npm run deploy` 部署时，不会因配置中没有数据库 ID 而移除现有 D1 绑定。首次部署尚未绑定数据库时也可以正常发布页面；该配置不会自动新建数据库。

后续 Worker 接口使用 `env.DB` 访问所绑定的数据库。**当前版本仍使用浏览器 `localStorage`，还没有 D1 读写、表结构、身份验证和云端同步接口；绑定数据库本身不会启用云端保存。**

部署配置参考 [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) 和 [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)；控制台绑定参考 [D1 绑定文档](https://developers.cloudflare.com/d1/best-practices/remote-development/)，保留绑定的上传元数据参考 [Worker 版本上传 API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/create/)。

## 自定义

打开桌面的「设置」App 或右键点击元素即可编辑。首次加载的默认数据位于 [`config.js`](./config.js)，采用 JSON 兼容的对象结构：

```js
{ id: "github", name: "GitHub", url: "https://github.com", icon: "GH", iconMode: "auto", color: "#252b3a", page: "home", category: "开发" }
```

`iconMode: "auto"` 根据 `url` 获取网站图标，`icon` 是加载失败时的备用标识；`iconMode: "custom"` 使用手动图标。手动图标可用文字、emoji，或以 `https://` 开头的图片 URL。自定义壁纸和布局保存在当前浏览器的 `localStorage` 中；跨设备迁移请在设置 → 数据中导出和导入 JSON。

文件夹保存成员 App ID 和各屏幕尺寸的大小，例如：

```js
{ id: "my-folder", name: "常用工具", page: "home", appIds: ["github", "google"], sizes: { desktop: { w: 2, h: 2 }, mobile: { w: 1, h: 1 } } }
```

大小以桌面网格为单位，位置保存在 `layout.desktop` / `layout.tablet` / `layout.mobile`；空间不足时自动增加横向桌面。拖入 Dock 会固定同一个快捷方式，原桌面或文件夹成员仍可访问；从 Dock 拖回桌面会取消固定并放到目标位置。

天气由 [Open-Meteo](https://open-meteo.com/) 提供，无需 API Key；请求失败时显示不可用状态。迷你播放器使用浏览器 Web Audio 合成三段原创旋律，不会请求外部音乐文件。

Bing 壁纸通过开源项目 [TimothyYe/bing-wallpaper](https://github.com/TimothyYe/bing-wallpaper) 的公开接口获取，图片与版权说明来自 Bing；可在外观设置中手动刷新。

## 来源与素材

项目结构与本地配置方案参考原仓库 [Swebersmith/browser-start-page-v2](https://github.com/Swebersmith/browser-start-page-v2)。新桌面界面、交互和默认配置已重新实现。`assets/sunny-town.png` 是为本项目生成的原创壁纸，不包含现成动漫角色或原仓库中的角色图片。
