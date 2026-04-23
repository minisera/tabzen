import { z } from 'zod';

export const tabMetaSchema = z.object({
  tabId: z.number(),
  windowId: z.number(),
  url: z.string(),
  title: z.string(),
  favIconUrl: z.string().optional(),
  lastActiveAt: z.number(), // epoch ms
  pinned: z.boolean(),
  audible: z.boolean(),
  groupId: z.number().optional(),
  formDirty: z.boolean(),
  suspended: z.boolean(),
});
export type TabMeta = z.infer<typeof tabMetaSchema>;

export const closedTabSchema = z.object({
  title: z.string(),
  url: z.string(),
  favIconUrl: z.string().optional(),
  closedAt: z.number(),
  groupId: z.number().optional(),
});
export type ClosedTab = z.infer<typeof closedTabSchema>;
