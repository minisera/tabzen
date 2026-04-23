import { z } from 'zod';

export const normalizeUrlOptionsSchema = z.object({
  stripTrailingSlash: z.boolean().default(true),
  stripUtm: z.boolean().default(true),
  stripFragment: z.boolean().default(false),
});

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
    // 復元履歴の保持件数
    restoreHistoryLimit: z.number().int().min(10).max(1000).default(100),
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
