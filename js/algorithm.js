/**
 * algorithm.js — 纯算法层，不接触任何 DOM
 * 依赖 dataset.js 中的数据常量
 */

import {
    dimensionMeta,
    dimensionOrder,
    NORMAL_TYPES,
    TYPE_LIBRARY,
    DRUNK_TRIGGER_QUESTION_ID
} from './dataset.js';

/**
 * 将某维度的原始分数映射为 L / M / H 三级
 * @param {number} score - 该维度两题之和（2~6）
 * @returns {'L'|'M'|'H'}
 */
export function sumToLevel(score) {
    if (score <= 3) return 'L';
    if (score === 4) return 'M';
    return 'H';
}

/**
 * 将级别字母转换为数值，用于向量距离计算
 * @param {'L'|'M'|'H'} level
 * @returns {1|2|3}
 */
export function levelNum(level) {
    return { L: 1, M: 2, H: 3 }[level];
}

/**
 * 将 "HHH-HMH-..." 格式的模式字符串解析为字符数组
 * @param {string} pattern
 * @returns {string[]}
 */
export function parsePattern(pattern) {
    return pattern.replace(/-/g, '').split('');
}

/**
 * 根据 answers 判断是否触发了饮酒隐藏路径
 * @param {Object} answers - { [questionId]: number }
 * @returns {boolean}
 */
export function getDrunkTriggered(answers) {
    return answers[DRUNK_TRIGGER_QUESTION_ID] === 2;
}

/**
 * 核心算法：根据用户答案计算最终人格结果
 * @param {Object} answers   - 用户所有题目的答案 { [questionId]: number }
 * @param {Array}  questions - 普通题库数组（来自 dataset.js）
 * @returns {Object} result 对象，包含：
 *   rawScores, levels, ranked, bestNormal,
 *   finalType, modeKicker, badge, sub, special, secondaryType
 */
export function computeResult(answers, questions) {
    // 1. 累加每个维度的原始分数
    const rawScores = {};
    const levels = {};
    Object.keys(dimensionMeta).forEach(dim => { rawScores[dim] = 0; });

    questions.forEach(q => {
        rawScores[q.dim] += Number(answers[q.id] || 0);
    });

    // 2. 将原始分数转为 L/M/H 级别
    Object.entries(rawScores).forEach(([dim, score]) => {
        levels[dim] = sumToLevel(score);
    });

    // 3. 计算用户向量，与所有标准人格做欧式距离匹配
    const userVector = dimensionOrder.map(dim => levelNum(levels[dim]));
    const ranked = NORMAL_TYPES.map(type => {
        const vector = parsePattern(type.pattern).map(levelNum);
        let distance = 0;
        let exact = 0;
        for (let i = 0; i < vector.length; i++) {
            const diff = Math.abs(userVector[i] - vector[i]);
            distance += diff;
            if (diff === 0) exact += 1;
        }
        const similarity = Math.max(0, Math.round((1 - distance / 30) * 100));
        return { ...type, ...TYPE_LIBRARY[type.code], distance, exact, similarity };
    }).sort((a, b) => {
        if (a.distance !== b.distance) return a.distance - b.distance;
        if (b.exact !== a.exact) return b.exact - a.exact;
        return b.similarity - a.similarity;
    });

    const bestNormal = ranked[0];
    const drunkTriggered = getDrunkTriggered(answers);

    // 4. 决定最终人格（普通 / 饮酒隐藏 / HHHH 兜底）
    let finalType;
    let modeKicker = '你的主类型';
    let badge = `匹配度 ${bestNormal.similarity}% · 精准命中 ${bestNormal.exact}/15 维`;
    let sub = '维度命中度较高，当前结果可视为你的第一人格画像。';
    let special = false;
    let secondaryType = null;

    if (drunkTriggered) {
        finalType = TYPE_LIBRARY.DRUNK;
        secondaryType = bestNormal;
        modeKicker = '隐藏人格已激活';
        badge = '匹配度 100% · 酒精异常因子已接管';
        sub = '乙醇亲和性过强，系统已直接跳过常规人格审判。';
        special = true;
    } else if (bestNormal.similarity < 60) {
        finalType = TYPE_LIBRARY.HHHH;
        modeKicker = '系统强制兜底';
        badge = `标准人格库最高匹配仅 ${bestNormal.similarity}%`;
        sub = '标准人格库对你的脑回路集体罢工了，于是系统把你强制分配给了 HHHH。';
        special = true;
    } else {
        finalType = bestNormal;
    }

    return {
        rawScores,
        levels,
        ranked,
        bestNormal,
        finalType,
        modeKicker,
        badge,
        sub,
        special,
        secondaryType
    };
}
