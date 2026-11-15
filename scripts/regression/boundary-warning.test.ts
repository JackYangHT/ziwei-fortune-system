import assert from 'node:assert/strict';
import {
  checkBoundaryWarning,
  checkSolarTermCrossing,
  getMinutesToNearestHourBoundary,
} from '../../lib/bazi/boundary-warning';

// 1. 普通时刻（不靠近节气、不靠近奇数整点交时）→ 三个 pending 均为 false
{
  const res = checkBoundaryWarning(
    { year: '丙午', month: '癸巳', day: '甲子', hour: '庚午' },
    { year: 2026, month: 5, day: 15, hour: 12, minute: 0, tz: 8 },
  );
  assert.equal(res.yearPending, false);
  assert.equal(res.monthPending, false);
  assert.equal(res.hourPending, false);
  assert.equal(res.adjustedPillars.year, '丙午');
  assert.equal(res.adjustedPillars.month, '癸巳');
  assert.equal(res.adjustedPillars.hour, '庚午');
}

// 2. 立春交节前后 6 小时内（2026-02-04 04:02 左右立春）→ yearPending 與 monthPending 均為 true
{
  const res = checkBoundaryWarning(
    { year: '乙巳', month: '己丑', day: '己酉', hour: '丙寅' },
    '2026-02-04 03:30',
  );
  assert.equal(res.yearPending, true);
  assert.equal(res.monthPending, true);
  assert.equal(res.solarTermName, '立春');
  assert.equal(res.adjustedPillars.year, '待確認');
  assert.equal(res.adjustedPillars.month, '待確認');
}

// 3. 非立春的其他节气交节前后 6 小时内（例如 2026-03-05 21:58 左右驚蟄）→ 僅 monthPending 為 true，yearPending 為 false
{
  const st = checkSolarTermCrossing(2026, 3, 5, 22.0, 8);
  assert.equal(st.isNearSolarTerm, true);
  assert.equal(st.termName, '驚蟄');

  const res = checkBoundaryWarning(
    { year: '丙午', month: '庚寅', day: '戊寅', hour: '癸亥' },
    { year: 2026, month: 3, day: 5, hour: 22, minute: 0, tz: 8 },
  );
  assert.equal(res.yearPending, false);
  assert.equal(res.monthPending, true);
  assert.equal(res.hourPending, false);
}

// 4. 时辰交界点前后 10 分钟内（例如 13:05 距离 13:00 丑/未奇数整点仅 5 分钟）→ hourPending 為 true
{
  assert.equal(getMinutesToNearestHourBoundary(13 * 60 + 5), 5);
  const res = checkBoundaryWarning(
    { year: '丙午', month: '癸巳', day: '甲子', hour: '辛未' },
    { year: 2026, month: 5, day: 15, hour: 13, minute: 5, tz: 8 },
  );
  assert.equal(res.yearPending, false);
  assert.equal(res.monthPending, false);
  assert.equal(res.hourPending, true);
  assert.equal(res.adjustedPillars.hour, '待確認');
}

// 5. 真太阳时偏移导致跨时辰（例如钟表时间 11:10 午时，真太阳时偏移 -25 分钟变为 10:45 巳时）→ hourPending 為 true
{
  const res = checkBoundaryWarning(
    { year: '丙午', month: '癸巳', day: '甲子', hour: '庚午' },
    {
      year: 2026,
      month: 5,
      day: 15,
      hour: 11,
      minute: 10,
      tz: 8,
      solarOffsetMinutes: -25,
    },
  );
  assert.equal(res.clockShichenMismatch, true);
  assert.equal(res.hourPending, true);
}

console.log('✓ boundary-warning regression tests passed');
