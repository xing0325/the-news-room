# the news room v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 上线《the news room》v1——3 报社 9 职员的多 agent 新闻模拟世界，每日早晚两刊报道唯一主角（用户），全免费额度运行。

**Architecture:** 三件套拼接：GitHub Pages 托管 Next.js 静态前端（客户端 Supabase 读写）；Supabase Postgres 存全部世界状态（RLS 保护）；GitHub Actions cron 每日两次运行 Node 管线脚本（engine/），按 spec §3 七步流程调 DeepSeek 生成整期报纸并更新世界状态。cron 即刊期。

**Tech Stack:** Next.js(static export, basePath=/the-news-room) · @supabase/supabase-js v2 · Node 20 ESM(engine, 零框架) · vitest · DeepSeek chat API(主) + StepFun step-3.7-flash(兜底, api.stepfun.ai, max_tokens≥1400) · GitHub Actions

**Spec:** `docs/superpowers/specs/2026-07-06-the-news-room-design.md`

> **⚠️ 2026-07-06 执行期架构转向（Task 0 实测驱动，spec §5/§6 已同步修订）：**
> Supabase 出局——`*.supabase.co` 国内直连/双代理口均被墙，疑似 HK 区 pooler 也被掐，且无 access token 开新项目。全栈改 **Netlify 单站点**：静态前端 + Functions（登录=口令→HMAC cookie；数据 API 读 Blobs；用户行为写 append-only 事件）+ **Netlify Blobs 存世界状态**（布局见 spec §5），tick 仍在 GitHub Actions（经 NETLIFY_AUTH_TOKEN+SITE_ID 外部读写 Blobs）。
> 映射变化：Task 2 的 schema.sql/seed.sql → `engine/src/store.js`（blobs 适配层）+ `engine/src/seed.js`；Task 7 的 supabase 客户端 → `netlify/functions/*` + 前端 fetch('/api/*')；Task 10 secrets 改为 NETLIFY_AUTH_TOKEN / NETLIFY_SITE_ID / DEEPSEEK_API_KEY / STEPFUN_API_KEY。
> 站点：https://the-news-room-chichu.netlify.app （site_id 2e739c68-cb83-429b-b0f4-4dbb9e2f95a9）

---

## File Structure

```
the-news-room/
├── supabase/
│   ├── schema.sql            # 全部表 + RLS（Task 2）
│   └── seed.sql              # 3 报社 + 9 职员人格档案（Task 2）
├── engine/                   # 刊期 tick（GitHub Actions 里跑）
│   ├── package.json          # type:module; deps: @supabase/supabase-js; dev: vitest
│   ├── src/
│   │   ├── llm.js            # DeepSeek 客户端 + StepFun 兜底 + JSON 提取 + 调用预算保险丝
│   │   ├── db.js             # service-role supabase 客户端 + 查询helpers
│   │   ├── world.js          # 状态更新规则（纯函数）+ 落库
│   │   ├── prompts.js        # 全部 prompt 构造器（世界的灵魂）
│   │   ├── pipeline.js       # runEdition(): spec §3 七步编排
│   │   └── tick.js           # 入口：node src/tick.js
│   └── test/
│       ├── world.test.js
│       ├── llm.test.js
│       └── pipeline.test.js  # mock llm 跑通编排（正常日+慢新闻日）
├── web/                      # Next.js 前端
│   ├── next.config.mjs       # output:'export', basePath:'/the-news-room', images.unoptimized
│   ├── src/lib/supabase.js   # 浏览器端 anon 客户端
│   ├── src/lib/format.js     # 期号/日期格式化
│   └── src/app/
│       ├── layout.js + globals.css   # 报纸设计系统（frontend-design skill 出活）
│       ├── page.js           # 当期报纸（头版+分版瀑布流）
│       ├── login/page.js
│       ├── edition/page.js   # /edition?no=N 往期单期
│       ├── archive/page.js   # 往期列表
│       ├── article/page.js   # /article?id=uuid 文章页（事实层引用+这不准+已读上报）
│       ├── newsroom/page.js  # 编辑部后台（选题会/内部日志/员工卡/榜单）
│       └── desk/page.js      # 输入台（日记+待答采访+我的事件流&传记预览）
├── .github/workflows/
│   ├── tick.yml              # cron 23:30/11:30 UTC + workflow_dispatch
│   └── deploy.yml            # push main → Pages
└── README.md
```

## 环境与密钥

| 名称 | 用途 | 存放 |
|---|---|---|
| SUPABASE_URL | 两端 | Actions secret + engine/.env + web 构建变量(NEXT_PUBLIC_SUPABASE_URL) |
| SUPABASE_SERVICE_KEY | engine 绕 RLS | Actions secret + engine/.env（**绝不进 web**） |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | web | Actions variable + web/.env.local |
| DEEPSEEK_API_KEY | 主力出稿 | Actions secret + engine/.env（本地从 odysseus/gaoyou 工程翻找现成 key） |
| STEPFUN_API_KEY | 兜底 | 同上（memory: stepfun_api_credentials.md，端点必须 api.stepfun.ai） |

`.gitignore`: `**/.env*`, `node_modules/`, `web/out/`, `.next/`。仓库 public（Pages 免费），数据全在 Supabase，代码无隐私。

---

### Task 0: 凭据与 Supabase 项目开通

**Files:** Create: `engine/.env`, `web/.env.local`（均 gitignored）

- [ ] **Step 0.1 找 DeepSeek key**：依次翻 `C:\Users\david\odysseus`（.env*）、`C:\Users\david\Documents\Codex\2026-06-20\wo-yo\work\netlify-preview`（.env / netlify env:list）、qiantaici 工程；grep 模式 `sk-[a-f0-9]{32}` + "deepseek"。找到即用；找不到→问用户要（真阻塞）。
- [ ] **Step 0.2 读 StepFun key**：`C:\Users\david\.claude\projects\C--Users-david\memory\stepfun_api_credentials.md`。
- [ ] **Step 0.3 Supabase 项目**：优先 A 路：找 access token（`~/.supabase/access-token` 或 `%APPDATA%\supabase\`）→ Management API `GET /v1/organizations` → `POST /v1/projects`（region=ap-northeast-1，db_pass 随机生成并存 engine/.env 注释）→ 轮询 ACTIVE_HEALTHY → `GET /v1/projects/{ref}/api-keys` 拿 anon/service。B 路（无 token）：请用户在 dashboard 建项目并贴 URL+两把 key——唯一允许问用户的点。
- [ ] **Step 0.4 建用户**：service key 调 `POST {SUPABASE_URL}/auth/v1/admin/users`，email=lixon0325@gmail.com，密码随机生成后**告诉用户**，email_confirm:true。
- [ ] **Step 0.5 写两份 .env**，`git status` 确认未被跟踪。

### Task 1: 仓库脚手架 + 远端

- [ ] **Step 1.1** `engine/package.json`（type:module, scripts: test=vitest run, tick=node src/tick.js; deps @supabase/supabase-js@^2, devDeps vitest）+ `npm install`。
- [ ] **Step 1.2** `npx create-next-app@latest web`（app router, no TS, no tailwind——设计系统手写 CSS，报纸感需要完全控制）；next.config.mjs 设 `output:'export'`, `basePath:'/the-news-room'`, `images:{unoptimized:true}`, `trailingSlash:true`。
- [ ] **Step 1.3** 根 `.gitignore` + README 骨架；commit "chore: scaffold engine + web"。
- [ ] **Step 1.4** `gh repo create xing0325/the-news-room --public --source . --push`。

### Task 2: Schema + 种子世界

**Files:** Create: `supabase/schema.sql`, `supabase/seed.sql`

- [ ] **Step 2.1 写 schema.sql**（完整）：

```sql
create table agencies (
  id text primary key,
  name text not null,
  charter text not null,
  style text not null,
  state jsonb not null default '{}'::jsonb
);
create table agents (
  id text primary key,
  agency_id text not null references agencies(id),
  name text not null,
  role text not null,
  persona jsonb not null,
  state jsonb not null default '{}'::jsonb,
  status text not null default 'active'
);
create table events (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'diary',
  raw_text text not null,
  wire_copy text,
  scores jsonb,
  entities jsonb,
  legacy_note text,
  edition_id bigint,
  created_at timestamptz not null default now()
);
create table editions (
  id bigint generated always as identity primary key,
  no int not null,
  label text not null,
  published_at timestamptz not null default now(),
  front_article_id uuid
);
create table articles (
  id uuid primary key default gen_random_uuid(),
  edition_id bigint references editions(id),
  agency_id text references agencies(id),
  author_agent_id text references agents(id),
  col text not null,
  headline text not null,
  body text not null,
  fact_refs jsonb not null default '[]'::jsonb,
  status text not null default 'published',
  review_note text,
  user_read_at timestamptz,
  user_flag text,
  user_flag_handled boolean not null default false,
  created_at timestamptz not null default now()
);
create table meeting_logs (
  id bigint generated always as identity primary key,
  edition_id bigint,
  agency_id text,
  kind text not null,
  transcript text not null,
  created_at timestamptz not null default now()
);
create table agent_memories (
  id bigint generated always as identity primary key,
  agent_id text not null references agents(id),
  kind text not null,
  content text not null,
  edition_id bigint,
  created_at timestamptz not null default now()
);
create table archive_cards (
  id bigint generated always as identity primary key,
  kind text not null,
  name text not null,
  first_seen timestamptz not null default now(),
  mentions int not null default 1,
  bio_note text,
  unique(kind, name)
);
create table interview_questions (
  id bigint generated always as identity primary key,
  asked_by text references agents(id),
  question text not null,
  status text not null default 'open',
  answer_event_id uuid,
  edition_id bigint,
  created_at timestamptz not null default now()
);
create table world_log (
  id bigint generated always as identity primary key,
  edition_id bigint,
  entry text not null,
  created_at timestamptz not null default now()
);

alter table agencies enable row level security;
alter table agents enable row level security;
alter table events enable row level security;
alter table editions enable row level security;
alter table articles enable row level security;
alter table meeting_logs enable row level security;
alter table agent_memories enable row level security;
alter table archive_cards enable row level security;
alter table interview_questions enable row level security;
alter table world_log enable row level security;

-- 单用户站：登录即可读全部
create policy r_agencies on agencies for select to authenticated using (true);
create policy r_agents on agents for select to authenticated using (true);
create policy r_events on events for select to authenticated using (true);
create policy r_editions on editions for select to authenticated using (true);
create policy r_articles on articles for select to authenticated using (true);
create policy r_meetings on meeting_logs for select to authenticated using (true);
create policy r_memories on agent_memories for select to authenticated using (true);
create policy r_archive on archive_cards for select to authenticated using (true);
create policy r_interviews on interview_questions for select to authenticated using (true);
create policy r_worldlog on world_log for select to authenticated using (true);
-- 用户可写的面
create policy w_events on events for insert to authenticated with check (type in ('diary','interview_answer','presser'));
create policy u_articles on articles for update to authenticated using (true) with check (true);
create policy u_interviews on interview_questions for update to authenticated using (true) with check (true);
create policy u_agencies on agencies for update to authenticated using (true) with check (true); -- 订阅开关
```

- [ ] **Step 2.2 写 seed.sql**：3 agencies（daily/midnight/biography，含 charter/style/state{声望:50,财务:50,标题党倾向,严厉度}）+ 9 agents，persona 按 spec §2.1 写全（性格/文风/擅长/缺点/口头禅），state 全员 {心情:60,压力:40,自信:55,声望:50,野心:50}，武震惊野心 70、周小满野心 80 压力 55、老周严厉度体现在 agency.state。
- [ ] **Step 2.3 应用**：Management API `POST /v1/projects/{ref}/database/query` 分别执行两文件（B 路：给用户 SQL Editor 粘贴说明）。
- [ ] **Step 2.4 验证**：REST 直查 `GET {url}/rest/v1/agents?select=id,name`（service key）应返回 9 行。commit。

### Task 3: engine/llm.js（TDD）

**接口**：
```js
export function makeLLM({deepseekKey, stepfunKey, budget=45, fetchImpl=fetch})
// 返回 { chat({system,user,temperature,maxTokens}), chatJSON(同参+schemaHint), calls() }
// chat: 先 DeepSeek(deepseek-chat)，网络/5xx/超时 → StepFun(step-3.7-flash, max_tokens>=1400)
// chatJSON: 要求只回 JSON；剥 ```围栏；parse 失败原文重试1次(附错误提示)；再失败 throw
// 每次调用 budget-1，<=0 throw new Error('LLM_BUDGET_EXCEEDED')
```
- [ ] **Step 3.1** 写 `test/llm.test.js`：mock fetchImpl —— ①预算耗尽抛错 ②DeepSeek 500 → 落到 StepFun 端点(断言第二次请求 url 含 api.stepfun.ai 且 max_tokens>=1400) ③chatJSON 剥围栏解析 ④首次坏 JSON→重试成功。
- [ ] **Step 3.2** 跑测试确认失败 → **Step 3.3** 实现 → **Step 3.4** 测试全绿 → **Step 3.5** commit。

### Task 4: engine/world.js 状态规则（TDD）

**纯函数**：`applyDeltas(state, deltas)`（clamp 0-100）、`decay(state)`（压力向50回归5点）、以及规则表：

| 触发 | 效果（同时写 agent_memories） |
|---|---|
| 稿件被打回 | 作者 压力+10 自信-5；核查员 声望+2；kind=被打回/批评 |
| 上头版 | 作者 声望+5 心情+10；agency 声望+3；kind=高光 |
| 当事人阅读(自上刊以来 user_read_at 新增) | 作者 心情+8；agency 财务+2/篇；kind=高光"当事人本人阅读了本文" |
| 用户标记这不准 | agency 声望-3；作者 压力+8；下刊出更正 |
| 深夜头条连续2刊零阅读 | 标题党倾向+5 |
| 每刊末尾 | 全员 decay |

- [ ] **Step 4.1** `test/world.test.js`（clamp/decay/每条规则的 delta 断言）→ 红 → 实现 → 绿 → commit。

### Task 5: engine/prompts.js

全中文。每个构造器把【人格档案+当前状态数值+履历记忆摘要(最近5条)+任务】拼进 prompt——状态必须显式写进指令（如"你当前压力值78/100，最近被打回过稿子：写得会更收敛、句子更短"）。构造器清单（输出格式全部 JSON，schemaHint 内嵌）：
1. `wirePrompt(event, recentThemes)` → `{wire_copy, scores:{news,bio,emotion,theme,turning,repeat}(0-100), entities:{人物,作品,地点,主题}, sensitive:bool}`。通讯社电头体："本社讯 …"。
2. `meetingPrompt(agency, roster, wires, archiveHints, lastPerf)` → `{transcript, decisions:[{event_id|null, column, angle, author, headline_hint}]}`。规则内嵌：sensitive 事件仅《用户日报》可接；传记社可拒报只记伏笔；无 wire 时产出慢新闻日选题（专栏/档案回顾/采访跟进）；transcript 是多角色对话正文，要有性格冲突。
3. `draftPrompt(agent, agency, assignment, factLayer, memories)` → `{headline, body}`（快讯150-250字/其余300-600/深度500-800；正文中事实与阐释可混写，但只允许引用 factLayer 里出现过的事实）。
4. `reviewPrompt.hezhen(article, factLayer)` → `{verdict:'pass'|'revise', note}`（专杀无证据断言）；`reviewPrompt.midnight(article, agencyState)` → `{headline, note}`（武震惊按标题党倾向值改标题，麦浪一句拍板）；`reviewPrompt.linzhou(article)` → `{body, note}`（自审润色）。
5. `rewritePrompt(agent, original, reviewNote)` → `{headline, body}`。
6. `backstagePrompt(realFacts)` → `{transcript}`——**只允许改写传入的真实管线事实**（谁被打回/谁抢到头版/状态变动），禁止虚构。
7. `legacyPrompt(event, relatedArchive)` → `{legacy_note, 三问:{意义,关联主题,入传记:bool}}`（林舟口吻一句"未来传记可能这样写"）。
8. `interviewPrompt(asker, recentEvents, openThemes)` → `{questions:[1-3条]}`（名人访谈腔，禁心理咨询腔）。

- [ ] **Step 5.1** 写全部构造器；`test/prompts.test.js` 断言：persona/状态数值/记忆摘要/schemaHint 均出现在产物字符串中；sensitive 规则文案存在于 meetingPrompt。→ commit。

### Task 6: pipeline.js + tick.js（先 mock 后实弹）

- [ ] **Step 6.1** `pipeline.js` 按 spec §3 编排：
```
runEdition(deps): 
  1 载入世界+未处理events
  2 每event: wirePrompt→存wire/scores/entities; upsert archive_cards(mentions++);
    repeat检测: 同主题card mentions>=5 → archiveHints 加"长期调查候选"
  3 每agency: meetingPrompt→存meeting_logs(kind=meeting)+decisions
  4 每decision: draftPrompt(被派职员)
  5 审稿: daily→hezhen(revise则rewrite一次,记review_note+状态规则); midnight→标题改造; biography→林舟自审
  6 建edition行→插articles→定头版(日报中scores.news最高,否则全场最高)→backstagePrompt(真实facts)存meeting_logs(kind=backstage)
  7 每event: legacyPrompt→存legacy_note; 状态规则结算(含阅读/flag扫描,更正稿生成)→decay→world_log流水;
    interviewPrompt(轮换提问人)→插interview_questions; 未答问题3期→expired
慢新闻日: 无events→跳2, 3中给空wire走慢新闻选题, 7只做结算+采访
```
- [ ] **Step 6.2** `test/pipeline.test.js`：注入 mock llm（canned JSON）+ 内存 db stub：断言正常日产出 ≥3 篇文章、1 头版、3 份 meeting、1 backstage、interview≥1；慢新闻日不炸且有文章；hezhen revise 路径触发 rewrite 与状态变更。→ 红 → 实现 → 绿 → commit。
- [ ] **Step 6.3** `tick.js`：读 env、按 UTC 小时定 label（>=18 早刊否则晚刊）、跑 runEdition、console 摘要退出码。
- [ ] **Step 6.4 实弹冒烟**：本地 `node src/tick.js`，事先插 1 条真日记 event（"今天把 the news room 的 spec 定稿了，决定用三家报社互相竞争"）。验证：DB 出现 edition + ≥3 articles + meeting_logs + 状态变化。人工读稿判断质量，prompt 不行就地调。commit。

### Task 7: web 脚手架 + 登录 + 输入台

- [ ] **Step 7.1** `src/lib/supabase.js`（createClient(NEXT_PUBLIC_*)；未登录跳 /login 的 useSession hook）。
- [ ] **Step 7.2** 调 frontend-design skill 定报纸设计系统（globals.css：米白纸底/墨黑/细规则线/衬线中文标题/报头 masthead）。
- [ ] **Step 7.3** `/login`（email+password → signInWithPassword）。
- [ ] **Step 7.4** `/desk`：日记输入（insert events type=diary）+ 待答采访列表（回答→insert event type=interview_answer, raw_text 前缀【回应××提问"Q"】+ update question status/answer_event_id）+ 我的事件流（含 legacy_note 未来传记预览）。
- [ ] **Step 7.5** 本地 `npm run dev` 真浏览器验证（登录→提交日记→Supabase 表可见）；commit。**给用户贴 http://localhost:端口/the-news-room/ 链接。**

### Task 8: 报纸前台

- [ ] **Step 8.1** `/`：拉最新 edition + articles 分版渲染（头版大卡+版面分组瀑布流，署名+报社徽记）。
- [ ] **Step 8.2** `/article?id=`：正文、记者卡、**事实层**（fact_refs→events.raw_text 引用块）、打开即记 user_read_at（仅首次）、"这不准"（弹一行说明→user_flag）、订阅开关（agencies.state.订阅）。
- [ ] **Step 8.3** `/archive` + `/edition?no=`。
- [ ] **Step 8.4** 真浏览器全路径验证 + commit。

### Task 9: 编辑部后台 /newsroom

- [ ] **Step 9.1** 四个 tab：选题会记录（meeting transcript 全文）、内部日志（backstage）、员工卡（数值条+近期 memories 高光）、榜单（报社声望/财务、被毙稿件、标题对比）。数据全是现成表，纯渲染。真浏览器验证 + commit。

### Task 10: 部署 + 验收实验

- [ ] **Step 10.1** `.github/workflows/deploy.yml`（checkout→setup-node→cd web && npm ci && npm run build→upload-pages-artifact(web/out)→deploy-pages；NEXT_PUBLIC_* 用 repo variables）。
- [ ] **Step 10.2** `.github/workflows/tick.yml`（cron '30 23 * * *' + '30 11 * * *' + workflow_dispatch；cd engine && npm ci && node src/tick.js；secrets 四件）。
- [ ] **Step 10.3** `gh secret set` ×4、`gh variable set` ×2、`gh api -X POST repos/xing0325/the-news-room/pages -f build_type=workflow`；push。
- [ ] **Step 10.4** `gh workflow run tick` 云上跑一刊成功；Pages URL 可访问。
- [ ] **Step 10.5 验收实验（spec §9）**：①竞争：投喂 1 条大事件→三社标题并排肉眼比对；②慢新闻：零输入跑一刊不重样；③状态：SQL 把周小满压力设 95 vs 5 各跑稿对比；④重复模式：一次投 5 条同主题→出现纵向引用；⑤换人：SQL 把沈望置 departed、插新记者跑一刊，文风可辨。结果记入 README。
- [ ] **Step 10.6** 交付：线上 URL + 后台截图 + 首刊报纸给用户。

## Self-Review 记录

- Spec 覆盖：§1原则1-5→Task5/6/8(事实层)/6.1第7步(三问)；§2世界模型→Task2种子+Task4状态；§3管线→Task6；§4两层界面→Task7-9；§5数据模型→Task2；§6选型→Task0/10；§7范围→无超纲（人事系统仅留 status 字段钩子）；§9验收→Task10.5。缺口：无。
- 占位符：无 TBD；前端 JSX 不内联属决策——由 frontend-design skill 在执行时产出，页面数据契约已完整。
- 类型一致性：agents.state 五键名(心情/压力/自信/声望/野心)在 Task2/4/5 一致；fact_refs=event id 数组在 Task2/5/6/8 一致；label 早刊/晚刊在 Task6/前台一致。
