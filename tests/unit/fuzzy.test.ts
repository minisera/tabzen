import { describe, expect, it } from 'vitest';
import { fuzzyFilter, fuzzyScore } from '@/shared/utils/fuzzy';

describe('fuzzyScore', () => {
  it('returns 0 for empty query', () => {
    expect(fuzzyScore('', 'github.com')).toBe(0);
  });

  it('returns null when characters do not appear in order', () => {
    expect(fuzzyScore('zzz', 'github.com')).toBeNull();
    expect(fuzzyScore('hg', 'github')).toBeNull();
  });

  it('matches case-insensitively', () => {
    expect(fuzzyScore('GH', 'github.com')).not.toBeNull();
  });

  it('scores consecutive matches higher than scattered ones', () => {
    const consecutive = fuzzyScore('git', 'github')!;
    const scattered = fuzzyScore('git', 'gXiXt')!;
    expect(consecutive).toBeGreaterThan(scattered);
  });

  it('rewards word-boundary matches', () => {
    const boundary = fuzzyScore('rd', 'react-dom')!;
    const middle = fuzzyScore('rd', 'a_react_xdom')!;
    expect(boundary).toBeGreaterThan(middle);
  });
});

describe('fuzzyFilter', () => {
  const items = [
    { title: 'GitHub Pull Requests', url: 'https://github.com/pulls' },
    { title: 'Google Docs', url: 'https://docs.google.com' },
    { title: 'Reddit', url: 'https://reddit.com' },
  ];

  it('returns all items when query is empty', () => {
    expect(fuzzyFilter('', items, (i) => [i.title, i.url])).toHaveLength(3);
  });

  it('matches against any of the provided strings', () => {
    const r = fuzzyFilter('docs', items, (i) => [i.title, i.url]);
    expect(r[0].title).toBe('Google Docs');
  });

  it('orders results by score (best first)', () => {
    const r = fuzzyFilter('git', items, (i) => [i.title, i.url]);
    expect(r[0].title).toBe('GitHub Pull Requests');
  });

  it('drops non-matching items', () => {
    const r = fuzzyFilter('zzzzz', items, (i) => [i.title, i.url]);
    expect(r).toHaveLength(0);
  });
});
