// Content Script エントリポイント
// Phase 5 で Ctrl+Tab の捕捉と中央プレビューオーバーレイを実装する。
// document_start で読み込まれるため、DOM 操作は DOMContentLoaded を待つ。

console.log('[Tab Tidy] Content Script loaded on', location.href);
