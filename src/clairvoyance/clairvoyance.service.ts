import { Injectable, Logger } from '@nestjs/common';

export interface CodeIntent {
  userId: string;
  githubLogin: string;
  branch: string;
  filePathHash: string; // Hash of the file being edited
  astNode: string; // The semantic node being edited (e.g., function name)
  timestamp: number;
}

@Injectable()
export class ClairvoyanceService {
  private readonly logger = new Logger(ClairvoyanceService.name);
  
  // In-memory store: workspaceId -> intent map (socketId -> CodeIntent)
  private workspaceIntents = new Map<string, Map<string, CodeIntent>>();

  addIntent(workspaceId: string, socketId: string, intent: CodeIntent) {
    if (!this.workspaceIntents.has(workspaceId)) {
      this.workspaceIntents.set(workspaceId, new Map());
    }
    const intents = this.workspaceIntents.get(workspaceId)!;
    intents.set(socketId, intent);
    this.logger.debug(`[${workspaceId}] Added intent for ${intent.githubLogin} at ${intent.astNode}`);
  }

  removeIntent(workspaceId: string, socketId: string) {
    const intents = this.workspaceIntents.get(workspaceId);
    if (intents) {
      intents.delete(socketId);
      if (intents.size === 0) {
        this.workspaceIntents.delete(workspaceId);
      }
    }
  }

  removeSocketGlobally(socketId: string) {
    for (const [workspaceId, intents] of this.workspaceIntents.entries()) {
      if (intents.has(socketId)) {
        this.removeIntent(workspaceId, socketId);
      }
    }
  }

  findConflicts(workspaceId: string, currentIntent: CodeIntent, currentSocketId: string): CodeIntent[] {
    const intents = this.workspaceIntents.get(workspaceId);
    if (!intents) return [];

    const conflicts: CodeIntent[] = [];
    for (const [socketId, intent] of intents.entries()) {
      // It's a conflict if someone else is on the same fileHash and astNode, but on a different branch or just different user
      if (socketId !== currentSocketId && 
          intent.filePathHash === currentIntent.filePathHash && 
          intent.astNode === currentIntent.astNode) {
        conflicts.push(intent);
      }
    }
    return conflicts;
  }
}
