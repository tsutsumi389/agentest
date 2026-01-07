import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';

// パフォーマンス最適化: プラグイン配列をコンポーネント外で定数化
const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeSanitize];

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

/**
 * Markdownプレビューコンポーネント
 * GitHub Flavored Markdownに対応した表示専用コンポーネント
 * rehype-sanitizeによりXSS攻撃を防止
 */
export function MarkdownPreview({ content, className = '' }: MarkdownPreviewProps) {
  if (!content) {
    return null;
  }

  return (
    <div className={`markdown-preview ${className}`}>
      <Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
        {content}
      </Markdown>
    </div>
  );
}
