// server.js

// .env 파일의 환경 변수를 로드합니다.
require('dotenv').config(); 

// 필요한 모듈을 가져옵니다.
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const path = require('path'); // 'path' 모듈 추가

// 환경 변수에서 OpenAI API 키를 가져와 클라이언트를 초기화합니다.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Express 앱을 생성합니다.
const app = express();
const port = process.env.PORT || 3001; // Vercel이 제공하는 포트를 사용하거나, 로컬에서는 3001번을 사용합니다.

// CORS와 JSON 파싱을 위한 미들웨어를 사용합니다.
app.use(cors());
app.use(express.json());

// '/api/chat' 경로로 POST 요청이 오면 처리할 비동기 로직입니다.
app.post('/api/chat', async (req, res) => {
  try {
    // 클라이언트에서 보낸 메시지와 시스템 프롬프트를 가져옵니다.
    const { messages, systemPrompt } = req.body;
    const userQuery = messages[messages.length - 1].content; // 사용자의 마지막 질문 추출
    console.log('Received User Query:', userQuery);

    // OpenAI API를 호출하여 채팅 응답을 생성합니다.
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // 또는 "gpt-4" 등 사용 가능한 모델
      messages: [
        { role: "system", content: systemPrompt }, // 클라이언트에서 생성된 전체 시스템 프롬프트
        ...messages                                // 사용자와 AI가 주고받은 전체 대화 내역
      ],
    });

    const aiResponse = completion.choices[0].message.content;
    res.json({ response: aiResponse });
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    res.status(500).json({ response: 'AI 모델을 호출하는 중 오류가 발생했습니다.' });
  }
});

// 지정된 포트에서 서버를 실행합니다.
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
