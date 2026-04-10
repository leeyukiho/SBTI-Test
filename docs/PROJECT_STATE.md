# PROJECT_STATE.md

## 当前技术栈 (Tech Stack)
- **Frontend**: Vanilla HTML5, CSS3 (Glassmorphism), Vanilla JavaScript.
- **Backend/API**: Cloudflare Workers (Platform).
- **Core AI**: DeepSeek-v3 (via API).
- **Frameworks**: None (Zero-dependency static project).

## 核心架构 (Core Architecture)
- **静态前端**: 主机在 Cloudflare Pages 或 GitHub Pages。
- **异步分析**: 前端提交 15 维数据至 Worker，Worker 调用 DeepSeek 返回毒舌报告。
- **状态存储**: 浏览器 `localStorage` 保留答题进度。

## 当前 Sprint 的 TODO
- [x] 自动化注入全站结构化数据 (JSON-LD BreadcrumbList)
- [x] 视觉面包屑导航添加 (UI)
- [ ] 基础设施 SEO 更新 (404.html, robots.txt, sitemap.xml)
- [ ] 全站图片关键词 (Alt Tags) 优化
- [ ] 404 页面设计与实现
