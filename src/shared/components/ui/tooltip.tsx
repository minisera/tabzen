import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

type Side = 'top' | 'bottom';
type Align = 'start' | 'center' | 'end';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: Side;
  align?: Align;
  className?: string;
  contentClassName?: string;
}

export function Tooltip({
  content,
  children,
  side = 'bottom',
  align = 'center',
  className,
  contentClassName,
}: TooltipProps) {
  return (
    <div className={cn('group relative', className)}>
      {children}
      <div
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-30 w-max max-w-[220px] rounded-md border border-border bg-card px-2.5 py-1.5 text-xs leading-snug font-normal text-card-foreground text-left whitespace-normal shadow-lg opacity-0 transition-opacity duration-150',
          'group-hover:opacity-100 group-focus-within:opacity-100',
          side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
          align === 'start' && 'left-0',
          align === 'center' && 'left-1/2 -translate-x-1/2',
          align === 'end' && 'right-0',
          contentClassName,
        )}
      >
        {content}
      </div>
    </div>
  );
}
