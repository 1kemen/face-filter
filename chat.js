// .env 파일의 환경 변수를 로드합니다.
require('dotenv').config(); 
const OpenAI = require('openai');
const { getKnowledgeBase, createSystemPrompt } = require('./lib/shared-logic');

// 환경 변수에서 OpenAI API 키를 가져와 클라이언트를 초기화합니다.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// AI가 참고할 내부 정보 파일을 읽고, 자연어 텍스트로 변환하는 함수
// 이 함수가 Vercel에 의해 API 요청 시 실행됩니다.
module.exports = async (req, res) => {
  // CORS 헤더 설정 (외부 도메인에서의 요청 허용)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 브라우저가 보내는 사전 요청(pre-flight) 처리
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POST 요청만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 클라이언트에서는 이제 대화 기록만 받습니다.
    const { messages } = req.body;
    const userQuery = messages && messages.length > 0 ? messages[messages.length - 1].content : 'No query found';
    console.log('Received User Query:', userQuery);

    // 서버에서 직접 내부 정보를 로드합니다.
    const knowledgeBase = await getKnowledgeBase();

    // 서버에서 직접 시스템 프롬프트를 최종적으로 구성합니다.
    const systemPrompt = createSystemPrompt(knowledgeBase);

    // OpenAI API를 호출하여 채팅 응답을 생성합니다.
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages
      ],
    });

    const aiResponse = completion.choices[0].message.content;
    return res.status(200).json({ response: aiResponse });
  } catch (error) {
    // 서버 로그에 더 상세한 에러를 기록합니다.
    console.error('Error in API function:', error);

    // 클라이언트에게 더 유용한 에러 메시지를 전달합니다.
    const errorMessage = error.response && error.response.data ? JSON.stringify(error.response.data) : error.message;
    return res.status(500).json({ response: `AI 모델 호출 중 서버 오류 발생: ${errorMessage}` });
  }
};
