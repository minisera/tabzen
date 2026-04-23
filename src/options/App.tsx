import { Settings } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto p-8">
        <header className="flex items-center gap-3 mb-8">
          <Settings className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Tab Tidy 設定</h1>
            <p className="text-sm text-muted-foreground">
              自動クローズ・サスペンド、除外ルール、ショートカットを管理します。
            </p>
          </div>
        </header>
        <main>
          <p className="text-sm text-muted-foreground">Phase 4 で Options Page を実装します。</p>
        </main>
      </div>
    </div>
  );
}
