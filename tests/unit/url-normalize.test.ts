import { describe, expect, it } from 'vitest';
import { isAllowlisted, matchDomain, normalizeUrl } from '@/shared/utils/url-normalize';

const OPTS = { stripTrailingSlash: true, stripUtm: true, stripFragment: false };

describe('normalizeUrl', () => {
  it('returns the input as-is when URL parse fails', () => {
    expect(normalizeUrl('not a url', OPTS)).toBe('not a url');
  });

  it('removes utm_* query params while keeping others', () => {
    const input = 'https://example.com/path?utm_source=x&utm_medium=y&a=1';
    expect(normalizeUrl(input, OPTS)).toBe('https://example.com/path?a=1');
  });

  it('strips trailing slash before query / fragment / end', () => {
    expect(normalizeUrl('https://example.com/', OPTS)).toBe('https://example.com');
    expect(
      normalizeUrl('https://example.com/foo/?bar=1', { ...OPTS, stripTrailingSlash: true }),
    ).toBe('https://example.com/foo?bar=1');
  });

  it('leaves trailing slash when stripTrailingSlash is false', () => {
    expect(normalizeUrl('https://example.com/', { ...OPTS, stripTrailingSlash: false })).toBe(
      'https://example.com/',
    );
  });

  it('removes fragment when stripFragment is true', () => {
    expect(normalizeUrl('https://example.com/page#section', { ...OPTS, stripFragment: true })).toBe(
      'https://example.com/page',
    );
  });

  it('keeps fragment when stripFragment is false', () => {
    expect(normalizeUrl('https://example.com/page#section', OPTS)).toBe(
      'https://example.com/page#section',
    );
  });
});

describe('matchDomain', () => {
  it('matches exact hostname', () => {
    expect(matchDomain('example.com', 'example.com')).toBe(true);
    expect(matchDomain('foo.example.com', 'example.com')).toBe(false);
  });

  it('matches wildcard prefix *.example.com', () => {
    expect(matchDomain('foo.example.com', '*.example.com')).toBe(true);
    expect(matchDomain('bar.foo.example.com', '*.example.com')).toBe(true);
    expect(matchDomain('example.com', '*.example.com')).toBe(true);
    expect(matchDomain('notexample.com', '*.example.com')).toBe(false);
  });
});

describe('isAllowlisted', () => {
  it('returns false when patterns is empty', () => {
    expect(isAllowlisted('https://example.com', [])).toBe(false);
  });

  it('returns true when host matches any of the patterns', () => {
    const patterns = ['github.com', '*.notion.so'];
    expect(isAllowlisted('https://github.com/foo', patterns)).toBe(true);
    expect(isAllowlisted('https://api.notion.so/v1', patterns)).toBe(true);
    expect(isAllowlisted('https://example.com', patterns)).toBe(false);
  });

  it('returns false for unparseable URL', () => {
    expect(isAllowlisted('about:blank', ['example.com'])).toBe(false);
  });
});
