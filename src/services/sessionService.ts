import { Session, SessionState, Role } from "../types";

const sessions = new Map<string, Session>();

const SESSION_TIMEOUT_MS = 3 * 60 * 60 * 1000; // 3시간
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;     // 5분

export function getSession(userId: string): Session {
  const existing = sessions.get(userId);
  if (existing) return existing;

  const newSession: Session = {
    userId,
    state: "IDLE",
    messages: [],
    questionCount: 0,
    diaryOffered: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  sessions.set(userId, newSession);
  return newSession;
}

export function updateSession(userId: string, updates: Partial<Session>): Session {
  const session = getSession(userId);
  const updated = { ...session, ...updates, updatedAt: new Date() };
  sessions.set(userId, updated);
  return updated;
}

export function addMessage(userId: string, role: Role, content: string): Session {
  const session = getSession(userId);
  const updatedMessages = [...session.messages, { role, content }];
  return updateSession(userId, { messages: updatedMessages });
}

export function resetSession(userId: string): Session {
  const reset: Session = {
    userId,
    state: "IDLE",
    messages: [],
    questionCount: 0,
    diaryOffered: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  sessions.set(userId, reset);
  return reset;
}

// 5분마다 3시간 이상 미활동 세션 정리
setInterval(() => {
  const now = Date.now();
  for (const [userId, session] of sessions.entries()) {
    if (now - session.updatedAt.getTime() > SESSION_TIMEOUT_MS) {
      sessions.delete(userId);
    }
  }
}, CLEANUP_INTERVAL_MS);
