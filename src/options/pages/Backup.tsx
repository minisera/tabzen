import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { sendMessage } from '@/shared/lib/runtime-client';
import { backupFilename, buildBackup, parseBackup, BACKUP_VERSION } from '@/shared/lib/backup';
import { useSettingsStore } from '@/shared/stores/settings-store';

type Status =
  | { kind: 'idle' }
  | { kind: 'ok'; message: string }
  | { kind: 'error'; message: string };

export function Backup() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const reload = useSettingsStore((s) => s.load);

  const onExport = async () => {
    setBusy(true);
    setStatus({ kind: 'idle' });
    try {
      const settings = await sendMessage({ kind: 'getSettings' });
      const json = JSON.stringify(buildBackup(settings), null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = backupFilename();
        document.body.appendChild(a);
        a.click();
        a.remove();
      } finally {
        // 即時 revoke だと一部ブラウザで download が中断するので
        // 次フレームに遅延させる。
        setTimeout(() => URL.revokeObjectURL(url), 0);
      }
      setStatus({ kind: 'ok', message: 'バックアップを書き出しました' });
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const onPickFile = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    // 同じファイルを再選択しても onChange が発火するように value をリセット
    ev.target.value = '';
    if (!file) return;
    if (
      !window.confirm(
        '読み込んだ設定で現在の設定を上書きします。よろしいですか？\n(履歴・サムネイル・セッション等は影響を受けません)',
      )
    ) {
      return;
    }
    setBusy(true);
    setStatus({ kind: 'idle' });
    try {
      const text = await file.text();
      const json = JSON.parse(text) as unknown;
      const backup = parseBackup(json);
      await sendMessage({ kind: 'setSettings', settings: backup.settings });
      await reload();
      setStatus({
        kind: 'ok',
        message: `${new Date(backup.exportedAt).toLocaleString()} に書き出されたバックアップを読み込みました`,
      });
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold mb-1">バックアップ</h2>
        <p className="text-sm text-muted-foreground">
          設定を JSON ファイルとして書き出し / 読み込みします。Chrome
          アカウントに紐づかない端末への移行や、設定変更前のバックアップに使えます。
        </p>
      </header>

      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void onExport()} disabled={busy}>
            <Download className="w-4 h-4" />
            設定を書き出す
          </Button>
          <Button variant="outline" onClick={onPickFile} disabled={busy}>
            <Upload className="w-4 h-4" />
            設定を読み込む
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void onFileChange(e)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          書き出されるのは設定 (閾値・除外ドメイン・MRU表示数など) のみ。バックアップ
          フォーマットバージョン:{' '}
          <code className="px-1 rounded bg-muted text-[10px]">v{BACKUP_VERSION}</code>
        </p>
        {status.kind === 'ok' && <p className="text-sm text-foreground">{status.message}</p>}
        {status.kind === 'error' && (
          <p className="text-sm text-destructive">読み込みに失敗しました: {status.message}</p>
        )}
      </Card>
    </div>
  );
}
