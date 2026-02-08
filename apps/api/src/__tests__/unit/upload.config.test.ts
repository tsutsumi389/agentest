import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isAllowedMimeType,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  MAX_EVIDENCES_PER_RESULT,
  TEXT_BASED_MIME_TYPES,
  MIME_EQUIVALENCES,
  validateMagicBytes,
} from '../../config/upload.js';

// file-type モジュールのモック
vi.mock('file-type', () => ({
  fileTypeFromBuffer: vi.fn(),
}));

// モック関数を取得
import { fileTypeFromBuffer } from 'file-type';
const mockFileTypeFromBuffer = vi.mocked(fileTypeFromBuffer);

describe('upload設定', () => {
  describe('定数', () => {
    it('MAX_FILE_SIZEは100MBである', () => {
      expect(MAX_FILE_SIZE).toBe(100 * 1024 * 1024);
    });

    it('MAX_EVIDENCES_PER_RESULTは10である', () => {
      expect(MAX_EVIDENCES_PER_RESULT).toBe(10);
    });

    it('ALLOWED_MIME_TYPESに主要な画像タイプが含まれる', () => {
      expect(ALLOWED_MIME_TYPES).toContain('image/jpeg');
      expect(ALLOWED_MIME_TYPES).toContain('image/png');
      expect(ALLOWED_MIME_TYPES).toContain('image/gif');
      expect(ALLOWED_MIME_TYPES).toContain('image/webp');
    });

    it('ALLOWED_MIME_TYPESに動画タイプが含まれる', () => {
      expect(ALLOWED_MIME_TYPES).toContain('video/mp4');
      expect(ALLOWED_MIME_TYPES).toContain('video/webm');
    });

    it('ALLOWED_MIME_TYPESにドキュメントタイプが含まれる', () => {
      expect(ALLOWED_MIME_TYPES).toContain('application/pdf');
      expect(ALLOWED_MIME_TYPES).toContain('text/plain');
      expect(ALLOWED_MIME_TYPES).toContain('application/json');
    });

    it('TEXT_BASED_MIME_TYPESにテキスト系タイプが含まれる', () => {
      expect(TEXT_BASED_MIME_TYPES.has('text/plain')).toBe(true);
      expect(TEXT_BASED_MIME_TYPES.has('text/csv')).toBe(true);
      expect(TEXT_BASED_MIME_TYPES.has('application/json')).toBe(true);
      expect(TEXT_BASED_MIME_TYPES.has('image/svg+xml')).toBe(true);
    });

    it('MIME_EQUIVALENCESに等価マッピングが定義されている', () => {
      expect(MIME_EQUIVALENCES['audio/x-wav']).toBe('audio/wav');
      expect(MIME_EQUIVALENCES['video/vnd.avi']).toBe('video/x-msvideo');
    });
  });

  describe('isAllowedMimeType', () => {
    it('許可リストに含まれるMIMEタイプはtrueを返す', () => {
      expect(isAllowedMimeType('image/jpeg')).toBe(true);
      expect(isAllowedMimeType('video/mp4')).toBe(true);
      expect(isAllowedMimeType('application/pdf')).toBe(true);
    });

    it('許可リストに含まれない画像タイプはfalseを返す（ワイルドカード無効）', () => {
      expect(isAllowedMimeType('image/tiff')).toBe(false);
      expect(isAllowedMimeType('image/x-icon')).toBe(false);
    });

    it('許可リストに含まれない動画タイプはfalseを返す（ワイルドカード無効）', () => {
      expect(isAllowedMimeType('video/3gpp')).toBe(false);
    });

    it('許可リストに含まれない音声タイプはfalseを返す（ワイルドカード無効）', () => {
      expect(isAllowedMimeType('audio/flac')).toBe(false);
    });

    it('許可されていないMIMEタイプはfalseを返す', () => {
      expect(isAllowedMimeType('application/x-executable')).toBe(false);
      expect(isAllowedMimeType('application/octet-stream')).toBe(false);
    });
  });

  describe('validateMagicBytes', () => {
    beforeEach(() => {
      mockFileTypeFromBuffer.mockReset();
    });

    it('正当なPNGファイルはエラーなく通過する', async () => {
      // PNGマジックバイト
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      mockFileTypeFromBuffer.mockResolvedValue({ ext: 'png', mime: 'image/png' });

      await expect(validateMagicBytes(pngBuffer, 'image/png')).resolves.toBeUndefined();
    });

    it('正当なJPEGファイルはエラーなく通過する', async () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      mockFileTypeFromBuffer.mockResolvedValue({ ext: 'jpg', mime: 'image/jpeg' });

      await expect(validateMagicBytes(jpegBuffer, 'image/jpeg')).resolves.toBeUndefined();
    });

    it('正当なPDFファイルはエラーなく通過する', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4');
      mockFileTypeFromBuffer.mockResolvedValue({ ext: 'pdf', mime: 'application/pdf' });

      await expect(validateMagicBytes(pdfBuffer, 'application/pdf')).resolves.toBeUndefined();
    });

    it('テキスト系ファイル（text/plain）はマジックバイト検証をスキップする', async () => {
      const textBuffer = Buffer.from('Hello, World!');

      await expect(validateMagicBytes(textBuffer, 'text/plain')).resolves.toBeUndefined();
      expect(mockFileTypeFromBuffer).not.toHaveBeenCalled();
    });

    it('テキスト系ファイル（text/csv）はマジックバイト検証をスキップする', async () => {
      const csvBuffer = Buffer.from('name,age\nJohn,30');

      await expect(validateMagicBytes(csvBuffer, 'text/csv')).resolves.toBeUndefined();
      expect(mockFileTypeFromBuffer).not.toHaveBeenCalled();
    });

    it('テキスト系ファイル（application/json）はマジックバイト検証をスキップする', async () => {
      const jsonBuffer = Buffer.from('{"key": "value"}');

      await expect(validateMagicBytes(jsonBuffer, 'application/json')).resolves.toBeUndefined();
      expect(mockFileTypeFromBuffer).not.toHaveBeenCalled();
    });

    it('テキスト系ファイル（image/svg+xml）はマジックバイト検証をスキップする', async () => {
      const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

      await expect(validateMagicBytes(svgBuffer, 'image/svg+xml')).resolves.toBeUndefined();
      expect(mockFileTypeFromBuffer).not.toHaveBeenCalled();
    });

    it('MIMEタイプ偽装（PNG宣言だが中身はJPEG）はエラーになる', async () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      mockFileTypeFromBuffer.mockResolvedValue({ ext: 'jpg', mime: 'image/jpeg' });

      await expect(validateMagicBytes(jpegBuffer, 'image/png')).rejects.toThrow(
        'ファイルの内容が宣言されたMIMEタイプと一致しません'
      );
    });

    it('マジックバイトを検出できない不明なバイナリはエラーになる', async () => {
      const unknownBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      mockFileTypeFromBuffer.mockResolvedValue(undefined);

      await expect(validateMagicBytes(unknownBuffer, 'application/zip')).rejects.toThrow(
        'ファイルの種別を検出できません'
      );
    });

    it('等価マッピングで正規化されたMIMEタイプが一致すれば通過する（WAV）', async () => {
      const wavBuffer = Buffer.from('RIFF....WAVEfmt ');
      // file-type は audio/x-wav を返すが、ホワイトリストは audio/wav
      mockFileTypeFromBuffer.mockResolvedValue({ ext: 'wav', mime: 'audio/x-wav' as any });

      await expect(validateMagicBytes(wavBuffer, 'audio/wav')).resolves.toBeUndefined();
    });

    it('等価マッピングで正規化されたMIMEタイプが一致すれば通過する（AVI）', async () => {
      const aviBuffer = Buffer.from('RIFF....AVI LIST');
      // file-type は video/vnd.avi を返すが、ホワイトリストは video/x-msvideo
      mockFileTypeFromBuffer.mockResolvedValue({ ext: 'avi', mime: 'video/vnd.avi' as any });

      await expect(validateMagicBytes(aviBuffer, 'video/x-msvideo')).resolves.toBeUndefined();
    });
  });
});
