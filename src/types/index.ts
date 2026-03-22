export interface KakaoRequest {
  userRequest: {
    user: {
      id: string;
    };
    utterance: string;
  };
}

export interface SimpleText {
  simpleText: {
    text: string;
  };
}

export interface KakaoResponse {
  version: "2.0";
  template: {
    outputs: SimpleText[];
  };
}

export type Role = "user" | "assistant";

export interface Message {
  role: Role;
  content: string;
}

export type SessionState = "IDLE" | "CHATTING" | "WRITING" | "REVIEWING";

export interface Session {
  userId: string;
  state: SessionState;
  messages: Message[];
  questionCount: number;
  diaryOffered: boolean;
  createdAt: Date;
  updatedAt: Date;
}
