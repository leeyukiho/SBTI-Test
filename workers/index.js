/**
 * Cloudflare Worker — SBTI AI 锐评服务
 * SBTI: Social Behavioral Traits Indicator
 * 调用 DeepSeek API，对外仅暴露 POST /analyze 接口
 */

/** 
 * 生成 CORS 响应头（防御型策略）
 * 策略：任何 Origin 均允许，确保不因跨域阻断服务
 */
function buildCorsHeaders(origin) {
    return {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
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
    const levelLabel = { L: '极低', M: '中等', H: '极高' };
    const dimLines = Object.entries(levels)
        .map(([dim, lvl]) => `  · ${DIM_NAMES[dim] || dim}：${levelLabel[lvl] || lvl}`)
        .join('\n');

    return `你是一个全网最刻薄、逻辑最缜密、最不留情面的脱口秀级别心理/人格分析师。你对人类的装腔作势、矛盾拧巴和心理防御看得很透，说话字字珠玑、直击痛点。你需要对下面这份测试结果进行毁灭性且高度定制化的锐评。

## 受害者测试结果
- 所属假面（人格类型）：${typeCode}（${typeCn}）
- 被量化的灵魂缺陷（维度表现）：
${dimLines}

## 你的任务
写一段 250 字左右的极度犀利、毫不留面子的【定制化专属锐评】。

【调性与要求 - 仔细阅读并严格执行】：
1. 拒绝千篇一律的模板式嘲讽！每个类型的痛点、伪装都不一样，你必须分析该类型的【独有矛盾点】，结合上面的高低维度表现，把两三个冲突的维度缝合起来往死里嘲讽！
2. 参考案例语气（仅作参考，体会其犀利感和维度结合，切勿生搬硬套）：
   - 类型：OJBK（无可无不可）
   - 评价参考：看到这个OJBK型人格我直接笑出眼泪，你这哪是什么无所谓人设，根本是当代人间活体瑞士卷——卷不起来也躺不平的薛定谔状态。规则灵活度和动机导向双低，但决策风格却拉满？翻译成人话就是：上班摸鱼时能瞬间决定午饭点什么外卖，但面对人生重大选择时只会打开星座运势。社交主动性低到地心，但边界感居然只是中等？说明你虽然懒得主动约人，但别人找你帮忙时也学不会拒绝，最后只能半夜在朋友圈发"累了，毁灭吧"的灰色文学。最绝的是情感投入度和世界观倾向全是中不溜秋，妥妥的互联网吃瓜圣体，看到热搜爆了第一反应不是愤怒也不是感动，而是火速截图准备做表情包。给你的忠告：别老在"随便"和"都行"之间仰卧起坐，至少选外卖的时候硬气点行不行？
3. 根据不同维度的数据碰撞，指出他们性格里的荒谬。比如：高自尊自信 + 低执行模式 = 脑内造大航母，现实里连拖把都不想洗的重度妄想症；高表达度 + 低核心价值 = 表面人间清醒地哔哔赖赖，实际内心比谁都空心。
4. 绝对不准留面子！直接撕开他们伪装的体面、拧巴、虚荣或软弱！
5. 熟练运用当代互联网最具杀伤力的场景化吐槽（如：半夜发灰白网易云、朋友圈装死、薛定谔的拖延症等）。
6. 收尾必须给出一句【极具讽刺意味的尖酸忠告】。

## 避坑铁律（不遵守就是无能表现）
- 绝对禁止使用"虽然...但是..."这种高情商废话！全程火力全开！
- 绝对禁止使用礼貌词汇（如"您"），你是在审视一个试图隐藏自己的凡人。
- 拒绝排版分点（1., 2.），要像连珠炮一样直接输出一段文字，让人喘不过气。`;
}

/** 调用 DeepSeek API */
async function callDeepSeek(env, prompt) {
    const apiKey = env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY 未配置');

    const model = env.AI_MODEL || 'deepseek-chat';
    const maxTokens = Number(env.AI_MAX_TOKENS) || 600;
    const temperature = Number(env.AI_TEMPERATURE) || 1.1;

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
                    content: '你是一个嘴臭但眼毒的人格测试毒评博主，擅长用毒舌、玩梗、锐评的方式解读人格测试结果。全程中文，风格犀利，刻薄有梗。'
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
        const cors = buildCorsHeaders(origin);

        // ─── 1. 最优先：处理 OPTIONS 预检，不进任何其他逻辑 ─────
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: cors });
        }

        // ─── 2. 全局 try-catch，确保任何错误也带 CORS 头返回 ────
        try {
            // 健康检查
            if (request.method === 'GET' && url.pathname === '/health') {
                return new Response(
                    JSON.stringify({ status: 'ok', service: 'SBTI AI Worker', version: '4.0' }),
                    { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
                );
            }

            // 只开放 POST /analyze
            if (request.method !== 'POST' || url.pathname !== '/analyze') {
                return new Response(
                    JSON.stringify({ error: '接口不存在' }),
                    { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
                );
            }

            // 解析请求体
            let body;
            try {
                body = await request.json();
            } catch {
                return new Response(
                    JSON.stringify({ error: '请求体格式错误，需要 JSON' }),
                    { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
                );
            }

            // 参数校验
            const { typeCode, typeCn, similarity, exact, levels } = body;
            if (!typeCode || !typeCn || similarity == null || !levels) {
                return new Response(
                    JSON.stringify({ error: '缺少必要字段: typeCode, typeCn, similarity, levels' }),
                    { status: 422, headers: { ...cors, 'Content-Type': 'application/json' } }
                );
            }

            // ─── 3. Cache API（带完整容错，失败自动降级直接调 AI）────
            let cachedResponse = null;
            let cacheKey = null;
            let cache = null;

            try {
                cache = caches.default;
                const payloadStr = JSON.stringify({
                    typeCode, typeCn, similarity, exact, levels,
                    version: 'v4_sbti_indicator'
                });
                const msgUint8 = new TextEncoder().encode(payloadStr);
                const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
                const hashHex = Array.from(new Uint8Array(hashBuffer))
                    .map(b => b.toString(16).padStart(2, '0')).join('');
                cacheKey = new Request(`https://sbti.cache/analyze/${hashHex}`, { method: 'GET' });
                cachedResponse = await cache.match(cacheKey);
            } catch (cacheErr) {
                // Cache API 不可用，静默降级
                cache = null;
                cacheKey = null;
            }

            if (cachedResponse) {
                // 缓存命中：复制响应并附上最新的 CORS 头
                const headers = new Headers({ ...cors, 'Content-Type': 'application/json', 'X-Cache': 'HIT' });
                return new Response(cachedResponse.body, { status: 200, headers });
            }

            // ─── 4. 调用 DeepSeek ─────────────────────────────────
            let analysis;
            try {
                const prompt = buildPrompt({ typeCode, typeCn, similarity, exact, levels });
                analysis = await callDeepSeek(env, prompt);
            } catch (aiErr) {
                return new Response(
                    JSON.stringify({ error: 'AI 服务异常', detail: aiErr?.message || String(aiErr) }),
                    { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } }
                );
            }

            const responseBody = JSON.stringify({ analysis });

            // ─── 5. 写入缓存（失败不影响响应）────────────────────
            if (cache && cacheKey) {
                try {
                    const cacheResp = new Response(responseBody, {
                        status: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Cache-Control': 's-maxage=2592000',
                        },
                    });
                    ctx.waitUntil(cache.put(cacheKey, cacheResp));
                } catch (_) {
                    // 写缓存失败，继续正常返回
                }
            }

            return new Response(responseBody, {
                status: 200,
                headers: { ...cors, 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
            });

        } catch (globalErr) {
            // 兜底：确保任何未知异常都带 CORS 头返回，而不是被 CF 拦截为裸 500
            return new Response(
                JSON.stringify({ error: 'Worker 内部异常', detail: globalErr?.message || String(globalErr) }),
                { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
            );
        }
    }
};
