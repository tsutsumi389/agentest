import { describe, it, expect } from 'vitest';
import { isAllowedMimeType, ALLOWED_MIME_TYPES, MAX_FILE_SIZE, MAX_EVIDENCES_PER_RESULT } from '../../config/upload.js';

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
  });

  describe('isAllowedMimeType', () => {
    it('許可リストに含まれるMIMEタイプはtrueを返す', () => {
      expect(isAllowedMimeType('image/jpeg')).toBe(true);
      expect(isAllowedMimeType('video/mp4')).toBe(true);
      expect(isAllowedMimeType('application/pdf')).toBe(true);
    });

    it('imageワイルドカードで未知の画像タイプもtrueを返す', () => {
      expect(isAllowedMimeType('image/tiff')).toBe(true);
      expect(isAllowedMimeType('image/x-icon')).toBe(true);
    });

    it('videoワイルドカードで未知の動画タイプもtrueを返す', () => {
      expect(isAllowedMimeType('video/3gpp')).toBe(true);
    });

    it('audioワイルドカードで未知の音声タイプもtrueを返す', () => {
      expect(isAllowedMimeType('audio/flac')).toBe(true);
    });

    it('許可されていないMIMEタイプはfalseを返す', () => {
      expect(isAllowedMimeType('application/x-executable')).toBe(false);
      expect(isAllowedMimeType('application/octet-stream')).toBe(false);
    });
  });
});
