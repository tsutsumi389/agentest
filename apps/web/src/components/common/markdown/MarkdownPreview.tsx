import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

/**
 * Markdownプレビューコンポーネント
 * GitHub Flavored Markdownに対応した表示専用コンポーネント
 */
export function MarkdownPreview({ content, className = '' }: MarkdownPreviewProps) {
  if (!content) {
    return null;
  }

  return (
    <div className={`markdown-preview ${className}`}>
      <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
    </div>
  );
}
