import { describe, expect, it } from 'vitest';
import { tabSessionSchema } from '@/shared/schema/session';

describe('tabSessionSchema', () => {
  it('parses a valid session', () => {
    const r = tabSessionSchema.safeParse({
      id: 'a',
      name: 'work',
      createdAt: 1,
      items: [
        { url: 'https://example.com', title: 'ex', pinned: false },
        { url: 'https://x.test', title: 'x', favIconUrl: 'https://x.test/f.ico', pinned: true },
      ],
    });
    expect(r.success).toBe(true);
  });

  it('defaults item.pinned to false', () => {
    const r = tabSessionSchema.parse({
      id: 'a',
      name: 'work',
      createdAt: 1,
      items: [{ url: 'https://example.com', title: 'ex' }],
    });
    expect(r.items[0].pinned).toBe(false);
  });

  it('rejects empty name', () => {
    const r = tabSessionSchema.safeParse({
      id: 'a',
      name: '',
      createdAt: 1,
      items: [],
    });
    expect(r.success).toBe(false);
  });
});
