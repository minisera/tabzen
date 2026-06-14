import { cn } from '@/shared/lib/utils';

interface TabSwitcherPreviewProps {
  layout: 'vertical' | 'horizontal';
  wrap: boolean;
  columns: number;
}

// ダミーカード。実際のサムネ + タイトル/ホスト 2 行をグレーのプレースホルダで再現する。
// active=true の 1 枚だけ選択中ハイライトを当てて実物の見た目に寄せる。
function PreviewCard({ horizontal, active }: { horizontal: boolean; active: boolean }) {
  const ring = active ? 'border-primary bg-primary/10' : 'border-transparent';
  if (horizontal) {
    return (
      <div className={cn('flex flex-col gap-1 rounded-md border p-1', ring)}>
        <div className="h-10 w-full rounded-sm bg-muted" />
        <div className="h-1.5 w-3/4 rounded bg-muted-foreground/30" />
        <div className="h-1.5 w-1/2 rounded bg-muted-foreground/20" />
      </div>
    );
  }
  return (
    <div className={cn('flex items-center gap-2 rounded-md border px-2 py-1.5', ring)}>
      <div className="h-7 w-10 shrink-0 rounded-sm bg-muted" />
      <div className="flex-1 space-y-1">
        <div className="h-1.5 w-3/4 rounded bg-muted-foreground/30" />
        <div className="h-1.5 w-1/2 rounded bg-muted-foreground/20" />
      </div>
    </div>
  );
}

/**
 * オプション画面に表示する Ctrl+Q オーバーレイのライブプレビュー。
 * layout / wrap / columns の組み合わせを、実際のオーバーレイと同じ構造
 * (縦リスト / 横一列スクロール / 折り返しグリッド) でダミー表示する。
 */
export function TabSwitcherPreview({ layout, wrap, columns }: TabSwitcherPreviewProps) {
  const horizontal = layout === 'horizontal';
  // 折り返しが効いていることが分かるよう、列数より少し多めのカードを出す。
  // 折り返しなしは均等幅で全件 1 行に収まる様子を見せる。縦リストは数件で十分。
  const count = !horizontal ? 5 : wrap ? columns + 2 : 5;
  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">プレビュー</p>
      <div className="rounded-lg border border-border bg-card p-3">
        <ul
          data-testid="tab-switcher-preview"
          data-layout={layout}
          data-wrap={String(wrap)}
          data-columns={columns}
          className={cn(
            horizontal
              ? wrap
                ? 'grid gap-2'
                : 'flex gap-2'
              : 'flex flex-col gap-1.5 max-h-44 overflow-y-auto',
          )}
          style={
            horizontal && wrap
              ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
              : undefined
          }
        >
          {items.map((i) => (
            <li key={i} className={horizontal && !wrap ? 'flex-1 min-w-0' : ''}>
              <PreviewCard horizontal={horizontal} active={i === 0} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
