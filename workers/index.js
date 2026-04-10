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

/** 维度中文名词映射 */
const DIM_NAMES = {
    S1: '自尊自信', S2: '自我清晰度', S3: '核心价值',
    E1: '依恋安全感', E2: '情感投入度', E3: '边界与依赖',
    A1: '世界观倾向', A2: '规则与灵活度', A3: '人生意义感',
    Ac1: '动机导向', Ac2: '决策风格', Ac3: '执行模式',
    So1: '社交主动性', So2: '人际边界感', So3: '表达与真实度'
};

/** 构造毒舌锐评 Prompt */
function buildPrompt(result) {
    const { typeCode, typeCn, similarity, exact, levels } = result;
    const levelLabel = { L: '低', M: '中', H: '高' };
    const dimLines = Object.entries(levels)
        .map(([dim, lvl]) => `  · ${DIM_NAMES[dim] || dim}：${levelLabel[lvl] || lvl}`)
        .join('\n');

    return `你是一个既嘴毒又懂梗的人格测试锐评区UP主，正在对一份"SBTI"测试结果进行点评。
SBTI 是基于15个维度的娱乐向人格测试。

## 用户测试结果
- 人格类型：${typeCode}（${typeCn}）
- 匹配度：${similarity}%，精准命中 ${exact}/15 维
- 各维度水平：
${dimLines}

## 你的任务
写一段约200字的点评，要求：
1. 【调性要求】：像损友一样吐槽、玩梗，适度扎心，但绝对不要过度人身攻击，把握好幽默分寸。
2. 【内容要求】：结合具体的维度数据（挑几个最极端的），用当代互联网黑话调侃ta的行为模式。结尾给一句“损但真诚”的忠告。
3. 【排版要求】：⚠️绝对不能分段！绝对不能换行！所有文字必须连成完整的一大段连续输出！
4. 【Emoji规则】：只允许极少量使用带情绪或梗的表情（如 😅、🤡、💀、🥺 等），绝对禁止使用无聊的、排版用的系统表情（如 🔄、✨、📊、💡 等）。

## 铁律
- 禁止使用"您"
- 禁止出现"优点是...缺点是..."这种刻板格式
- 禁止废话开场（不要说"好的我来解读"或重复用户数据）
- 全程中文，禁止换行，直接输出正文段落`;
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
