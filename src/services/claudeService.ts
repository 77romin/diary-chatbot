import Groq from "groq-sdk";
import { Session } from "../types";
import systemPrompt from "../prompts/systemPrompt";
import { buildDiaryPrompt } from "../prompts/diaryPrompt";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = "qwen/qwen3-32b";
const ERROR_MESSAGE = "잠시 문제가 생겼어요. 다시 말씀해 주세요.";

function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

function stripLeadingDate(text: string): string {
  // AI가 쓴 날짜 패턴 제거 (예: **2023. 11. 7**, 2023년 11월 7일 등)
  return text.replace(/^[\*\s]*\d{4}[년.\s]+\d{1,2}[월.\s]+\d{1,2}[일.]?[\*\s]*\n*/i, "").trim();
}

export async function chat(session: Session): Promise<string> {
  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...session.messages,
      ],
    });

    const content = response.choices[0].message.content ?? ERROR_MESSAGE;
    return stripThinkTags(content);
  } catch (e) {
    console.error("[chat error]", e);
    return ERROR_MESSAGE;
  }
}

export async function generateDiary(session: Session, date: string): Promise<string> {
  try {
    const prompt = buildDiaryPrompt(session.messages, date);

    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.choices[0].message.content ?? ERROR_MESSAGE;
    const cleaned = stripLeadingDate(stripThinkTags(content));
    return `${date}\n\n${cleaned}`;
  } catch (e) {
    console.error("[generateDiary error]", e);
    return ERROR_MESSAGE;
  }
}
