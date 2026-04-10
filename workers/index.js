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
写一段约200字的锐评，要求：
1. 【调性风格】：像极度了解对方底细的损友，开场方式要千变万化（禁止每次都用"好家伙"、"哎哟"等固定词汇起手，可以直接贴脸输出或从某个奇怪的角度切入）。要求犀利、有梗、适度扎心但不可辱骂。
2. 【内容重点】：结合具体的维度数据（挑几个最极端、最矛盾的维度），用当代互联网最新鲜的黑话调侃ta的行为模式。结尾给一句"损但真诚"的忠告。
3. 【排版要求】：可以分段，但是中间不能有空行。
4. 【自由发挥】：不要受限于常规的性格分析套路，可以适当放飞自我。

## 避坑铁律（触发即失败）
- 绝对禁止使用 "您"。
- 绝对禁止使用 "好家伙" 或类似的陈词滥调作为固定开场白。
- 绝对禁止出现 "优点是...缺点是..." 或 "总的来说..." 这样的刻板句式。
- 全程中文，直接输出正文段落。`;
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

        // ======= Cache API 缓存拦截逻辑 =======
        const cache = caches.default;
        // 把会影响评价的字段打成一个特征字符串
        const payloadStr = JSON.stringify({ typeCode, typeCn, similarity, exact, levels });

        // 生成对应哈希当做 Cache Key (Cache API 必须用 GET Request 做 Key)
        const msgUint8 = new TextEncoder().encode(payloadStr);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        const cacheKey = new Request(`https://sbti.cache/analyze/${hashHex}`, { method: 'GET' });

        // 尝试命中缓存
        let cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) {
            // 命中缓存，直接复制并加上跨域等基础头部
            const newResp = new Response(cachedResponse.body, cachedResponse);
            Object.entries(headers).forEach(([k, v]) => newResp.headers.set(k, v));
            newResp.headers.set('X-Cache-Status', 'HIT');
            return newResp;
        }
        // ===================================

        // 没命中，老老实实调用 DeepSeek
        let analysis;
        try {
            const prompt = buildPrompt({ typeCode, typeCn, similarity, exact, levels });
            analysis = await callDeepSeek(env, prompt);
        } catch (err) {
            const errMsg = err?.message || String(err);
            return new Response(JSON.stringify({ error: 'AI 服务异常', detail: errMsg }), {
                status: 503,
                headers: { ...headers, 'Content-Type': 'application/json' }
            });
        }

        const responseData = JSON.stringify({ analysis });

        // 构造返回用户的响应（带 MISS）
        const finalResponse = new Response(responseData, {
            status: 200,
            headers: { ...headers, 'Content-Type': 'application/json', 'X-Cache-Status': 'MISS' }
        });

        // ======= 将结果推入缓存 =======
        // Cache API 需要缓存响应带 Cache-Control 头部
        const cacheResponse = new Response(responseData, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 's-maxage=2592000' // 放缓存里存一个月 (30天)
            }
        });
        ctx.waitUntil(cache.put(cacheKey, cacheResponse));

        return finalResponse;
    }
};
