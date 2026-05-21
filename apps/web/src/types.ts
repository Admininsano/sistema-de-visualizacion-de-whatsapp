export interface ParsedMessage {
  id: number;
  dateISO: string;
  dateLabel: string;
  timeLabel: string;
  sender: string | null;
  content: string;
  raw: string;
  kind: "message" | "system" | "media";
  isFromMe: boolean;
}

export interface ParsedChat {
  sourceName: string;
  participants: string[];
  messageCount: number;
  firstMessageAt: string | null;
  lastMessageAt: string | null;
  messages: ParsedMessage[];
}

export interface SearchMatch {
  messageId: number;
  index: number;
  length: number;
}