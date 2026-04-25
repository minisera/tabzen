/**
 * シンプルなサブシーケンス・スコアリング型ファジーマッチ。
 * 連続一致 / 単語境界一致をボーナス、対象文字列長を弱いペナルティとして
 * 計算する。マッチしない場合は null。
 */
export function fuzzyScore(query: string, target: string): number | null {
  if (query.length === 0) return 0;
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  let qi = 0;
  let score = 0;
  let consecutive = 0;
  let prev = -2;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t.charCodeAt(ti) === q.charCodeAt(qi)) {
      if (ti === prev + 1) {
        consecutive++;
        score += 5 + consecutive;
      } else {
        consecutive = 0;
        score += 1;
      }
      const prevChar = ti === 0 ? ' ' : t[ti - 1];
      if (ti === 0 || /[\s\-_/.:?#]/.test(prevChar)) {
        score += 3;
      }
      prev = ti;
      qi++;
    }
  }

  if (qi < q.length) return null;

  score -= t.length * 0.01;
  return score;
}

/**
 * items を query で絞り込み、スコア降順に並べ替える。
 * getStrings は 1 アイテムあたり複数のターゲット文字列を返せる
 * (タイトル + URL など)。各アイテムは最高スコアで採点される。
 */
export function fuzzyFilter<T>(query: string, items: T[], getStrings: (item: T) => string[]): T[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) return items;
  const scored: Array<{ item: T; score: number }> = [];
  for (const item of items) {
    let best: number | null = null;
    for (const s of getStrings(item)) {
      const sc = fuzzyScore(trimmed, s);
      if (sc !== null && (best === null || sc > best)) best = sc;
    }
    if (best !== null) scored.push({ item, score: best });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
}
