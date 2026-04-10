# Security Policy

## Supported Versions

我们建议始终使用主分支 (`main`) 的最新代码，因为安全补丁将首先在此处发布。

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

如果你发现了安全漏洞，请不要公开发布 Issue。请通过以下方式联系我们：

1. 发送邮件至：`leeyukiho@gmail.com`
2. 或者在 GitHub 私有报告功能中提交漏洞说明（如果可用）。

我们将会在 48 小时内给予回复，并根据漏洞的严重程度安排修复计划。

## AI 安全说明
由于项目接入了 AI 辅助分析功能，请确保你的 API Key 安全地存储在环境变量（如 Cloudflare Workers Secrets）中。**切勿**将 API Key 直接写在前端 JS 文件或提交到公开仓库。
