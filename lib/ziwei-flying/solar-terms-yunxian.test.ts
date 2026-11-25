import assert from 'node:assert/strict';
import { astro } from 'iztro';
import { generateChart } from '../ziwei/algorithm';
import { getSolarTermInfo } from './solar-terms';
import {
  computeYunxianSnapshot,
  resolveTargetDateFromQuestion,
} from './yunxian';
import {
  buildInterpretChatMessages,
  buildHemingChatMessages,
} from '../ai-client';

// 1. 驗證二十四節氣與五運六氣調候算法
const samples: { date: string; expectedTerm: string; expectedElement: string }[] = [
  { date: '2026-02-04T12:00:00', expectedTerm: '立春', expectedElement: '木' },
  { date: '2026-04-22T12:00:00', expectedTerm: '穀雨', expectedElement: '土' },
  { date: '2026-05-06T12:00:00', expectedTerm: '立夏', expectedElement: '火' },
  { date: '2026-07-24T12:00:00', expectedTerm: '大暑', expectedElement: '土' },
  { date: '2026-08-08T12:00:00', expectedTerm: '立秋', expectedElement: '金' },
  { date: '2026-10-24T12:00:00', expectedTerm: '霜降', expectedElement: '土' },
  { date: '2026-11-25T12:00:00', expectedTerm: '小雪', expectedElement: '水' },
  { date: '2026-12-25T12:00:00', expectedTerm: '冬至', expectedElement: '水' },
];

for (const s of samples) {
  const info = getSolarTermInfo(new Date(s.date));
  assert.equal(info.currentTerm, s.expectedTerm, `${s.date} expected ${s.expectedTerm}, got ${info.currentTerm}`);
  assert.equal(info.element, s.expectedElement, `${s.date} expected element ${s.expectedElement}, got ${info.element}`);
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(info.termStartDate), `termStartDate format invalid: ${info.termStartDate}`);
  assert.ok(info.nextTerm.length > 0 && info.nextTerm !== info.currentTerm, `nextTerm must differ from currentTerm: ${info.currentTerm} vs ${info.nextTerm}`);
  assert.ok(info.description.length > 0);
  assert.ok(info.wuYun && info.wuYun.includes('丙年水運太過'), `2026 should be 丙年水運太過, got ${info.wuYun}`);
  assert.ok(info.liuQiSiTian && info.liuQiSiTian.includes('少陰君火司天'));
  assert.ok(info.tiaoHouAdvice && info.tiaoHouAdvice.length > 5);
}

// 2. 驗證五層運限實算（大限、小限、流年、流月、流日），並與 iztro 交叉驗證小限地支
const chart = generateChart({
  year: 1990,
  month: 5,
  day: 15,
  hour: 3,
  gender: 'male',
  name: '測試命主',
});
const targetDate = new Date(2026, 10, 25, 12, 0, 0); // 2026-11-25
const yx = computeYunxianSnapshot(chart, targetDate);

const iz = astro.bySolar('1990-05-15', 3, '男', true, 'zh-CN');
const izHoro = iz.horoscope(targetDate);

assert.ok(yx.daXian, 'daXian should be computed');
assert.equal(yx.xiaoXian.branchName, izHoro.age.earthlyBranch, '小限地支須與 iztro 一致');
assert.equal(yx.liuNian.branchName, izHoro.yearly.earthlyBranch, '流年地支須與 iztro 一致');
assert.equal(yx.liuNian.stemName, izHoro.yearly.heavenlyStem, '流年天干須與 iztro 一致');
assert.equal(yx.liuYue.flights.length, 4);
assert.equal(yx.liuRi.flights.length, 4);
assert.ok(yx.daXianTimeline.length >= 6);

// 3. 驗證自然提問時間解析
const fixedNow = new Date(2026, 10, 25, 12, 0, 0);
const qNextYear = resolveTargetDateFromQuestion('我2027年3月適合換工作嗎？', 2026, fixedNow);
assert.equal(qNextYear.targetDate.getFullYear(), 2027);
assert.equal(qNextYear.targetDate.getMonth() + 1, 3);
assert.equal(qNextYear.explicitTimeDetected, true);

const qTomorrow = resolveTargetDateFromQuestion('明天去談合約順利嗎？', 2026, fixedNow);
assert.equal(qTomorrow.targetDate.getFullYear(), 2026);
assert.equal(qTomorrow.targetDate.getMonth() + 1, 11);
assert.equal(qTomorrow.targetDate.getDate(), 26);

// 4. 驗證 AI Prompt 同時具備三飛四化 + 大限/小限/流年/流月/流日 + 節氣五運六氣，且不同問題產生差異化上下文
const msgsWork = buildInterpretChatMessages(
  chart,
  [
    { role: 'user', content: '【起盤現況核對】...' },
    { role: 'assistant', content: '**【現況核對清單】**\n1. 事業狀態？' },
    { role: 'user', content: '我2027年3月適合換工作嗎？' },
  ],
  { referenceYear: 2026, now: fixedNow },
);
const msgsToday = buildInterpretChatMessages(
  chart,
  [
    { role: 'user', content: '【起盤現況核對】...' },
    { role: 'assistant', content: '**【現況核對清單】**\n1. 事業狀態？' },
    { role: 'user', content: '今天情緒很煩躁，身體有點累怎麼調養？' },
  ],
  { referenceYear: 2026, now: fixedNow },
);

const sysWork = msgsWork[0].content;
const sysToday = msgsToday[0].content;

for (const token of ['三飛四化完整實算', '12宮本命飛化祿忌流向', '大限(', '小限(', '流年(', '流月(', '流日(', '二十四節氣', '五運六氣']) {
  assert.ok(sysWork.includes(token), `sysWork missing ${token}`);
  assert.ok(sysToday.includes(token), `sysToday missing ${token}`);
}
// 追問模式下不應再夾帶「現況核對清單」流程指令，避免重複吐出核對表
assert.ok(!sysWork.includes('起盤「現況核對清單」機制'), 'direct question mode should omit fact-check questionnaire block');
// 兩個不同時間的問題，系統提示詞必須算出不同的時間與節氣
assert.ok(sysWork.includes('2027-03-'), 'work question should resolve to 2027-03');
assert.ok(sysToday.includes('2026-11-25'), 'today question should resolve to 2026-11-25');
assert.notEqual(sysWork, sysToday);
assert.ok(msgsWork[msgsWork.length - 1].content.includes('我2027年3月適合換工作嗎？'));
assert.ok(msgsToday[msgsToday.length - 1].content.includes('今天情緒很煩躁，身體有點累怎麼調養？'));

// 5. 驗證合盤追問模式不再重跑「單輪完整解讀＋星級」
const chartB = generateChart({
  year: 1992,
  month: 8,
  day: 20,
  hour: 7,
  gender: 'female',
  name: '乙方',
});
const hemingFollowUp = buildHemingChatMessages(
  chart,
  chartB,
  '我們下個月適合一起簽約合夥嗎？',
  '合夥人/同事',
  [{ role: 'assistant', content: '**【生活場景】**\n初輪解讀...' }],
  { now: fixedNow },
);
assert.ok(hemingFollowUp[0].content.includes('本次為合盤追問輪'));
assert.ok(hemingFollowUp[0].content.includes('五層運限實算'));
assert.ok(hemingFollowUp[0].content.includes('二十四節氣'));

console.log('✓ solar-terms, yunxian, and dynamic AI prompt unit tests passed');
