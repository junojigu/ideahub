export interface Idea {
  id: string;
  date: string;
  title: string;
  content: string;
  tags: string[];
  sourceUrl?: string;
  importance: number; // 1 to 5
  views: number;
}

export interface TagStat {
  tag: string;
  count: number;
}

export interface GasConfig {
  gasUrl: string;
  spreadsheetId: string;
  autoSync: boolean;
}

export interface SyncStatus {
  connected: boolean;
  lastSyncedAt?: string;
  message?: string;
  isSyncing: boolean;
}

export interface GeminiAutoTagResponse {
  suggestedTitle?: string;
  suggestedTags: string[];
  summary?: string;
  keyTakeaway?: string;
}

export interface CreativeSynthesisResult {
  synthesisTitle: string;
  combinedIdeas: { id: string; title: string }[];
  conceptDescription: string;
  actionableNextSteps: string[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  referencedIdeaIds?: string[];
  timestamp: string;
}
