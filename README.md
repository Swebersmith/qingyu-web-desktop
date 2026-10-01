# Weboss

一个轻盈的个人 Web 平板桌面，基于 [browser-start-page-v2](https://github.com/Swebersmith/browser-start-page-v2) 重新设计。App、Widget 和文件夹可以组合、拖动和保存，常用网站一键打开。

## 功能

- 自由桌面：取消预设网站分类和按类型命名的页面；鼠标拖动、触摸滑动、滚轮和方向键切换，自动吸附。每屏固定且不需要上下滚动；内容过多时自动续到下一张横向桌面。空桌面和空的续屏自动移除，全部为空时保留一张可用桌面。
- 默认内置丰富的 App 快捷方式，一键打开网站；固定 Dock 支持拖入、拖出和排序，最多 12 个 App。加入 Dock 后从桌面和文件夹移除，移出 Dock 则放回当前桌面，不重复显示。
- 搜索框从 Dock 上方的胶囊入口连续展开为悬浮面板，关闭时收回原处，中途可反向展开；实时匹配 App、网址和搜索历史，支持 Google、Bing、百度、GitHub。
- 小组件单击展开为详情窗口，关闭时连续收回原卡片：世界时钟、可翻月份的月历、完整 Todo 和添加任务、七天天气及体感/湿度/风速、可保存实际计数的学习进度、最长 4000 字便签、完整最近访问和收藏列表、观看列表添加内容、轻音乐播放列表和文案选取。卡片内的勾选、播放和网站链接仍可直接操作。
- App、Widget 和文件夹在同一张网格内拖动：落点和同尺寸交换会提前预览，松手后才保存；拖到左右边缘稍作停留可移到相邻页面。在最后一屏的右边缘停留会预览新桌面，松手后保存，取消拖动不会留下空页。动态桌面列表随 JSON 一起备份和恢复。触屏长按拖动，点右上角「布置」进入整理模式。桌面不显示页面名称，使用分页圆点定位。
- 把一个 App 拖到另一个 App 上方停留片刻可创建文件夹，也可拖入已有文件夹、从打开的文件夹拖出。文件夹只剩一个 App 时自动解散，剩余 App 接替文件夹的位置；空文件夹自动移除。支持内部排序、直接改名、选择成员和解散；右键一键选择小、大、宽、超大尺寸，也可直接拖右下角调整，预览受影响图标的位置。触屏长按文件夹显示菜单和调整边缘。大文件夹按实际宽高显示完整 App 格子，可一键打开；多余 App 通过最后一个叠放入口访问，避免半排图标被裁掉。
- 批量整理：顶部「整理 → 批量整理」、App 右键菜单、文件夹中的「多选」和设置均可进入。支持跨桌面多选、全选筛选结果、合并新文件夹、移入已有文件夹、移到桌面、加入或移出 Dock、批量删除；操作后可撤销，已有其他桌面修改时不会强行覆盖。
- AI 自动整理：顶部「整理」打开，与批量工具合并在同一面板，选择范围后生成可编辑的文件夹预览，再决定是否应用。可改名、移除成员、取消某组、修改目标桌面；只有确定后才保存。已在文件夹中的 App 默认不参与，相同名称和目标桌面的文件夹会合并。
- App 图标依次尝试根目录 favicon、网页声明的图标路径和第三方缓存。都不可用时自动使用 Workers AI 设计的 SVG 备用图标；未绑定 AI 或服务不可用时显示独立的本地备用图标。可右键重新获取或主动生成 AI 图标，也可手动设置。
- 右键编辑 App、Widget、文件夹、搜索入口和 Dock，桌面空白处提供添加和整理操作；App 还支持复制链接、移动页面、加入文件夹和删除。
- 桌面「设置」App 从图标连续展开，关闭时收回图标；可管理 App、文件夹、Widget、Dock、壁纸、天气位置和备份。
- 支持上传本地壁纸、填写图片 URL，以及 Bing 每日一图；每日壁纸加载成功后缓存，网络失败时保留上一张。
- 浏览器自动保存配置，支持 JSON 备份和导入，兼容旧版快捷方式数组，以及原项目的 `shortcuts` / `widgets` 导出结构。快捷方式数组去重追加，完整桌面备份恢复布局。
- 跨设备云同步：设置中的「云同步」或右上角 ☁ 进入。同步 App、文件夹、小组件、Dock、Todo、壁纸和各尺寸布局；离线继续保存，联网后自动同步。不同内容的并发修改自动合并，同一处的冲突由用户选择版本；接入云桌面及应用远程更新前保留最近三份本机恢复备份。
- 桌面、平板与手机分别保存布局；桌面内容与固定搜索、Dock 分区显示，避免遮挡；所有面板隐藏滚动条，仍可滚轮和触摸滚动；尊重系统减少动态效果的偏好。
- 删除确认显示在目标 App 旁边，支持取消、确认、Esc 和点击外部关闭；编辑窗口和批量删除使用同样的浮层。切换搜索引擎不重建历史图标，文件夹开关复用 App / 图片节点。拖入文件夹会先预览目标格子，释放时图标缩小落位，并保留原文件夹节点。

## 本地运行

静态构建需要 Node.js 18+。Workers 部署需要使用 Wrangler 支持的 Node.js 版本，建议 Node.js 22 或 24；网页本身没有第三方运行依赖。

```bash
npm run dev
```

访问 `http://localhost:4173`。页面使用原生 ES modules，请通过本地服务器或部署地址访问。天气、壁纸和云端 AI 等在线功能需要网络；本地预览未连接 Workers AI 时，自动整理会使用本地规则并显示来源。

## 构建与部署

```bash
npm run check
npm test
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

`wrangler.jsonc` 使用 Wrangler 的 `unsafe.metadata.keep_bindings` 上传元数据配置，保留控制台已有的 D1 / Workers AI 绑定，以及 Wrangler 默认保留的密钥类型。因此后续通过本仓库的 `npm run deploy` 部署时，不会因配置中没有数据库 ID 而移除现有 D1 绑定。首次部署尚未绑定数据库时也可以正常发布页面；该配置不会自动新建数据库。

Worker 的云同步接口通过 `env.DB` 读写数据库。首次同步请求会自动建立 `weboss_desktops` 表，不需要手动执行 SQL；[`schema.sql`](./schema.sql) 提供相同表结构以便检查。现有数据库中的其他表不会受影响。数据库 ID 仍只在控制台绑定，不写入仓库。

### 启用内容和界面同步

1. 部署最新代码，确保 D1 已通过变量 **`DB`** 绑定到 Worker。
2. 在已有桌面的设备上打开右上角 ☁ 或「设置 → 云同步」。可以输入 **12～128 个字符的自定义密钥**（支持中文），或留空自动生成，再选择 **创建云桌面**。
3. 在其他设备打开同一 Workers 网站，输入相同的自定义密钥，或通过 **复制密钥** 获得的设备连接码，选择 **连接并使用云桌面**。接入前的本机桌面会自动备份。
4. 之后编辑内容或拖动位置会自动上传；页面显示时约每 12 秒检查远程更新，恢复网络或切回页面时也会检查。正在拖动、编辑 App 或批量整理时会延后拉取。右上角指示灯及同步面板显示状态，也可点击 **立即同步**。

桌面、平板和手机的 `layout` 各自保存并同步，不强制把 PC 网格缩小到手机。同步范围包含快捷方式、页面、文件夹成员及尺寸、Widget、Todo、历史、Dock、搜索偏好、天气城市和壁纸；当前打开的窗口、搜索输入和播放状态留在各设备。自定义壁纸随配置同步，单份配置最多 1 MB；较大的图片可改用壁纸 URL。

自动密钥由 256 位安全随机数生成；自定义密钥在浏览器内经过 Unicode NFC 规范化及 PBKDF2-SHA-256（210,000 次迭代、固定应用盐）生成相同格式的设备连接码。自定义密钥原文不保存或发送，浏览器单独保存连接码，服务器仅保存其 SHA-256 摘要；两者都不出现在 URL、普通桌面 JSON 备份或日志中。拥有相同密钥或连接码的设备共享同一桌面；不同密钥的数据隔离。此版本未提供账号登录或端到端加密，桌面内容以 JSON 保存于你绑定的 D1。断开仅移除本机连接，不删除云端或当前本机数据。

已连接后可展开 **更换自定义密钥**。完成同步后，服务器通过带版本条件的原子更新迁移云桌面的凭据，保留内容和布局，并让旧密钥失效；不会覆盖已使用该新密钥的其他桌面。其他设备需要输入新密钥重新连接。

云端采用递增版本号及带版本条件的 SQL 更新，防止并发覆盖。客户端使用上次已同步版本进行三方合并：独立改动自动合并，同一字段的不同修改、删除与编辑、矛盾的文件夹归属会暂停写入。冲突面板可下载两个版本、使用云端或保留本机；被替换版本自动备份。同步记录和最近三份恢复备份保存在本机 IndexedDB，密钥单独保存在本机浏览器存储中，清除浏览器数据后需重新输入密钥。

`GET /api/sync/status` 检查绑定状态；`GET /api/sync` 拉取、`PUT /api/sync` 保存及 `POST /api/sync/key` 更换凭据均要求 `Authorization: Bearer <设备连接码>`，响应禁止缓存，写入校验配置结构、大小和版本号。`SYNC_LIMITER` 按访问 IP / Cloudflare 服务位置限制每分钟 60 次同步请求；该计数不是全局限额。静态 Pages 或普通静态预览继续支持本地保存，云同步需要 Workers API。

实现依据 [D1 参数化查询](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)、[D1 一致性与 Sessions API](https://developers.cloudflare.com/d1/worker-api/d1-database/)、[D1 限制](https://developers.cloudflare.com/d1/platform/limits/) 和 [Workers Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)。

部署配置参考 [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) 和 [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)；控制台绑定参考 [D1 绑定文档](https://developers.cloudflare.com/d1/best-practices/remote-development/)，保留绑定的上传元数据参考 [Worker 版本上传 API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/create/)。

### 启用云端 AI 整理

部署最新代码后，在 Cloudflare → Workers & Pages → `weboss` → 绑定 → 添加绑定中，选择 **Workers AI**，变量名称填 **`AI`** 并保存。无需把账号 ID 或 API Key 写进前端或仓库；D1 绑定与 AI 整理独立。

「生成整理预览」会调用同源 `POST /api/organize`，使用 Workers AI 的 `@cf/meta/llama-3.3-70b-instruct-fp8-fast`。可以输入整理偏好，如「学习和开发分开」。模型综合名称、精确域名、用途路径及已有文件夹，区分同一平台的不同服务，输出简短分组理由；低于 0.72 的模型自评把握会被过滤（这个数值不是统计准确率）。只发送所选 App 的名称、域名、经过白名单筛选的语义路径段、已有文件夹名称及填写的偏好，不发送私有路径段、URL 参数、历史记录、Todo 或壁纸。Worker 限制请求大小及 App 数量（每次 2～120 个），校验结果中的 App ID、去重，并通过 `AI_LIMITER` 限制每个 Cloudflare 服务位置每分钟 6 次推理请求；这不是全局用量上限。Workers AI 的实际用量和计费以 Cloudflare 控制台为准。

未绑定 AI、网络超时、服务失败或超过 120 个 App 时，界面自动改用本地加权规则，并明确显示「本地智能整理」。本地规则优先匹配真实域名和子服务，再判断名称及用途路径，避免假域名的子串匹配；不能理解任意自然语言偏好。不认识的站点、判断冲突及单个 App 保持原位；AI 建议空列表时不会被本地规则重新强制归组。所有整理均先预览，再由用户应用。参考 [Workers AI 绑定](https://developers.cloudflare.com/workers-ai/configuration/bindings/) 和 [JSON Mode](https://developers.cloudflare.com/workers-ai/features/json-mode/)。

### 图标获取与 AI 备用图标

网站不一定把 Logo 放在 `/favicon.ico`：部分使用 HTML 声明的 PNG / SVG / Apple 图标路径，部分限制外部访问，第三方缓存也可能缺失或在当前网络不可达。新版会补查公开网页中的图标声明，再尝试第三方缓存；成功结果在本机缓存，多个位置共享正在进行的请求。

都失败时，`POST /api/icon` 使用同一个 **`AI`** 绑定与 Llama 模型，根据网站名称及域名选择语义图形、配色和名称角标，组合成清晰的 SVG 备用图标。这是独立的图标设计，来源标注为 AI；它不会声称恢复了官网 Logo。只发送名称和域名，URL 路径、查询参数、密码及片段不发送；私有地址用 `private-site` 替代域名。服务不可用时保留明确标注的本地备用设计。

通过现有 **`DB`** 绑定可共享缓存 AI 设计，首次自动建立 `weboss_site_icons` 表，无需修改数据库 ID 或手动迁移。网站图标缓存 7 天、AI 设计缓存 30 天；图标缓存独立于桌面 JSON。右键「重新获取图标」或「生成 AI 备用图标」可主动更新。`ICON_AI_LIMITER` 在每个 Cloudflare 服务位置限制每分钟 12 次生成；达到限额时先显示本地图标，仍在页面中的图标稍后重试。`ICON_LOOKUP_LIMITER` 按 IP / Cloudflare 服务位置限制每分钟 60 次网页图标查询；两者都不是全局计数。静态预览不提供 Worker 的网页查询和 AI API，仍支持直接获取及本地备用图标。实现参考 [Llama 模型](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/) 和 [Workers AI JSON Mode](https://developers.cloudflare.com/workers-ai/features/json-mode/)。

## 自定义

打开桌面的「设置」App 或右键点击元素即可编辑。首次加载的默认数据位于 [`config.js`](./config.js)，采用 JSON 兼容的对象结构：

```js
{ id: "github", name: "GitHub", url: "https://github.com", icon: "GH", iconMode: "auto", color: "#252b3a", page: "home" }
```

`iconMode: "auto"` 根据 `url` 获取网站图标，`icon` 是加载失败时的备用标识；`iconMode: "custom"` 使用手动图标。手动图标可用文字、emoji，或以 `https://` 开头的图片 URL。自定义壁纸和布局保存在当前浏览器的 `localStorage` 中；跨设备迁移请在设置 → 数据中导出和导入 JSON。

文件夹保存成员 App ID 和各屏幕尺寸的大小，例如：

```js
{ id: "my-folder", name: "常用工具", page: "home", appIds: ["github", "google"], sizes: { desktop: { w: 2, h: 2 }, mobile: { w: 1, h: 1 } } }
```

大小以桌面网格为单位，位置保存在 `layout.desktop` / `layout.tablet` / `layout.mobile`；空间不足时自动增加横向续屏。`pages` 保存实际桌面列表，清空后自动删除；拖到最后一屏右边缘可新增桌面。拖入 Dock 后，快捷方式只在 Dock 显示；从 Dock 拖回桌面会取消固定并放到目标位置。

点击文件夹的标题、图标或空白处即可打开；大文件夹中可见的 App 仍然一键打开网站。打开后焦点停在标题，不会弹出改名输入框或手机键盘；点击「重命名」再编辑，Enter 或点到其他地方保存，Esc 取消当前改名。

文件夹内部支持跟手横向滑动、松手吸附、分页圆点、鼠标滚轮与方向键；鼠标可以拖动空白处翻页，触屏长按 App 后仍可排序或拖出。翻页与重复开关复用 App 节点和图标。长名称最多显示两行，完整名称保留在链接提示和右键菜单中。设置窗口根据自身宽度调整布局，小窗口将每条快捷方式的操作按钮放在记录下方，保留完整的编辑和排序入口。

### 导入旧快捷方式

在 **设置 → 数据 → 导入 JSON / 旧快捷方式** 选择文件，支持以下结构：

```json
[
  { "id": "my-app", "name": "示例网站", "url": "https://example.org/", "category": "旧分类", "color": "#6c9ca4", "pinned": true, "icon": "", "order": 0 }
]
```

也支持 `{ "shortcuts": [...], "widgets": [...] }` 和 `{ "apps": [...] }`。旧快捷方式按 `order` 稳定排序，按完整 URL 去重后追加到当前桌面，保留名称、颜色和手动图标；空图标自动获取。`pinned` 放入 Dock，Dock 超过 12 个时其余置顶保存在收藏。已有 App 的手动编辑不会被同网址的旧记录覆盖，现有壁纸、小组件、文件夹和布局保留；旧 `category` 不生成分类页面，可之后用 AI 或批量整理建立文件夹。包含 `apps` 和 `pages` 的 Weboss 完整备份则恢复整份桌面。导入支持不超过 1 MB 的 JSON；连接云桌面时导入内容也会同步。

学习进度小组件使用 `{ "value": 2, "total": 10, "unit": "章节" }` 的 `progress` 字段，完成率从数量计算；小组件内容和新计数随 JSON 备份及云同步保存。

天气由 [Open-Meteo](https://open-meteo.com/) 提供，无需 API Key；请求失败时显示不可用状态。迷你播放器使用浏览器 Web Audio 合成三段原创旋律，不会请求外部音乐文件。

Bing 壁纸通过同源 `GET /api/wallpaper/bing` 获取元数据，Worker 依次尝试 Bing 官方的 `cn.bing.com` 与 `www.bing.com` 接口；图片通过同源 `/api/wallpaper/bing/image?id=...` 加载，浏览器无需连接原来的第三方域名或跨域获取 JSON。元数据缓存 30 分钟、固定图片缓存一天，失败时保留上一张；设置 → 外观可手动刷新。JSON 和云同步只保存官方图片地址、日期及版权，各设备根据自己的站点地址加载图片。图片接口仅接受 Bing 的固定图片 ID，拒绝任意网址、私有地址及非图片响应；`WALLPAPER_LIMITER` 按 IP / Cloudflare 服务位置限制每分钟 30 次请求。此功能无需新增数据库、AI 绑定或 API Key，本地 `npm run dev` 也使用同一代理。公开 Bing 接口没有可用性保证，站点自身须能在当前网络下访问。图片与版权来自 [Bing 官方壁纸接口](https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN)，缓存方式参考 [Workers fetch 缓存](https://developers.cloudflare.com/workers/examples/cache-using-fetch/)。

## 来源与素材

项目结构与本地配置方案参考原仓库 [Swebersmith/browser-start-page-v2](https://github.com/Swebersmith/browser-start-page-v2)。新桌面界面、交互和默认配置已重新实现。`assets/sunny-town.png` 是为本项目生成的原创壁纸，不包含现成动漫角色或原仓库中的角色图片。
