import { Bot } from 'lucide-react';

/**
 * 著者情報
 */
export interface AuthorInfo {
  name: string;
  avatarUrl: string | null;
}

/**
 * エージェントセッション情報
 */
export interface AgentSessionInfo {
  clientName: string | null;
}

interface AuthorAvatarProps {
  /** 著者情報（ユーザー） */
  author: AuthorInfo | null;
  /** エージェントセッション情報 */
  agentSession: AgentSessionInfo | null;
  /** サイズ */
  size?: 'sm' | 'md' | 'lg';
  /** カスタムクラス */
  className?: string;
}

/**
 * サイズ設定
 */
const SIZE_CONFIG = {
  sm: {
    container: 'w-5 h-5 text-xs',
    icon: 'w-3 h-3',
  },
  md: {
    container: 'w-6 h-6 text-sm',
    icon: 'w-4 h-4',
  },
  lg: {
    container: 'w-8 h-8 text-sm',
    icon: 'w-4 h-4',
  },
};

/**
 * 著者アバターコンポーネント
 * ユーザーまたはエージェントのアバターを表示
 */
export function AuthorAvatar({
  author,
  agentSession,
  size = 'md',
  className = '',
}: AuthorAvatarProps) {
  const sizeConfig = SIZE_CONFIG[size];

  // エージェントの場合
  if (agentSession) {
    return (
      <div
        className={`${sizeConfig.container} rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 ${className}`}
      >
        <Bot className={`${sizeConfig.icon} text-accent`} />
      </div>
    );
  }

  // ユーザーのアバター画像がある場合
  if (author?.avatarUrl) {
    return (
      <img
        src={author.avatarUrl}
        alt={author.name}
        className={`${sizeConfig.container} rounded-full flex-shrink-0 ${className}`}
      />
    );
  }

  // アバター画像がない場合（イニシャル表示）
  return (
    <div
      className={`${sizeConfig.container} rounded-full bg-foreground-muted/20 flex items-center justify-center flex-shrink-0 font-medium text-foreground-muted ${className}`}
    >
      {author?.name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

/**
 * 著者名コンポーネント
 * ユーザーまたはエージェントの名前を表示
 */
export function AuthorName({
  author,
  agentSession,
  className = '',
}: {
  author: AuthorInfo | null;
  agentSession: AgentSessionInfo | null;
  className?: string;
}) {
  if (agentSession) {
    return (
      <span className={`text-sm font-medium text-foreground flex items-center gap-1 ${className}`}>
        <Bot className="w-3 h-3" />
        {agentSession.clientName || 'Agent'}
      </span>
    );
  }

  return (
    <span className={`text-sm font-medium text-foreground ${className}`}>
      {author?.name || '不明なユーザー'}
    </span>
  );
}

/**
 * 著者名を取得するヘルパー関数
 */
export function getAuthorDisplayName(
  author: AuthorInfo | null,
  agentSession: AgentSessionInfo | null
): string {
  if (agentSession) {
    return agentSession.clientName || 'Agent';
  }
  return author?.name || '不明なユーザー';
}
