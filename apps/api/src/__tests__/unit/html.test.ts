import { describe, it, expect } from 'vitest';
import { escapeHtml, sanitizeUrl } from '../../utils/html.js';

describe('escapeHtml', () => {
  it('string以外の値が渡された場合は空文字列を返す', () => {
    // ランタイムで型が保証されないケースへの防御
    expect(escapeHtml(undefined as unknown as string)).toBe('');
    expect(escapeHtml(null as unknown as string)).toBe('');
    expect(escapeHtml(123 as unknown as string)).toBe('');
  });

  it('HTMLの特殊文字をエスケープする', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('アンパサンドをエスケープする', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
  });

  it('シングルクォートをエスケープする', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('山括弧をエスケープする', () => {
    expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
  });

  it('ダブルクォートをエスケープする', () => {
    expect(escapeHtml('" onclick="alert(1)"')).toBe(
      '&quot; onclick=&quot;alert(1)&quot;'
    );
  });

  it('特殊文字を含まない文字列はそのまま返す', () => {
    expect(escapeHtml('テスト太郎')).toBe('テスト太郎');
  });

  it('空文字列を処理できる', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('複数の特殊文字が混在する場合も正しくエスケープする', () => {
    expect(escapeHtml('<a href="test&foo">it\'s</a>')).toBe(
      '&lt;a href=&quot;test&amp;foo&quot;&gt;it&#39;s&lt;/a&gt;'
    );
  });
});

describe('sanitizeUrl', () => {
  it('https URLを許可する', () => {
    expect(sanitizeUrl('https://example.com/invite/abc')).toBe('https://example.com/invite/abc');
  });

  it('http URLを許可する', () => {
    expect(sanitizeUrl('http://localhost:3000/invite/abc')).toBe('http://localhost:3000/invite/abc');
  });

  it('クエリパラメータ付きURLを許可する', () => {
    const url = 'https://example.com/invite?token=abc&org=123';
    expect(sanitizeUrl(url)).toBe(url);
  });

  it('javascript: URIを拒否する', () => {
    expect(() => sanitizeUrl('javascript:alert(1)')).toThrow('許可されないURLプロトコル');
  });

  it('data: URIを拒否する', () => {
    expect(() => sanitizeUrl('data:text/html,<script>alert(1)</script>')).toThrow('許可されないURLプロトコル');
  });

  it('不正なURLを拒否する', () => {
    expect(() => sanitizeUrl('not-a-url')).toThrow('不正なURL');
  });

  it('空文字列を拒否する', () => {
    expect(() => sanitizeUrl('')).toThrow('不正なURL');
  });
});
