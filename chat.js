// .env 파일의 환경 변수를 로드합니다.
require('dotenv').config(); 
const OpenAI = require('openai');

// --- Start of Inlined Logic ---
// 데이터 파일을 빌드 시점에 포함시키기 위해 require를 사용합니다.
const rules = require('../data/procedure-rules.json');
const patchNotes = require('../data/patch-notes.json');

// Knowledge Base 데이터를 캐싱할 변수
let knowledgeBaseCache = null;

function getKnowledgeBase() {
    // 캐시된 데이터가 있으면 즉시 반환
    if (knowledgeBaseCache) {
        return knowledgeBaseCache;
    }

    try {
        // 파싱된 결과를 텍스트로 변환하여 캐시에 저장
        const rulesText = rules.map(item => {
            if (item.description) return `- ${item.name}: ${item.description}`;
            if (item.procedures) return `- ${item.name} (시술: ${item.procedures.join(', ')})의 추천 순서는 '${item.order}' 입니다. (이유: ${item.reason})`;
            return null; // 규칙에 맞지 않는 항목은 null로 처리
        }).filter(Boolean).join('\n'); // null 값을 걸러내고 문자열로 합칩니다.

        const patchNotesText = patchNotes.map(patch => {
            const notes = patch.notes.map(note => `  - ${note}`).join('\n');
            return `- 버전 ${patch.version} (${patch.date}):\n${notes}`;
        }).join('\n\n');

        // 두 정보를 결합하여 최종 Knowledge Base를 구성합니다.
        knowledgeBaseCache = `
# 시술 원칙 및 조합 예시
${rulesText}

# 최신 업데이트 내역 (패치노트)
${patchNotesText}
        `.trim();

        return knowledgeBaseCache;
    } catch (error) {
        console.error("Error processing knowledge base:", error);
        throw new Error('Failed to load or process the knowledge base file.');
    }
}

function createSystemPrompt(knowledgeBase) {
    return `
        당신은 '어레인지 클리닉'의 AI 전문가 '페필이'입니다. 당신의 역할은 사용자의 질문에 대해 아래 '참고 정보'를 바탕으로 친절하고 명확하게 답변하는 것입니다.

        # 당신의 핵심 임무:
        사용자의 질문 의도를 파악하여, '감염 방지', '시술 효율', '동선 최적화'라는 3가지 원칙에 입각해 최적의 시술 순서를 추천하고, 그 이유를 논리적으로 설명해야 합니다.

        # 답변 시 반드시 지켜야 할 규칙:
        1.  **전문가적이지만 쉬운 설명:** 당신은 전문가이지만, 고객을 대하듯 쉽고 친절한 말투를 사용하세요.
        2.  **정보 기반 답변:** 답변은 반드시 아래 제공된 '참고 정보'에 근거해야 합니다. 정보에 없는 내용은 답변하지 마세요.
        3.  **코드나 오류 메시지 절대 금지:** 당신은 코드를 실행하거나 프로그래밍을 하는 역할이 아닙니다. 따라서 자바스크립트 코드, 'rules is not defined'와 같은 기술 오류 메시지, 또는 기타 컴퓨터 용어를 절대로 사용해서는 안 됩니다. 오직 자연스러운 한국어 대화만을 생성해야 합니다.

        ---
        # 참고 정보
        ${knowledgeBase}
    `;
}
// --- End of Inlined Logic ---

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
    const knowledgeBase = getKnowledgeBase();

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
