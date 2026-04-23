import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json' with { type: 'json' };

export default defineManifest({
  manifest_version: 3,
  name: 'Tab Tidy',
  description: '時間経過でタブを自動クローズ・サスペンドし、Arc風MRUタブ切替を提供するタブ管理拡張',
  version: pkg.version,
  icons: {
    16: 'icons/icon.svg',
    32: 'icons/icon.svg',
    48: 'icons/icon.svg',
    128: 'icons/icon.svg',
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
      16: 'icons/icon.svg',
      32: 'icons/icon.svg',
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
      suggested_key: { default: 'Alt+Shift+W' },
      description: '現在のウィンドウの全タブをクローズ',
    },
    'switch-tab-fallback': {
      suggested_key: { default: 'Alt+Q' },
      description: 'MRU タブ切替 (次へ)',
    },
    'switch-tab-fallback-prev': {
      suggested_key: { default: 'Alt+Shift+Q' },
      description: 'MRU タブ切替 (前へ)',
    },
  },
});
