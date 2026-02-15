// .env 파일의 환경 변수를 로드합니다.
require('dotenv').config(); 
const OpenAI = require('openai');
<<<<<<< HEAD
const { getKnowledgeBase, createSystemPrompt } = require('./lib/shared-logic');
=======
const path = require('path');
const fs = require('fs').promises;
>>>>>>> 73edd3ea79668320bb864cd30fdda114fa9881f7

// 환경 변수에서 OpenAI API 키를 가져와 클라이언트를 초기화합니다.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// AI가 참고할 내부 정보 파일을 읽고, 자연어 텍스트로 변환하는 함수
async function getKnowledgeBase() {
    try {
        // Vercel 서버리스 환경에서 파일을 읽기 위해 절대 경로를 사용합니다.
        const rulesPath = path.join(process.cwd(), 'public', 'data', 'procedure-rules.json');
        const rulesData = await fs.readFile(rulesPath, 'utf8');
        const rules = JSON.parse(rulesData);

        // AI가 코드로 오해하지 않도록, JSON 데이터를 순수한 텍스트로 변환합니다.
        return rules.map(item => {
            if (item.description) return `- ${item.name}: ${item.description}`;
            return `- ${item.name} (시술: ${item.procedures.join(', ')})의 추천 순서는 '${item.order}' 입니다. (이유: ${item.reason})`;
        }).join('\n');
    } catch (error) {
        console.error("Error reading knowledge base:", error);
        return "내부 정보 파일을 읽는 데 실패했습니다.";
    }
}

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
<<<<<<< HEAD
    const systemPrompt = createSystemPrompt(knowledgeBase);
=======
    const systemPrompt = `
        당신은 '어레인지 클리닉'의 최고 전문가 '페필이'입니다. 당신의 임무는 사용자의 질문을 이해하고, 아래 제공된 '내부 참고 정보'를 바탕으로 최적의 시술 순서를 제안하는 것입니다.

        # 답변 생성 가이드라인
        - **핵심 원칙 준수:** 항상 '감염 방지', '시술 효율', '동선 최적화' 원칙을 최우선으로 고려하여 답변하세요.
        - **근거 제시:** 왜 그런 순서가 최적인지, 어떤 원칙이 적용되었는지 근거를 명확히 설명해야 합니다.
        - **가장 중요한 규칙:** 당신은 코드 실행기가 아닙니다. 'rules is not defined'와 같은 기술적인 오류 메시지를 절대로 생성해서는 안 됩니다. 제공된 텍스트 정보만을 참고하여 자연스러운 한국어 답변을 생성하세요.

        ---
        # 내부 참고 정보 (Knowledge Base)
        ${knowledgeBase}
    `;
>>>>>>> 73edd3ea79668320bb864cd30fdda114fa9881f7

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
