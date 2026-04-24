# Tab Zen

時間経過でタブを自動クローズ/サスペンドし、Arc 風の MRU タブ切替を提供する Chrome 拡張機能。

## 主な機能

- **タブ自動クローズ**: 最終アクティブ時刻から一定時間経過したタブを閉じる。閾値は GUI のスライダー or プリセットで自由に変更可能
- **タブ自動サスペンド**: 2 段階目の閾値を超えると先に `chrome.tabs.discard()` でメモリを解放し、タブ UI だけ残す
- **閉じたタブの復元履歴**: 自動クローズされたタブはワンクリックで復元可能。ブラウザ再起動を越えて残る
- **除外ルール**: ピン留め / 音声再生中 / アクティブ / 未送信フォーム / ドメインホワイトリストのタブは対象外
- **重複タブ検出・クローズ**: URL 正規化 (UTM・trailing slash など) を踏まえて重複タブを検出し、最新アクティブだけ残して閉じる
- **Arc 風 MRU タブ切替 (`Alt+Q`)**: 最新 5 件をオーバーレイで巡回。`Alt+Q` を押すたびに下の候補へ移動、1.5 秒無操作で自動確定 (`Enter` で即確定、`Esc` でキャンセル)。`chrome://` など Content Script が動かないページでは `Alt+Q` が MRU を直接巡回してタブを切り替える。
  _Ctrl+Tab は Chrome のブラウザ予約キーで、拡張機能の Content Script からは捕捉不可能 ([Chromium 仕様](https://bugs.chromium.org/p/chromium/issues/detail?id=1413527))。そのためこの拡張は `Alt+Q` に統一しています。_
- **キーボードショートカット 3 種**: `Alt+Shift+X` (非アクティブを即クローズ) / `Alt+Shift+D` (重複タブクローズ) / `Alt+Shift+W` (全タブクローズ)。重複・全タブクローズ時はアクティブタブの Content Script で確認ダイアログを表示

## クイックスタート

### 開発セットアップ

```bash
pnpm install
pnpm dev     # Vite 開発サーバー起動 (dist/ にライブ出力)
pnpm build   # dist/ に本番ビルド
```

### Chrome への読み込み

1. `chrome://extensions/` を開く
2. 右上の「デベロッパーモード」を ON
3. 「パッケージ化されていない拡張機能を読み込む」から `dist/` を選択
4. ツールバーに Tab Zen アイコンが表示されれば成功

`pnpm dev` 実行中は HMR でファイル変更が `dist/` に反映されます。Service Worker を更新した際は拡張機能リストで「更新」ボタンを押してください。

### スクリプト一覧

| コマンド             | 内容                                                    |
| -------------------- | ------------------------------------------------------- |
| `pnpm dev`           | Vite 開発サーバー起動 (拡張機能は `dist/` にライブ出力) |
| `pnpm build`         | TypeScript 型チェック + 本番ビルド                      |
| `pnpm preview`       | 本番ビルドのプレビュー                                  |
| `pnpm lint`          | ESLint 実行                                             |
| `pnpm lint:fix`      | ESLint 自動修正                                         |
| `pnpm typecheck`     | `tsc -b` で型チェックのみ                               |
| `pnpm test`          | Vitest で単体テストを実行                               |
| `pnpm test:watch`    | Vitest をウォッチモードで実行                           |
| `pnpm test:coverage` | Vitest カバレッジ計測                                   |
| `pnpm format`        | Prettier でフォーマット                                 |
| `pnpm format:check`  | Prettier のフォーマットチェック                         |

## 技術スタック

- Vite 6 + `@crxjs/vite-plugin` 2.x (Manifest V3)
- React 19 + TypeScript (strict)
- Tailwind CSS v4 + shadcn/ui 風の手書きコンポーネント
- Zustand (状態管理) / Zod (スキーマバリデーション) / dayjs (相対時刻) / webextension-polyfill / lucide-react
- ESLint 9 / Prettier / husky + lint-staged
- Vitest + Testing Library (happy-dom)

## ディレクトリ構成

```
src/
├── background/            # Service Worker
│   ├── index.ts           # エントリ: alarms / commands / runtime
│   ├── mru-stack.ts       # ウィンドウごとの MRU 履歴
│   ├── tab-monitor.ts     # chrome.tabs イベント → メタ更新
│   ├── auto-cleaner.ts    # 除外判定 / 自動クローズ / サスペンド
│   ├── duplicate-finder.ts# 重複タブ検出・クローズ
│   ├── restore-history.ts # 閉じたタブ履歴
│   └── messaging.ts       # Popup/Options/Content Script との通信
├── content/               # Content Script
│   ├── index.tsx          # Shadow DOM マウント + confirm リスナー
│   ├── form-detector.ts   # 未送信フォーム検出
│   └── tab-switcher/
│       └── TabSwitcherOverlay.tsx  # Ctrl+Tab オーバーレイ
├── popup/                 # ツールバー Popup
├── options/               # 設定ページ (5 タブ)
│   └── pages/             # General / Allowlist / Shortcuts / History / About
├── shared/                # 共通モジュール
│   ├── components/ui/     # Button / Card / Input / Label / Slider / Switch / Separator
│   ├── hooks/             # usePopupData / useHashRoute
│   ├── lib/               # utils (cn) / runtime-client (sendMessage)
│   ├── schema/            # Zod スキーマ (settings / tab-meta)
│   ├── storage/           # chrome.storage.{sync,local} のラッパー
│   ├── stores/            # Zustand settings-store
│   ├── styles/globals.css # Tailwind v4 + CSS 変数
│   ├── types.ts           # メッセージ型定義
│   └── utils/             # url-normalize / time
└── manifest.ts            # @crxjs manifest 定義
```

## 手動検証チェックリスト

`pnpm build` → Chrome に `dist/` を読み込んで、以下を確認:

### 自動クローズ / サスペンド

- [ ] Options → 一般 で **サスペンド: 1 分 / クローズ: 2 分** に設定
- [ ] 適当なページを開いて放置し、1 分後に `chrome.tabs.discard()` 扱いになる (タブタイトルが薄くなる / タスクマネージャーでメモリ解放)
- [ ] さらに 1 分後にタブが閉じる
- [ ] ピン留めしたタブは閉じない
- [ ] YouTube など音声再生中のタブは閉じない
- [ ] テキスト入力中のタブ (form) は閉じない
- [ ] 除外ドメインに `github.com` を追加 → GitHub タブが閉じない

### 閉じたタブの復元履歴

- [ ] 自動クローズされたタブが Popup の「最近閉じたタブ」5 件に表示される
- [ ] クリックで新規タブとして復元される
- [ ] Options → 復元履歴 で全履歴を検索・復元・クリアできる

### Arc 風 MRU タブ切替 (`Alt+Q`)

- [ ] 任意のウェブページで `Alt+Q` → 中央オーバーレイに最新 5 件の MRU リスト。初回は 2 番目を選択
- [ ] `Alt+Q` 連打で次の候補へ (最後まで行ったら先頭へ戻る)
- [ ] 1.5 秒押さなかったら選択タブに自動で切り替わる
- [ ] `Enter` で即確定、`Escape` でキャンセル、オーバーレイ外クリックでもキャンセル
- [ ] `chrome://extensions/` など Content Script が動かないページでも `Alt+Q` で MRU を直接巡回 (UI なし・直接切替)

### 一括クローズショートカット

- [ ] `Alt+Shift+X` で閾値超えの非アクティブタブが即クローズ
- [ ] `Alt+Shift+D` で重複タブを検出 → 確認ダイアログ → クローズ
- [ ] `Alt+Shift+W` で「全タブクローズ」の確認ダイアログ → OK でクローズ (除外タブは残る)
- [ ] `chrome://` など Content Script が動かないページでは `Alt+Shift+D` / `Alt+Shift+W` はキャンセル扱い (安全側)

### Popup のクイックアクション

- [ ] 「非アクティブを今すぐ閉じる」→ N 件が 0 のときはフィードバックのみ
- [ ] 「重複タブを閉じる」→ 重複が 0 のときはフィードバックのみ
- [ ] 「全タブをサスペンド」→ 件数メッセージが出る
- [ ] 統計サマリがアクション後にリフレッシュされる

### 設定の同期

- [ ] Options でスライダーを動かして保存 → 自動クローズの挙動に即反映
- [ ] サスペンド閾値 ≥ クローズ閾値を入力するとバリデーションエラー
- [ ] 設定は `chrome.storage.sync` に保存されるので別 Chrome プロファイルに同期される (要ログイン)

## 将来の公開準備メモ (Chrome Web Store)

今回の MVP には含まないが、リリース前に対応する項目:

- **アイコン**: 現在 SVG プレースホルダ (`public/icons/icon.svg`)。実際の 16/32/48/128 PNG を用意
- **スクリーンショット**: Web Store 用に 1280×800 または 640×400 を 1-5 枚 (Popup / Options / Ctrl+Tab オーバーレイ)
- **プライバシーポリシー**: `<all_urls>` ホスト権限・`chrome.storage.sync` 使用の明示 (任意の Web ページには介入しないこと、通信しないことを書く)
- **i18n**: `_locales/en/messages.json`, `_locales/ja/messages.json` を整備し、`__MSG_xxx__` キーに置換
- **アイコンのライセンス**: lucide-react は ISC だがアセットの出所を README に明記
- **E2E テスト**: Playwright + `extensions.loadExtension` パターンで Ctrl+Tab / 自動クローズを検証
- **GitHub Actions**: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` の CI を追加
- **リリース自動化**: `pnpm build` → `dist/` を zip → Web Store upload

## 実装ロードマップ

| フェーズ | 内容                                                                   | 状態 |
| -------- | ---------------------------------------------------------------------- | ---- |
| 1        | 基盤セットアップ (Vite + @crxjs + React + TS + Tailwind + Lint/Format) | ✅   |
| 2        | Service Worker コア機能 (MRU / 自動クローズ / サスペンド / 復元履歴)   | ✅   |
| 3        | Popup UI (状態サマリ / クイックアクション / 復元履歴 5 件)             | ✅   |
| 4        | Options Page (5 ページ + Zod バリデーション + Zustand)                 | ✅   |
| 5        | Arc 風タブ切替 (Content Script + Shadow DOM オーバーレイ + `Alt+Q`)    | ✅   |
| 6        | 一括クローズショートカット (確認ダイアログ付き)                        | ✅   |
| 7        | テスト (Vitest 単体テスト + Popup UI テスト)                           | ✅   |
| 8        | ドキュメント (README + 検証手順 + 公開準備メモ)                        | ✅   |

## ライセンス

未定 (Web Store 公開前に決定予定。候補: MIT / Apache-2.0)。
