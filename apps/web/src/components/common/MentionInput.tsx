import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Folder, FileText } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import {
  projectsApi,
  testSuitesApi,
  testCasesApi,
  type TestSuiteSuggestion,
  type TestCaseSuggestion,
  type TestCaseWithDetails,
} from '../../lib/api';

/**
 * メンション入力の状態
 */
type MentionState =
  | { type: 'idle' }
  | { type: 'suite-search'; query: string; startIndex: number }
  | { type: 'case-search'; suiteId: string; suiteName: string; query: string; startIndex: number };

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  projectId: string;
  onTestCaseSelect?: (testCase: TestCaseWithDetails) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * @参照入力コンポーネント
 * タイトル入力欄で@を入力すると、テストスイート・テストケースを参照できる
 */
export function MentionInput({
  value,
  onChange,
  projectId,
  onTestCaseSelect,
  placeholder,
  disabled = false,
  className = '',
}: MentionInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // メンション状態管理
  const [mentionState, setMentionState] = useState<MentionState>({ type: 'idle' });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // デバウンス検索クエリ
  const debouncedQuery = useDebounce(mentionState.type !== 'idle' ? mentionState.query : '', 300);

  // テストスイートサジェスト取得
  const { data: suiteSuggestionsData, isLoading: isSuiteLoading } = useQuery({
    queryKey: ['suite-suggestions', projectId, debouncedQuery],
    queryFn: () => projectsApi.suggestTestSuites(projectId, { q: debouncedQuery, limit: 10 }),
    enabled: mentionState.type === 'suite-search' && !!projectId,
    staleTime: 30000,
  });

  // テストケースサジェスト取得
  const { data: caseSuggestionsData, isLoading: isCaseLoading } = useQuery({
    queryKey: [
      'case-suggestions',
      mentionState.type === 'case-search' ? mentionState.suiteId : '',
      debouncedQuery,
    ],
    queryFn: () => {
      if (mentionState.type !== 'case-search') return { suggestions: [] };
      return testSuitesApi.suggestTestCases(mentionState.suiteId, { q: debouncedQuery, limit: 10 });
    },
    enabled: mentionState.type === 'case-search',
    staleTime: 30000,
  });

  const suiteSuggestions = suiteSuggestionsData?.suggestions || [];
  const caseSuggestions = caseSuggestionsData?.suggestions || [];
  const isLoading = isSuiteLoading || isCaseLoading || isLoadingDetails;

  // 選択インデックスのリセット
  useEffect(() => {
    setSelectedIndex(0);
  }, [debouncedQuery, mentionState.type]);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        // フォーカス喪失時は状態維持（ドロップダウンのみ閉じる）
        setMentionState({ type: 'idle' });
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 入力値変更ハンドラ
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      const cursorPos = e.target.selectionStart || 0;
      onChange(newValue);

      // @の検出（最後の@を探す）
      const lastAtIndex = newValue.lastIndexOf('@', cursorPos - 1);

      if (lastAtIndex === -1) {
        // @がない場合はidle
        setMentionState({ type: 'idle' });
        return;
      }

      // @以降のテキストを取得
      const afterAt = newValue.slice(lastAtIndex + 1, cursorPos);

      // /があるかチェック
      const slashIndex = afterAt.indexOf('/');

      if (mentionState.type === 'case-search' && slashIndex === -1) {
        // case-search状態で/が消えた場合はsuite-searchに戻る
        setMentionState({
          type: 'suite-search',
          query: afterAt,
          startIndex: lastAtIndex,
        });
      } else if (mentionState.type === 'case-search' && slashIndex !== -1) {
        // case-search状態で/以降のクエリを更新
        const caseQuery = afterAt.slice(slashIndex + 1);
        setMentionState((prev) => {
          if (prev.type !== 'case-search') return prev;
          return {
            ...prev,
            query: caseQuery,
          };
        });
      } else if (slashIndex === -1) {
        // suite-search
        setMentionState({
          type: 'suite-search',
          query: afterAt,
          startIndex: lastAtIndex,
        });
      }
    },
    [onChange, mentionState.type]
  );

  // テストスイート選択
  const handleSuiteSelect = useCallback(
    (suite: TestSuiteSuggestion) => {
      if (mentionState.type !== 'suite-search') return;

      // @クエリをスイート名+/に置き換え
      const beforeAt = value.slice(0, mentionState.startIndex);
      const afterQuery = value.slice(mentionState.startIndex + 1 + mentionState.query.length);
      const newValue = `${beforeAt}@${suite.name}/${afterQuery}`;
      onChange(newValue);

      // case-search状態に遷移
      setMentionState({
        type: 'case-search',
        suiteId: suite.id,
        suiteName: suite.name,
        query: '',
        startIndex: mentionState.startIndex,
      });
      setSelectedIndex(0);

      // 入力欄にフォーカスを維持
      inputRef.current?.focus();
    },
    [mentionState, value, onChange]
  );

  // テストケース選択
  const handleCaseSelect = useCallback(
    async (testCase: TestCaseSuggestion) => {
      if (mentionState.type !== 'case-search') return;

      setIsLoadingDetails(true);

      try {
        // 詳細を取得
        const { testCase: testCaseDetails } = await testCasesApi.getByIdWithDetails(testCase.id);

        // @メンションをテストケースのタイトルに置き換え
        const beforeAt = value.slice(0, mentionState.startIndex);
        onChange(beforeAt + testCaseDetails.title);

        // 親コンポーネントに通知
        onTestCaseSelect?.(testCaseDetails);

        // idle状態に戻る
        setMentionState({ type: 'idle' });
      } catch {
        // エラー時はそのまま
      } finally {
        setIsLoadingDetails(false);
      }
    },
    [mentionState, value, onChange, onTestCaseSelect]
  );

  // キーボードナビゲーション
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (mentionState.type === 'idle') return;

      const suggestions = mentionState.type === 'suite-search' ? suiteSuggestions : caseSuggestions;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
          break;

        case 'Enter':
        case 'Tab':
          if (suggestions.length > 0 && suggestions[selectedIndex]) {
            e.preventDefault();
            if (mentionState.type === 'suite-search') {
              handleSuiteSelect(suggestions[selectedIndex] as TestSuiteSuggestion);
            } else {
              handleCaseSelect(suggestions[selectedIndex] as TestCaseSuggestion);
            }
          }
          break;

        case 'Escape':
          e.preventDefault();
          if (mentionState.type === 'case-search') {
            // case-searchからsuite-searchに戻る
            setMentionState({
              type: 'suite-search',
              query: mentionState.suiteName,
              startIndex: mentionState.startIndex,
            });
          } else {
            // suite-searchからidleに戻る
            setMentionState({ type: 'idle' });
          }
          break;

        case 'Backspace':
          if (mentionState.type === 'case-search' && mentionState.query === '') {
            // case-search状態でクエリが空の時、/を削除してsuite-searchに戻る
            const beforeAt = value.slice(0, mentionState.startIndex);
            const suitePart = `@${mentionState.suiteName}`;
            onChange(beforeAt + suitePart);
            setMentionState({
              type: 'suite-search',
              query: mentionState.suiteName,
              startIndex: mentionState.startIndex,
            });
          }
          break;
      }
    },
    [
      mentionState,
      suiteSuggestions,
      caseSuggestions,
      selectedIndex,
      handleSuiteSelect,
      handleCaseSelect,
      value,
      onChange,
    ]
  );

  // ステータスバッジの色を取得
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'badge-success';
      case 'DRAFT':
        return 'badge-warning';
      default:
        return 'text-foreground-muted';
    }
  };

  // ステータスの表示名を取得
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return '有効';
      case 'DRAFT':
        return '下書き';
      case 'ARCHIVED':
        return 'アーカイブ';
      default:
        return status;
    }
  };

  const showDropdown = mentionState.type !== 'idle';
  const suggestions = mentionState.type === 'suite-search' ? suiteSuggestions : caseSuggestions;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={`input ${className}`}
        role="combobox"
        aria-expanded={showDropdown}
        aria-haspopup="listbox"
        aria-autocomplete="list"
      />

      {/* サジェストドロップダウン */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 top-full mt-1 bg-background-secondary border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto z-dropdown"
          role="listbox"
          aria-label={mentionState.type === 'suite-search' ? 'テストスイート' : 'テストケース'}
        >
          {/* ヘッダー */}
          <div className="px-3 py-2 text-xs font-medium text-foreground-muted border-b border-border flex items-center gap-2">
            {mentionState.type === 'suite-search' ? (
              <>
                <Folder className="w-3.5 h-3.5" />
                テストスイート
              </>
            ) : (
              <>
                <FileText className="w-3.5 h-3.5" />
                テストケース（{mentionState.suiteName}）
              </>
            )}
          </div>

          {/* ローディング表示 */}
          {isLoading && (
            <div className="px-4 py-6 text-center text-foreground-muted">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              <span className="text-sm">検索中...</span>
            </div>
          )}

          {/* 結果なし表示 */}
          {!isLoading && suggestions.length === 0 && (
            <div className="px-4 py-6 text-center text-foreground-muted text-sm">
              {mentionState.type === 'suite-search'
                ? '一致するテストスイートがありません'
                : '一致するテストケースがありません'}
            </div>
          )}

          {/* サジェストリスト */}
          {!isLoading && suggestions.length > 0 && (
            <div className="py-1">
              {mentionState.type === 'suite-search'
                ? suiteSuggestions.map((suite, index) => (
                    <button
                      key={suite.id}
                      type="button"
                      role="option"
                      aria-selected={index === selectedIndex}
                      onClick={() => handleSuiteSelect(suite)}
                      className={`
                        w-full text-left px-3 py-2 transition-colors
                        ${
                          index === selectedIndex
                            ? 'bg-accent-subtle text-foreground'
                            : 'text-foreground-muted hover:bg-background-tertiary hover:text-foreground'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{suite.name}</span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${getStatusBadgeClass(suite.status)}`}
                        >
                          {getStatusLabel(suite.status)}
                        </span>
                      </div>
                      {suite.description && (
                        <p className="text-xs text-foreground-subtle mt-0.5 truncate">
                          {suite.description}
                        </p>
                      )}
                    </button>
                  ))
                : caseSuggestions.map((testCase, index) => (
                    <button
                      key={testCase.id}
                      type="button"
                      role="option"
                      aria-selected={index === selectedIndex}
                      onClick={() => handleCaseSelect(testCase)}
                      className={`
                        w-full text-left px-3 py-2 transition-colors
                        ${
                          index === selectedIndex
                            ? 'bg-accent-subtle text-foreground'
                            : 'text-foreground-muted hover:bg-background-tertiary hover:text-foreground'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{testCase.title}</span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${getStatusBadgeClass(testCase.status)}`}
                        >
                          {getStatusLabel(testCase.status)}
                        </span>
                      </div>
                      {testCase.description && (
                        <p className="text-xs text-foreground-subtle mt-0.5 truncate">
                          {testCase.description}
                        </p>
                      )}
                    </button>
                  ))}
            </div>
          )}

          {/* フッター（キーボードヒント） */}
          <div className="px-3 py-2 border-t border-border text-xs text-foreground-subtle flex items-center gap-4">
            <span>
              <kbd className="px-1 py-0.5 bg-background-tertiary rounded text-[10px]">↑↓</kbd> 選択
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-background-tertiary rounded text-[10px]">Enter</kbd>{' '}
              確定
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-background-tertiary rounded text-[10px]">Esc</kbd>{' '}
              閉じる
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
