const rules = require('./_data/procedure-rules.json');
const patchNotes = require('./_data/patch-notes.json');

// Knowledge Base 데이터를 캐싱할 변수
let knowledgeBaseCache = null;

async function getKnowledgeBase() {
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

        // --- 디버깅을 위한 로그 추가 ---
        console.log("--- Generated Knowledge Base ---");
        console.log(knowledgeBaseCache);
        console.log("------------------------------");

        // 만약 파싱 후 내용이 없다면, 파일이 비어있거나 형식이 잘못된 것이므로 에러를 발생시킵니다.
        if (!knowledgeBaseCache) {
            throw new Error("Knowledge base is empty after parsing. Check the JSON file.");
        }

        return knowledgeBaseCache;
    } catch (error) {
        console.error("Error processing knowledge base:", error);
        // 에러가 발생하면, AI에게 텍스트를 전달하는 대신 시스템 전체에 에러를 알립니다.
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

module.exports = { getKnowledgeBase, createSystemPrompt };