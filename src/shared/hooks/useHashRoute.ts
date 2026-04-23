import { useEffect, useState } from 'react';

export function useHashRoute(defaultRoute: string): [string, (next: string) => void] {
  const read = () => {
    if (typeof window === 'undefined') return defaultRoute;
    return window.location.hash.replace(/^#/, '') || defaultRoute;
  };

  const [hash, setHash] = useState<string>(read);

  useEffect(() => {
    const onChange = () => setHash(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultRoute]);

  const navigate = (next: string) => {
    window.location.hash = next;
  };
  return [hash, navigate];
}
