import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateOrderKey, sleep, retry, omit, pick, generateTimestamp } from './index.js';

describe('generateOrderKey', () => {
  describe('初期値の生成', () => {
    it('両方nullの場合は"a"を返す', () => {
      expect(generateOrderKey(null, null)).toBe('a');
    });
  });

  describe('先頭への挿入', () => {
    it('nextKeyの前の文字を返す', () => {
      expect(generateOrderKey(null, 'b')).toBe('a');
      expect(generateOrderKey(null, 'z')).toBe('y');
    });

    it('nextKeyが"0"の場合は"0a"を返す', () => {
      expect(generateOrderKey(null, '0')).toBe('0a');
    });
  });

  describe('末尾への挿入', () => {
    it('prevKeyの次の文字を返す', () => {
      expect(generateOrderKey('a', null)).toBe('b');
      expect(generateOrderKey('y', null)).toBe('z');
    });

    it('prevKeyが最大文字の場合は"a"を追加', () => {
      expect(generateOrderKey('z', null)).toBe('za');
    });

    it('複数文字のキーの場合は最後の文字をインクリメント', () => {
      expect(generateOrderKey('aa', null)).toBe('ab');
    });
  });

  describe('中間への挿入', () => {
    it('2つの間の中間値を返す', () => {
      const result = generateOrderKey('a', 'c');
      expect(result).toBe('b');
    });

    it('隣接する文字の場合は"a"を追加', () => {
      const result = generateOrderKey('a', 'b');
      expect(result).toBe('aa');
    });

    it('共通プレフィックスがある場合はそれを保持', () => {
      const result = generateOrderKey('aa', 'ac');
      expect(result).toBe('ab');
    });
  });

  describe('連続挿入', () => {
    it('連続して挿入しても順序が保たれる', () => {
      const keys: string[] = ['a'];

      // 末尾に追加
      keys.push(generateOrderKey(keys[keys.length - 1], null));
      keys.push(generateOrderKey(keys[keys.length - 1], null));

      // ソートしても順序が変わらない
      const sorted = [...keys].sort();
      expect(keys).toEqual(sorted);
    });
  });
});

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('指定したミリ秒後に解決する', async () => {
    const promise = sleep(1000);

    vi.advanceTimersByTime(999);
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(1);
    await promise;
  });

  it('0ミリ秒でも正しく動作する', async () => {
    const promise = sleep(0);
    vi.advanceTimersByTime(0);
    await promise;
  });
});

describe('retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('成功した場合は結果を返す', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await retry(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('失敗後にリトライして成功する', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('fail1')).mockResolvedValue('success');

    const promise = retry(fn);

    // 最初の失敗後、100ms待機
    await vi.advanceTimersByTimeAsync(100);

    const result = await promise;
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('最大試行回数を超えるとエラーをスローする', async () => {
    vi.useRealTimers(); // このテストはreal timersで実行
    const error = new Error('always fails');
    const fn = vi.fn().mockRejectedValue(error);

    await expect(retry(fn, { maxAttempts: 3, initialDelay: 1, maxDelay: 5 })).rejects.toThrow(
      'always fails'
    );
    expect(fn).toHaveBeenCalledTimes(3);
    vi.useFakeTimers(); // 元に戻す
  });

  it('オプションをカスタマイズできる', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('success');

    const promise = retry(fn, {
      maxAttempts: 5,
      initialDelay: 50,
      maxDelay: 500,
      factor: 3,
    });

    await vi.advanceTimersByTimeAsync(50);

    const result = await promise;
    expect(result).toBe('success');
  });

  it('maxDelayを超えないようにする', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockRejectedValueOnce(new Error('fail3'))
      .mockResolvedValue('success');

    const promise = retry(fn, {
      maxAttempts: 4,
      initialDelay: 1000,
      maxDelay: 2000,
      factor: 3,
    });

    // 1回目失敗後1000ms
    await vi.advanceTimersByTimeAsync(1000);
    // 2回目失敗後2000ms（maxDelayで制限）
    await vi.advanceTimersByTimeAsync(2000);
    // 3回目失敗後2000ms（maxDelayで制限）
    await vi.advanceTimersByTimeAsync(2000);

    const result = await promise;
    expect(result).toBe('success');
  });
});

describe('omit', () => {
  it('指定したキーを除外したオブジェクトを返す', () => {
    const obj = { a: 1, b: 2, c: 3 };
    const result = omit(obj, ['b']);

    expect(result).toEqual({ a: 1, c: 3 });
  });

  it('複数のキーを除外できる', () => {
    const obj = { a: 1, b: 2, c: 3, d: 4 };
    const result = omit(obj, ['b', 'd']);

    expect(result).toEqual({ a: 1, c: 3 });
  });

  it('元のオブジェクトを変更しない', () => {
    const obj = { a: 1, b: 2 };
    omit(obj, ['b']);

    expect(obj).toEqual({ a: 1, b: 2 });
  });

  it('存在しないキーを指定しても正常に動作する', () => {
    const obj = { a: 1 };
    // @ts-expect-error 存在しないキーのテスト
    const result = omit(obj, ['b']);

    expect(result).toEqual({ a: 1 });
  });

  it('空の配列を指定すると元のオブジェクトのコピーを返す', () => {
    const obj = { a: 1, b: 2 };
    const result = omit(obj, []);

    expect(result).toEqual({ a: 1, b: 2 });
    expect(result).not.toBe(obj);
  });
});

describe('pick', () => {
  it('指定したキーのみを持つオブジェクトを返す', () => {
    const obj = { a: 1, b: 2, c: 3 };
    const result = pick(obj, ['a', 'c']);

    expect(result).toEqual({ a: 1, c: 3 });
  });

  it('単一のキーを抽出できる', () => {
    const obj = { a: 1, b: 2, c: 3 };
    const result = pick(obj, ['b']);

    expect(result).toEqual({ b: 2 });
  });

  it('元のオブジェクトを変更しない', () => {
    const obj = { a: 1, b: 2, c: 3 };
    pick(obj, ['a']);

    expect(obj).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('存在しないキーを指定すると無視される', () => {
    const obj = { a: 1 };
    // @ts-expect-error 存在しないキーのテスト
    const result = pick(obj, ['a', 'b']);

    expect(result).toEqual({ a: 1 });
  });

  it('空の配列を指定すると空のオブジェクトを返す', () => {
    const obj = { a: 1, b: 2 };
    const result = pick(obj, []);

    expect(result).toEqual({});
  });
});

describe('generateTimestamp', () => {
  it('YYYYMMDD-HHmmss形式のタイムスタンプを生成する', () => {
    const date = new Date('2024-03-15T09:05:30');
    const result = generateTimestamp(date);

    expect(result).toBe('20240315-090530');
  });

  it('月と日が1桁の場合はゼロ埋めする', () => {
    const date = new Date('2024-01-05T01:02:03');
    const result = generateTimestamp(date);

    expect(result).toBe('20240105-010203');
  });

  it('引数なしで現在時刻を使用する', () => {
    const result = generateTimestamp();

    // フォーマットが正しいことを確認
    expect(result).toMatch(/^\d{8}-\d{6}$/);
  });

  it('年末年始の境界で正しく動作する', () => {
    const date = new Date('2024-12-31T23:59:59');
    const result = generateTimestamp(date);

    expect(result).toBe('20241231-235959');
  });
});
