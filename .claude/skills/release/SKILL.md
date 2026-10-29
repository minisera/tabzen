---
name: release
description: tabzen の新しいバージョンをリリースする際に使用。「リリースして」「新バージョンを出して」「バージョンを上げて」などのリクエスト時に使用する。
allowed-tools:
  - Bash(git:*)
  - Bash(gh:*)
  - Bash(pnpm:*)
  - Bash(node:*)
  - Bash(bash .github/scripts/extract-release-notes.sh:*)
  - Read
  - Edit
---

# リリーススキル

tabzen (Chrome 拡張) の新バージョンをリリースする手順。エージェントが行うのは `version bump → CHANGELOG → release PR → squash マージ` まで。**version を上げた commit が main に入ると `.github/workflows/release.yml` がタグ作成・GitHub Release・Chrome Web Store への審査提出まで自動で行う**。人向けの説明と CWS 初期設定は `RELEASING.md`。

## 重要な前提（先に読む）

- **バージョンの単一の真実は `package.json` の `version`**。`src/manifest.ts` がビルド時にこれを読み、manifest の version になる。手で manifest を書き換えない。
- **main への push（`package.json` / `CHANGELOG.md` の変更）が `release.yml` を起動**し、`vX.Y.Z` タグが未作成なら CI (lint/typecheck/test/build) → `dist/manifest.json` の version 確認 → `dist/` を zip (`tabzen-vX.Y.Z.zip`) → CHANGELOG から release notes 抽出 → **タグ + GitHub Release 作成** → **Chrome Web Store にアップロードして審査提出**（通過後に自動公開）まで実行する。
- つまり **version を上げた PR をマージした瞬間にリリースが始まる**。マージは「リリースしてよい」状態になってから行う。
- **手でタグを打たない / `gh release create` しない**。workflow がタグごと作るので、先に打つと「タグ既存」と判定されて Release も Web Store 提出も行われない。
- workflow は CHANGELOG の `## [X.Y.Z]` セクションを release notes に使い、**セクションが無い / 空 / 末尾リンク参照の更新漏れがあると失敗**する（`.github/scripts/extract-release-notes.sh`）。PR の CI でも同じ検証が走るので、CI green = CHANGELOG OK。
- Chrome Web Store 提出 job は `CWS_EXTENSION_ID` 変数が未設定だと skip される。その場合だけ Web Store へのアップロードをユーザーに依頼する。
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

- `## [X.Y.Z] - YYYY-MM-DD` セクションを追加（日付はマージする日 / JST）。`## [Unreleased]` に書き溜められた内容があれば、このセクションへ移して `[Unreleased]` は空にする。`### Added` / `### Changed` / `### Fixed` / `### Internal` / `### Security` を使い、**「なぜ / 何を」を日本語で**書く（Keep a Changelog 形式）。
- **末尾のリンク参照を更新（忘れやすい）**:
  ```
  [Unreleased]: https://github.com/minisera/tabzen/compare/vX.Y.Z...HEAD
  [X.Y.Z]: https://github.com/minisera/tabzen/releases/tag/vX.Y.Z
  ```
  `[Unreleased]` の比較基点を新バージョンに変え、`[X.Y.Z]` の行を追加する。

### 5. ローカル検証

**必須（push 前の事前チェック）** — version とリリースノートが揃っているか、コミット前に確認する。PR の CI でも同じ検証が走るが、ここで気付けば CI 待ちの往復が減る:

```bash
# package.json の version がリリース対象と一致するか（bump 漏れ検出）
node -p "require('./package.json').version"   # → X.Y.Z

# release.yml / CI と同じスクリプトで CHANGELOG を検証し、notes を表示（見出し形式ミス・リンク参照の更新漏れ検出）
bash .github/scripts/extract-release-notes.sh X.Y.Z
# ::error:: が出たらメッセージに従って直すこと
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

### 8. squash マージ（= リリース開始）

過去のリリース履歴（`chore: release v1.0.3 (#28)` 等）に合わせて squash。**マージした時点で release.yml が走り、Web Store への提出まで進む**。

```bash
gh pr merge <PR番号> --squash --delete-branch
```

### 9. Release workflow を見届ける

```bash
RUN_ID=$(gh run list --workflow=release.yml --branch main --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh release view vX.Y.Z --json name,assets,isDraft,url
```

- `tabzen-vX.Y.Z.zip` が添付され `isDraft=false` なら GitHub Release は成功。
- `Publish to Chrome Web Store` job が成功していれば審査提出済み（log の `::notice::` に state が出る）。審査通過後は自動で公開される。
- `Publish to Chrome Web Store` が **skipped** の場合は CWS 未設定。手順10へ。
- 失敗した場合は `RELEASING.md` の「失敗したとき」に従う。再実行は **Re-run failed jobs**（`gh run rerun "$RUN_ID" --failed`）。Re-run all jobs はタグ既存で何もしないので使わない。

### 10. （CWS 未設定時のみ）Chrome Web Store へ手動アップロード（エージェントは実行不可）

Release の `tabzen-vX.Y.Z.zip` を [デベロッパーダッシュボード](https://chrome.google.com/webstore/devconsole) で新バージョンとしてアップロード → 審査提出。**この手順はユーザーに依頼する**。自動化したい場合は `RELEASING.md` の初期設定を案内する。

## よくある失敗

| 失敗                                                    | 原因 / 対処                                                                                                     |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| CI の `Verify CHANGELOG entry for current version` 失敗 | CHANGELOG のセクション / 末尾リンク参照の不備。エラーメッセージに従って直す                                     |
| マージしたのに Release ができない                       | 手でタグを先に打った（タグ既存で skip）。タグを消して workflow を `gh workflow run release.yml` で再実行        |
| `Verify manifest version` で失敗                        | `dist/manifest.json` と `package.json` の version 不一致。`src/manifest.ts` が `pkg.version` を読んでいるか確認 |
| `Publish to Chrome Web Store` が `invalid_grant` で失敗 | refresh token 失効。ユーザーに `RELEASING.md` の手順で取り直してもらい、Re-run failed jobs                      |
| Release が 2 つできる / 提出が二重になる                | 手動で `gh release create` や Web Store アップロードをした。workflow に任せる                                   |
| 履歴が汚れる                                            | squash 以外でマージした。`--squash` を使う                                                                      |

## チェックリスト

- [ ] バージョン決定（SemVer）
- [ ] `package.json` の version を bump
- [ ] CHANGELOG にセクション追加（`[Unreleased]` の内容を移す）+ 末尾リンク参照を更新
- [ ] release PR を作成、CI green を確認
- [ ] squash マージ（= リリース開始）
- [ ] release.yml の成功を確認（GitHub Release + Web Store 提出）
- [ ] Web Store 提出 job が skipped なら、手動アップロードをユーザーに依頼
