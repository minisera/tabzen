import type { SVGProps } from 'react';

/**
 * 禅の円相 (enso) をモチーフにしたブランドアイコン。
 * stroke は currentColor を使うので、親の text-* クラスで色が変わる。
 */
export function ZenIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 128 128"
      fill="none"
      stroke="currentColor"
      strokeWidth={10}
      strokeLinecap="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <circle cx="64" cy="64" r="46" strokeDasharray="240 90" transform="rotate(-35 64 64)" />
    </svg>
  );
}
