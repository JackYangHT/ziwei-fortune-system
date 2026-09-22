const fs = require('fs');
const path = require('path');
const { astro } = require('C:/Users/Jack/AppData/Local/hermes/node/node_modules/ziwei_iztro-mcpserver/node_modules/iztro');

// Birth: 1990-03-15 未時 (birthTime index 7), Male
const astrolabe = astro.bySolar('1990-03-15', 7, '男', true, 'zh-CN');

function formatPalace(p, h) {
  if (!p) return null;
  const dailyStars = (h.daily.stars && h.daily.stars[p.index]) ? h.daily.stars[p.index].map(s => s.name) : [];
  return {
    earthlyBranch: p.earthlyBranch,
    natalPalace: p.name,
    index: p.index,
    majorStars: p.majorStars.map(s => ({
      name: s.name,
      mutagen: s.mutagen || ''
    })),
    minorStars: p.minorStars.map(s => ({
      name: s.name,
      mutagen: s.mutagen || ''
    })),
    adjectiveStars: p.adjectiveStars.map(s => s.name),
    changsheng12: p.changsheng12 || '',
    dailyStars: dailyStars
  };
}

const yearData = [];
const palaceKeyMap = {
  '命宫': 'dailyMing',
  '兄弟': 'dailyXiongdi',
  '夫妻': 'dailyFuqi',
  '子女': 'dailyZinv',
  '财帛': 'dailyCaibo',
  '疾厄': 'dailyJie',
  '迁移': 'dailyQianyi',
  '仆役': 'dailyPuyi',
  '官禄': 'dailyGuanlu',
  '田宅': 'dailyTianzhai',
  '福德': 'dailyFude',
  '父母': 'dailyFumu'
};

const palaceNames = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];

for (let d = 0; d < 365; d++) {
  const cur = new Date(2026, 0, 1 + d);
  const y = cur.getFullYear();
  const m = String(cur.getMonth() + 1).padStart(2, '0');
  const dayNum = String(cur.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${dayNum}`;
  const h = astrolabe.horoscope(dateStr);

  const palacesByBranch = {};
  const formattedPalaces = {};

  palaceNames.forEach(pName => {
    const p = h.palace(pName, 'daily');
    const formatted = formatPalace(p, h);
    if (formatted) {
      formattedPalaces[palaceKeyMap[pName]] = formatted;
      palacesByBranch[formatted.earthlyBranch] = formatted;
    }
  });

  const record = {
    date: dateStr,
    dailyGanZhi: h.daily.heavenlyStem + h.daily.earthlyBranch,
    lunarDate: h.lunarDate || '',
    dailySiHua: {
      化禄: h.daily.mutagen[0] || '',
      化权: h.daily.mutagen[1] || '',
      化科: h.daily.mutagen[2] || '',
      化忌: h.daily.mutagen[3] || ''
    },
    ...formattedPalaces,
    palacesByBranch
  };

  yearData.push(record);
}

const outDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const outFile = path.join(outDir, 'daily_data_2026.json');
fs.writeFileSync(outFile, JSON.stringify(yearData, null, 2), 'utf8');
console.log(`Successfully generated ${yearData.length} daily records to ${outFile}`);
