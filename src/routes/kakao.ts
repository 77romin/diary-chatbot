import { Router, Request, Response } from "express";
import { KakaoRequest, KakaoResponse } from "../types";
import { getSession, addMessage, updateSession, resetSession } from "../services/sessionService";
import { chat, generateDiary } from "../services/claudeService";

const router = Router();

const TIMEOUT_MS = 4000;

const EMOTION_WORDS = [
  "좋았", "힘들", "피곤", "행복", "슬펐", "화났", "설렜", "뿌듯",
  "외로", "무서", "지쳤", "즐거", "기뻤", "우울", "답답", "벅찼",
];

const DIARY_YES = ["네", "응", "좋아", "써줘", "일기 써줘"];
const DIARY_NO  = ["괜찮아요", "아니", "됐어"];

function makeKakaoResponse(text: string): KakaoResponse {
  return {
    version: "2.0",
    template: {
      outputs: [{ simpleText: { text } }],
    },
  };
}

function makeDiaryResponse(diary: string): KakaoResponse {
  return {
    version: "2.0",
    template: {
      outputs: [
        { simpleText: { text: diary } },
        { simpleText: { text: "이 일기를 읽고 지금 어떤 마음이 들어?" } },
      ],
    },
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), ms)
  );
  return Promise.race([promise, timeout]);
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

async function runGenerateDiary(userId: string): Promise<string> {
  const session = getSession(userId);
  const diary = await generateDiary(session, getToday());
  addMessage(userId, "assistant", diary);
  updateSession(userId, { state: "REFLECTING", diaryOffered: false });
  return diary;
}

router.post("/webhook", async (req: Request, res: Response) => {
  const body = req.body as KakaoRequest;
  const userId = body.userRequest?.user?.id;
  const utterance = body.userRequest?.utterance?.trim();

  if (!userId || !utterance) {
    res.json(makeKakaoResponse("요청 형식이 올바르지 않아요."));
    return;
  }

  console.log("웹훅 요청:", userId, utterance);

  try {
  const session = getSession(userId);

  // REFLECTING 상태 처리
  if (session.state === "REFLECTING") {
    addMessage(userId, "user", utterance);
    updateSession(userId, { state: "REVIEWING" });
    res.json(makeKakaoResponse("그 감정에 잠시만 집중해볼 수 있을까?"));
    return;
  }

  // REVIEWING 상태 처리
  if (session.state === "REVIEWING") {
    if (utterance === "저장") {
      resetSession(userId);
      res.json(makeKakaoResponse("일기가 저장됐어요! ✅"));
      return;
    }
    if (utterance === "다시 써줘" || utterance === "수정") {
      const result = await withTimeout(runGenerateDiary(userId), TIMEOUT_MS);
      res.json(makeDiaryResponse(result));
      return;
    }
  }

  // 사용자가 직접 "일기 써줘" 명령 (diaryOffered 상관없이)
  if (utterance === "일기 써줘") {
    addMessage(userId, "user", utterance);
    const result = await withTimeout(runGenerateDiary(userId), TIMEOUT_MS);
    res.json(makeDiaryResponse(result));
    return;
  }

  // diaryOffered = true 상태에서 YES/NO 처리
  if (session.diaryOffered) {
    if (DIARY_YES.some((w) => utterance === w || utterance.includes(w))) {
      addMessage(userId, "user", utterance);
      const result = await withTimeout(runGenerateDiary(userId), TIMEOUT_MS);
      res.json(makeDiaryResponse(result));
      return;
    }
    if (DIARY_NO.some((w) => utterance.includes(w))) {
      updateSession(userId, { diaryOffered: false });
      addMessage(userId, "user", utterance);
      const updated = getSession(userId);
      const task = chat(updated).then((reply) => {
        addMessage(userId, "assistant", reply);
        updateSession(userId, { state: "CHATTING", questionCount: updated.questionCount + 1 });
        return reply;
      });
      const result = await withTimeout(task, TIMEOUT_MS);
      res.json(makeKakaoResponse(result));
      return;
    }
    // YES/NO 아닌 입력이면 diaryOffered 초기화 후 일반 대화 진행
    updateSession(userId, { diaryOffered: false });
  }

  // 일반 대화
  addMessage(userId, "user", utterance);
  const updated = getSession(userId);

  const task = (async () => {
    const reply = await chat(updated);
    addMessage(userId, "assistant", reply);

    // questionCount >= 3 이고 감정어 포함 시 일기 제안 (diaryOffered 아직 안 한 경우)
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

  const result = await withTimeout(task, TIMEOUT_MS);
  res.json(makeKakaoResponse(result));
  } catch (error) {
    if (error instanceof Error && error.message === "timeout") {
      console.error("카카오 웹훅 타임아웃:", userId);
      res.json(makeKakaoResponse("잠시만요... 🤔 다시 한번 말씀해 주세요."));
    } else {
      console.error("카카오 웹훅 오류:", error);
      res.json(makeKakaoResponse("오류가 발생했어요. 다시 말씀해 주세요."));
    }
  }
});

export default router;
