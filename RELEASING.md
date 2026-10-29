# リリース手順

**`package.json` の `version` を上げた PR を main にマージした時点でリリースが走ります。** タグ作成・GitHub Release・Chrome Web Store への審査提出は `.github/workflows/release.yml` が自動で行うので、手でタグを打ったり `gh release create` したりする必要はありません。

## 流れ

1. release PR を作る（Claude Code なら「リリースして」で `.claude/skills/release` が手順を実行する）
   - `package.json` の `version` を `X.Y.Z` に上げる
   - `CHANGELOG.md` に `## [X.Y.Z] - YYYY-MM-DD` セクションを追加し（`[Unreleased]` に書き溜めた内容はここへ移す）、末尾のリンク参照を更新する
     ```
     [Unreleased]: https://github.com/minisera/tabzen/compare/vX.Y.Z...HEAD
     [X.Y.Z]: https://github.com/minisera/tabzen/releases/tag/vX.Y.Z
     ```
2. CI が CHANGELOG を検証する（セクションが無い / 空 / リンク参照の更新漏れで落ちる）
3. squash マージすると `release.yml` が次を順に実行する

   | job                           | 内容                                                                                                         |
   | ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
   | `Check version`               | `vX.Y.Z` タグがまだ無ければ続行。既にあれば何もしない（依存更新で `package.json` が変わっただけのケース）    |
   | `Build & GitHub Release`      | lint / typecheck / test / build → `tabzen-vX.Y.Z.zip` 作成 → CHANGELOG から notes 抽出 → タグ + Release 作成 |
   | `Publish to Chrome Web Store` | Release の zip を Chrome Web Store API でアップロードし審査に提出。**審査を通過すると自動で公開される**      |

Chrome Web Store の自動提出は下記の初期設定をするまで skip され、その間は Release の zip を[デベロッパーダッシュボード](https://chrome.google.com/webstore/devconsole)から手動でアップロードします。

## Chrome Web Store 自動提出の初期設定（初回のみ）

[公式ドキュメント](https://developer.chrome.com/docs/webstore/using-api)の手順で OAuth の認証情報を作り、GitHub に登録します。

### 1. Google Cloud 側

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成し、**Chrome Web Store API** を有効化する
2. **OAuth 同意画面**: User Type は「外部」。アプリ名・サポートメール・連絡先を入力し、テストユーザーに自分のアカウントを追加する
3. **公開ステータスを「本番環境」に切り替える**。「テスト」のままだと refresh token が **7 日で失効**し、次のリリースで `invalid_grant` になる（自分専用なので Google の審査は不要。認可時に「未確認のアプリ」と出たら「詳細」→「（安全ではないページ）に移動」で進む）
4. **認証情報** → OAuth クライアント ID を作成。種類は「ウェブ アプリケーション」、承認済みリダイレクト URI に `https://developers.google.com/oauthplayground` を追加し、クライアント ID / シークレットを控える
5. [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) の歯車アイコン → 「Use your own OAuth credentials」にクライアント ID / シークレットを入力 → スコープ欄に `https://www.googleapis.com/auth/chromewebstore` を入れて **Authorize APIs**（拡張を所有するアカウントでログイン）→ **Exchange authorization code for tokens** → 表示された **Refresh token** を控える
6. デベロッパーダッシュボードの **パブリッシャー → 設定** でパブリッシャー ID を、アイテムのページで拡張 ID を確認する

### 2. GitHub 側

1. **Settings → Environments → New environment** で `chrome-web-store` を作成する
   - Deployment branches and tags: **Selected branches** → `main` のみ許可
   - Environment secrets に登録:

     | 名前                | 値                             |
     | ------------------- | ------------------------------ |
     | `CWS_CLIENT_ID`     | OAuth クライアント ID          |
     | `CWS_CLIENT_SECRET` | OAuth クライアントシークレット |
     | `CWS_REFRESH_TOKEN` | Refresh token                  |

   - 提出前に人の承認を挟みたい場合は Required reviewers に自分を追加する（無ければ完全自動）

2. **Settings → Secrets and variables → Actions → Variables**（Repository variables）に登録:

   | 名前               | 値                |
   | ------------------ | ----------------- |
   | `CWS_PUBLISHER_ID` | パブリッシャー ID |
   | `CWS_EXTENSION_ID` | 拡張 ID           |

   `CWS_EXTENSION_ID` は job の実行条件に使うため、environment ではなく repository 側に置く。

### 注意

- ダッシュボードで公開範囲（visibility）を変更した直後は、一度ダッシュボードから手動で公開しないと API からは公開できない
- ストア掲載情報（説明文・スクリーンショット・プライバシー欄）の変更は API の対象外。従来どおりダッシュボードで行う

## 失敗したとき

| 状況                                                  | 対処                                                                                                                                                |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Build & GitHub Release` が CHANGELOG 抽出で失敗      | タグはまだ作られていない。CHANGELOG を直す PR をマージすれば workflow が再実行される                                                                |
| `Build & GitHub Release` がそれ以外で失敗             | 原因を直してから Actions の該当 run で **Re-run failed jobs**                                                                                       |
| `Publish to Chrome Web Store` が失敗                  | **Re-run failed jobs**（提出済みの version は skip される）。**Re-run all jobs は使わない** — タグが既にあるので `Check version` で止まり何もしない |
| `access token の取得に失敗しました` + `invalid_grant` | refresh token の失効。同意画面が「本番環境」か確認し、初期設定 1-5 で取り直して `CWS_REFRESH_TOKEN` を更新してから Re-run                           |
| 再実行できない（run から 30 日経過など）              | Release の zip をダッシュボードから手動アップロード                                                                                                 |
