import type {
  PreconditionStatus,
  StepStatus,
  JudgmentStatus,
  LockTargetType as _LockTargetType,
  ReviewStatus,
} from '@agentest/shared';

// 再エクスポート
export type { LockTargetType } from '@agentest/shared';
type LockTargetType = _LockTargetType;

// ============================================
// 基本型
// ============================================

export interface BaseMessage {
  type: string;
  timestamp: number;
}

export interface BaseEvent extends BaseMessage {
  eventId: string;
}

// ============================================
// クライアント -> サーバー メッセージ
// ============================================

export interface AuthenticateMessage extends BaseMessage {
  type: 'authenticate';
  token: string;
}

export interface SubscribeMessage extends BaseMessage {
  type: 'subscribe';
  channels: string[];
}

export interface UnsubscribeMessage extends BaseMessage {
  type: 'unsubscribe';
  channels: string[];
}

export interface PingMessage extends BaseMessage {
  type: 'ping';
}

export interface HeartbeatMessage extends BaseMessage {
  type: 'heartbeat';
  lockId?: string;
}

export type ClientMessage =
  | AuthenticateMessage
  | SubscribeMessage
  | UnsubscribeMessage
  | PingMessage
  | HeartbeatMessage;

// ============================================
// サーバー -> クライアント メッセージ
// ============================================

export interface AuthenticatedMessage extends BaseMessage {
  type: 'authenticated';
  userId: string;
}

export interface ErrorMessage extends BaseMessage {
  type: 'error';
  code: string;
  message: string;
}

export interface PongMessage extends BaseMessage {
  type: 'pong';
}

export interface SubscribedMessage extends BaseMessage {
  type: 'subscribed';
  channels: string[];
}

// ============================================
// 実行イベント
// ============================================

export interface ExecutionStartedEvent extends BaseEvent {
  type: 'execution:started';
  executionId: string;
  testSuiteId: string;
  environmentId: string | null;
  executedBy: {
    type: 'user' | 'agent';
    id: string;
    name: string;
  };
}

export interface ExecutionPreconditionUpdatedEvent extends BaseEvent {
  type: 'execution:precondition_updated';
  executionId: string;
  resultId: string;
  snapshotPreconditionId: string;
  status: PreconditionStatus;
  note: string | null;
}

export interface ExecutionStepUpdatedEvent extends BaseEvent {
  type: 'execution:step_updated';
  executionId: string;
  resultId: string;
  snapshotTestCaseId: string;
  snapshotStepId: string;
  status: StepStatus;
  note: string | null;
}

export interface ExecutionExpectedResultUpdatedEvent extends BaseEvent {
  type: 'execution:expected_result_updated';
  executionId: string;
  resultId: string;
  snapshotTestCaseId: string;
  snapshotExpectedResultId: string;
  status: JudgmentStatus;
  note: string | null;
}

export interface ExecutionEvidenceAddedEvent extends BaseEvent {
  type: 'execution:evidence_added';
  executionId: string;
  expectedResultId: string;
  evidence: {
    id: string;
    fileName: string;
    fileUrl: string;
    fileType: string;
  };
}

export type ExecutionEvent =
  | ExecutionStartedEvent
  | ExecutionPreconditionUpdatedEvent
  | ExecutionStepUpdatedEvent
  | ExecutionExpectedResultUpdatedEvent
  | ExecutionEvidenceAddedEvent;

// ============================================
// 編集ロックイベント
// ============================================

export interface LockAcquiredEvent extends BaseEvent {
  type: 'lock:acquired';
  lockId: string;
  targetType: LockTargetType;
  targetId: string;
  lockedBy: {
    type: 'user' | 'agent';
    id: string;
    name: string;
  };
  expiresAt: string;
}

export interface LockReleasedEvent extends BaseEvent {
  type: 'lock:released';
  lockId: string;
  targetType: LockTargetType;
  targetId: string;
}

export interface LockExpiredEvent extends BaseEvent {
  type: 'lock:expired';
  lockId: string;
  targetType: LockTargetType;
  targetId: string;
}

export type LockEvent = LockAcquiredEvent | LockReleasedEvent | LockExpiredEvent;

// ============================================
// プレゼンスイベント
// ============================================

export interface UserJoinedEvent extends BaseEvent {
  type: 'presence:user_joined';
  channel: string;
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
}

export interface UserLeftEvent extends BaseEvent {
  type: 'presence:user_left';
  channel: string;
  userId: string;
}

export interface PresenceListEvent extends BaseEvent {
  type: 'presence:list';
  channel: string;
  users: Array<{
    id: string;
    name: string;
    avatarUrl: string | null;
  }>;
}

export type PresenceEvent = UserJoinedEvent | UserLeftEvent | PresenceListEvent;

// ============================================
// レビューイベント
// ============================================

export interface ReviewCommentAddedEvent extends BaseEvent {
  type: 'review:comment_added';
  comment: {
    id: string;
    targetType: string;
    targetId: string;
    targetField: string;
    targetItemId: string | null;
    content: string;
    status: ReviewStatus;
    author: {
      type: 'user' | 'agent';
      id: string;
      name: string;
    };
  };
}

export interface ReviewCommentResolvedEvent extends BaseEvent {
  type: 'review:comment_resolved';
  commentId: string;
  targetType: string;
  targetId: string;
}

export interface ReviewReplyAddedEvent extends BaseEvent {
  type: 'review:reply_added';
  commentId: string;
  reply: {
    id: string;
    content: string;
    author: {
      type: 'user' | 'agent';
      id: string;
      name: string;
    };
  };
}

export type ReviewEvent =
  | ReviewCommentAddedEvent
  | ReviewCommentResolvedEvent
  | ReviewReplyAddedEvent;

// ============================================
// テストスイート/ケースイベント
// ============================================

export interface TestSuiteUpdatedEvent extends BaseEvent {
  type: 'test_suite:updated';
  testSuiteId: string;
  projectId: string;
  changes: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
  updatedBy: {
    type: 'user' | 'agent';
    id: string;
    name: string;
  };
}

export interface TestCaseUpdatedEvent extends BaseEvent {
  type: 'test_case:updated';
  testCaseId: string;
  testSuiteId: string;
  projectId: string;
  changes: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
  updatedBy: {
    type: 'user' | 'agent';
    id: string;
    name: string;
  };
}

export type TestUpdateEvent = TestSuiteUpdatedEvent | TestCaseUpdatedEvent;

// ============================================
// エージェントセッションイベント
// ============================================

export interface AgentSessionStartedEvent extends BaseEvent {
  type: 'agent:session_started';
  sessionId: string;
  projectId: string;
  clientId: string;
  clientName: string | null;
}

export interface AgentSessionEndedEvent extends BaseEvent {
  type: 'agent:session_ended';
  sessionId: string;
  projectId: string;
  reason: 'ended' | 'timeout' | 'error';
}

export type AgentEvent = AgentSessionStartedEvent | AgentSessionEndedEvent;

// ============================================
// ダッシュボードイベント
// ============================================

export interface DashboardUpdatedEvent extends BaseEvent {
  type: 'dashboard:updated';
  projectId: string;
  trigger: 'execution' | 'test_suite' | 'test_case' | 'review';
  resourceId?: string;
}

export type DashboardEvent = DashboardUpdatedEvent;

// ============================================
// 通知イベント
// ============================================

export interface NotificationReceivedEvent extends BaseEvent {
  type: 'notification:received';
  notification: {
    id: string;
    type: string;  // NotificationType
    title: string;
    body: string;
    data: Record<string, unknown> | null;
    createdAt: string;
  };
}

export interface NotificationReadEvent extends BaseEvent {
  type: 'notification:read';
  notificationId: string;
}

export interface NotificationUnreadCountEvent extends BaseEvent {
  type: 'notification:unread_count';
  count: number;
}

export type NotificationEvent =
  | NotificationReceivedEvent
  | NotificationReadEvent
  | NotificationUnreadCountEvent;

// ============================================
// 統合型
// ============================================

export type ServerMessage =
  | AuthenticatedMessage
  | ErrorMessage
  | PongMessage
  | SubscribedMessage;

export type ServerEvent =
  | ExecutionEvent
  | LockEvent
  | PresenceEvent
  | ReviewEvent
  | TestUpdateEvent
  | AgentEvent
  | DashboardEvent
  | NotificationEvent;

export type WebSocketMessage = ClientMessage | ServerMessage | ServerEvent;

// ============================================
// チャンネルヘルパー
// ============================================

export const Channels = {
  project: (projectId: string) => `project:${projectId}`,
  testSuite: (testSuiteId: string) => `test_suite:${testSuiteId}`,
  testCase: (testCaseId: string) => `test_case:${testCaseId}`,
  execution: (executionId: string) => `execution:${executionId}`,
  user: (userId: string) => `user:${userId}`,
} as const;
