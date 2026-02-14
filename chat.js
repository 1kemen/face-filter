// .env 파일의 환경 변수를 로드합니다.
require('dotenv').config(); 
const OpenAI = require('openai');

// 환경 변수에서 OpenAI API 키를 가져와 클라이언트를 초기화합니다.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    // Vercel은 자동으로 body를 파싱해줍니다.
    const { messages, systemPrompt } = req.body; 
    const userQuery = messages[messages.length - 1]?.content || 'No query found';
    console.log('Received User Query:', userQuery);

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
    console.error('Error calling OpenAI API:', error);
    return res.status(500).json({ response: 'AI 모델을 호출하는 중 오류가 발생했습니다.' });
  }
};
