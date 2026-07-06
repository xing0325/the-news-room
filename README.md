# the news room

> 一个只报道你的新闻世界——你的生活，是这里唯一的公共事件。

3 家虚构报社、9 名有人格有状态的职员，围绕唯一主角（你）持续运转的媒体宇宙。不是"AI 帮你写日记"，而是让文本**被一个世界生产出来**。

- 线上：https://the-news-room-chichu.netlify.app
- 设计文档：[docs/superpowers/specs/2026-07-06-the-news-room-design.md](docs/superpowers/specs/2026-07-06-the-news-room-design.md)
- 实现计划：[docs/superpowers/plans/2026-07-06-the-news-room-v1.md](docs/superpowers/plans/2026-07-06-the-news-room-v1.md)

## 结构

```
engine/   刊期 tick（GitHub Actions cron 每日两刊）：七步管线调 DeepSeek 出整期报纸
web/      Next.js 静态导出前端（报纸前台 + 编辑部后台 + 输入台）
netlify/functions/   登录 + 读世界 + 写事件的薄 API
supabase/ （已废弃——供墙内网络原因改用 Netlify Blobs，见 spec §5 修订注）
```

## 本地开发

```bash
npm i && cd engine && npm i && cd ../web && npm i && cd ..
netlify link --id 2e739c68-cb83-429b-b0f4-4dbb9e2f95a9
netlify dev          # http://localhost:8888（前端 + functions + 云端环境变量）
cd engine && npm run tick   # 手动出一刊（需 engine/.env）
```
