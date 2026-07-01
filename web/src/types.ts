// Tipos espelhando as respostas da API (schema.prisma é a fonte da verdade).

export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  githubRepoFullName: string | null;
  ownerId: string;
  _count?: { members: number; tasks: number };
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  githubIssueNumber: number | null;
  workspaceId: string;
  assigneeId: string | null;
  createdAt: string;
}
