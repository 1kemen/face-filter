// .env 파일의 환경 변수를 로드합니다.
require('dotenv').config(); 
const OpenAI = require('openai');

// --- Start of Inlined Logic ---
// 데이터 파일을 빌드 시점에 포함시키기 위해 require를 사용합니다.
const rules = require('../data/procedure-rules.json');
const patchNotes = require('../data/patch-notes.json');
const genmac = require('../data/genmac.json');
const otherProcedures = require('../data/other-procedures.json');

// Knowledge Base 데이터를 캐싱할 변수
let knowledgeBaseCache = null;

function formatSec(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return `${s}초`;
    return s === 0 ? `${m}분` : `${m}분 ${s}초`;
}

function getKnowledgeBase() {
    if (knowledgeBaseCache) return knowledgeBaseCache;

    try {
        // 1. 시술 순서 규칙
        const rulesText = rules.map(item => {
            if (item.description) return `- ${item.name}: ${item.description}`;
            if (item.procedures) return `- ${item.name} (시술: ${item.procedures.join(', ')})의 추천 순서는 '${item.order}' 입니다. (이유: ${item.reason})`;
            return null;
        }).filter(Boolean).join('\n');

        // 2. 의료진 프로필
        const doctorText = genmac.doctorProfiles.map(d =>
            `- ${d.name}: 얼굴제모 계수 ${d.face}, 바디제모 계수 ${d.body}, 주사시술 계수 ${d.injection}`
        ).join('\n');

        // 3. 젠틀맥스 프로(젠맥) 얼굴 제모 소요시간 (의료진별)
        const faceLaserText = genmac.faceLaserData.map(item => {
            const times = genmac.doctorProfiles.map(doc => {
                let t;
                if (doc.id === 'A_peak' && item.name === '얼굴전체') t = 80;
                else t = Math.round(item.time * doc.face / 10) * 10;
                return `${doc.name}: ${formatSec(t)}`;
            }).join(', ');
            return `  · ${item.name} (기준 ${formatSec(item.time)}) → ${times}`;
        }).join('\n');

        // 4. 젠맥 바디 제모 소요시간 (의료진별)
        const bodyLaserText = genmac.bodyLaserData.map(item => {
            const times = genmac.doctorProfiles.map(doc => {
                const t = Math.round(item.time * doc.body / 10) * 10;
                return `${doc.name}: ${formatSec(t)}`;
            }).join(', ');
            return `  · ${item.name} (기준 ${formatSec(item.time)}) → ${times}`;
        }).join('\n');

        // 5. 주사시술 소요시간 (의료진별)
        const injectionText = genmac.injectionData.map(item => {
            const times = genmac.doctorProfiles.map(doc => {
                const t = Math.round(item.baseTimeSec * doc.injection / 10) * 10;
                return `${doc.name}: ${formatSec(t)}`;
            }).join(', ');
            return `  · ${item.name} (기준 ${formatSec(item.baseTimeSec)}) → ${times}`;
        }).join('\n');

        // 6. 간호팀/피부팀 시술 시간
        const nurseText = otherProcedures.filter(p => p.team === '간호팀').map(p =>
            `  · ${p.name}: 시술 ${p.procedure}분${p.anesthesia > 0 ? `, 마취 ${p.anesthesia}분` : ''}`
        ).join('\n');

        const skinCategories = ['리프팅', '레이저', '필'];
        const skinText = skinCategories.map(cat => {
            const items = otherProcedures.filter(p => p.team === '피부팀' && p.category === cat);
            const lines = items.map(p =>
                `  · ${p.name}: 시술 ${p.procedure}분${p.anesthesia > 0 ? `, 마취 ${p.anesthesia}분` : ''}`
            ).join('\n');
            return `[${cat}]\n${lines}`;
        }).join('\n');

        // 7. 패치노트
        const patchNotesText = patchNotes.map(patch => {
            const notes = patch.notes.map(note => `  - ${note}`).join('\n');
            return `- 버전 ${patch.version} (${patch.date}):\n${notes}`;
        }).join('\n\n');

        knowledgeBaseCache = `
# 시술 원칙 및 조합 예시
${rulesText}

# 의료진 프로필 및 속도 계수
${doctorText}

# 젠틀맥스 프로(젠맥) 얼굴 제모 - 의료진별 소요시간
${faceLaserText}

# 젠틀맥스 프로(젠맥) 바디 제모 - 의료진별 소요시간
${bodyLaserText}

# 주사 시술 - 의료진별 소요시간
${injectionText}

# 간호팀 시술 소요시간
${nurseText}

# 피부팀 시술 소요시간
${skinText}

# 바디 시술 신장 보정 규칙
- 바디 레이저(젠맥 바디 제모) 시술 시간은 환자의 신장에 따라 보정됩니다.
- 남성 기준 신장: 174cm, 여성 기준 신장: 163cm
- 기준 신장 대비 ±5cm마다 ±30초가 추가/감소됩니다.
- 예: 남성 179cm → +30초, 남성 184cm → +1분, 여성 158cm → -30초
- 보정 제외 항목: 겨드랑이, 브라질리언 (신장과 무관한 부위이므로 보정하지 않음)
- 적용 항목: 팔하완, 종아리무릎포함, 여자 팔/다리 전체, 남자 팔/다리 전체

# 최신 업데이트 내역
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

// 환경 변수에서 OpenAI API 키와 모델을 가져와 클라이언트를 초기화합니다.
// OPENAI_MODEL: 파인튜닝 완료 후 ft:gpt-4o-mini-xxxx 값으로 교체하면 파인튜닝 모델 사용.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

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
      model: MODEL,
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
