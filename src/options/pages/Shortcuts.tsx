import { useEffect, useState } from 'react';
import { ExternalLink, Info } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Tooltip } from '@/shared/components/ui/tooltip';

interface Command {
  name?: string;
  description?: string;
  shortcut?: string;
}

// デフォルトキーを敢えて割り当てていないコマンドの理由。
// 単に「未設定」と表示するだけだと意図 (危険性 / Chrome の上限) が伝わらないので
// hover ツールチップで補足する。
const UNSET_REASON: Record<string, string> = {
  'close-all-window':
    '誤操作で全タブを失うのを防ぐため、デフォルトキーを割り当てていません。chrome://extensions/shortcuts から手動で設定してください。',
  'switch-tab-fallback-prev':
    'Chrome がデフォルトキーを割り当てられるコマンド数 (4) の上限に達するため、手動割り当て運用にしています。chrome://extensions/shortcuts から設定してください。',
};

export function Shortcuts() {
  const [commands, setCommands] = useState<Command[]>([]);

  useEffect(() => {
    chrome.commands
      .getAll()
      // _execute_action などアンダースコア始まりの予約コマンドは Chrome が
      // 自動生成するもの (ツールバーアイコンのキー起動等) で、ユーザーが
      // 通常編集しないため非表示にする。
      .then((list) => setCommands(list.filter((c) => !c.name?.startsWith('_'))))
      .catch(console.error);
  }, []);

  const openShortcutsPage = () => {
    void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold mb-1">ショートカット</h2>
        <p className="text-sm text-muted-foreground">
          Chrome の仕様上キーバインドの変更は拡張内からは行えません。下のボタンから Chrome
          設定画面を開いて編集してください。
        </p>
      </header>
      <Card className="p-5 space-y-4">
        <ul className="flex flex-col divide-y divide-border">
          {commands.map((cmd) => {
            const reason = cmd.name ? UNSET_REASON[cmd.name] : undefined;
            return (
              <li key={cmd.name} className="flex items-center justify-between py-3 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{cmd.description || cmd.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{cmd.name}</p>
                </div>
                {cmd.shortcut ? (
                  <kbd className="px-2 py-1 text-xs rounded-md bg-muted shrink-0">
                    {cmd.shortcut}
                  </kbd>
                ) : reason ? (
                  <Tooltip content={reason} side="top" align="end" className="shrink-0 cursor-help">
                    <span
                      tabIndex={0}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-muted text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Info className="w-3 h-3" />
                      未設定
                    </span>
                  </Tooltip>
                ) : (
                  <kbd className="px-2 py-1 text-xs rounded-md bg-muted shrink-0">未設定</kbd>
                )}
              </li>
            );
          })}
        </ul>
        <Button variant="outline" onClick={openShortcutsPage}>
          <ExternalLink className="w-4 h-4" />
          chrome://extensions/shortcuts を開く
        </Button>
      </Card>
    </div>
  );
}
