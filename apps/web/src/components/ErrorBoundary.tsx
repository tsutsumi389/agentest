import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * エラーバウンダリコンポーネント
 * 子コンポーネントで発生したエラーをキャッチし、フォールバックUIを表示
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('エラーバウンダリでエラーをキャッチ:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="card p-8 max-w-md text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-danger-muted rounded-full">
                <AlertTriangle className="w-8 h-8 text-danger" />
              </div>
            </div>
            <h1 className="text-xl font-semibold text-foreground mb-2">
              エラーが発生しました
            </h1>
            <p className="text-foreground-muted mb-6">
              予期しないエラーが発生しました。ページを再読み込みするか、しばらくしてから再度お試しください。
            </p>
            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-sm text-foreground-subtle cursor-pointer hover:text-foreground-muted">
                  エラー詳細
                </summary>
                <pre className="mt-2 p-3 bg-background-tertiary rounded text-xs font-code text-danger overflow-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className="flex gap-3 justify-center">
              <button onClick={this.handleReset} className="btn btn-secondary">
                再試行
              </button>
              <button onClick={this.handleReload} className="btn btn-primary">
                <RefreshCw className="w-4 h-4" />
                ページを再読み込み
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
