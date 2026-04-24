import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/utils';

type Unit = 'min' | 'hour' | 'day';

const SCALE: Record<Unit, number> = { min: 1, hour: 60, day: 1440 };
const LABEL: Record<Unit, string> = { min: '分', hour: '時間', day: '日' };

function guessUnit(minutes: number): Unit {
  if (minutes > 0 && minutes % 1440 === 0) return 'day';
  if (minutes > 0 && minutes % 60 === 0) return 'hour';
  return 'min';
}

interface DurationInputProps {
  id?: string;
  /** 分単位の値 */
  value: number;
  onChange: (minutes: number) => void;
  /** 最小値 (分単位) */
  minMinutes?: number;
  /** 最大値 (分単位) */
  maxMinutes?: number;
  className?: string;
}

export function DurationInput({
  id,
  value,
  onChange,
  minMinutes = 1,
  maxMinutes = 30 * 24 * 60,
  className,
}: DurationInputProps) {
  const [unit, setUnit] = useState<Unit>(() => guessUnit(value));
  const scale = SCALE[unit];
  const displayValue = Math.max(1, Math.round(value / scale));
  const minDisplay = Math.max(1, Math.ceil(minMinutes / scale));
  const maxDisplay = Math.max(minDisplay, Math.floor(maxMinutes / scale));

  const handleUnitChange = (next: Unit) => {
    setUnit(next);
    const nextScale = SCALE[next];
    const nextDisplay = Math.max(1, Math.round(value / nextScale));
    const clamped = Math.max(minMinutes, Math.min(maxMinutes, nextDisplay * nextScale));
    if (clamped !== value) onChange(clamped);
  };

  const handleValueChange = (raw: string) => {
    // 空欄や 0 は Number("") = 0 経由で minMinutes に強制され、
    // unit と value の整合性が崩れる (表示「1 時間」 / 実値 2 分のような
    // 不一致になりバリデーションが誤って発火)。1 未満は無視する。
    if (raw.trim() === '') return;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1) return;
    const minutes = Math.max(minMinutes, Math.min(maxMinutes, Math.round(n) * scale));
    onChange(minutes);
  };

  const units: Unit[] = ['min', 'hour', 'day'];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Input
        id={id}
        type="number"
        min={minDisplay}
        max={maxDisplay}
        value={displayValue}
        onChange={(e) => handleValueChange(e.target.value)}
        className="w-28 shrink-0"
      />
      <div className="inline-flex rounded-md border border-border overflow-hidden shrink-0">
        {units.map((u) => (
          <Button
            key={u}
            type="button"
            variant={u === unit ? 'default' : 'ghost'}
            size="sm"
            className="rounded-none border-0"
            onClick={() => handleUnitChange(u)}
          >
            {LABEL[u]}
          </Button>
        ))}
      </div>
    </div>
  );
}
