import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';

interface Command {
  name?: string;
  description?: string;
  shortcut?: string;
}

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
          {commands.map((cmd) => (
            <li key={cmd.name} className="flex items-center justify-between py-3 gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{cmd.description || cmd.name}</p>
                <p className="text-xs text-muted-foreground truncate">{cmd.name}</p>
              </div>
              <kbd className="px-2 py-1 text-xs rounded-md bg-muted shrink-0">
                {cmd.shortcut || '未設定'}
              </kbd>
            </li>
          ))}
        </ul>
        <Button variant="outline" onClick={openShortcutsPage}>
          <ExternalLink className="w-4 h-4" />
          chrome://extensions/shortcuts を開く
        </Button>
      </Card>
    </div>
  );
}
