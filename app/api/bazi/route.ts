import { NextRequest, NextResponse } from 'next/server';
import { generateChart } from '@/lib/ziwei/algorithm';
import type { BirthInfo, ZiweiChart } from '@/lib/ziwei/types';
import { computeBazi } from '@/lib/bazi/chart';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      birthInfo?: BirthInfo;
      chart?: ZiweiChart;
      referenceYear?: number;
    };

    const chart = body.birthInfo
      ? generateChart(body.birthInfo)
      : body.chart;

    if (!chart) {
      return NextResponse.json(
        { error: 'Missing birthInfo or chart' },
        { status: 400 },
      );
    }

    const bazi = computeBazi({
      chart,
      gender: chart.birthInfo.gender === 'male' ? 'M' : 'F',
      referenceYear: body.referenceYear,
    });

    return NextResponse.json(bazi);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
