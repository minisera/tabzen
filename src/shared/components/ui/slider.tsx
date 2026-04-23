import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/utils';

export const Slider = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="range"
      className={cn(
        'w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary',
        className,
      )}
      {...props}
    />
  ),
);
Slider.displayName = 'Slider';
