import "dotenv/config";
import express from "express";
import kakaoRouter from "./routes/kakao";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "AI 일기장 챗봇 서버" });
});

app.use("/kakao", kakaoRouter);

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
