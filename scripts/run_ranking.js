const fs = require('fs');
const path = require('path');
const { scoreDay } = require('./scoring_engine');

const dataFile = path.join(__dirname, '..', 'data', 'daily_data_2026.json');
if (!fs.existsSync(dataFile)) {
  console.error(`File not found: ${dataFile}. Please run generate_data.js first.`);
  process.exit(1);
}

const dailyData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
console.log(`Loaded ${dailyData.length} daily records.`);

const categories = [
  { key: 'piancai', name: '偏財日', desc: '偏財爆發、投資獲利' },
  { key: 'taohua', name: '桃花日', desc: '異性緣佳、情感魅力' },
  { key: 'rouyu', name: '肉慾日', desc: '激情浪漫、感官享受' },
  { key: 'guiren', name: '貴人日', desc: '提攜相助、逢凶化吉' },
  { key: 'shiye', name: '事業日', desc: '升遷突破、職場權力' },
  { key: 'jiankang', name: '健康日', desc: '元氣充沛、身心調理' },
  { key: 'shangji', name: '巨大商機日', desc: '商業談判、投資佈局、啟動專案' },
  { key: 'letou', name: '樂透運', desc: '八字飛財、火貪格、破軍化祿/祿存、財帛祿忌' }
];

const categoryRankings = {};

categories.forEach(cat => {
  categoryRankings[cat.key] = [];
});

const defaultBazi = {
  yearly: ['庚', '午'],
  daily: ['丁', '卯'],
  hourly: ['丁', '未']
};

dailyData.forEach(day => {
  const scores = scoreDay(day, { bazi: defaultBazi });

  categories.forEach(cat => {
    categoryRankings[cat.key].push({
      date: day.date,
      dailyGanZhi: day.dailyGanZhi,
      lunarDate: day.lunarDate,
      score: scores[cat.key].score,
      details: scores[cat.key].details,
      dailyMingBranch: day.dailyMing ? day.dailyMing.earthlyBranch : '',
      dailySiHua: day.dailySiHua
    });
  });
});

// 依分數由大到小排序 (若分數相同則按日期升序)
const outputResults = {};

console.log('\n======================================================');
console.log('       2026 年（丙午年）流日六大運勢排行榜 TOP 10');
console.log('======================================================\n');

categories.forEach(cat => {
  categoryRankings[cat.key].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.date.localeCompare(b.date);
  });

  // 計算分數區間統計
  const scoreDistribution = {};
  categoryRankings[cat.key].forEach(x => {
    scoreDistribution[x.score] = (scoreDistribution[x.score] || 0) + 1;
  });

  // 取得各分數階梯代表日 (例如 8分、7分、6分、5分、4分代表日)
  const distinctScores = [...new Set(categoryRankings[cat.key].map(x => x.score))].sort((a, b) => b - a);
  const scoreLadderRepresentatives = distinctScores.map(score => {
    const day = categoryRankings[cat.key].find(x => x.score === score);
    return {
      score,
      totalDaysWithThisScore: scoreDistribution[score],
      representativeDay: {
        date: day.date,
        dailyGanZhi: day.dailyGanZhi,
        details: day.details
      }
    };
  });

  const top10 = categoryRankings[cat.key].slice(0, 10);
  outputResults[cat.key] = {
    name: cat.name,
    desc: cat.desc,
    scoreDistribution,
    scoreLadderRepresentatives,
    top10: top10
  };

  console.log(`🏆【${cat.name}】Top 10 排行榜 (${cat.desc})：`);
  console.log('------------------------------------------------------');
  top10.forEach((item, idx) => {
    const rulesStr = item.details.map(d => `${d.rule}(${d.points > 0 ? '+' : ''}${d.points})`).join('、 ');
    console.log(`第 ${String(idx + 1).padStart(2, ' ')} 名 | 日期: ${item.date} (${item.dailyGanZhi}日) | 得分: ${String(item.score).padStart(2, ' ')} 分 | 觸發: ${rulesStr || '無特殊星曜'}`);
  });

  console.log(`📈 全年分數區間梯隊 (Score -> 天數):`);
  const ladderStr = distinctScores.map(sc => `${sc}分(${scoreDistribution[sc]}天)`).join(' → ');
  console.log(`   ${ladderStr}\n`);
});

const outRankingFile = path.join(__dirname, '..', 'data', 'rankings_2026.json');
fs.writeFileSync(outRankingFile, JSON.stringify(outputResults, null, 2), 'utf8');
console.log(`Rankings successfully written to: ${outRankingFile}`);

// 同步複製至 webapp/data/
const webappDataDir = path.join(__dirname, '..', 'webapp', 'data');
if (!fs.existsSync(webappDataDir)) {
  fs.mkdirSync(webappDataDir, { recursive: true });
}
const webappRankingFile = path.join(webappDataDir, 'rankings_2026.json');
fs.writeFileSync(webappRankingFile, JSON.stringify(outputResults, null, 2), 'utf8');
console.log(`Rankings also synced to: ${webappRankingFile}`);
