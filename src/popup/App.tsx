import { Sparkles } from 'lucide-react';

export default function App() {
  return (
    <div className="w-[360px] min-h-[400px] bg-background text-foreground p-4">
      <header className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">Tab Tidy</h1>
      </header>
      <p className="text-sm text-muted-foreground">Phase 3 で Popup UI を実装します。</p>
    </div>
  );
}
