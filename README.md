# 五大人格访谈计划

一个无需前端框架即可运行的中文单页应用。默认使用 mock provider，包含一次性访问码、服务端会话、每日签发上限与每会话题数上限。

## 运行

1. 安装 Node.js 20 或更高版本。
2. 复制 `.env.example` 为 `.env`。
3. 运行 `npm run secrets`，从三个随机管理员密码中任选一个，并把生成的 `SESSION_SECRET` 塭入 `.env`。
4. 运行 `npm start`。
5. 打开 `http://localhost:3000`。每天前 10 位新用户可自动领取专属访问码。

项目不依赖第三方 npm 包，因此无需 `npm install`。

## 访问码与费用保护

- 不需要管理员生成密码；默认每天最多 10 位新用户，以 Asia/Singapore 日期为准。
- 用户点击领取名额时自动获得专属码；访问码只保存 SHA-256 摘要，明文只在领取时显示。
- 同一个码可反复登录，但只对应同一个访谈和报告，不会创建新的免费会话。
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
│  ├─ provider.js       # mock / DeepLake 接口层
│  ├─ prompt.js         # Big Five 判定、追问、停止、报告结构
│  └─ store.js          # 一次性访问码及本地持久化
├─ scripts/
│  └─ generate-secrets.js
├─ data/                # 运行数据，不提交 GitHub
├─ .env.example
└─ package.json
```

## 部署提醒

本地 JSON 存储适合个人小流量和单实例。若部署为多实例或无状态 Serverless，应把 `server/store.js` 换成 Redis / Postgres，并使用原子操作兑换访问码，防止并发重复消费。
