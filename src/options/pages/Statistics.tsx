import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { RotateCw, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import type { DayStat } from '@/shared/schema/daily-stats';
import { sendMessage } from '@/shared/lib/runtime-client';

const RANGE_DAYS = 30;
const CHART_HEIGHT = 160;

interface State {
  items: DayStat[];
  loading: boolean;
  error: string | null;
}

function buildSeries(items: DayStat[], days: number): DayStat[] {
  const map = new Map(items.map((s) => [s.date, s]));
  const today = dayjs();
  const series: DayStat[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = today.subtract(i, 'day').format('YYYY-MM-DD');
    series.push(map.get(d) ?? { date: d, autoClosed: 0, manualClosed: 0, suspended: 0 });
  }
  return series;
}

interface BarChartProps {
  series: DayStat[];
}

function BarChart({ series }: BarChartProps) {
  const max = Math.max(
    1,
    ...series.map((s) => s.autoClosed + s.manualClosed),
    ...series.map((s) => s.suspended),
  );
  const w = 100 / series.length;

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-primary/70" />
          自動クローズ
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-primary/40" />
          手動クローズ
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-secondary-foreground/40" />
          サスペンド
        </span>
        <span className="ml-auto tabular-nums">最大 {max} 件 / 日</span>
      </div>
      <svg
        viewBox={`0 0 100 ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="w-full bg-secondary/30 rounded-md border border-border"
        role="img"
        aria-label="日次タブ処理数"
      >
        {series.map((s, i) => {
          const x = i * w;
          const closedTotal = s.autoClosed + s.manualClosed;
          // 縦に積む: closed (auto + manual)
          const closedH = (closedTotal / max) * (CHART_HEIGHT - 4);
          const autoH = (s.autoClosed / max) * (CHART_HEIGHT - 4);
          // 別カラム: suspended (隣接して並べる)
          const suspH = (s.suspended / max) * (CHART_HEIGHT - 4);
          const barW = w * 0.4;
          const gap = w * 0.1;
          return (
            <g key={s.date}>
              <title>
                {s.date}: 自動 {s.autoClosed} / 手動 {s.manualClosed} / サスペンド {s.suspended}
              </title>
              {/* close stacked: manual の上に auto */}
              <rect
                x={x + gap}
                y={CHART_HEIGHT - closedH}
                width={barW}
                height={closedH - autoH}
                className="fill-primary/40"
              />
              <rect
                x={x + gap}
                y={CHART_HEIGHT - autoH}
                width={barW}
                height={autoH}
                className="fill-primary/70"
              />
              {/* suspended */}
              <rect
                x={x + gap + barW + 1}
                y={CHART_HEIGHT - suspH}
                width={barW}
                height={suspH}
                className="fill-foreground/30"
              />
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{series[0]?.date}</span>
        <span>{series[series.length - 1]?.date}</span>
      </div>
    </div>
  );
}

export function Statistics() {
  const [state, setState] = useState<State>({ items: [], loading: true, error: null });

  const refresh = useCallback(async () => {
    try {
      const items = await sendMessage({ kind: 'getDailyStats' });
      setState({ items, loading: false, error: null });
    } catch (e) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const series = useMemo(() => buildSeries(state.items, RANGE_DAYS), [state.items]);
  const totals = useMemo(() => {
    return series.reduce(
      (acc, s) => ({
        autoClosed: acc.autoClosed + s.autoClosed,
        manualClosed: acc.manualClosed + s.manualClosed,
        suspended: acc.suspended + s.suspended,
      }),
      { autoClosed: 0, manualClosed: 0, suspended: 0 },
    );
  }, [series]);

  const clear = async () => {
    if (!window.confirm('集計データを全て削除しますか？')) return;
    await sendMessage({ kind: 'clearDailyStats' });
    await refresh();
  };

  const { loading, error } = state;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold mb-1">統計</h2>
        <p className="text-sm text-muted-foreground">
          自動クローズ・サスペンドの実績を可視化します。直近 {RANGE_DAYS} 日 (最大 90 日まで保持)。
        </p>
      </header>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="grid grid-cols-3 gap-6 text-sm">
            <Stat label="自動クローズ" value={totals.autoClosed} />
            <Stat label="手動クローズ" value={totals.manualClosed} />
            <Stat label="サスペンド" value={totals.suspended} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              <RotateCw className="w-4 h-4" />
              更新
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void clear()}>
              <Trash2 className="w-4 h-4" />
              クリア
            </Button>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {loading ? (
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        ) : (
          <BarChart series={series} />
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
