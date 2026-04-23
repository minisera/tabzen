// Content Script エントリポイント
// Phase 5 で Ctrl+Tab の捕捉と中央プレビューオーバーレイを実装する。
import { initFormDetector } from './form-detector';

console.log('[Tab Tidy] Content Script loaded on', location.href);

initFormDetector();
