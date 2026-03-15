import { prisma } from '@agentest/db';

/**
 * コメント配列にターゲット名（テストケース名/テストスイート名）を付与する
 * N+1問題を回避するため、targetTypeごとにバッチ取得する
 */
export async function enrichCommentsWithTargetName<
  T extends { targetType: string; targetId: string },
>(comments: T[]): Promise<(T & { targetName: string | null })[]> {
  if (comments.length === 0) {
    return [];
  }

  // targetTypeごとにユニークなIDを収集
  const caseIds = [
    ...new Set(comments.filter((c) => c.targetType === 'CASE').map((c) => c.targetId)),
  ];
  const suiteIds = [
    ...new Set(comments.filter((c) => c.targetType === 'SUITE').map((c) => c.targetId)),
  ];

  // バッチ取得（必要な場合のみクエリ発行、並列実行）
  const [cases, suites] = await Promise.all([
    caseIds.length > 0
      ? prisma.testCase.findMany({
          where: { id: { in: caseIds } },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
    suiteIds.length > 0
      ? prisma.testSuite.findMany({
          where: { id: { in: suiteIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  // targetTypeプレフィックス付きMapでID衝突を回避
  const nameMap = new Map<string, string>();
  for (const tc of cases) {
    nameMap.set(`CASE:${tc.id}`, tc.title);
  }
  for (const ts of suites) {
    nameMap.set(`SUITE:${ts.id}`, ts.name);
  }

  // コメントにtargetNameをマッピング
  return comments.map((comment) => ({
    ...comment,
    targetName: nameMap.get(`${comment.targetType}:${comment.targetId}`) ?? null,
  }));
}

/**
 * レビューオブジェクト全体のコメントにtargetNameを付与するラッパー
 * null安全：nullが渡された場合はnullを返す
 */
export async function enrichReviewWithTargetNames<
  T extends { comments: Array<{ targetType: string; targetId: string }> },
>(review: T | null): Promise<T | null> {
  if (!review) {
    return null;
  }

  const enrichedComments = await enrichCommentsWithTargetName(review.comments);
  return { ...review, comments: enrichedComments };
}
