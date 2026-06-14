import { z } from 'zod';

export const normalizeUrlOptionsSchema = z.object({
  stripTrailingSlash: z.boolean().default(true),
  stripUtm: z.boolean().default(true),
  stripFragment: z.boolean().default(false),
});

/**
 * ドメイン単位のルール。pattern は "github.com" / "*.notion.so" 形式。
 *
 * - neverClose : 自動クローズ・サスペンドの対象から除外。
 *                (旧 allowlist の役割をこのモードで担う)
 * - custom     : このドメインだけグローバル閾値を上書き。例えば
 *                "youtube.com" は 1 日、"twitter.com" は 30 分など。
 */
export const domainRuleSchema = z
  .object({
    pattern: z.string().min(1),
    mode: z.enum(['neverClose', 'custom']),
    suspendAfterMinutes: z
      .number()
      .int()
      .min(1)
      .max(24 * 60)
      .optional(),
    closeAfterMinutes: z
      .number()
      .int()
      .min(1)
      .max(30 * 24 * 60)
      .optional(),
  })
  .refine(
    (r) =>
      r.mode !== 'custom' ||
      (r.suspendAfterMinutes !== undefined && r.closeAfterMinutes !== undefined),
    {
      message: 'custom モードでは両方の閾値が必要です',
      path: ['suspendAfterMinutes'],
    },
  )
  .refine(
    (r) =>
      r.mode !== 'custom' ||
      r.suspendAfterMinutes === undefined ||
      r.closeAfterMinutes === undefined ||
      r.suspendAfterMinutes < r.closeAfterMinutes,
    {
      message: 'サスペンド閾値はクローズ閾値より短くしてください',
      path: ['suspendAfterMinutes'],
    },
  );

export type DomainRule = z.infer<typeof domainRuleSchema>;

const settingsObjectSchema = z.object({
  enabled: z.boolean().default(true),
  // 最終アクティブから X 分でサスペンド
  suspendAfterMinutes: z
    .number()
    .int()
    .min(1)
    .max(24 * 60)
    .default(15),
  // 最終アクティブから X 分でクローズ（必ず suspendAfterMinutes より大きい）
  closeAfterMinutes: z
    .number()
    .int()
    .min(1)
    .max(30 * 24 * 60)
    .default(60),
  // ドメインごとのルール (先頭から順に評価)。
  // 旧 settings.allowlist は読み込み時に neverClose ルールへ自動移行される
  // (下の preprocess を参照)。
  domainRules: z.array(domainRuleSchema).default([]),
  // 復元履歴の保持件数
  restoreHistoryLimit: z.number().int().min(10).max(1000).default(100),
  // Ctrl+Q オーバーレイに表示する MRU タブ数
  tabSwitcherMax: z.number().int().min(2).max(10).default(5),
  // Ctrl+Q オーバーレイのレイアウト。
  // vertical   : 横長カードを縦に積む (デフォルト・従来動作)
  // horizontal : サムネイル上・タイトル下のカードを横並び (macOS Cmd+Tab 風)
  tabSwitcherLayout: z.enum(['vertical', 'horizontal']).default('vertical'),
  // 横レイアウト時にカードを折り返すか。
  // false : 横一列に並べてはみ出し分は横スクロール (デフォルト)
  // true  : tabSwitcherColumns 列で折り返してグリッド表示
  tabSwitcherWrap: z.boolean().default(false),
  // 横レイアウトで折り返す場合の 1 行あたり列数。
  tabSwitcherColumns: z.number().int().min(2).max(8).default(4),
  normalizeUrl: normalizeUrlOptionsSchema.default({
    stripTrailingSlash: true,
    stripUtm: true,
    stripFragment: false,
  }),
});

/**
 * v1 互換: 旧 `allowlist: string[]` を `domainRules` 先頭の neverClose
 * ルールへ畳み込む。chrome.storage.sync の既存値、Backup JSON のインポート
 * のどちらでも同じ経路を通すため、スキーマのレベルでマイグレーションする。
 */
function migrateLegacyAllowlist(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input;
  const obj = input as Record<string, unknown>;
  if (!('allowlist' in obj)) return obj;
  const allowlist = obj.allowlist;
  const { allowlist: _drop, ...rest } = obj;
  if (!Array.isArray(allowlist) || allowlist.length === 0) return rest;
  const existing = Array.isArray(rest.domainRules) ? rest.domainRules : [];
  const existingPatterns = new Set(
    existing
      .filter((r): r is { pattern: unknown } => !!r && typeof r === 'object')
      .map((r) => r.pattern)
      .filter((p): p is string => typeof p === 'string'),
  );
  const migrated = allowlist
    .filter((p): p is string => typeof p === 'string' && p.length > 0)
    .filter((p) => !existingPatterns.has(p))
    .map((pattern) => ({ pattern, mode: 'neverClose' as const }));
  return { ...rest, domainRules: [...migrated, ...existing] };
}

export const settingsSchema = z
  .preprocess(migrateLegacyAllowlist, settingsObjectSchema)
  .refine((s) => s.suspendAfterMinutes < s.closeAfterMinutes, {
    message: 'サスペンド閾値はクローズ閾値より短くしてください',
    path: ['suspendAfterMinutes'],
  });

export type Settings = z.infer<typeof settingsSchema>;
export type NormalizeUrlOptions = z.infer<typeof normalizeUrlOptionsSchema>;

export const defaultSettings: Settings = settingsSchema.parse({});
