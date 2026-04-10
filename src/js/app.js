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
const AI_WORKER_URL = 'https://sbti-test-ai-analysis.leeyukiho-bdf.workers.dev/analyze';

// ─── 应用状态 ─────────────────────────────────────────────
const app = {
    shuffledQuestions: [],
    answers: {},
    previewMode: false
};

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
function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => {
        el.classList.toggle('active', key === name);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    const visible = [...app.shuffledQuestions];
    const gateIndex = visible.findIndex(q => q.id === 'drink_gate_q1');
    if (gateIndex !== -1 && app.answers['drink_gate_q1'] === 3) {
        visible.splice(gateIndex + 1, 0, specialQuestions[1]);
    }
    return visible;
}

/**
 * 获取题目的维度标签文本
 * @param {Object} q - 题目对象
 * @returns {string}
 */
function getQuestionMetaLabel(q) {
    if (q.special) return '补充题';
    return app.previewMode ? dimensionMeta[q.dim].name : '维度已隐藏';
}

// ─── 渲染逻辑 ─────────────────────────────────────────────
/**
 * 渲染题目列表到 DOM
 */
function renderQuestions() {
    const visibleQuestions = getVisibleQuestions();
    questionList.innerHTML = '';
    visibleQuestions.forEach((q, index) => {
        const card = document.createElement('article');
        card.className = 'question';
        card.innerHTML = `
          <div class="question-meta">
            <div class="badge">第 ${index + 1} 题</div>
            <div>${getQuestionMetaLabel(q)}</div>
          </div>
          <div class="question-title">${q.text}</div>
          <div class="options">
            ${q.options.map((opt, i) => {
            const code = ['A', 'B', 'C', 'D'][i] || String(i + 1);
            const checked = app.answers[q.id] === opt.value ? 'checked' : '';
            return `
                <label class="option">
                  <input type="radio" name="${q.id}" value="${opt.value}" ${checked} />
                  <div class="option-code">${code}</div>
                  <div>${opt.label}</div>
                </label>
              `;
        }).join('')}
          </div>
        `;
        questionList.appendChild(card);
    });

    // 绑定单选框变化事件
    questionList.querySelectorAll('input[type="radio"]').forEach(input => {
        input.addEventListener('change', (e) => {
            const { name, value } = e.target;
            app.answers[name] = Number(value);

            // 饮酒门控题：切换后重新渲染
            if (name === 'drink_gate_q1') {
                if (Number(value) !== 3) {
                    delete app.answers['drink_gate_q2'];
                }
                renderQuestions();
                return;
            }

            updateProgress();
        });
    });

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
    submitBtn.disabled = !complete;
    testHint.textContent = complete
        ? '都做完了。现在可以把你的电子魂魄交给结果页审判。'
        : '全选完才会放行。世界已经够乱了，起码把题做完整。';
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
    const resp = await fetch(AI_WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return data.analysis || '';
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

    // 重置 AI 区块为待触发状态，保存结果供按钮使用
    app.lastResult = result;
    resetAiZone();

    showScreen('result');
}

/**
 * 重置 AI 区块回初始待触发状态
 */
function resetAiZone() {
    document.getElementById('aiTriggerZone').classList.remove('ai-zone-hidden');
    document.getElementById('aiLoadingZone').classList.add('ai-zone-hidden');
    const aiText = document.getElementById('aiAnalysisText');
    aiText.classList.add('ai-zone-hidden');
    aiText.textContent = '';
    const btn = document.getElementById('aiTriggerBtn');
    btn.disabled = false;
    btn.textContent = '🧬 召唤 AI 毒舌锐评';
}

/**
 * 手动触发 AI 毒舌锐评
 */
async function triggerAiAnalysis() {
    const result = app.lastResult;
    if (!result) return;

    const btn = document.getElementById('aiTriggerBtn');
    const triggerZone = document.getElementById('aiTriggerZone');
    const loadingZone = document.getElementById('aiLoadingZone');
    const aiText = document.getElementById('aiAnalysisText');

    // 切换到 loading 状态
    btn.disabled = true;
    triggerZone.classList.add('ai-zone-hidden');
    loadingZone.classList.remove('ai-zone-hidden');
    aiText.classList.add('ai-zone-hidden');

    try {
        const analysis = await fetchAiAnalysis(result);
        // 隐藏 loading，显示结果
        loadingZone.classList.add('ai-zone-hidden');
        aiText.classList.remove('ai-zone-hidden');
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
        loadingZone.classList.add('ai-zone-hidden');
        triggerZone.classList.remove('ai-zone-hidden');
        btn.disabled = false;
        btn.textContent = '⚠️ 锐评失败，再试一次';
        console.error('AI 解读失败：', err);
    }
}

// ─── 测试启动 ─────────────────────────────────────────────
/**
 * 初始化并进入测试页
 * @param {boolean} preview - 是否显示维度标签（开发用）
 */
function startTest(preview = false) {
    app.previewMode = preview;
    app.answers = {};
    const shuffledRegular = shuffle(questions);
    const insertIndex = Math.floor(Math.random() * shuffledRegular.length) + 1;
    app.shuffledQuestions = [
        ...shuffledRegular.slice(0, insertIndex),
        specialQuestions[0],
        ...shuffledRegular.slice(insertIndex)
    ];
    renderQuestions();
    showScreen('test');
}

// ─── 事件绑定 ─────────────────────────────────────────────
document.getElementById('startBtn').addEventListener('click', () => startTest(false));
document.getElementById('backIntroBtn').addEventListener('click', () => showScreen('intro'));
document.getElementById('submitBtn').addEventListener('click', renderResult);
document.getElementById('restartBtn').addEventListener('click', () => startTest(false));
document.getElementById('toTopBtn').addEventListener('click', () => showScreen('intro'));
document.getElementById('aiTriggerBtn').addEventListener('click', triggerAiAnalysis);
