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
    return `${date}\n\n${stripThinkTags(content)}`;
  } catch (e) {
    console.error("[generateDiary error]", e);
    return ERROR_MESSAGE;
  }
}
