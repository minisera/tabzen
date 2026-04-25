import { Card } from '@/shared/components/ui/card';
import pkg from '../../../package.json' with { type: 'json' };

const REPO_URL = 'https://github.com/minisera/tabzen';

export function About() {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold mb-1">About</h2>
        <p className="text-sm text-muted-foreground">Tab Zen について。</p>
      </header>
      <Card className="p-5 space-y-3 text-sm">
        <div>
          <span className="text-muted-foreground">バージョン: </span>
          <span className="font-mono">{pkg.version}</span>
        </div>
        <div>
          <span className="text-muted-foreground">説明: </span>
          <span>{pkg.description ?? 'タブ管理 Chrome 拡張'}</span>
        </div>
        <div>
          <span className="text-muted-foreground">ライセンス: </span>
          <a
            href={`${REPO_URL}/blob/main/LICENSE`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            MIT License
          </a>
        </div>
        <div>
          <span className="text-muted-foreground">リポジトリ: </span>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            github.com/minisera/tabzen
          </a>
        </div>
        <div>
          <span className="text-muted-foreground">プライバシー: </span>
          <a
            href={`${REPO_URL}/blob/main/PRIVACY.ja.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            プライバシーポリシー
          </a>
        </div>
      </Card>
    </div>
  );
}
