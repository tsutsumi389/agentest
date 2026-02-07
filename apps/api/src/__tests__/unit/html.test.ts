import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../../utils/html.js';

describe('escapeHtml', () => {
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
