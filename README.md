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

## Chrome Web Store 公開ガイド

### 0. 事前準備

- [Chrome Web Store Developer Console](https://chrome.google.com/webstore/devconsole) で開発者登録 (一度きり $5 USD)
- プライバシーポリシー [`PRIVACY.md`](./PRIVACY.md) を GitHub Pages や Gist などで **公開 URL として公開** しておく (`<all_urls>` を要求する拡張は提出時にポリシー URL が必須)

### 1. 配布用 zip の作成

```bash
pnpm build
cd dist && zip -r ../tabzen-v1.0.0.zip . && cd ..
```

`dist/manifest.json` が zip のルートに来ている必要がある (上記コマンドで OK)。

### 2. ストア掲載テキスト (Console にコピペ用)

#### 名前 (45 文字以内)

```
Tab Zen
```

#### 簡単な説明 (132 文字以内)

```
時間経過でタブを自動クローズ・サスペンドし、Arc 風の最近使ったタブ切替オーバーレイを提供する Chrome 拡張。設定は分/時間/日で柔軟に。
```

#### 詳細な説明 (16,000 文字以内 / 抜粋)

```
Tab Zen は、増えすぎたタブを時間経過で自動的に整理し、Arc ブラウザのような最近使った順 (MRU) のタブ切替オーバーレイを提供します。

【主な機能】
- タブ自動クローズ: 最終アクティブから一定時間が経過したタブを自動で閉じます。閾値は分/時間/日で柔軟に設定可能 (最大 30 日)。
- 2 段階のサスペンド → クローズ: 先にメモリだけ解放してタブ UI を残し、さらに時間が経過したらクローズします。
- 復元履歴: 自動クローズしたタブはワンクリックで再オープン。ブラウザを再起動しても残ります。
- 除外ルール: ピン留め / 音声再生中 / 現在アクティブ / 未送信フォーム / 除外ドメインのタブは対象外。
- 重複タブ検出・クローズ: URL を正規化 (UTM 除去・trailing slash 等) して重複を検出。
- Arc 風タブ切替 (Alt+Q): 最大 10 件のタブをサムネイル付きでオーバーレイ表示。Alt 押しっぱなしで Q 連打 → リリースで確定。

【プライバシー】
Tab Zen は個人情報を一切収集・送信しません。すべてのデータは chrome.storage 内に保存され、ネットワーク通信は行いません。
```

#### Single purpose (単一目的)

```
時間経過でブラウザのタブを自動的にサスペンド／クローズし、Arc 風の最近使った順 (MRU) のタブ切替オーバーレイを提供する。
```

#### 各 permission の justification

| permission                     | 説明欄に記入する文                                                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `tabs`                         | タブの URL・タイトル・最終アクティブ時刻を取得して、自動クローズ判定と MRU 切替に使用。                                |
| `alarms`                       | 1 分間隔で経過時間をチェックし、閾値超過タブを処理するため。                                                           |
| `storage`                      | 設定・MRU 履歴・復元履歴・サムネイルを端末に永続化するため。                                                           |
| `scripting`                    | 拡張機能更新後、すでに開いているタブへ content script を再注入し、Alt+Q オーバーレイを即座に使えるようにするため。     |
| `host_permissions: <all_urls>` | Alt+Q オーバーレイをすべてのウェブページに表示し、未送信フォームを検出するため。ページ内容の読み取り・送信は行わない。 |

#### データ使用宣言 (Console の Privacy 欄)

- 「個人を特定できる情報」「健康情報」「金融情報」「認証情報」「個人通信」「位置情報」「ウェブ閲覧履歴」… **すべてチェックなし**
- "I do not collect or use this user data" を選択
- ポリシー URL: 公開した `PRIVACY.md` の URL を記入

### 3. 画像アセット

| 種類                   | サイズ                          | 必要数             | 状態                           |
| ---------------------- | ------------------------------- | ------------------ | ------------------------------ |
| ストアアイコン         | 128×128                         | 1                  | ✅ `public/icons/icon-128.png` |
| **スクリーンショット** | **1280×800** または **640×400** | **1〜5 枚 (必須)** | 撮影が必要                     |
| 小プロモーションタイル | 440×280                         | 推奨               | 任意                           |
| マーキータイル         | 1400×560                        | 推奨               | 任意                           |

#### スクリーンショット撮影の推奨構図

1. **Alt+Q オーバーレイ**: 多数のタブを開いた状態で Alt+Q を押下 → 中央のオーバーレイ + サムネイル列が映るように
2. **Popup**: ツールバーアイコンクリック後の Popup (統計サマリ + クイックアクション + 復元履歴)
3. **Options「一般」**: 閾値スライダー (分/時間/日 切替) + プリセットボタン
4. **Options「除外ドメイン」**: ホワイトリスト UI
5. **Options「復元履歴」**: 検索可能な履歴一覧

撮影は `Cmd+Shift+4` で範囲選択 → ウィンドウ撮影なら `Cmd+Shift+4 → Space → click`。撮影後 Preview.app で 1280×800 にリサイズして書き出し。

### 4. 公開フロー

1. Developer Console → 「新しいアイテム」→ 上記 zip をアップロード
2. ストア掲載情報・画像をアップロード
3. プライバシー設定でポリシー URL を入力、データ使用宣言を完了
4. 公開範囲: Public / Unlisted / Private を選択
5. 「審査用に送信」 — 通常 1〜数日で公開判定

## ライセンス

[MIT License](./LICENSE) © 2025 minisera
