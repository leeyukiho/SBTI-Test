/**
 * app.js — 应用层，负责 DOM 渲染、交互与事件绑定
 * 依赖 dataset.js（数据）与 algorithm.js（算法）
 */

import {
    questions,
    specialQuestions,
    dimensionMeta,
    dimensionOrder,
    DIM_EXPLANATIONS,
    TYPE_IMAGES
} from './dataset.js';

import { computeResult } from './algorithm.js';

// ─── AI Worker 接口地址（部署后替换为你的 Worker 域名）─────
const AI_WORKER_URL = 'https://api.sbti-ai.com/analyze';

// ─── 应用状态 ─────────────────────────────────────────────
const app = {
    shuffledQuestions: [],
    answers: {}
};

const LS_ANSWERS_KEY = 'sbti_answers';
const LS_QUESTIONS_KEY = 'sbti_questions';

function saveState() {
    localStorage.setItem(LS_ANSWERS_KEY, JSON.stringify(app.answers));
    localStorage.setItem(LS_QUESTIONS_KEY, JSON.stringify(app.shuffledQuestions));
    checkSavedState();
}

function loadState() {
    try {
        const a = localStorage.getItem(LS_ANSWERS_KEY);
        const q = localStorage.getItem(LS_QUESTIONS_KEY);
        if (a && q) {
            app.answers = JSON.parse(a);
            app.shuffledQuestions = JSON.parse(q);
            return true;
        }
    } catch(e) {}
    return false;
}

function clearState() {
    localStorage.removeItem(LS_ANSWERS_KEY);
    localStorage.removeItem(LS_QUESTIONS_KEY);
    checkSavedState();
}

function checkSavedState() {
    const hasState = !!localStorage.getItem(LS_ANSWERS_KEY);
    const startBtn = document.getElementById('startBtn');
    const freshBtn = document.getElementById('freshStartBtn');
    if (startBtn && freshBtn) {
        if (hasState) {
            startBtn.innerHTML = '⚡ 继续上次未完成的测试';
            freshBtn.style.display = 'inline-block';
        } else {
            startBtn.innerHTML = '⚡ 立即开始测试 (约 3 分钟)';
            freshBtn.style.display = 'none';
        }
    }
}

// ─── DOM 节点引用 ──────────────────────────────────────────
const screens = {
    intro: document.getElementById('intro'),
    test: document.getElementById('test'),
    result: document.getElementById('result')
};
const questionList = document.getElementById('questionList');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const submitBtn = document.getElementById('submitBtn');
const testHint = document.getElementById('testHint');

// ─── 屏幕切换 ─────────────────────────────────────────────
function showScreen(name, pushState = true) {
    Object.entries(screens).forEach(([key, el]) => {
        el.classList.toggle('active', key === name);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    if (pushState) {
        history.pushState({ screen: name }, '', `#${name}`);
    }
}

// ─── 工具函数 ─────────────────────────────────────────────
/**
 * Fisher-Yates 洗牌
 * @param {Array} array
 * @returns {Array} 新数组
 */
function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * 获取当前应该渲染的题目列表（含饮酒条件题）
 * @returns {Array}
 */
function getVisibleQuestions() {
    return app.shuffledQuestions.filter(q => {
        if (q.id === 'drink_gate_q2') {
            return app.answers['drink_gate_q1'] === 3;
        }
        return true;
    });
}

/**
 * 获取题目的维度标签文本
 * @param {Object} q - 题目对象
 * @returns {string}
 */
function getQuestionMetaLabel(q) {
    return '维度已隐藏';
}

// ─── 渲染逻辑 ─────────────────────────────────────────────
/**
 * 渲染题目列表到 DOM
 */
function renderQuestions() {
    // 渲染时注入所有题目节点，由 CSS 类控制显隐，避免交互后的重绘闪跳
    questionList.innerHTML = '';
    app.shuffledQuestions.forEach((q) => {
        const card = document.createElement('article');
        const isHidden = q.id === 'drink_gate_q2' && app.answers['drink_gate_q1'] !== 3;
        card.className = 'question' + (isHidden ? ' hidden-q' : '');
        card.id = 'dom_' + q.id;
        card.innerHTML = `
          <div class="question-meta">
            <div class="badge">第 <span class="num"></span> 题</div>
            <div class="dim-label">${getQuestionMetaLabel(q)}</div>
          </div>
          <fieldset class="question-fieldset">
            <legend class="question-title">${q.text}</legend>
            <div class="options">
              ${q.options.map((opt, i) => {
              const code = ['A', 'B', 'C', 'D'][i] || String(i + 1);
              const checked = app.answers[q.id] === opt.value ? 'checked' : '';
              return `
                  <label class="option-card">
                    <input type="radio" name="${q.id}" value="${opt.value}" ${checked} class="sr-only"/>
                    <div class="option-code">${code}</div>
                    <div class="option-text">${opt.label}</div>
                    <div class="radio-indicator"></div>
                  </label>
                `;
          }).join('')}
            </div>
          </fieldset>
        `;
        // 非隐藏题直接可见，不通过 JS 控制动画，防止滚动白屏闪烁
        if (!isHidden) {
            card.style.opacity = '1';
        }
        questionList.appendChild(card);
    });

    // 绑定单选框变化事件
    questionList.querySelectorAll('input[type="radio"]').forEach(input => {
        input.addEventListener('change', (e) => {
            const { name, value } = e.target;
            app.answers[name] = Number(value);

            // 饮酒门控题：无刷新修改后续题目的 CSS 显隐
            if (name === 'drink_gate_q1') {
                const q2DOM = document.getElementById('dom_drink_gate_q2');
                if (Number(value) === 3) {
                    if (q2DOM) q2DOM.classList.remove('hidden-q');
                } else {
                    delete app.answers['drink_gate_q2'];
                    if (q2DOM) {
                        q2DOM.classList.add('hidden-q');
                        q2DOM.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
                    }
                }
                saveState();
                updateProgress();
                return;
            }

            saveState();
            updateProgress();
        });
    });

    // 已移除 IntersectionObserver 延迟渲染机制，解决上下滑动时的白屏和闪现问题
    // 题目默认全部在 DOM 中渲染完毕，交由浏览器原生性能处理

    updateProgress();
}

/**
 * 更新进度条与提交按钮状态
 */
function updateProgress() {
    const visibleQuestions = getVisibleQuestions();
    const total = visibleQuestions.length;
    const done = visibleQuestions.filter(q => app.answers[q.id] !== undefined).length;
    const percent = total ? (done / total) * 100 : 0;
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${done} / ${total}`;
    
    const complete = done === total && total > 0;
    submitBtn.disabled = false; // 始终允许点击以触发检查
    
    if (!testHint.style.color || testHint.style.color === '') {
        testHint.textContent = complete
            ? '都做完了。现在可以把你的电子魂魄交给结果页审判。'
            : '系统会在提交时帮你检查遗漏选项';
    }
}

function handleSubmit() {
    const visibleQuestions = getVisibleQuestions();
    const missingQ = visibleQuestions.find(q => app.answers[q.id] === undefined);
    
    if (missingQ) {
        const targetCard = document.getElementById('dom_' + missingQ.id);
        if (targetCard) {
            targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // 清理旧警告
            questionList.querySelectorAll('.missing-alert').forEach(alert => {
                alert.remove();
            });

            const alertMsg = document.createElement('div');
            alertMsg.className = 'missing-alert';
            alertMsg.style.color = '#ff4d4f';
            alertMsg.style.marginTop = '12px';
            alertMsg.style.fontWeight = 'bold';
            alertMsg.textContent = '👆 这道题还没选呢！请补充';
            targetCard.appendChild(alertMsg);
        }
        testHint.textContent = '❌ 有题目未完成，已为您滚动到该题上方';
        testHint.style.color = '#ff4d4f';
        setTimeout(() => {
            testHint.style.color = '';
            updateProgress();
        }, 3000);
        return;
    }
    
    renderResult();
}

/**
 * 渲染十五维度评分列表
 * @param {Object} result - computeResult 返回值
 */
function renderDimList(result) {
    const dimList = document.getElementById('dimList');
    dimList.innerHTML = dimensionOrder.map(dim => {
        const level = result.levels[dim];
        const explanation = DIM_EXPLANATIONS[dim][level];
        return `
          <div class="dim-item">
            <div class="dim-item-top">
              <div class="dim-item-name">${dimensionMeta[dim].name}</div>
              <div class="dim-item-score">${level} / ${result.rawScores[dim]}分</div>
            </div>
            <p>${explanation}</p>
          </div>
        `;
    }).join('');
}

/**
 * 调用 AI Worker 获取个性化解读
 * @param {Object} result - computeResult 返回值
 * @returns {Promise<string>}
 */
async function fetchAiAnalysis(result) {
    const type = result.finalType;
    const payload = {
        typeCode: type.code,
        typeCn: type.cn,
        similarity: result.bestNormal?.similarity ?? 100,
        exact: result.bestNormal?.exact ?? 15,
        levels: result.levels,
    };
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    try {
        const resp = await fetch(AI_WORKER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!resp.ok) {
            const txt = await resp.text();
            throw new Error(`HTTP ${resp.status}`);
        }
        const data = await resp.json();
        return data.analysis || '';
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error('网络请求超时（国内网络直接访问 workers.dev 可能被墙拦截，请开启代理或绑定自定义域名）');
        }
        throw err;
    }
}

/**
 * 渲染结果页
 */
function renderResult() {
    // 调用算法层，传入当前答案和题库
    const result = computeResult(app.answers, questions);
    const type = result.finalType;

    document.getElementById('resultModeKicker').textContent = result.modeKicker;
    document.getElementById('resultTypeName').textContent = `${type.code}（${type.cn}）`;
    document.getElementById('matchBadge').textContent = result.badge;
    document.getElementById('resultTypeSub').textContent = result.sub;
    document.getElementById('resultDesc').textContent = type.desc;
    document.getElementById('posterCaption').textContent = type.intro;
    document.getElementById('funNote').textContent = result.special
        ? '本测试仅供娱乐。隐藏人格和傻乐兜底都属于作者故意埋的损招，请勿把它当成医学、心理学、相学、命理学或灵异学依据。'
        : '本测试仅供娱乐，别拿它当诊断、面试、相亲、分手、招魂、算命或人生判决书。你可以笑，但别太当真。';

    // 图片处理
    const posterBox = document.getElementById('posterBox');
    const posterImage = document.getElementById('posterImage');
    const imageSrc = TYPE_IMAGES[type.code];
    if (imageSrc) {
        posterImage.src = imageSrc;
        posterImage.alt = `${type.code}（${type.cn}）`;
        posterBox.classList.remove('no-image');
    } else {
        posterImage.removeAttribute('src');
        posterImage.alt = '';
        posterBox.classList.add('no-image');
    }

    renderDimList(result);

    // 保存结果，重置 AI 区块为待触发状态
    app.lastResult = result;
    resetAiZone();
    showScreen('result');
}

/**
 * 重置 AI 区块回初始待触发状态
 */
function resetAiZone() {
    const actionZone = document.getElementById('aiActionZone');
    const aiText = document.getElementById('aiAnalysisText');
    const btn = document.getElementById('aiTriggerBtn');
    actionZone.style.display = '';
    aiText.style.display = 'none';
    aiText.textContent = '';
    btn.disabled = false;
    btn.innerHTML = '🧬 立即生成专属 AI 毒舌锐评';
}

/**
 * 手动触发 AI 毒舌锐评
 */
async function triggerAiAnalysis() {
    const result = app.lastResult;
    if (!result) {
        alert('⚠️ 请先完成测试再获取 AI 锐评！');
        return;
    }

    const actionZone = document.getElementById('aiActionZone');
    const aiText    = document.getElementById('aiAnalysisText');
    const btn       = document.getElementById('aiTriggerBtn');

    // 防御：DOM 元素缺失时直接报错
    if (!actionZone || !aiText || !btn) {
        return;
    }

    try {
        // 切换到 loading 状态
        btn.disabled = true;
        btn.textContent = '⏳ 正在读取你的牛马基因…';

        const analysis = await fetchAiAnalysis(result);

        // 隐藏按钮区，显示结果
        actionZone.style.display = 'none';
        aiText.style.display = 'block';
        aiText.textContent = '';

        // 逐字打印效果
        let i = 0;
        const print = () => {
            if (i < analysis.length) {
                aiText.textContent += analysis[i++];
                setTimeout(print, 18);
            }
        };
        print();
    } catch (err) {
        // 错误信息显示在页面内，而不只是 console
        if (btn) {
            btn.disabled = false;
            btn.textContent = '⚠️ 锐评失败，点我重试';
        }
        if (aiText) {
            aiText.style.display = 'block';
            aiText.textContent = `[错误] ${err.message || String(err)}`;
        }
    }
}

// ─── 测试启动 ─────────────────────────────────────────────
/**
 * 初始化并进入测试页
 */
function startTest() {
    app.answers = {};
    const shuffledRegular = shuffle(questions);
    const insertIndex = Math.floor(Math.random() * shuffledRegular.length) + 1;
    app.shuffledQuestions = [
        ...shuffledRegular.slice(0, insertIndex),
        specialQuestions[0],
        specialQuestions[1],
        ...shuffledRegular.slice(insertIndex)
    ];
    clearState();
    saveState();
    renderQuestions();
    showScreen('test');
}

function resumeOrStartTest() {
    if (loadState()) {
        renderQuestions();
        showScreen('test');
    } else {
        startTest();
    }
}

// ─── 初始化与安全事件绑定 ────────────────────────────────────
function bindBtn(id, handler) {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('click', handler);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    checkSavedState();
    // 首次进入写入初始状态记录
    if (!history.state || !history.state.screen) {
        history.replaceState({ screen: 'intro' }, '', window.location.pathname + window.location.search);
    }
});

// 监听浏览器返回按钮（移动端侧边滑动返回 / 物理返回键）
window.addEventListener('popstate', (e) => {
    if (e.state && e.state.screen) {
        showScreen(e.state.screen, false);
    } else {
        showScreen('intro', false);
    }
});

bindBtn('startBtn',     resumeOrStartTest);
bindBtn('freshStartBtn', startTest);
bindBtn('backIntroBtn', () => { showScreen('intro'); checkSavedState(); });
bindBtn('submitBtn',    handleSubmit);
bindBtn('restartBtn',   startTest);
bindBtn('toTopBtn',     () => showScreen('intro'));
bindBtn('aiTriggerBtn', triggerAiAnalysis);

const navStartHandler = (e) => {
    e.preventDefault();
    resumeOrStartTest();
    // 关闭可能打开的移动端菜单
    const menu = document.getElementById('navMobileMenu');
    if (menu) menu.classList.remove('active');
};
bindBtn('navStartBtn', navStartHandler);
bindBtn('navMobileStartBtn', navStartHandler);

// 劫持首页导航链接，如果已在首页则执行无刷新滚动
document.querySelectorAll('a[href="index.html"]').forEach(link => {
    link.addEventListener('click', (e) => {
        if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
            e.preventDefault();
            showScreen('intro');
            const menu = document.getElementById('navMobileMenu');
            if (menu) menu.classList.remove('active');
        }
    });
});
