import { z } from 'zod';

export const normalizeUrlOptionsSchema = z.object({
  stripTrailingSlash: z.boolean().default(true),
  stripUtm: z.boolean().default(true),
  stripFragment: z.boolean().default(false),
});

/**
 * ドメイン単位のルール。pattern は "github.com" / "*.notion.so" の形式
 * (allowlist と同じセマンティクス)。
 *
 * - neverClose : 自動クローズ・サスペンドの対象から除外。allowlist の
 *                サブセットだが、UI 上で「クローズしない」を独立して
 *                並べたいので別ルールとして扱う。
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

export const settingsSchema = z
  .object({
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
    // 除外ドメイン（"github.com" / "*.notion.so" 形式）
    allowlist: z.array(z.string().min(1)).default([]),
    // ドメインごとの上書きルール (先頭から順に評価)
    domainRules: z.array(domainRuleSchema).default([]),
    // 復元履歴の保持件数
    restoreHistoryLimit: z.number().int().min(10).max(1000).default(100),
    // Ctrl+Q オーバーレイに表示する MRU タブ数
    tabSwitcherMax: z.number().int().min(2).max(10).default(5),
    normalizeUrl: normalizeUrlOptionsSchema.default({
      stripTrailingSlash: true,
      stripUtm: true,
      stripFragment: false,
    }),
  })
  .refine((s) => s.suspendAfterMinutes < s.closeAfterMinutes, {
    message: 'サスペンド閾値はクローズ閾値より短くしてください',
    path: ['suspendAfterMinutes'],
  });

export type Settings = z.infer<typeof settingsSchema>;
export type NormalizeUrlOptions = z.infer<typeof normalizeUrlOptionsSchema>;

export const defaultSettings: Settings = settingsSchema.parse({});
