# 五大人格访谈计划

一个无需前端框架即可运行的中文单页应用。默认使用 mock provider，包含一次性访问码、服务端会话、每日签发上限与每会话题数上限。

## 网页完整版本

这个仓库提交的是完整版本，不是静态展示稿：网页界面、每日名额、访问码、结果回看和服务端 DeepSeek 调用都包含在内。

GitHub 负责保存和更新代码；真正公开打开的网页需要部署成一个 Node 网站。原因是访问码和 DeepSeek Key 必须由服务端保存，不能放进任何可被浏览器下载的 HTML / JavaScript 文件。

推荐做法：在 [Render](https://render.com/) 用 GitHub 登录，选择 **New + → Blueprint**，选择本仓库。平台会自动读取 `render.yaml` 并建立完整网页服务。首次部署可先保持 `AI_PROVIDER=mock`，确认页面无误后，再到 Render 的环境变量中填写 `DEEPSEEK_API_KEY` 并把 `AI_PROVIDER` 改为 `deepseek`。这些设置不会被写回 GitHub，也不会显示给访客。

部署完成后，Render 会给出一个 `https://...onrender.com` 网页地址；把那个地址分享给访客即可。访客只会看到网页和自己的访问码，无法看到 API Key。

> GitHub Pages 只能托管静态 HTML，不能安全保存 API Key，也无法可靠保存每日十个名额及访问码。因此它不适合本项目的完整版本。

## 本地运行

1. 安装 Node.js 20 或更高版本。
2. 复制 `.env.example` 为 `.env`。
3. 运行 `npm run secrets`，从三个随机密钥中任选一个，并把生成的 `SESSION_SECRET` 填入 `.env`。
4. 运行 `npm start`。
5. 打开 `http://localhost:3000`。每天前 10 位新用户可自动领取专属访问码。

项目不依赖第三方 npm 包，因此无需 `npm install`。

## 访问码与费用保护

- 不需要管理员生成密码；默认每天最多 10 位新用户，以 Asia/Singapore 日期为准。
- 用户点击领取名额时自动获得专属码；访问码只保存 SHA-256 摘要，明文只在领取时显示。
- 同一个码可反复登录，但只对应同一个访谈和报告，不会创建新的免费会话；默认可回看十年。
- 登录后使用 HttpOnly 会话 Cookie，浏览器脚本无法读取会话凭证。
- 每个会话最多 66 个访谈回合；信息充分时会提前结束。可在 `.env` 调低 `MAX_TURNS_PER_SESSION`。
- `data/store.json` 保存签发记录和访谈上下文，已被 `.gitignore` 排除。

这能控制普通分享场景下的滥用，但公开部署时仍建议在反向代理或云平台增加 IP 速率限制和总预算告警。

## 接入 DeepSeek API

服务端接口层位于 `server/provider.js`，使用 DeepSeek 官方 OpenAI 兼容的 `/chat/completions` 接口：

```env
AI_PROVIDER=deepseek
DEEPSEEK_API_BASE_URL=https://api.deepseek.com
DEEPSEEK_API_KEY=你的密钥
DEEPSEEK_MODEL=deepseek-v4-flash
```

真实 Key 绝不能写进 `public/` 目录或前端环境变量。若希望提高报告质量，可以把模型改成 `deepseek-v4-pro`，但成本会更高。

## 目录

```text
bigfive-interview/
├─ public/              # 单页界面
│  ├─ index.html
│  ├─ styles.css
│  └─ app.js
├─ server/
│  ├─ index.js          # HTTP、认证与会话 API
│  ├─ provider.js       # mock / DeepSeek 接口层
│  ├─ prompt.js         # Big Five 判定、追问、停止、报告结构
│  └─ store.js          # 一次性访问码及本地持久化
├─ scripts/
│  └─ generate-secrets.js
├─ data/                # 运行数据，不提交 GitHub
├─ .env.example
└─ package.json
```

## 部署与数据保存

当前 `data/store.json` 适合个人小流量、单个网站实例。Render 的完整部署请为服务挂载持久化磁盘到 `/opt/render/project/src/data`，这样访问码和结果会在重启后保留。若未来访问量提高或需要多实例，再把 `server/store.js` 换成 Redis / Postgres，并使用原子操作兑换访问码，防止并发重复消费。
