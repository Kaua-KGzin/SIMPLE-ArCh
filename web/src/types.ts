// Tipos espelhando as respostas da API (schema.prisma é a fonte da verdade).

export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface PublicUser {
  id: string;
  name: string | null;
  githubLogin: string;
  avatarUrl: string | null;
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
