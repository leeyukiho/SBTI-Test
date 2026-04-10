# 🧬 SBTI 人格测试 (SBTI Personality Test)

> 一个比 MBTI 更狠的、完全免费的 AI 毒舌性格测试工具。

[![Static Badge](https://img.shields.io/badge/Status-Active-success)](/)
[![Vanilla JS](https://img.shields.io/badge/Tech_Stack-Vanilla_JS-yellow)](/)
[![DeepSeek AI](https://img.shields.io/badge/Powered_By-DeepSeek-blue)](/)

## 📖 项目简介
SBTI 是一款风靡全网的互联网原生性格测试工具，起源于网络梗，但内置了异常真实的 15 维度心理行为评分模型。它不套刻板的主流话术，而是直面真实接地气的日常反应。

本项目不仅完整复原了所有题目与 27 种人格（含常规与隐藏人格），还独家接入了 **DeepSeek AI 大模型**。在你完成基础测试后，可以一键生成千人千面、极度毒舌的专属性格辅助分析报告。

## ✨ 核心特性
- **📊 15 维度匹配雷达**：不玩二分法，用更复杂的行为切面来勾勒真实人设。
- **🎭 27 种完整人格图鉴**：包含极其稀有的“CTRL 拿捏者”以及隐藏彩蛋“DRUNK 酒鬼”、“HHHH 傻乐者”等。
- **🤖 DeepSeek 毒舌批斗**：传入个人维度得分，动态生成毫不留情但细思极恐的赛博诊断书。
- **⚡ 纯本地极速运行**：前端采用原生 HTML/CSS/Vanilla JS 打造，无重度框架，轻量级。

## 🚀 快速开始
本项目为纯前端静态项目，无需复杂的 `npm` 依赖安装，即插即用：
1. `git clone` 下载本项目代码。
2. 使用 VS Code 的 **Live Server** 插件，或者任意 HTTP 静态服务器。
3. 根目录指向 `src/` 文件夹。
4. 浏览器打开 `localhost:xxxx` 即可体验。

*(注：AI 毒舌功能需要在对应的 worker 云函数端配置 DeepSeek API Key)*

## 📚 目录结构
```text
SBTI-Test/
├── src/
│   ├── css/          # 全局样式与变量预设
│   ├── js/           # 核心逻辑 (app.js, dataset.js)
│   ├── index.html    # 首页与测试页
│   ├── types.html    # 27 种人格完整图鉴
│   ├── rankings.html # 人格榜单展示
│   └── about.html    # 原理说明与 FAQ
└── README.md
```

## 🤝 贡献说明
如果你发现了 BUG 或是想要优化代码，欢迎提交 Issue 或者 Pull Request。
- 请尽可能保持原生 Vanilla 的技术栈，避免盲目引入重度框架。
- 确保测试完毕后所有样式在移动端表现正常。

## 📜 版权申明
- **核心框架及题库溯源**：来源于 B 站博主 [@蛆肉儿串儿](https://space.bilibili.com/417038183)。
- 本项目开源仅供学习交流与娱乐，不可用于严肃的临床心理学测试或医学评估。
