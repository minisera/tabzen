import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json' with { type: 'json' };

export default defineManifest({
  manifest_version: 3,
  name: 'Tab Zen',
  description: '時間経過でタブを自動クローズ・サスペンドし、Arc風MRUタブ切替を提供するタブ管理拡張',
  version: pkg.version,
  homepage_url: 'https://minisera.hatenablog.com/',
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  permissions: ['tabs', 'alarms', 'storage', 'scripting'],
  host_permissions: ['<all_urls>'],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.tsx'],
      run_at: 'document_start',
      all_frames: false,
    },
  ],
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
    },
  },
  options_page: 'src/options/index.html',
  commands: {
    'close-inactive-now': {
      suggested_key: { default: 'Alt+Shift+X' },
      description: '閾値超えの非アクティブタブを今すぐクローズ',
    },
    'close-duplicates': {
      suggested_key: { default: 'Alt+Shift+D' },
      description: '重複タブをクローズ',
    },
    'close-all-window': {
      description:
        '現在のウィンドウの全タブをクローズ (危険なためデフォルトキー未設定。chrome://extensions/shortcuts で割り当て)',
    },
    'switch-tab-fallback': {
      suggested_key: { default: 'Ctrl+Q' },
      description: 'MRU タブ切替 (次へ)',
    },
    'switch-tab-fallback-prev': {
      suggested_key: { default: 'Ctrl+Shift+Q' },
      description: 'MRU タブ切替 (前へ)',
    },
  },
});
