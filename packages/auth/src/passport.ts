import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import type { AuthConfig, OAuthProfile } from './types.js';

export type OAuthCallback = (
  profile: OAuthProfile
) => Promise<{ userId: string; email: string }>;

export function configurePassport(config: AuthConfig, onOAuth: OAuthCallback): void {
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
          profile: GitHubStrategy.Profile,
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
          profile: GoogleStrategy.Profile,
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
}

export { passport };
