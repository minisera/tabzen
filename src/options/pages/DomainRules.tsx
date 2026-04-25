import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { DurationInput } from '@/shared/components/duration-input';
import type { DomainRule } from '@/shared/schema/settings';
import { useSettingsStore } from '@/shared/stores/settings-store';

interface NewRuleDraft {
  pattern: string;
  mode: 'neverClose' | 'custom';
  suspendAfterMinutes: number;
  closeAfterMinutes: number;
}

const INITIAL_DRAFT: NewRuleDraft = {
  pattern: '',
  mode: 'neverClose',
  suspendAfterMinutes: 60,
  closeAfterMinutes: 24 * 60,
};

function describe(rule: DomainRule): string {
  if (rule.mode === 'neverClose') return 'クローズしない';
  return `${rule.suspendAfterMinutes ?? '?'} 分でサスペンド / ${rule.closeAfterMinutes ?? '?'} 分でクローズ`;
}

export function DomainRules() {
  const { draft, settings, setDraft, save, reset, saving, error } = useSettingsStore();
  const [newRule, setNewRule] = useState<NewRuleDraft>(INITIAL_DRAFT);

  const dirty = JSON.stringify(settings.domainRules) !== JSON.stringify(draft.domainRules);

  const add = () => {
    const pattern = newRule.pattern.trim();
    if (!pattern) return;
    if (draft.domainRules.some((r) => r.pattern === pattern)) {
      // 同じ pattern の重複は許さない (UI 上のシンプルさのため)
      return;
    }
    const rule: DomainRule =
      newRule.mode === 'neverClose'
        ? { pattern, mode: 'neverClose' }
        : {
            pattern,
            mode: 'custom',
            suspendAfterMinutes: newRule.suspendAfterMinutes,
            closeAfterMinutes: newRule.closeAfterMinutes,
          };
    setDraft({ domainRules: [...draft.domainRules, rule] });
    setNewRule(INITIAL_DRAFT);
  };

  const remove = (pattern: string) => {
    setDraft({ domainRules: draft.domainRules.filter((r) => r.pattern !== pattern) });
  };

  const customInvalid =
    newRule.mode === 'custom' && newRule.suspendAfterMinutes >= newRule.closeAfterMinutes;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold mb-1">ドメインルール</h2>
        <p className="text-sm text-muted-foreground">
          ドメインごとに自動処理の挙動を上書きします。「クローズしない」または独自の閾値を設定可能。
          先頭から順にマッチした最初のルールが適用されます。
          <code className="mx-1 px-1 rounded bg-muted text-xs">*.example.com</code>
          でサブドメインも一致します。
        </p>
      </header>

      <Card className="p-5 space-y-4">
        <Label htmlFor="rulePattern">新規ルール</Label>
        <div className="space-y-3">
          <Input
            id="rulePattern"
            placeholder="github.com または *.notion.so"
            value={newRule.pattern}
            onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
          />
          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="ruleMode"
                checked={newRule.mode === 'neverClose'}
                onChange={() => setNewRule({ ...newRule, mode: 'neverClose' })}
              />
              クローズしない
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="ruleMode"
                checked={newRule.mode === 'custom'}
                onChange={() => setNewRule({ ...newRule, mode: 'custom' })}
              />
              独自閾値
            </label>
          </div>

          {newRule.mode === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">サスペンド閾値</Label>
                <DurationInput
                  value={newRule.suspendAfterMinutes}
                  onChange={(m) => setNewRule({ ...newRule, suspendAfterMinutes: m })}
                  minMinutes={1}
                  maxMinutes={24 * 60}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">クローズ閾値</Label>
                <DurationInput
                  value={newRule.closeAfterMinutes}
                  onChange={(m) => setNewRule({ ...newRule, closeAfterMinutes: m })}
                  minMinutes={2}
                  maxMinutes={30 * 24 * 60}
                />
              </div>
            </div>
          )}

          {customInvalid && (
            <p className="text-xs text-destructive">
              サスペンド閾値はクローズ閾値より短くしてください。
            </p>
          )}

          <Button onClick={add} disabled={!newRule.pattern.trim() || customInvalid}>
            <Plus className="w-4 h-4" />
            追加
          </Button>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="text-sm font-semibold">適用中のルール</h3>
        {draft.domainRules.length === 0 ? (
          <p className="text-sm text-muted-foreground">まだ登録されていません。</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {draft.domainRules.map((r) => (
              <li
                key={r.pattern}
                className="flex items-center justify-between px-3 py-2 rounded-md bg-secondary/60"
              >
                <div className="min-w-0">
                  <code className="text-sm">{r.pattern}</code>
                  <p className="text-xs text-muted-foreground">{describe(r)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(r.pattern)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`${r.pattern} を削除`}
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
