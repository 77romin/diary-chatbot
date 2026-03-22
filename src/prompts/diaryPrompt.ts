import { Message } from "../types";

export function buildDiaryPrompt(messages: Message[], date: string): string {
  const conversation = messages
    .map((m) => `${m.role === "user" ? "사용자" : "도우미"}: ${m.content}`)
    .join("\n");

  return `아래는 오늘 하루에 대한 대화 내용입니다.

--- 대화 내용 ---
${conversation}
-----------------

위 대화를 바탕으로 오늘의 일기를 작성해주세요.

조건:
- 첫 줄에 날짜를 적어주세요: ${date}
- 1인칭 시점으로 작성합니다.
- 150~250자 분량으로 작성합니다.
- 오늘 있었던 사실과 느낀 감정을 솔직하게 담아주세요.
- 과장 없이 담담하고 진솔하게 씁니다.
- 일기 외의 설명이나 코멘트는 적지 않습니다.`;
}
