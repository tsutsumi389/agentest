import passport from 'passport';
import { Strategy as GitHubStrategy, type Profile as GitHubProfile } from 'passport-github2';
import { Strategy as GoogleStrategy, type Profile as GoogleProfile } from 'passport-google-oauth20';
import type { Request } from 'express';
import type { AuthConfig, OAuthProfile } from './types.js';

export type OAuthCallback = (
  profile: OAuthProfile
) => Promise<{ userId: string; email: string }>;

// 連携追加用のコールバック（既存ユーザーにプロバイダーを追加）
export type OAuthLinkCallback = (
  userId: string,
  profile: OAuthProfile
) => Promise<{ success: boolean; error?: string }>;

export function configurePassport(
  config: AuthConfig,
  onOAuth: OAuthCallback,
  onOAuthLink?: OAuthLinkCallback
): void {
  // GitHub Strategy
  if (config.oauth.github) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: config.oauth.github.clientId,
          clientSecret: config.oauth.github.clientSecret,
          callbackURL: config.oauth.github.callbackUrl,
          scope: ['user:email'],
        },
        async (
          accessToken: string,
          refreshToken: string,
          profile: GitHubProfile,
          done: (error: Error | null, user?: { userId: string; email: string }) => void
        ) => {
          try {
            const email =
              profile.emails?.[0]?.value ||
              `${profile.id}@users.noreply.github.com`;

            const oauthProfile: OAuthProfile = {
              provider: 'github',
              providerAccountId: profile.id,
              email,
              name: profile.displayName || profile.username || 'GitHub User',
              avatarUrl: profile.photos?.[0]?.value,
              accessToken,
              refreshToken,
            };

            const user = await onOAuth(oauthProfile);
            done(null, user);
          } catch (error) {
            done(error as Error);
          }
        }
      )
    );
  }

  // Google Strategy
  if (config.oauth.google) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: config.oauth.google.clientId,
          clientSecret: config.oauth.google.clientSecret,
          callbackURL: config.oauth.google.callbackUrl,
          scope: ['profile', 'email'],
        },
        async (
          accessToken: string,
          refreshToken: string,
          profile: GoogleProfile,
          done: (error: Error | null, user?: { userId: string; email: string }) => void
        ) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
              throw new Error('No email provided by Google');
            }

            const oauthProfile: OAuthProfile = {
              provider: 'google',
              providerAccountId: profile.id,
              email,
              name: profile.displayName || 'Google User',
              avatarUrl: profile.photos?.[0]?.value,
              accessToken,
              refreshToken,
            };

            const user = await onOAuth(oauthProfile);
            done(null, user);
          } catch (error) {
            done(error as Error);
          }
        }
      )
    );
  }

  // 連携追加用ストラテジー（onOAuthLinkが提供されている場合のみ）
  if (onOAuthLink) {
    // GitHub Link Strategy
    if (config.oauth.github) {
      const linkCallbackUrl = config.oauth.github.callbackUrl.replace('/callback', '/link/callback');
      passport.use(
        'github-link',
        new GitHubStrategy(
          {
            clientID: config.oauth.github.clientId,
            clientSecret: config.oauth.github.clientSecret,
            callbackURL: linkCallbackUrl,
            scope: ['user:email'],
            passReqToCallback: true,
          },
          async (
            req: Request,
            accessToken: string,
            refreshToken: string,
            profile: GitHubProfile,
            done: (error: Error | null, user?: { success: boolean; error?: string }) => void
          ) => {
            try {
              const userId = req.user?.id;
              if (!userId) {
                done(null, { success: false, error: 'ログインが必要です' });
                return;
              }

              const email =
                profile.emails?.[0]?.value ||
                `${profile.id}@users.noreply.github.com`;

              const oauthProfile: OAuthProfile = {
                provider: 'github',
                providerAccountId: profile.id,
                email,
                name: profile.displayName || profile.username || 'GitHub User',
                avatarUrl: profile.photos?.[0]?.value,
                accessToken,
                refreshToken,
              };

              const result = await onOAuthLink(userId, oauthProfile);
              done(null, result);
            } catch (error) {
              done(error as Error);
            }
          }
        )
      );
    }

    // Google Link Strategy
    if (config.oauth.google) {
      const linkCallbackUrl = config.oauth.google.callbackUrl.replace('/callback', '/link/callback');
      passport.use(
        'google-link',
        new GoogleStrategy(
          {
            clientID: config.oauth.google.clientId,
            clientSecret: config.oauth.google.clientSecret,
            callbackURL: linkCallbackUrl,
            scope: ['profile', 'email'],
            passReqToCallback: true,
          },
          async (
            req: Request,
            accessToken: string,
            refreshToken: string,
            profile: GoogleProfile,
            done: (error: Error | null, user?: { success: boolean; error?: string }) => void
          ) => {
            try {
              const userId = req.user?.id;
              if (!userId) {
                done(null, { success: false, error: 'ログインが必要です' });
                return;
              }

              const email = profile.emails?.[0]?.value;
              if (!email) {
                done(null, { success: false, error: 'メールアドレスが取得できませんでした' });
                return;
              }

              const oauthProfile: OAuthProfile = {
                provider: 'google',
                providerAccountId: profile.id,
                email,
                name: profile.displayName || 'Google User',
                avatarUrl: profile.photos?.[0]?.value,
                accessToken,
                refreshToken,
              };

              const result = await onOAuthLink(userId, oauthProfile);
              done(null, result);
            } catch (error) {
              done(error as Error);
            }
          }
        )
      );
    }
  }
}

export { passport };
