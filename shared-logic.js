const path = require('path');
const fs = require('fs').promises;

// Knowledge Base 데이터를 캐싱할 변수
let knowledgeBaseCache = null;

async function getKnowledgeBase() {
    // 캐시된 데이터가 있으면 즉시 반환
    if (knowledgeBaseCache) {
        return knowledgeBaseCache;
    }

    try {
        const rulesPath = path.join(process.cwd(), 'public', 'data', 'procedure-rules.json');
        const rulesData = await fs.readFile(rulesPath, 'utf8');
        const rules = JSON.parse(rulesData);

        // 파싱된 결과를 텍스트로 변환하여 캐시에 저장
        knowledgeBaseCache = rules.map(item => {
            if (item.rule) return `- ${item.name}: ${item.rule}`;
            return `- ${item.name} (시술: ${item.procedures.join(', ')})의 추천 순서는 '${item.order}' 입니다. (이유: ${item.reason})`;
        }).join('\n');
    } catch (error) {
        console.error("Error reading knowledge base:", error);
        return "내부 정보 파일을 읽는 데 실패했습니다.";
    }

    return knowledgeBaseCache;
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

module.exports = { getKnowledgeBase, createSystemPrompt };