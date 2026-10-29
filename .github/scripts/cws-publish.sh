#!/usr/bin/env bash
# Chrome Web Store API v2 で拡張の zip をアップロードし、審査に提出する。
# 審査を通過すると自動で公開される (publishType=DEFAULT_PUBLISH = ダッシュボードから手で提出した時と同じ挙動)。
#
# usage: cws-publish.sh <zip> <version>
# env:   CWS_CLIENT_ID / CWS_CLIENT_SECRET / CWS_REFRESH_TOKEN / CWS_PUBLISHER_ID / CWS_EXTENSION_ID
#        (取得手順は RELEASING.md)
set -euo pipefail

zip_path="${1:?usage: $0 <zip> <version>}"
version="${2:?usage: $0 <zip> <version>}"
: "${CWS_CLIENT_ID:?}" "${CWS_CLIENT_SECRET:?}" "${CWS_REFRESH_TOKEN:?}"
: "${CWS_PUBLISHER_ID:?}" "${CWS_EXTENSION_ID:?}"

api="https://chromewebstore.googleapis.com"
item="publishers/${CWS_PUBLISHER_ID}/items/${CWS_EXTENSION_ID}"

fail() {
  echo "::error::$1" >&2
  if [ -n "${2:-}" ]; then
    echo "$2" >&2
  fi
  exit 1
}

# 秘密値を curl の argv に載せると同じランナー上の ps から読めるため、stdin 経由で渡す
if ! token_resp=$(
  jq -rn '"client_id=\(env.CWS_CLIENT_ID | @uri)&client_secret=\(env.CWS_CLIENT_SECRET | @uri)&refresh_token=\(env.CWS_REFRESH_TOKEN | @uri)&grant_type=refresh_token"' |
    curl -sS --fail-with-body --data @- https://oauth2.googleapis.com/token
); then
  # invalid_grant は refresh token の失効。OAuth 同意画面が「テスト」のままだと 7 日で失効する
  fail "access token の取得に失敗しました" "$token_resp"
fi
access_token=$(jq -r '.access_token // empty' <<<"$token_resp")
if [ -z "$access_token" ]; then
  fail "token レスポンスに access_token がありません"
fi
echo "::add-mask::${access_token}"

# access token も argv に載せないよう、ヘッダは printf (builtin) からプロセス置換で渡す
cws() {
  local url="$1"
  shift
  curl -sS --fail-with-body -H @<(printf 'Authorization: Bearer %s\n' "$access_token") "$@" "$url"
}

if ! status=$(cws "${api}/v2/${item}:fetchStatus"); then
  fail "fetchStatus に失敗しました" "$status"
fi
# 提出後にジョブが落ちて re-run した場合、同じ version を再提出しても弾かれるだけなので成功扱いで終える
if jq -e --arg v "$version" '
  [.publishedItemRevisionStatus, .submittedItemRevisionStatus]
  | map(select(. != null and .state != "REJECTED" and .state != "CANCELLED"))
  | any(.[].distributionChannels[]?; .crxVersion == $v)
' <<<"$status" >/dev/null; then
  echo "::notice::v${version} は Chrome Web Store に提出済みのためスキップしました"
  exit 0
fi

if ! upload=$(cws "${api}/upload/v2/${item}:upload" -X POST -T "$zip_path"); then
  fail "zip のアップロードに失敗しました" "$upload"
fi
upload_state=$(jq -r '.uploadState // empty' <<<"$upload")
# 処理に時間がかかると非同期になり、fetchStatus の lastAsyncUploadState で完了を待つ必要がある。
# ドキュメント本文は UPLOAD_IN_PROGRESS、enum 定義は IN_PROGRESS と表記が揺れているので両方待つ
for _ in $(seq 1 30); do
  case "$upload_state" in
    IN_PROGRESS | UPLOAD_IN_PROGRESS) ;;
    *) break ;;
  esac
  sleep 10
  if ! status=$(cws "${api}/v2/${item}:fetchStatus"); then
    fail "fetchStatus に失敗しました" "$status"
  fi
  # まだ反映されず未設定の場合も、上限回数までは処理中とみなして待つ
  upload_state=$(jq -r '.lastAsyncUploadState // "IN_PROGRESS"' <<<"$status")
done
if [ "$upload_state" != "SUCCEEDED" ]; then
  fail "zip のアップロードが完了しませんでした (uploadState=${upload_state:-none})" "$upload"
fi

if ! publish=$(cws "${api}/v2/${item}:publish" -H 'Content-Type: application/json' --data '{"publishType":"DEFAULT_PUBLISH"}'); then
  fail "審査への提出に失敗しました" "$publish"
fi
jq -r '.warningInfo.warnings[]? | "::warning::\(.reason): \(.description)"' <<<"$publish"
echo "::notice::v${version} を Chrome Web Store の審査に提出しました (state=$(jq -r '.state // "UNKNOWN"' <<<"$publish"))"
