import {
  App,
  applyDocumentTheme,
  applyHostStyleVariables,
  applyHostFonts,
  type McpUiHostContext,
} from '@modelcontextprotocol/ext-apps';
import type { TestSuite, SearchTestSuiteResponse } from '../types';

// DOM要素
const appEl = document.getElementById('app')!;

/**
 * ホストコンテキストの変更を処理し、スタイルを適用する
 */
function handleHostContextChanged(ctx: McpUiHostContext): void {
  // テーマを適用
  if (ctx.theme) {
    applyDocumentTheme(ctx.theme);
  }
  // CSS変数を適用
  if (ctx.styles?.variables) {
    applyHostStyleVariables(ctx.styles.variables);
  }
  // フォントを適用
  if (ctx.styles?.css?.fonts) {
    applyHostFonts(ctx.styles.css.fonts);
  }
  // セーフエリアのパディングを適用
  if (ctx.safeAreaInsets) {
    appEl.style.paddingTop = `${ctx.safeAreaInsets.top}px`;
    appEl.style.paddingRight = `${ctx.safeAreaInsets.right}px`;
    appEl.style.paddingBottom = `${ctx.safeAreaInsets.bottom}px`;
    appEl.style.paddingLeft = `${ctx.safeAreaInsets.left}px`;
  }
}

// MCPアプリケーションインスタンスを作成
const app = new App({
  name: 'Test Suites App',
  version: '1.0.0',
});

// テストスイートデータを保持
let testSuites: TestSuite[] = [];
let total = 0;

// メッセージ送信済みのテストスイートID
const messageSentIds = new Set<string>();

/**
 * ステータスに応じたバッジのCSSクラスを返す
 */
function getStatusClass(status: string): string {
  switch (status) {
    case 'DRAFT':
      return 'status-draft';
    case 'ACTIVE':
      return 'status-active';
    case 'ARCHIVED':
      return 'status-archived';
    default:
      return '';
  }
}

/**
 * ステータスの日本語表示を返す
 */
function getStatusLabel(status: string): string {
  switch (status) {
    case 'DRAFT':
      return '下書き';
    case 'ACTIVE':
      return '有効';
    case 'ARCHIVED':
      return 'アーカイブ';
    default:
      return status;
  }
}

/**
 * 日付をフォーマット
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * テスト実行をLLMに依頼
 */
async function requestTestExecution(suite: TestSuite): Promise<void> {
  try {
    await app.sendMessage({
      role: 'user',
      content: [
        {
          type: 'text',
          text: `テストスイート「${suite.name}」（ID: ${suite.id}）のテスト実行を開始してください。
create_executionツールを使用してテスト実行を開始し、get_test_suiteで取得したテストケースを順番に実行してください。`,
        },
      ],
    });

    // 送信済みとしてマーク
    messageSentIds.add(suite.id);

    // UIを更新
    render();
  } catch (error) {
    console.error('メッセージ送信に失敗:', error);
    showError('テスト実行依頼の送信に失敗しました');
  }
}

/**
 * エラーメッセージを表示
 */
function showError(message: string): void {
  appEl.innerHTML = `
    <div class="error">${escapeHtml(message)}</div>
  `;
}

/**
 * HTMLエスケープ
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * UIをレンダリング
 */
function render(): void {
  if (testSuites.length === 0) {
    appEl.innerHTML = `
      <div class="header">
        <h1>テストスイート</h1>
        <span class="count">0件</span>
      </div>
      <div class="empty">テストスイートがありません</div>
    `;
    return;
  }

  const cardsHtml = testSuites
    .map(
      (suite) => `
      <div class="test-suite-card">
        <div class="project-badge">${escapeHtml(suite.project.name)}</div>
        <div class="test-suite-header">
          <span class="test-suite-name">${escapeHtml(suite.name)}</span>
          <span class="test-suite-status ${getStatusClass(suite.status)}">${getStatusLabel(suite.status)}</span>
        </div>
        ${suite.description ? `<div class="test-suite-description">${escapeHtml(suite.description)}</div>` : ''}
        <div class="test-suite-meta">
          <span>テストケース: ${suite._count.testCases}件</span>
          <span>前提条件: ${suite._count.preconditions}件</span>
          <span>更新: ${formatDate(suite.updatedAt)}</span>
        </div>
        <div class="test-suite-actions">
          <button
            class="btn btn-primary"
            data-action="execute"
            data-suite-id="${suite.id}"
            aria-label="${escapeHtml(suite.name)}のテスト実行を依頼"
            ${suite.status !== 'ACTIVE' || messageSentIds.has(suite.id) ? 'disabled' : ''}
          >
            ${messageSentIds.has(suite.id) ? '依頼済み' : 'テスト実行を依頼'}
          </button>
        </div>
        ${messageSentIds.has(suite.id) ? '<div class="message-sent">LLMにテスト実行を依頼しました</div>' : ''}
      </div>
    `
    )
    .join('');

  appEl.innerHTML = `
    <div class="header">
      <h1>テストスイート</h1>
      <span class="count">${total}件</span>
    </div>
    <div class="test-suite-list">
      ${cardsHtml}
    </div>
  `;

  // ボタンのイベントリスナーを設定
  const buttons = appEl.querySelectorAll('[data-action="execute"]');
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const suiteId = button.getAttribute('data-suite-id');
      const suite = testSuites.find((s) => s.id === suiteId);
      if (suite) {
        requestTestExecution(suite);
      }
    });
  });
}

// ===== ハンドラー登録（connect前に行う必要あり）=====

// アプリ終了時の処理
app.onteardown = async () => {
  console.info('App is being torn down');
  return {};
};

// ツール入力を受け取ったとき
app.ontoolinput = (params) => {
  console.info('Received tool input:', params);
};

// ツール結果を受け取るハンドラ
app.ontoolresult = (result) => {
  try {
    // 結果がJSONかを確認してパース
    if (result.content && result.content.length > 0) {
      const textContent = result.content.find((c) => c.type === 'text');
      if (textContent && 'text' in textContent) {
        const data = JSON.parse(textContent.text) as SearchTestSuiteResponse;
        testSuites = data.testSuites;
        total = data.pagination.total;
        render();
      }
    }
  } catch (error) {
    console.error('ツール結果の解析に失敗:', error);
    showError('データの読み込みに失敗しました');
  }
};

// ツールキャンセル時の処理
app.ontoolcancelled = (params) => {
  console.info('Tool was cancelled:', params);
};

// ホストコンテキスト変更時の処理
app.onhostcontextchanged = handleHostContextChanged;

// ===== ホストに接続 =====
app.connect().then(() => {
  // 接続後に初期コンテキストを取得・適用
  const ctx = app.getHostContext();
  if (ctx) {
    handleHostContextChanged(ctx);
  }
});
