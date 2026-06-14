---
name: release
description: tabzen の新しいバージョンをリリースする際に使用。「リリースして」「新バージョンを出して」「バージョンを上げて」などのリクエスト時に使用する。
allowed-tools:
  - Bash(git:*)
  - Bash(gh:*)
  - Bash(pnpm:*)
  - Bash(node:*)
  - Read
  - Edit
---

# リリーススキル

tabzen (Chrome 拡張) の新バージョンをリリースする手順。`version bump → CHANGELOG → release PR → squash マージ → タグ push` の流れで、**タグ push を起点に `.github/workflows/release.yml` が GitHub Release を自動生成**する。

## 重要な前提（先に読む）

- **バージョンの単一の真実は `package.json` の `version`**。`src/manifest.ts` がビルド時にこれを読み、manifest の version になる。手で manifest を書き換えない。
- **`v*` タグの push が `release.yml` を起動**し、CI (lint/typecheck/test/build) → version 整合チェック → `dist/` を zip (`tabzen-vX.Y.Z.zip`) → CHANGELOG から release notes 抽出 → **GitHub Release 自動作成** まで実行する。
- **手動で `gh release create` しない**。workflow が作るので二重になる。
- workflow は `package.json` の version が**タグと一致するか検証**する。不一致だと Release を作らず失敗する。
- workflow は CHANGELOG の `## [X.Y.Z]` セクションを release notes に使う（`awk` で `## [X.Y.Z]` と次の `## [` の間を抽出）。**見出し形式を厳守**。
- **Chrome Web Store への公開は手動**。エージェントからは実行不可。ユーザーに依頼する。
- GitHub Actions はすべて commit SHA でピン留めされている。リリース作業中に触らない。

## 手順

### 1. バージョンを決める（SemVer）

| 種別  | 例            | 条件                       |
| ----- | ------------- | -------------------------- |
| PATCH | 1.1.0 → 1.1.1 | バグ修正のみ               |
| MINOR | 1.0.3 → 1.1.0 | 後方互換の新機能           |
| MAJOR | 1.x.x → 2.0.0 | 破壊的変更（拡張ではまれ） |

判断に迷う場合はユーザーに確認する。

### 2. main を最新化して release ブランチを作成

```bash
git checkout main && git pull --ff-only origin main
git checkout -b release-vX.Y.Z
```

### 3. package.json の version を更新

`version` を `X.Y.Z` に変更（Edit）。

### 4. CHANGELOG.md を更新

- `## [X.Y.Z] - YYYY-MM-DD` セクションを追加（日付はタグを打つ日 / JST）。`### Added` / `### Changed` / `### Fixed` / `### Internal` / `### Security` を使い、**「なぜ / 何を」を日本語で**書く（Keep a Changelog 形式）。
- **末尾のリンク参照を更新（忘れやすい）**:
  ```
  [Unreleased]: https://github.com/minisera/tabzen/compare/vX.Y.Z...HEAD
  [X.Y.Z]: https://github.com/minisera/tabzen/releases/tag/vX.Y.Z
  ```
  `[Unreleased]` の比較基点を新バージョンに変え、`[X.Y.Z]` の行を追加する。

### 5. ローカル検証

**必須（タグ打ち直しを防ぐ事前チェック）** — version とリリースノートが揃っているか、コミット前に確認する。これを怠ると不整合がタグ push 後の workflow 失敗まで発覚せず、タグの打ち直しになる:

```bash
# package.json の version がリリース対象と一致するか（bump 漏れ検出）
node -p "require('./package.json').version"   # → X.Y.Z

# release.yml と同じ方法で CHANGELOG から notes を抽出し、空でないか確認（見出し形式ミス検出）
awk -v ver="X.Y.Z" '$0 ~ "^## \\[" ver "\\]" {c=1; next} c && /^## \[/ {exit} c {print}' CHANGELOG.md
# 出力が空なら見出しが `## [X.Y.Z]` 形式になっていない。直すこと
```

**推奨** — CI と同じ検証をローカルでも回す:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
node -p "require('./dist/manifest.json').version"   # → X.Y.Z（manifest にも反映されているか）
```

### 6. コミット & release PR

```bash
git add package.json CHANGELOG.md
git commit -m "chore: release vX.Y.Z"
git push -u origin release-vX.Y.Z
gh pr create --base main --title "chore: release vX.Y.Z" --body "vX.Y.Z リリース。CHANGELOG 参照。"
```

### 7. CI green を待つ

```bash
gh pr checks <PR番号>
gh pr view <PR番号> --json mergeStateStatus -q .mergeStateStatus   # → CLEAN
```

`Lint / Typecheck / Test / Build` と `Analyze (CodeQL)` が pass、`mergeStateStatus=CLEAN` を確認。

### 8. squash マージ

過去のリリース履歴（`chore: release v1.0.3 (#28)` 等）に合わせて squash。

```bash
gh pr merge <PR番号> --squash --delete-branch
```

### 9. main 同期 & バージョン確認

`gh pr merge` が自動で main に切り替え + fast-forward する。念のため確認:

```bash
git checkout main && git pull
node -p "require('./package.json').version"   # → X.Y.Z
git rev-parse HEAD; git rev-parse origin/main # 一致すること
```

HEAD と origin/main が一致しない、または version が `X.Y.Z` でない場合は、**タグを打たずに中断**し原因を解消してから手順10へ進む（古い／誤った commit にタグが付くのを防ぐ）。

### 10. タグ作成 & push（= Release 自動生成のトリガー）

```bash
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
```

### 11. Release workflow を見届ける

```bash
RUN_ID=$(gh run list --workflow=release.yml --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh release view vX.Y.Z --json name,assets,isDraft,url
```

`tabzen-vX.Y.Z.zip` が添付され `isDraft=false` なら成功。

### 12. Chrome Web Store へ手動アップロード（エージェントは実行不可）

Release の `tabzen-vX.Y.Z.zip` をダウンロード（または `pnpm build` → `dist/` を zip）し、[デベロッパーダッシュボード](https://chrome.google.com/webstore/devconsole) で新バージョンとしてアップロード → 審査提出。**この手順はユーザーに依頼する**。

## よくある失敗

| 失敗                                            | 原因 / 対処                                                                                    |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| workflow の `Verify version matches tag` で失敗 | `package.json` の version がタグと不一致。version を直して main にマージし直し、タグを打ち直す |
| Release notes が空（タグ名だけ）                | CHANGELOG 見出しが `## [X.Y.Z]` 形式でない。形式を厳守                                         |
| Release が 2 つできる                           | 手動で `gh release create` した。workflow に任せる                                             |
| CHANGELOG のリンク切れ                          | 末尾リンク参照（`[Unreleased]` / `[X.Y.Z]`）の更新漏れ。手順4を実施                            |
| 履歴が汚れる                                    | squash 以外でマージした。`--squash` を使う                                                     |
| 古い内容がリリースされる                        | main 以外 / 古い commit にタグを打った。手順9で HEAD を確認してから打つ                        |

## チェックリスト

- [ ] バージョン決定（SemVer）
- [ ] `package.json` の version を bump
- [ ] CHANGELOG にセクション追加 + 末尾リンク参照を更新
- [ ] release PR を作成、CI green を確認
- [ ] squash マージ、main を同期しバージョン確認
- [ ] `vX.Y.Z` タグを push、workflow 成功、Release を確認
- [ ] Chrome Web Store への手動アップロードをユーザーに依頼
