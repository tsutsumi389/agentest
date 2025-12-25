import { PrismaClient, UserPlan, OrganizationPlan, EntityStatus, TestCasePriority } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('データベースのシード処理を開始...');

  // デモユーザーを作成
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@agentest.dev' },
    update: {},
    create: {
      email: 'demo@agentest.dev',
      name: 'Demo User',
      plan: UserPlan.PRO,
    },
  });

  console.log('デモユーザーを作成:', demoUser.email);

  // デモ組織を作成
  const demoOrg = await prisma.organization.upsert({
    where: { slug: 'demo-org' },
    update: {},
    create: {
      name: 'Demo Organization',
      slug: 'demo-org',
      description: 'A demo organization for testing',
      plan: OrganizationPlan.TEAM,
      billingEmail: 'billing@demo-org.dev',
    },
  });

  console.log('デモ組織を作成:', demoOrg.slug);

  // デモユーザーを組織に追加
  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: demoOrg.id,
        userId: demoUser.id,
      },
    },
    update: {},
    create: {
      organizationId: demoOrg.id,
      userId: demoUser.id,
      role: 'OWNER',
    },
  });

  // デモプロジェクトを作成
  const demoProject = await prisma.project.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Demo Project',
      description: 'A demo project for testing Agentest features',
      organizationId: demoOrg.id,
    },
  });

  console.log('デモプロジェクトを作成:', demoProject.name);

  // デモ環境を作成
  await prisma.projectEnvironment.upsert({
    where: {
      projectId_slug: {
        projectId: demoProject.id,
        slug: 'development',
      },
    },
    update: {},
    create: {
      projectId: demoProject.id,
      name: 'Development',
      slug: 'development',
      baseUrl: 'http://localhost:3000',
      isDefault: true,
      sortOrder: 0,
    },
  });

  // デモテストスイートを作成
  const demoSuite = await prisma.testSuite.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      projectId: demoProject.id,
      name: 'Login Feature Tests',
      description: 'Test suite for login functionality',
      status: EntityStatus.ACTIVE,
      createdByUserId: demoUser.id,
    },
  });

  console.log('デモテストスイートを作成:', demoSuite.name);

  // デモテストケースを作成
  const demoTestCase = await prisma.testCase.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      testSuiteId: demoSuite.id,
      title: 'Valid user can login successfully',
      description: 'Verify that a user with valid credentials can login',
      priority: TestCasePriority.HIGH,
      status: EntityStatus.ACTIVE,
      orderKey: 'a',
      createdByUserId: demoUser.id,
    },
  });

  // テストケースのステップを作成
  await prisma.testCaseStep.createMany({
    skipDuplicates: true,
    data: [
      {
        testCaseId: demoTestCase.id,
        content: 'Navigate to login page',
        orderKey: 'a',
      },
      {
        testCaseId: demoTestCase.id,
        content: 'Enter valid email address',
        orderKey: 'b',
      },
      {
        testCaseId: demoTestCase.id,
        content: 'Enter valid password',
        orderKey: 'c',
      },
      {
        testCaseId: demoTestCase.id,
        content: 'Click login button',
        orderKey: 'd',
      },
    ],
  });

  // 期待結果を作成
  await prisma.testCaseExpectedResult.createMany({
    skipDuplicates: true,
    data: [
      {
        testCaseId: demoTestCase.id,
        content: 'User is redirected to dashboard',
        orderKey: 'a',
      },
      {
        testCaseId: demoTestCase.id,
        content: 'User name is displayed in header',
        orderKey: 'b',
      },
    ],
  });

  console.log('デモテストケースを作成:', demoTestCase.title);

  console.log('データベースのシード処理が完了しました!');
}

main()
  .catch((e) => {
    console.error('データベースシード処理でエラー:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
