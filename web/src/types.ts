// Tipos espelhando as respostas da API (schema.prisma é a fonte da verdade).

export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface PublicUser {
  id: string;
  name: string | null;
  githubLogin: string | null; // null para contas criadas por e-mail/senha
  avatarUrl: string | null;
}

/** Nome exibível de qualquer usuário, com ou sem GitHub. */
export function displayName(user: PublicUser | null | undefined): string {
  return user?.name ?? user?.githubLogin ?? 'membro';
}

export interface Member {
  id: string;
  role: MemberRole;
  user: PublicUser;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  githubRepoFullName: string | null;
  ownerId: string;
  members?: Member[];
  _count?: { members: number; tasks: number };
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  githubIssueNumber: number | null;
  githubPrNumber: number | null;
  workspaceId: string;
  assigneeId: string | null;
  assignee?: PublicUser | null;
  createdAt: string;
}

export interface Comment {
  id: string;
  body: string;
  taskId: string;
  author: PublicUser;
  createdAt: string;
}

export type ActivityType =
  | 'TASK_CREATED'
  | 'TASK_MOVED'
  | 'TASK_ASSIGNED'
  | 'TASK_DELETED'
  | 'COMMENT_ADDED'
  | 'MEMBER_JOINED'
  | 'PR_LINKED';

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  summary: string;
  actor: PublicUser | null; // null = evento de sistema (ex.: webhook)
  taskId: string | null;
  createdAt: string;
}

export type NotificationType = 'MENTION' | 'ASSIGNED' | 'COMMENT';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  read: boolean;
  workspaceId: string;
  taskId: string | null;
  actor: PublicUser | null;
  createdAt: string;
}
