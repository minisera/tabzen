import { z } from 'zod';

export const snoozedTabSchema = z.object({
  id: z.string().min(1),
  url: z.string(),
  title: z.string(),
  favIconUrl: z.string().optional(),
  snoozedAt: z.number(),
  wakeAt: z.number(),
});
export type SnoozedTab = z.infer<typeof snoozedTabSchema>;
