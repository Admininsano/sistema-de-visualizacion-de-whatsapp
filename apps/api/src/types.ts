export type ChatKind = "message" | "system" | "media";

export interface ParsedMessage {
  id: number;
  dateISO: string;
  dateLabel: string;
  timeLabel: string;
  sender: string | null;
  content: string;
  raw: string;
  kind: ChatKind;
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