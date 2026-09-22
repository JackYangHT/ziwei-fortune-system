const fs = require('fs');
const dailyData = JSON.parse(fs.readFileSync('data/daily_data_2026.json', 'utf8'));
const { scoreDay, scoreLetou, NAYIN_MAP } = require('./scoring_engine.js');

const defaultBazi = {
  yearly: ['庚', '午'],
  daily: ['丁', '卯'],
  hourly: ['丁', '未']
};

const scoredDays = dailyData.map(d => {
  const sc = scoreDay(d, { bazi: defaultBazi });
  return { ...d, scores: sc };
});

const todayStr = '2026-09-21';
const todayDay = scoredDays.find(d => d.date === todayStr);

console.log('--- TEST 1: 今天流日如何 ---');
console.log('當前抓取日期:', todayDay.date);
console.log('流日干支:', todayDay.dailyGanZhi + '日 (納音:' + NAYIN_MAP[todayDay.dailyGanZhi] + ')');
console.log('流日命宮:', todayDay.dailyMing.earthlyBranch + '宮 (本命' + todayDay.dailyMing.natalPalace + ')');
console.log('流日四化:', JSON.stringify(todayDay.dailySiHua));
console.log('今日各大評分:');
console.log('  桃花運:', todayDay.scores.taohua.score, '分');
console.log('  貴人運:', todayDay.scores.guiren.score, '分');
console.log('  偏財運:', todayDay.scores.piancai.score, '分');
console.log('  樂透運:', todayDay.scores.letou.score, '分');
console.log('  商機運:', todayDay.scores.shangji.score, '分');
console.log('  事業運:', todayDay.scores.shiye.score, '分');
console.log('  健康運:', todayDay.scores.jiankang.score, '分');

console.log('\n--- TEST 2: 哪一天適合買彩券 (未來 TOP 5) ---');
const futureDays = scoredDays.filter(d => d.date >= todayStr);
const letouRank = futureDays.map(d => ({
  date: d.date,
  ganzhi: d.dailyGanZhi,
  score: d.scores.letou.score,
  details: d.scores.letou.details
})).sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));

console.log('今天之後未來 TOP 5 彩券吉日:');
letouRank.slice(0, 5).forEach((item, idx) => {
  console.log(`第 ${idx + 1} 名: ${item.date} (${item.ganzhi}日) - 得分: ${item.score}分`);
  console.log('  觸發規則:', item.details.map(d => `${d.rule}(${d.points > 0 ? '+' : ''}${d.points})`).join('、 '));
});

console.log('\n--- TEST 3: 樂透運評分模組 (未來 TOP 10) ---');
console.log('今天之後未來 TOP 10 樂透吉日:');
letouRank.slice(0, 10).forEach((item, idx) => {
  console.log(`第 ${idx + 1} 名: ${item.date} (${item.ganzhi}日) - 得分: ${item.score}分`);
});

const anyPast = letouRank.slice(0, 10).some(d => d.date < todayStr);
console.log('\n過去日期排除驗證:', anyPast ? 'FAIL: 含過去日期' : 'PASS: 100% 全為今天或未來日期 (>= 2026-09-21)');
