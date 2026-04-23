import { useCallback, useEffect, useState } from 'react';
import type { ClosedTab } from '@/shared/schema/tab-meta';
import type { Stats } from '@/shared/types';
import { sendMessage } from '@/shared/lib/runtime-client';

interface PopupData {
  stats: Stats | null;
  history: ClosedTab[];
  loading: boolean;
  error: string | null;
}

interface PopupDataState extends PopupData {
  refresh: () => Promise<void>;
}

async function fetchData(): Promise<{ stats: Stats; history: ClosedTab[] }> {
  const [stats, history] = await Promise.all([
    sendMessage({ kind: 'getStats' }),
    sendMessage({ kind: 'listHistory' }),
  ]);
  return { stats, history };
}

export function usePopupData(): PopupDataState {
  const [data, setData] = useState<PopupData>({
    stats: null,
    history: [],
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    try {
      const { stats, history } = await fetchData();
      setData({ stats, history, loading: false, error: null });
    } catch (e) {
      setData((prev) => ({
        ...prev,
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...data, refresh };
}
