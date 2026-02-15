// server.js

// .env 파일의 환경 변수를 로드합니다.
require('dotenv').config(); 

// 필요한 모듈을 가져옵니다.
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const { getKnowledgeBase, createSystemPrompt } = require('./shared-logic');

// 환경 변수에서 OpenAI API 키를 가져와 클라이언트를 초기화합니다.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Express 앱을 생성합니다.
const app = express();
const port = process.env.PORT || 3001;

// CORS와 JSON 파싱을 위한 미들웨어를 사용합니다.
app.use(cors());
app.use(express.json());

// '/api/chat' 경로로 POST 요청이 오면 처리할 비동기 로직입니다.
app.post('/api/chat', async (req, res) => {
  try {
    // 클라이언트에서 보낸 메시지만 가져옵니다. 시스템 프롬프트는 서버에서 관리합니다.
    const { messages } = req.body;
    const userQuery = messages && messages.length > 0 ? messages[messages.length - 1].content : 'No query found';
    console.log('Received User Query:', userQuery);

    // 서버에서 직접 내부 정보를 로드합니다.
    const knowledgeBase = await getKnowledgeBase();

    // 서버에서 직접 시스템 프롬프트를 최종적으로 구성합니다. (chat.js와 동일)
    const systemPrompt = createSystemPrompt(knowledgeBase);

    // OpenAI API를 호출하여 채팅 응답을 생성합니다.
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt }, // 서버에서 생성된 시스템 프롬프트 사용
        ...messages
      ],
    });

    const aiResponse = completion.choices[0].message.content;
    res.json({ response: aiResponse });
  } catch (error) {
    console.error('Error in API function:', error);
    const errorMessage = error.response && error.response.data ? JSON.stringify(error.response.data) : error.message;
    res.status(500).json({ response: `AI 모델 호출 중 서버 오류 발생: ${errorMessage}` });
  }
});

// 지정된 포트에서 서버를 실행합니다.
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
