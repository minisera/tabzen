import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json' with { type: 'json' };

export default defineManifest({
  manifest_version: 3,
  // i18n: see public/_locales/{en,ja}/messages.json
  name: '__MSG_extName__',
  description: '__MSG_extDescription__',
  default_locale: 'en',
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
  // MV3 default と同等だが、明示することで eval/inline-script 等を一切
  // 許容しないことを宣言する (XSS / リモートコード実行への防御層)
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self'",
  },
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
      description: '__MSG_cmdCloseInactiveNow__',
    },
    'close-duplicates': {
      suggested_key: { default: 'Alt+Shift+D' },
      description: '__MSG_cmdCloseDuplicates__',
    },
    'close-all-window': {
      description: '__MSG_cmdCloseAllWindow__',
    },
    'switch-tab-fallback': {
      suggested_key: { default: 'Ctrl+Q' },
      description: '__MSG_cmdSwitchTabFallback__',
    },
    'switch-tab-fallback-prev': {
      suggested_key: { default: 'Ctrl+Shift+Q' },
      description: '__MSG_cmdSwitchTabFallbackPrev__',
    },
  },
});
