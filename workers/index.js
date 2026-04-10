/**
 * Cloudflare Worker — SBTI AI 锐评服务
 * 调用 DeepSeek API，对外仅暴露 POST /analyze 接口
 */

/** CORS 响应头（白名单未命中则直接放行请求来源） */
function corsHeaders(origin, env) {
    const list = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const allowed = (list.length === 0 || list.includes(origin)) ? (origin || '*') : list[0];
    return {
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
    };
}

/** 构造毒舌锐评 Prompt */
function buildPrompt(result) {
    const { typeCode, typeCn, similarity, exact, levels } = result;
    const levelLabel = { L: '低', M: '中', H: '高' };
    const dimLines = Object.entries(levels)
        .map(([dim, lvl]) => `  · ${dim}：${levelLabel[lvl] || lvl}`)
        .join('\n');

    return `你是一个嘴臭但眼毒的人格测试毒评博主，正在对一份"SBTI"人格测试结果进行锐评。
SBTI 是一套基于15个维度的娱乐向人格测试体系，不是 MBTI。

## 用户测试结果
- 人格类型：${typeCode}（${typeCn}）
- 匹配度：${similarity}%，精准命中 ${exact}/15 维
- 各维度水平：
${dimLines}

## 你的任务
用"毒舌+玩梗+锐评"风格写一段约200字的人格解读，要求：
1. 第一句话必须是一针见血的"灵魂暴击"，直接点出这类人最典型的黑色特征
2. 中间结合维度数据，用互联网黑话/梗文化调侃用户的行为模式（比如"抽象"、"纯纯"、"赛博"等当代网络用语）
3. 结尾用一句"损但真诚"的人生忠告收场
4. 可以适当使用表情符号增加节目效果

## 铁律
- 禁止使用"您"
- 禁止出现"优点是...缺点是..."这种无聊格式
- 禁止废话开场（不要说"好的，我来解读"之类）
- 禁止输出任何前缀说明
- 全程中文，直接输出正文`;
}

/** 调用 DeepSeek API */
async function callDeepSeek(env, prompt) {
    const apiKey = env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY 未配置');

    const model = env.AI_MODEL || 'deepseek-chat';
    const maxTokens = Number(env.AI_MAX_TOKENS) || 600;
    const temperature = Number(env.AI_TEMPERATURE) || 1.0;

    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: [
                {
                    role: 'system',
                    content: '你是一个嘴臭但眼毒的人格测试毒评博主，擅长用毒舌、玩梗、锐评的方式解读人格测试结果。全程中文，风格犀利有梗。'
                },
                { role: 'user', content: prompt }
            ],
            max_tokens: maxTokens,
            temperature,
        }),
    });

    if (!resp.ok) {
        const errBody = await resp.text();
        throw new Error(`DeepSeek API 错误 ${resp.status}: ${errBody}`);
    }

    const data = await resp.json();
    return data.choices?.[0]?.message?.content || '';
}

/** 主请求处理器 */
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const origin = request.headers.get('Origin') || '';
        const headers = corsHeaders(origin, env);

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

        // 参数校验
        const { typeCode, typeCn, similarity, exact, levels } = body;
        if (!typeCode || !typeCn || similarity == null || !levels) {
            return new Response(JSON.stringify({ error: '缺少必要字段' }), {
                status: 422,
                headers: { ...headers, 'Content-Type': 'application/json' }
            });
        }

        // 调用 DeepSeek
        let analysis;
        try {
            const prompt = buildPrompt({ typeCode, typeCn, similarity, exact, levels });
            analysis = await callDeepSeek(env, prompt);
        } catch (err) {
            console.error('AI 调用失败：', err);
            const errMsg = err?.message || String(err);
            return new Response(JSON.stringify({ error: 'AI 服务异常', detail: errMsg }), {
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
