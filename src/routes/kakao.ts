import { Router, Request, Response } from "express";
import { KakaoRequest, KakaoResponse } from "../types";
import { getSession, addMessage, updateSession, resetSession } from "../services/sessionService";
import { chat, generateDiary } from "../services/claudeService";

const router = Router();

const TIMEOUT_MS = 4500;
const TIMEOUT_MESSAGE = "잠시 서버가 바빠요. 다시 말씀해 주세요 🙏";

const EMOTION_WORDS = [
  "좋았", "힘들", "피곤", "행복", "슬펐", "화났", "설렜", "뿌듯",
  "외로", "무서", "지쳤", "즐거", "기뻤", "우울", "답답", "벅찼",
];

const DIARY_YES = ["네", "응", "좋아"];
const DIARY_NO  = ["괜찮아요", "아니"];

function makeKakaoResponse(text: string): KakaoResponse {
  return {
    version: "2.0",
    template: {
      outputs: [{ simpleText: { text } }],
    },
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  const timeout = new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), ms)
  );
  return Promise.race([promise, timeout]).catch(() => fallback);
}

function hasEmotionWord(text: string): boolean {
  return EMOTION_WORDS.some((word) => text.includes(word));
}

function getToday(): string {
  return new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

router.post("/webhook", async (req: Request, res: Response) => {
  const body = req.body as KakaoRequest;
  const userId = body.userRequest?.user?.id;
  const utterance = body.userRequest?.utterance?.trim();

  if (!userId || !utterance) {
    res.json(makeKakaoResponse("요청 형식이 올바르지 않아요."));
    return;
  }

  const session = getSession(userId);

  // REVIEWING 상태 처리
  if (session.state === "REVIEWING") {
    if (utterance === "저장") {
      resetSession(userId);
      res.json(makeKakaoResponse("일기가 저장됐어요! ✅"));
      return;
    }
    if (utterance === "다시 써줘" || utterance === "수정") {
      const task = (async () => {
        const diary = await generateDiary(session, getToday());
        addMessage(userId, "assistant", diary);
        updateSession(userId, { state: "REVIEWING" });
        return diary;
      })();
      const result = await withTimeout(task, TIMEOUT_MS, TIMEOUT_MESSAGE);
      res.json(makeKakaoResponse(result));
      return;
    }
  }

  // 일기 제안에 대한 답변 처리 (diaryOffered = true 상태)
  if (session.diaryOffered) {
    if (DIARY_YES.includes(utterance)) {
      const task = (async () => {
        const diary = await generateDiary(session, getToday());
        addMessage(userId, "assistant", diary);
        updateSession(userId, { state: "REVIEWING", diaryOffered: false });
        return diary;
      })();
      const result = await withTimeout(task, TIMEOUT_MS, TIMEOUT_MESSAGE);
      res.json(makeKakaoResponse(result));
      return;
    }
    if (DIARY_NO.some((w) => utterance.includes(w))) {
      updateSession(userId, { diaryOffered: false });
      addMessage(userId, "user", utterance);
      const updated = getSession(userId);
      const task = chat(updated).then((reply) => {
        addMessage(userId, "assistant", reply);
        updateSession(userId, { questionCount: updated.questionCount + 1 });
        return reply;
      });
      const result = await withTimeout(task, TIMEOUT_MS, TIMEOUT_MESSAGE);
      res.json(makeKakaoResponse(result));
      return;
    }
  }

  // 사용자 메시지 추가
  addMessage(userId, "user", utterance);
  const updated = getSession(userId);

  // 일기 직접 요청 또는 questionCount >= 5
  const isDiaryTrigger = utterance === "일기 써줘" || updated.questionCount >= 5;

  if (isDiaryTrigger) {
    const task = (async () => {
      const diary = await generateDiary(updated, getToday());
      addMessage(userId, "assistant", diary);
      updateSession(userId, { state: "REVIEWING" });
      return diary;
    })();
    const result = await withTimeout(task, TIMEOUT_MS, TIMEOUT_MESSAGE);
    res.json(makeKakaoResponse(result));
    return;
  }

  // 일반 대화
  const task = (async () => {
    const reply = await chat(updated);
    addMessage(userId, "assistant", reply);

    // questionCount >= 3 이고 감정어 포함 시 일기 제안
    const shouldOffer =
      updated.questionCount >= 3 &&
      hasEmotionWord(utterance) &&
      !updated.diaryOffered;

    if (shouldOffer) {
      updateSession(userId, {
        state: "CHATTING",
        questionCount: updated.questionCount + 1,
        diaryOffered: true,
      });
      return reply + "\n\n오늘 하루를 일기로 남겨볼까요? (네 / 괜찮아요)";
    }

    updateSession(userId, {
      state: "CHATTING",
      questionCount: updated.questionCount + 1,
    });
    return reply;
  })();

  const result = await withTimeout(task, TIMEOUT_MS, TIMEOUT_MESSAGE);
  res.json(makeKakaoResponse(result));
});

export default router;
