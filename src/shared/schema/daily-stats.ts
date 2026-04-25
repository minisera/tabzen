import { z } from 'zod';

/** 1 日あたりの集計値。日付は YYYY-MM-DD (ローカルタイム)。 */
export const dayStatSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  autoClosed: z.number().int().min(0).default(0),
  manualClosed: z.number().int().min(0).default(0),
  suspended: z.number().int().min(0).default(0),
});
export type DayStat = z.infer<typeof dayStatSchema>;

export const dailyStatsSchema = z.array(dayStatSchema);
