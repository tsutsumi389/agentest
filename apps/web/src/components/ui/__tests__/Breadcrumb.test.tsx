import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { Breadcrumb, type BreadcrumbItem } from '../Breadcrumb';

/**
 * テスト用ラッパー（react-router の Link コンポーネント用）
 */
function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('Breadcrumb', () => {
  const items: BreadcrumbItem[] = [
    { label: 'プロジェクト', href: '/projects/1' },
    { label: 'テストスイート' },
  ];

  it('ホームリンク付きでアイテムが正しくレンダリングされる', () => {
    renderWithRouter(<Breadcrumb items={items} />);

    expect(screen.getByText('ホーム')).toBeInTheDocument();
    expect(screen.getByText('プロジェクト')).toBeInTheDocument();
    expect(screen.getByText('テストスイート')).toBeInTheDocument();
  });

  it('showHome=false でホームリンクが非表示になる', () => {
    renderWithRouter(<Breadcrumb items={items} showHome={false} />);

    expect(screen.queryByText('ホーム')).not.toBeInTheDocument();
    expect(screen.getByText('プロジェクト')).toBeInTheDocument();
    expect(screen.getByText('テストスイート')).toBeInTheDocument();
  });

  it('最後のアイテムが aria-current="page" を持つ', () => {
    renderWithRouter(<Breadcrumb items={items} />);

    // 最後のアイテム「テストスイート」の親spanがaria-currentを持つ
    const lastItem = screen.getByText('テストスイート').closest('[aria-current]');
    expect(lastItem).toHaveAttribute('aria-current', 'page');
  });

  it('リンク付きアイテムが <a> タグでレンダリングされる', () => {
    renderWithRouter(<Breadcrumb items={items} />);

    // 「プロジェクト」はリンク付き
    const projectLink = screen.getByText('プロジェクト').closest('a');
    expect(projectLink).toBeInTheDocument();
    expect(projectLink).toHaveAttribute('href', '/projects/1');
  });

  it('最後のアイテムはリンクなしのhrefがあってもリンクにならない', () => {
    const itemsWithLastHref: BreadcrumbItem[] = [
      { label: 'プロジェクト', href: '/projects/1' },
      { label: 'テストスイート', href: '/test-suites/1' },
    ];
    renderWithRouter(<Breadcrumb items={itemsWithLastHref} />);

    // 最後のアイテム「テストスイート」はhrefがあってもリンクにならない
    const lastLink = screen.getByText('テストスイート').closest('a');
    expect(lastLink).toBeNull();
  });

  it('セパレーターが正しく表示される', () => {
    renderWithRouter(<Breadcrumb items={items} />);

    // セパレーターはaria-hidden="true"のSVG要素
    const separators = document.querySelectorAll('[aria-hidden="true"]');
    // ホーム + プロジェクト + テストスイート = 3アイテム、セパレーターは2つ
    expect(separators.length).toBe(2);
  });

  it('navにaria-labelが設定されている', () => {
    renderWithRouter(<Breadcrumb items={items} />);

    const nav = screen.getByRole('navigation', { name: 'パンくずリスト' });
    expect(nav).toBeInTheDocument();
  });
});
