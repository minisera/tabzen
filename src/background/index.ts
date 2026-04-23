// Service Worker エントリポイント
// Phase 2 以降で MRU 管理、タブイベント監視、alarms、自動クローズ/サスペンド、
// 復元履歴、除外ルールなどをこのディレクトリに実装していく。

console.log('[Tab Tidy] Service Worker booted at', new Date().toISOString());

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Tab Tidy] onInstalled:', details.reason);
});
