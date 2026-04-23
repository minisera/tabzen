import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { useSettingsStore } from '@/shared/stores/settings-store';

export function Allowlist() {
  const { draft, settings, setDraft, save, reset, saving, error } = useSettingsStore();
  const [input, setInput] = useState('');

  const add = () => {
    const v = input.trim();
    if (!v) return;
    if (draft.allowlist.includes(v)) {
      setInput('');
      return;
    }
    setDraft({ allowlist: [...draft.allowlist, v] });
    setInput('');
  };

  const remove = (d: string) => {
    setDraft({ allowlist: draft.allowlist.filter((x) => x !== d) });
  };

  const dirty = JSON.stringify(settings.allowlist) !== JSON.stringify(draft.allowlist);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold mb-1">除外ドメイン</h2>
        <p className="text-sm text-muted-foreground">
          ここに登録したドメインのタブは自動クローズ・サスペンドの対象外になります。
          <code className="mx-1 px-1 rounded bg-muted text-xs">*.example.com</code>
          でサブドメインも一致します。
        </p>
      </header>
      <Card className="p-5 space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="flex gap-2"
        >
          <Input
            placeholder="github.com または *.notion.so"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button type="submit">
            <Plus className="w-4 h-4" />
            追加
          </Button>
        </form>

        {draft.allowlist.length === 0 ? (
          <p className="text-sm text-muted-foreground">まだ登録されていません。</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {draft.allowlist.map((d) => (
              <li
                key={d}
                className="flex items-center justify-between px-3 py-2 rounded-md bg-secondary/60"
              >
                <code className="text-sm">{d}</code>
                <button
                  type="button"
                  onClick={() => remove(d)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`${d} を削除`}
                >
                  <X className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {dirty && (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={reset} disabled={saving}>
              取り消し
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
