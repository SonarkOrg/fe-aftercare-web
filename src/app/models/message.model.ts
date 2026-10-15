export type MessageSender = 'PATIENT' | 'STAFF';

export interface MessageSendRequest { body: string }
export interface MarkReadRequest { upToId: number }

export interface Message {
  id: number; patientId: number; sender: MessageSender; senderName: string | null; body: string;
  sentAt: string; readByStaffAt: string | null; readByPatientAt: string | null;
}

export interface Thread {
  patientId: number; messagingOpen: boolean; messagingOpenUntil: string | null;
  items: Message[]; hasMore: boolean;
}

export interface Conversation {
  patientId: number; patientFirstName: string; patientLastName: string;
  lastMessageAt: string; lastMessagePreview: string; lastSender: MessageSender;
  unreadCount: number; messagingOpen: boolean;
}

export interface UnreadCount { unreadMessages: number; conversations: number }

export interface PublicMessage {
  id: number; sender: MessageSender; senderName: string | null; body: string; sentAt: string; seen: boolean;
}

export interface PublicThread {
  clinicName: string; clinicPhone: string | null; items: PublicMessage[]; hasMore: boolean; unreadCount: number;
}
