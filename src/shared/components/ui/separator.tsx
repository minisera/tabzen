import { cn } from '@/shared/lib/utils';

export function Separator({ className }: { className?: string }) {
  return <hr className={cn('border-border', className)} />;
}
