import { PrismaClient, UserPlan, OrganizationPlan, EntityStatus, TestCasePriority } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create demo user
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@agentest.dev' },
    update: {},
    create: {
      email: 'demo@agentest.dev',
      name: 'Demo User',
      plan: UserPlan.PRO,
    },
  });

  console.log('Created demo user:', demoUser.email);

  // Create demo organization
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

  console.log('Created demo organization:', demoOrg.slug);

  // Add demo user to organization
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

  // Create demo project
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

  console.log('Created demo project:', demoProject.name);

  // Create demo environment
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

  // Create demo test suite
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

  console.log('Created demo test suite:', demoSuite.name);

  // Create demo test case
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

  // Create test case steps
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

  // Create expected results
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

  console.log('Created demo test case:', demoTestCase.title);

  console.log('Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
