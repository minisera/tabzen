import { z } from 'zod';

export const sessionItemSchema = z.object({
  url: z.string(),
  title: z.string(),
  favIconUrl: z.string().optional(),
  pinned: z.boolean().default(false),
});
export type SessionItem = z.infer<typeof sessionItemSchema>;

export const tabSessionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.number(),
  items: z.array(sessionItemSchema),
});
export type TabSession = z.infer<typeof tabSessionSchema>;
