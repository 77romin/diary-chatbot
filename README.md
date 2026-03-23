# 📖 AI 일기장 챗봇

> 카카오톡으로 나누는 하루 이야기, AI가 일기로 완성해드립니다.

---

## 프로젝트 소개

매일 저녁 카카오톡 채널에서 AI와 짧은 대화를 나누면,  
AI가 그날의 감정과 사건을 자연스럽게 끌어내고 일기를 대신 써주는 챗봇입니다.

소크라테스식 대화법을 기반으로, 사용자가 스스로 하루를 되돌아볼 수 있도록 유도합니다.

```
사용자: 오늘 너무 피곤한 하루였어
  봇: 어떤 일이 있었길래 피곤하셨나요?
사용자: 오전에 중요한 발표가 있었는데...
  봇: 발표를 앞두고 어떤 감정이 가장 크셨나요?
사용자: 긴장보다는 잘 해낼 수 있을까 두려웠어
  봇: 발표가 끝나고 나서는 어떠셨나요?
사용자: 생각보다 반응이 좋아서 안도했어
  봇: 오늘 하루를 일기로 남겨볼까요? (네 / 괜찮아요)
사용자: 네
  봇: 2026년 3월 22일
      오늘은 유독 긴 하루였다. 아침부터 중요한 발표가
      머릿속을 가득 채웠고, 잘 해낼 수 있을지 두려움이 앞섰다...
```

---

## 주요 기능

- **소크라테스식 대화**: 한 번에 질문 1개, 사실과 감정을 번갈아 탐색
- **AI 일기 제안**: 대화 3회 이상 + 감정어 감지 시 자연스럽게 일기 작성 제안
- **사용자 동의 후 작성**: AI가 먼저 일기를 쓰지 않고, 사용자가 원할 때만 작성
- **~다체 1인칭 일기**: 내가 직접 쓴 것 같은 자연스러운 일기체
- **일기 재생성**: 마음에 안 들면 "다시 써줘"로 재작성 요청 가능
- **다국어 자동 감지**: 한국어로 말하면 한국어로, 영어로 말하면 영어로 응답
- **웰컴 메시지**: 채널 입장 시 사용법 안내

---

## 기술 스택

| 영역 | 기술 | 선택 이유 |
|------|------|-----------|
| 런타임 | Node.js 20 | 비동기 처리에 적합, 생태계 풍부 |
| 웹 프레임워크 | Express.js | 경량, 카카오 웹훅 처리에 적합 |
| 언어 | TypeScript | 타입 안정성, 세션/상태 관리 명확화 |
| AI 모델 | Groq (qwen/qwen3-32b) | 무료 API, 한국어 품질 우수 |
| 챗봇 플랫폼 | 카카오 i 오픈빌더 | 국내 사용자 접근성 최고 |
| 배포 | Railway | GitHub 연동 자동 배포 |
| 컨테이너 | Docker | 환경 격리, 배포 일관성 |

---

## 프로젝트 구조

```
diary-chatbot/
├── src/
│   ├── index.ts                  # Express 서버 진입점
│   ├── routes/
│   │   └── kakao.ts              # 카카오 웹훅 엔드포인트
│   ├── services/
│   │   ├── claudeService.ts      # Groq API 호출 로직
│   │   └── sessionService.ts     # 대화 세션 관리 (in-memory)
│   ├── prompts/
│   │   ├── systemPrompt.ts       # 대화용 시스템 프롬프트
│   │   └── diaryPrompt.ts        # 일기 생성 전용 프롬프트
│   └── types/
│       └── index.ts              # 공통 타입 정의
├── Dockerfile
├── docker-compose.yml
├── railway.json
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 세션 상태 머신

```
IDLE → CHATTING → (일기 제안) → REVIEWING → IDLE
                ↘ (사용자 거절) → CHATTING 계속
```

| 상태 | 설명 |
|------|------|
| IDLE | 대화 시작 전 |
| CHATTING | 소크라테스 질문 진행 중 |
| REVIEWING | 일기 검토 (저장/수정 대기) |

세션은 마지막 메시지로부터 3시간 후 자동 만료됩니다.

---

## 환경 변수

```env
GROQ_API_KEY=gsk_...
KAKAO_BOT_SECRET=카카오_보안토큰
PORT=3000
```

---

## 로컬 실행

```bash
# 1. 저장소 클론
git clone https://github.com/bighead0831/diary-chatbot.git
cd diary-chatbot

# 2. 환경변수 설정
cp .env.example .env
# .env에 GROQ_API_KEY 입력

# 3. 실행 (Docker)
docker compose up --build

# 또는 직접 실행
npm install
npm run dev
```

---

## 개발 과정에서 겪은 난관들

### 1. Gemini API 무료 할당량 문제
처음에는 Google Gemini API를 무료로 사용하려 했으나, 발급한 키가 결제가 연결된 Cloud 프로젝트에 귀속되어 무료 할당량이 0으로 설정되어 있었습니다.

**해결**: Groq API로 전환 (완전 무료, 넉넉한 무료 한도)

---

### 2. 카카오 5초 타임아웃
카카오 오픈빌더는 스킬 서버가 5초 안에 응답하지 않으면 오류(1001)를 반환합니다. Groq API 응답이 가끔 5초를 초과했습니다.

**해결**: `Promise.race()`로 4초 타임아웃 처리. 초과 시 "잠시만요... 다시 한번 말씀해 주세요." 반환

```typescript
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('timeout')), 4000)
);
const response = await Promise.race([apiCall(), timeoutPromise]);
```

---

### 3. AI 언어 혼용 문제 (한자·베트남어 섞임)
llama 모델이 한국어 응답 중에 일본어(本当に), 베트남어(thật), 프랑스어(journée) 등을 섞어 쓰는 현상이 발생했습니다.

**해결 과정**:
- llama-3.3-70b → 언어 혼용 심함
- llama-3.1-8b-instant → 순수 한국어지만 문맥 이해 약함
- mixtral-8x7b → 폐기된 모델
- gemma2-9b → 폐기된 모델
- **qwen/qwen3-32b** → 한국어 품질 우수, 문맥 이해 양호 ✅

추가로 시스템 프롬프트에 "한자·일본어·베트남어 절대 사용 금지" 명시

---

### 4. Railway 배포 CRASH 문제
여러 원인이 겹쳐 배포가 계속 실패했습니다.

**원인들**:
1. `dist/index.js` 없음 → Dockerfile에 `RUN npm run build` 추가
2. 환경변수 미설정 → Railway Variables 탭에서 `GROQ_API_KEY` 등록
3. Trial 플랜 메모리 제한(0.5GB) → SIGTERM 발생

**해결**: 환경변수 정상 등록 + 서비스 레벨에서 Variables 설정 (배포 단위가 아닌 서비스 단위)

---

### 5. AI가 일기를 먼저 써버리는 문제
시스템 프롬프트 설정에도 불구하고 AI가 대화 중간에 일기를 미리 작성해버리는 문제가 있었습니다.

**해결**:
- Session에 `diaryOffered: boolean` 상태 추가
- 라우터에서 `diaryOffered === true` 일 때만 사용자 동의 체크
- 시스템 프롬프트에 "사용자 동의 전 일기 작성 절대 금지" 명시

---

### 6. 카카오톡 실제 채팅 연동 문제
봇테스트에서는 잘 작동했지만 실제 카카오톡에서는 응답이 없었습니다.

**원인**: cloudflared 임시 URL 사용 중 URL 만료, 카카오 채널 1:1 채팅 비활성화, 배포 미완료 등 복합적 원인

**해결**: Railway 고정 URL 사용 + 카카오 채널 1:1 채팅 활성화 + 스킬 URL 업데이트 후 재배포

---

## 카카오 오픈빌더 설정

1. [카카오 i 오픈빌더](https://i.kakao.com) 접속 → 봇 생성
2. 스킬 등록: URL = `https://your-server.com/kakao/webhook`
3. 폴백 블록 → 스킬데이터 연결
4. 웰컴 블록 → 사용법 안내 텍스트 추가
5. 배포

---

## 향후 개선 사항

- [ ] 카카오 비즈니스 채널 심사 후 22시 저녁 알림 기능
- [ ] 감정 태그 자동 분류 (😊😔😤)
- [ ] 세션 DB 저장 (서버 재시작 시 대화 기록 유지)
- [ ] 일기 목록 조회 기능
- [ ] 맥북 로컬 서버 + Let's Encrypt SSL 적용

---

## 개발 환경

- macOS (Apple Silicon)
- Node.js v25.8.1
- Docker 29.2.1
- VS Code

---

*개발 초보자가 Claude Code와 함께 바이브코딩으로 만든 첫 번째 챗봇 프로젝트입니다.*
