// .env 파일의 환경 변수를 로드합니다.
require('dotenv').config();
const OpenAI = require('openai');
const https = require('https');

// --- Start of Inlined Logic ---
// 데이터 파일을 빌드 시점에 포함시키기 위해 require를 사용합니다.
const rules = require('../data/procedure-rules.json');
const patchNotes = require('../data/patch-notes.json');
const genmac = require('../data/genmac.json');
const otherProcedures = require('../data/other-procedures.json');
const corrections = require('../data/corrections.json');

// Knowledge Base 및 시스템 프롬프트 캐싱 변수
let knowledgeBaseCache = null;
let systemPromptCache = null;

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

        // 8. 정정 메모
        const correctionsText = corrections.length > 0
            ? corrections.map(c => `- [${c.date}] ${c.topic}: ${c.correction}`).join('\n')
            : '(등록된 정정 메모 없음)';

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

# 운영 중 확인된 정정 메모 (최우선 적용)
아래 내용은 실제 운영 중 발견된 오류를 수정한 것입니다. 위 참고 정보와 충돌할 경우 반드시 이 정정 메모를 우선시하세요.
${correctionsText}
        `.trim();

        return knowledgeBaseCache;
    } catch (error) {
        console.error("Error processing knowledge base:", error);
        throw new Error('Failed to load or process the knowledge base file.');
    }
}

function getSystemPrompt() {
    if (systemPromptCache) return systemPromptCache;
    systemPromptCache = createSystemPrompt(getKnowledgeBase());
    return systemPromptCache;
}

function createSystemPrompt(knowledgeBase) {
    return `
        당신은 '어레인지 클리닉'의 AI 전문가 '페필이'입니다. 당신의 역할은 사용자의 질문에 대해 아래 '참고 정보'를 바탕으로 친절하고 명확하게 답변하는 것입니다.

        # 당신의 핵심 임무:
        사용자의 질문 의도를 파악하여, '감염 방지', '시술 효율', '동선 최적화'라는 3가지 원칙에 입각해 최적의 시술 순서를 추천하고, 그 이유를 논리적으로 설명해야 합니다.

        # 답변 시 반드시 지켜야 할 규칙:
        1.  **전문가적이지만 쉬운 설명:** 당신은 전문가이지만, 고객을 대하듯 쉽고 친절한 말투를 사용하세요.
        2.  **정보 기반 답변 (우선순위):** 시술 소요시간, 의료진 배정, 시술 순서 등 클리닉 운영에 관한 질문은 반드시 아래 '참고 정보'에 근거하여 답변하세요. 단, 참고 정보에 없는 시술의 일반적인 특성·원리·효과에 대한 질문(예: 인모드, 울쎄라 등 기기 설명)은 당신의 일반 의학·미용 지식으로 자유롭게 답변하세요.
        3.  **코드나 오류 메시지 절대 금지:** 당신은 코드를 실행하거나 프로그래밍을 하는 역할이 아닙니다. 따라서 자바스크립트 코드, 'rules is not defined'와 같은 기술 오류 메시지, 또는 기타 컴퓨터 용어를 절대로 사용해서는 안 됩니다. 오직 자연스러운 한국어 대화만을 생성해야 합니다.
        7.  **웹 검색 활용:** 내부 참고 정보에 없는 시술·의약품·의학 정보가 필요할 때는 web_search 도구를 호출하여 최신 정보를 검색한 후 답변하세요. 단, 클리닉 운영(소요시간·의료진 배정 등)에 관한 질문은 반드시 내부 데이터를 우선 사용하세요.
        4.  **시술 연계 순서 질문:** 시술 연계 순서만 물어볼 경우(이유·설명 요청 없음), 번호 리스트로 순서만 간결하게 답변하세요. 이유·원칙·배경 설명은 사용자가 '왜', '이유', '설명해줘' 등을 직접 요청할 때만 추가하세요.
        5.  **데이터 없는 부위 추정 답변:** 젠맥 바디 제모 시 데이터에 없는 부위가 나와도 "데이터가 없어 안내 어렵습니다" 같은 단정적 거부 표현을 사용하지 마세요. 대신 부위의 ①면적 크기, ②곡면·요철 복잡도, ③시술 리스크를 종합적으로 판단하여 인접 유사 부위와 비교한 대략적 추정 시간을 "(추정)" 표시와 함께 제시하세요. 추정값은 너무 보수적으로 잡지 말고 실제 제모 맥락에서 합리적인 수준으로 산정하세요.
        6.  **부위명 동의어·별칭 매핑:** '올브항', '올브라질리언'은 반드시 브라질리언으로 인식하여 브라질리언 소요시간을 적용하세요. 데이터 없음으로 처리하는 것은 절대 금지입니다.

        ---
        # 참고 정보
        ${knowledgeBase}
    `;
}
// OpenAI Responses API(web_search_preview)를 이용한 웹 검색
function executeWebSearch(query) {
    return new Promise((resolve) => {
        const postData = JSON.stringify({
            model: 'gpt-4o-mini-search-preview',
            input: query,
            tools: [{ type: 'web_search_preview' }]
        });
        const options = {
            hostname: 'api.openai.com',
            path: '/v1/responses',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        let data = '';
        const req = https.request(options, (res) => {
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const msgItem = json.output && json.output.find(o => o.type === 'message');
                    const textItem = msgItem && msgItem.content && msgItem.content.find(c => c.type === 'output_text');
                    resolve(textItem ? textItem.text : null);
                } catch (e) {
                    console.error('Web search parse error:', e.message);
                    resolve(null);
                }
            });
        });
        req.on('error', (e) => { console.error('Web search request error:', e.message); resolve(null); });
        req.setTimeout(12000, () => { req.destroy(); resolve(null); });
        req.write(postData);
        req.end();
    });
}

const webSearchTool = {
    type: 'function',
    function: {
        name: 'web_search',
        description: '클리닉 내부 지식베이스에 없는 시술·의학·미용 정보(시술 원리, 효과, 부작용, 의약품 정보 등)를 웹에서 검색합니다. 내부 데이터로 답변할 수 없을 때만 사용하세요.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: '검색어 (한국어, 구체적으로)' }
            },
            required: ['query']
        }
    }
};

function logToSheets(webhookUrl, question, answer) {
    return new Promise((resolve) => {
        const postData = JSON.stringify({ question, answer });
        const parsedUrl = new URL(webhookUrl);
        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        const req = https.request(options, (res) => {
            console.log('Sheets response status:', res.statusCode);
            res.resume();
            resolve(res.statusCode);
        });
        req.on('error', (err) => {
            console.error('Sheets error:', err.message);
            resolve(null);
        });
        req.setTimeout(8000, () => {
            console.error('Sheets timeout');
            req.destroy();
            resolve(null);
        });
        req.write(postData);
        req.end();
    });
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
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ response: '잘못된 요청입니다.' });
    }

    // 비용 보호: 단일 메시지 최대 1500자, 대화 기록 최대 20개
    const MAX_MSG_LENGTH = 1500;
    const MAX_HISTORY = 20;
    if (messages.some(m => typeof m.content === 'string' && m.content.length > MAX_MSG_LENGTH)) {
      return res.status(400).json({ response: `메시지가 너무 깁니다. (최대 ${MAX_MSG_LENGTH}자)` });
    }
    const limitedMessages = messages.slice(-MAX_HISTORY);

    const userQuery = limitedMessages[limitedMessages.length - 1].content;
    console.log('Received User Query:', userQuery);

    const systemPrompt = getSystemPrompt();

    // OpenAI API를 호출하여 채팅 응답을 생성합니다.
    let aiResponse;
    try {
      const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          ...limitedMessages
        ],
        tools: [webSearchTool],
        tool_choice: "auto"
      });

      const choice = completion.choices[0];
      if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length > 0) {
        const toolCall = choice.message.tool_calls[0];
        const args = JSON.parse(toolCall.function.arguments);
        console.log('Web search query:', args.query);
        const searchResult = await executeWebSearch(args.query);

        const completion2 = await openai.chat.completions.create({
          model: MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            ...limitedMessages,
            choice.message,
            {
              role: "tool",
              tool_call_id: toolCall.id,
              content: searchResult ? `웹 검색 결과:\n${searchResult}` : "검색 결과를 가져오지 못했습니다."
            }
          ]
        });
        aiResponse = completion2.choices[0].message.content;
      } else {
        aiResponse = choice.message.content;
      }
    } catch (toolError) {
      console.error('Tool call failed, falling back to no-tools:', toolError.message);
      const fallback = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          ...limitedMessages
        ]
      });
      aiResponse = fallback.choices[0].message.content;
    }

    // Google Sheets 로그 기록 (https 모듈로 직접 POST, 리다이렉트 미추적)
    if (process.env.SHEETS_WEBHOOK_URL) {
      await logToSheets(process.env.SHEETS_WEBHOOK_URL, userQuery, aiResponse);
    }

    return res.status(200).json({ response: aiResponse });
  } catch (error) {
    // 서버 로그에 더 상세한 에러를 기록합니다.
    console.error('Error in API function:', error);

    // 클라이언트에게 더 유용한 에러 메시지를 전달합니다.
    const errorMessage = error.response && error.response.data ? JSON.stringify(error.response.data) : error.message;
    return res.status(500).json({ response: `AI 모델 호출 중 서버 오류 발생: ${errorMessage}` });
  }
};
