# 🧬 SBTI 人格测试 (SBTI Personality Test)

> **AI 驱动的深度人格分析工具** —— 一个比 MBTI 更狠、更真实的 15 维度心理行为建模工具。

[![Static Badge](https://img.shields.io/badge/Status-Active-success)](https://sbti-ai.com)
[![Vanilla JS](https://img.shields.io/badge/Tech_Stack-Vanilla_JS-yellow)](/)
[![AI Powered](https://img.shields.io/badge/Powered_By-AI-blue)](/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

### 🌐 [立即体验 (Live Demo)](https://sbti-ai.com) | [人格碰撞实验室](https://cp.sbti-ai.com)

---

## 📖 项目简介 (Overview)

**SBTI (Social Behavior Type Indicator)** 是一款专为互联网原生世代设计的性格测试工具。不同于传统 MBTI 的二分法，SBTI 内置了基于 15 个行为维度的深度评分模型，直面真实、接地气的日常社交反应。

本项目不仅完整复原了核心题库与 27 种人格（含常规与隐藏人格），还独家接入了 **AI 毒舌分析引擎**。通过对维度得分的语义化解析，生成千人千面、极度犀利的赛博性格诊断报告。

## ✨ 核心特性 (Key Features)

- **📊 15 维度行为建模**：涵盖“拿捏度”、“酒鬼值”、“二次元指数”等 15 个独特维度，刻画立体人设。
- **🎭 27 种完整人格图鉴**：包含极其稀有的“CTRL 拿捏者”以及隐藏彩蛋“DRUNK 酒鬼”、“HHHH 傻乐者”等。
- **💥 人格碰撞 (CP 分析)**：支持双人人格对比，从多维度解析火花冲突、互补程度及相处建议。
- **🤖 AI 毒舌批斗**：基于大语言模型的自研 Prompt，生成毫不留情但细思极恐的性格报告。
- **⚡ 极致性能**：采用原生 HTML/Vanilla JS 打造，0 依赖，极致轻量，完美适配移动端。
- **🔍 SEO 友好**：全量接入 Schema.org 结构化数据，确保搜索引擎精准抓取测试结果。

## 🌍 English Introduction

SBTI is an AI-powered personality assessment tool designed for the modern internet era. Unlike traditional MBTI, it utilizes a sophisticated 15-dimensional behavioral model to provide a more nuanced and "raw" evaluation of your personality. Features include AI-generated "roast" reports, personality collision analysis (compatibility), and a lightweight vanilla JS architecture.

---

## 🚀 快速开始

本项目为纯前端静态项目，支持静态托管：
1. `git clone https://github.com/leeyukiho/SBTI-Test.git`
2. 进入 `src/` 目录。
3. 使用任意静态服务器（如 VS Code Live Server）运行。

*(注：AI 功能由 Cloudflare Workers 提供支持，需配置相应的 API Key)*

## 📚 目录结构
```text
SBTI-Test/
├── src/
│   ├── css/          # 样式系统
│   ├── js/           # 核心逻辑 (app.js, dataset.js)
│   ├── index.html    # 官网首页
│   └── ...           # 其他业务页 (compare, types, rankings)
├── workers/          # AI 辅助分析后端 (Cloudflare Workers)
└── docs/             # 项目文档与 SEO 策略
```

## 🏷️ GitHub Topics (建议配置)
为了提升仓库曝光，建议在仓库设置中添加以下标签：
`sbti`, `mbti`, `personality-test`, `ai-agent`, `psychology`, `personality-assessment`, `vanilla-js`, `cloudflare-pages`

## 🤝 贡献说明
欢迎提交 Issue 或 Pull Request。请保持 Vanilla JS 风格，并确保移动端兼容性。

## 📜 版权与申明
- **核心框架及题库**：来源于 B 站博主 [@蛆肉儿串儿](https://space.bilibili.com/417038183)。
- **开源协议**：本项目基于 **MIT License** 开源。
- **免责声明**：本工具仅供娱乐与自我探索，不可替代专业心理咨询或医学诊断。
