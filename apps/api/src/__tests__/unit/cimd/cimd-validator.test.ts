import { describe, it, expect } from 'vitest';
import {
  validateCimdMetadata,
  CimdValidationError,
} from '../../../services/cimd/cimd-validator.js';

describe('CIMD validator', () => {
  const baseMetadata = {
    client_id: 'https://example.com/client/abc',
    client_name: 'Example MCP Client',
    redirect_uris: ['https://example.com/callback'],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  };

  describe('正常系', () => {
    it('最小限の有効なメタデータを受け入れる', () => {
      const result = validateCimdMetadata(baseMetadata, 'https://example.com/client/abc');
      expect(result.client_id).toBe('https://example.com/client/abc');
      expect(result.redirect_uris).toEqual(['https://example.com/callback']);
      expect(result.token_endpoint_auth_method).toBe('none');
    });

    it('オプショナルフィールド (client_uri, logo_uri, scope, jwks_uri) を受け入れる', () => {
      const result = validateCimdMetadata(
        {
          ...baseMetadata,
          client_uri: 'https://example.com',
          logo_uri: 'https://example.com/logo.png',
          scope: 'mcp:read mcp:write',
          jwks_uri: 'https://example.com/.well-known/jwks',
        },
        'https://example.com/client/abc'
      );
      expect(result.client_uri).toBe('https://example.com');
      expect(result.logo_uri).toBe('https://example.com/logo.png');
      expect(result.scope).toBe('mcp:read mcp:write');
      expect(result.jwks_uri).toBe('https://example.com/.well-known/jwks');
    });

    it('grant_types/response_types が省略された場合のデフォルトを補完する', () => {
      const { grant_types: _g, response_types: _r, ...rest } = baseMetadata;
      const result = validateCimdMetadata(rest, 'https://example.com/client/abc');
      expect(result.grant_types).toEqual(['authorization_code']);
      expect(result.response_types).toEqual(['code']);
    });
  });

  describe('client_id一致検証', () => {
    it('client_id プロパティとフェッチ URL が一致しない場合は拒否する (仕様必須要件)', () => {
      expect(() =>
        validateCimdMetadata(
          { ...baseMetadata, client_id: 'https://other.example.com/client/xyz' },
          'https://example.com/client/abc'
        )
      ).toThrow(CimdValidationError);
    });

    it('client_id プロパティが欠けている場合は拒否する', () => {
      const { client_id: _, ...rest } = baseMetadata;
      expect(() => validateCimdMetadata(rest, 'https://example.com/client/abc')).toThrow(
        CimdValidationError
      );
    });
  });

  describe('対称鍵認証の禁止', () => {
    it('client_secret_basic は拒否する', () => {
      expect(() =>
        validateCimdMetadata(
          { ...baseMetadata, token_endpoint_auth_method: 'client_secret_basic' },
          'https://example.com/client/abc'
        )
      ).toThrow(CimdValidationError);
    });

    it('client_secret_post は拒否する', () => {
      expect(() =>
        validateCimdMetadata(
          { ...baseMetadata, token_endpoint_auth_method: 'client_secret_post' },
          'https://example.com/client/abc'
        )
      ).toThrow(CimdValidationError);
    });

    it('client_secret_jwt は拒否する', () => {
      expect(() =>
        validateCimdMetadata(
          { ...baseMetadata, token_endpoint_auth_method: 'client_secret_jwt' },
          'https://example.com/client/abc'
        )
      ).toThrow(CimdValidationError);
    });

    it('client_secret プロパティが含まれる場合は拒否する', () => {
      expect(() =>
        validateCimdMetadata(
          { ...baseMetadata, client_secret: 'secret-value' },
          'https://example.com/client/abc'
        )
      ).toThrow(CimdValidationError);
    });

    it('private_key_jwt と none は許可する', () => {
      expect(() =>
        validateCimdMetadata(
          { ...baseMetadata, token_endpoint_auth_method: 'none' },
          'https://example.com/client/abc'
        )
      ).not.toThrow();
      expect(() =>
        validateCimdMetadata(
          { ...baseMetadata, token_endpoint_auth_method: 'private_key_jwt' },
          'https://example.com/client/abc'
        )
      ).not.toThrow();
    });
  });

  describe('redirect_uris 検証', () => {
    it('redirect_uris が必須である', () => {
      const { redirect_uris: _, ...rest } = baseMetadata;
      expect(() => validateCimdMetadata(rest, 'https://example.com/client/abc')).toThrow(
        CimdValidationError
      );
    });

    it('redirect_uris が空配列の場合は拒否する', () => {
      expect(() =>
        validateCimdMetadata(
          { ...baseMetadata, redirect_uris: [] },
          'https://example.com/client/abc'
        )
      ).toThrow(CimdValidationError);
    });

    it('redirect_uris に有効な URL でないものが含まれる場合は拒否する', () => {
      expect(() =>
        validateCimdMetadata(
          { ...baseMetadata, redirect_uris: ['not-a-url'] },
          'https://example.com/client/abc'
        )
      ).toThrow(CimdValidationError);
    });
  });

  describe('JSON 型検証', () => {
    it('null や非オブジェクトは拒否する', () => {
      expect(() => validateCimdMetadata(null, 'https://example.com/client/abc')).toThrow(
        CimdValidationError
      );
      expect(() => validateCimdMetadata('string', 'https://example.com/client/abc')).toThrow(
        CimdValidationError
      );
    });
  });
});
