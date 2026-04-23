# Tab Tidy

時間経過でタブを自動クローズ/サスペンドし、Arc 風の MRU タブ切替を提供する Chrome 拡張機能。

## 主な機能（予定）

- タブ自動クローズ（GUI で時間変更可能、ログスケールのスライダー + プリセット）
- タブ自動サスペンド（`chrome.tabs.discard()` でメモリ解放、UI は残す）
- 閉じたタブの復元履歴（セーフティネット、ブラウザ再起動を越えて復元可能）
- 除外ルール（ピン留め / 音声再生中 / アクティブ / 未送信フォーム / ドメインホワイトリスト）
- 重複タブ検出・クローズ
- Arc 風 Ctrl+Tab 切替（MRU 順、画面中央プレビュー、`Alt+Q` フォールバック）
- キーボードショートカットで一括クローズ（3 種類）

## 開発セットアップ

```bash
pnpm install
pnpm dev     # Vite 開発サーバー起動
pnpm build   # dist/ に本番ビルド
```

### Chrome への読み込み

1. `chrome://extensions/` を開く
2. 右上の「デベロッパーモード」を ON
3. 「パッケージ化されていない拡張機能を読み込む」から `dist/` を選択
4. ツールバーに Tab Tidy アイコンが表示されれば成功

### スクリプト一覧

| コマンド            | 内容                                                     |
| ------------------- | -------------------------------------------------------- |
| `pnpm dev`          | Vite 開発サーバー起動（拡張機能は `dist/` にライブ出力） |
| `pnpm build`        | TypeScript 型チェック + 本番ビルド                       |
| `pnpm preview`      | 本番ビルドのプレビュー                                   |
| `pnpm lint`         | ESLint 実行                                              |
| `pnpm lint:fix`     | ESLint 自動修正                                          |
| `pnpm typecheck`    | `tsc -b` で型チェックのみ                                |
| `pnpm format`       | Prettier でフォーマット                                  |
| `pnpm format:check` | Prettier のフォーマットチェック                          |

## 技術スタック

- Vite 6 + `@crxjs/vite-plugin` 2.x (Manifest V3)
- React 19 + TypeScript (strict)
- Tailwind CSS v4 + shadcn/ui
- Zustand (状態管理) / Zod (スキーマバリデーション) / dayjs (相対時刻) / webextension-polyfill / lucide-react
- ESLint 9 / Prettier / husky + lint-staged

## ディレクトリ構成

```
src/
├── background/   # Service Worker (MRU 管理、自動クローズ等)
├── content/      # Content Script (Ctrl+Tab 捕捉、オーバーレイ)
├── popup/        # ツールバー Popup
├── options/      # 詳細設定ページ
├── shared/       # 共有: components/hooks/storage/schema/utils
└── manifest.ts   # @crxjs manifest 定義
```

## 実装ロードマップ

| フェーズ | 内容                                                              | 状態 |
| -------- | ----------------------------------------------------------------- | ---- |
| 1        | 基盤セットアップ                                                  | ✅   |
| 2        | Service Worker コア機能 (MRU、自動クローズ、サスペンド、復元履歴) | —    |
| 3        | Popup UI                                                          | —    |
| 4        | Options Page                                                      | —    |
| 5        | Arc 風タブ切替 (Content Script + 中央オーバーレイ)                | —    |
| 6        | 一括クローズショートカット                                        | —    |
| 7        | テスト                                                            | —    |
| 8        | ドキュメント・公開準備                                            | —    |

## ライセンス

未定（リリース前に決定予定）。
