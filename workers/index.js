/**
 * Cloudflare Worker — SBTI AI 个性化解读服务
 * 隔离 AI API Key，对外仅暴露 /analyze 接口
 */

// 允许的来源列表（本地开发 + 生产域名，按需修改）
const ALLOWED_ORIGINS = [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:8080',
    'https://sbti.pages.dev',  // CF Pages 默认域名，按实际替换
];

/** CORS 响应头生成 */
function corsHeaders(origin) {
    const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
    };
}

/** 构造 Prompt —— 根据测试结果组装高质量中文提示词 */
function buildPrompt(result) {
    const { typeCode, typeCn, similarity, exact, levels } = result;

    // 将维度等级转换为可读文本
    const levelLabel = { L: '低', M: '中', H: '高' };
    const dimLines = Object.entries(levels)
        .map(([dim, lvl]) => `  · ${dim}：${levelLabel[lvl] || lvl}`)
        .join('\n');

    return `你是一个犀利幽默但洞察深刻的性格分析师，正在为用户解读一份名为"SBTI"的人格测试结果。SBTI 是一套基于15个维度构建的娱乐向人格体系，分为若干类型，每个类型有中文名称和代号。

## 用户的测试结果
- **人格类型**：${typeCode}（${typeCn}）
- **匹配度**：${similarity}%，精准命中 ${exact}/15 维
- **各维度水平**：
${dimLines}

## 你的任务
请用以下风格为用户写一段约200字的个性化解读：
1. **开头**：用一句神来之笔的话点出这个类型的核心气质
2. **中段**：结合匹配度和维度分布，点评用户的典型行为模式（可以适当调侃）
3. **结尾**：给出一句真诚但带点损的"人生建议"

**风格要求**：锋芒毕露但不刻薄，幽默但有真知灼见，像朋友说话而不是机器。禁止列举无意义的优缺点清单，禁止使用"您"，禁止套话。直接输出解读正文，不要任何前缀说明。`;
}

/** 调用 Cloudflare AI Workers (Workers AI) */
async function runAI(env, prompt) {
    const model = env.AI_MODEL || '@cf/qwen/qwen3-30b-a3b-fp8';
    const maxTokens = Number(env.AI_MAX_TOKENS) || 512;
    const temperature = Number(env.AI_TEMPERATURE) || 0.85;

    const response = await env.AI.run(model, {
        messages: [
            { role: 'system', content: '你是一个犀利幽默的人格分析师，擅长用简洁有趣的语言解读性格测试结果。' },
            { role: 'user', content: prompt }
        ],
        max_tokens: maxTokens,
        temperature,
    });
    return response.response || response.result || '';
}

/** 主请求处理器 */
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const origin = request.headers.get('Origin') || '';
        const headers = corsHeaders(origin);

        // 预检请求
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers });
        }

        // 仅开放 POST /analyze
        if (request.method !== 'POST' || url.pathname !== '/analyze') {
            return new Response(JSON.stringify({ error: '接口不存在' }), {
                status: 404,
                headers: { ...headers, 'Content-Type': 'application/json' }
            });
        }

        // 解析请求体
        let body;
        try {
            body = await request.json();
        } catch {
            return new Response(JSON.stringify({ error: '请求体格式错误' }), {
                status: 400,
                headers: { ...headers, 'Content-Type': 'application/json' }
            });
        }

        // 基本参数校验
        const { typeCode, typeCn, similarity, exact, levels } = body;
        if (!typeCode || !typeCn || similarity == null || !levels) {
            return new Response(JSON.stringify({ error: '缺少必要字段' }), {
                status: 422,
                headers: { ...headers, 'Content-Type': 'application/json' }
            });
        }

        // 调用 AI
        let analysis;
        try {
            const prompt = buildPrompt({ typeCode, typeCn, similarity, exact, levels });
            analysis = await runAI(env, prompt);
        } catch (err) {
            console.error('AI 调用失败：', err);
            return new Response(JSON.stringify({ error: 'AI 服务暂时不可用，请稍后重试' }), {
                status: 503,
                headers: { ...headers, 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ analysis }), {
            status: 200,
            headers: { ...headers, 'Content-Type': 'application/json' }
        });
    }
};
