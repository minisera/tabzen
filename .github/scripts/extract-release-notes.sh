#!/usr/bin/env bash
# CHANGELOG.md から指定バージョンのセクション本文を stdout に出す。
# main へのマージで release.yml が自動リリースまで進むため、CHANGELOG の不備は
# PR の CI (ci.yml) で落としておきたい。両方で同じ判定を使うよう共通化している。
#
# usage: extract-release-notes.sh <version> [changelog]
set -euo pipefail

version="${1:?usage: $0 <version> [changelog]}"
changelog="${2:-CHANGELOG.md}"

fail() {
  echo "::error file=${changelog}::$1" >&2
  exit 1
}

has_line_with_prefix() {
  awk -v p="$1" 'index($0, p) == 1 { found = 1 } END { exit !found }' "$changelog"
}

# 正規表現だと version の "." が任意の 1 文字にマッチしてしまうので、index() で前方一致させる
notes=$(awk -v ver="$version" '
  index($0, "## [" ver "]") == 1 { capture = 1; next }
  capture && /^## \[/ { exit }
  capture { print }
' "$changelog")

if [ -z "${notes//[[:space:]]/}" ]; then
  fail "\"## [${version}]\" セクションが無いか、本文が空です"
fi

# 末尾のリンク参照は更新漏れしやすく、漏れると GitHub 上で見出しのリンクが切れる
if ! has_line_with_prefix "[${version}]: "; then
  fail "リンク参照 \"[${version}]: ...\" がありません"
fi
if ! awk -v s="/compare/v${version}...HEAD" '
    index($0, "[Unreleased]: ") == 1 && substr($0, length($0) - length(s) + 1) == s { found = 1 }
    END { exit !found }
  ' "$changelog"; then
  fail "\"[Unreleased]: ...\" の比較基点が v${version} になっていません"
fi

printf '%s\n' "$notes"
