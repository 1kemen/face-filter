# 어레인지 통합 관제 보드 — 프로젝트 스펙

> **현재 버전:** v36.1  
> **배포 플랫폼:** Vercel (`face-filter-rao5`)  
> **운영 클리닉:** 어레인지 클리닉 (피부과 — 시술·진료 중심)

---

## 1. 프로젝트 목적

피부과 클리닉의 일일 시술 운영을 효율화하기 위한 통합 관제 대시보드.  
의료진별 시술 소요시간 자동 계산, 스케줄 시각화, 그리고 AI 어시스턴트 "페필이"를 통한 시술 순서 추천·운영 질의응답을 제공한다.

---

## 2. 아키텍처 개요

```
┌──────────────────────────────────────────┐
│  index.html  (Single-File SPA)           │
│  React 18 + Babel (CDN) + Tailwind (CDN) │
│  Recharts + Lucide + Marked + DOMPurify  │
└──────────┬────────────────────┬──────────┘
           │ GET /api/get-data  │ POST /api/chat
           ▼                    ▼
┌──────────────────┐  ┌──────────────────────────────┐
│ api/get-data.js  │  │ api/chat.js                  │
│ (정적 데이터     │  │ OpenAI GPT-4o-mini           │
│  통합 제공)      │  │ + web_search_preview 도구    │
└──────────────────┘  │ + Google Sheets 로그         │
                      └──────────────────────────────┘
           ▲                    ▲
           └──── data/*.json ───┘
```

**배포 방식:** Vercel Serverless Functions. 빌드 단계 없이 `index.html` + `api/` + `data/`가 전부다.  
**로컬 실행:** `vercel dev` (또는 Node.js 직접 실행 불가 — 브라우저 단 확인은 Live Server 사용).

---

## 3. 디렉터리 구조

```
clinic-dashboard/
├── index.html              # 전체 프론트엔드 (React JSX 인라인)
├── style.css               # 커스텀 스타일 (Tailwind 보완)
├── api/
│   ├── chat.js             # AI 챗봇 엔드포인트 (POST /api/chat)
│   └── get-data.js         # 대시보드 데이터 엔드포인트 (GET /api/get-data)
├── data/
│   ├── genmac.json         # 젠틀맥스 프로(젠맥) 시술 데이터 + 의료진 프로필
│   ├── procedure-rules.json# 시술 순서 원칙 및 조합 규칙 (16개)
│   ├── other-procedures.json # 간호팀·피부팀 시술 시간 (27개)
│   ├── corrections.json    # 운영 중 정정 메모 (최우선 적용, 현재 30건)
│   └── patch-notes.json    # 버전별 업데이트 내역 (현재 7버전)
├── .env                    # 로컬 환경변수 (git 제외)
├── .env.example            # 환경변수 템플릿
└── package.json            # 의존성: dotenv, openai
```

---

## 4. 핵심 기능

### 4-1. 시술 시간 계산 대시보드
- **의료진 5인** 각각의 속도 계수(얼굴/바디/주사)를 적용해 시술 소요시간을 자동 산출
- A대표원장님은 **평시/피크타임** 두 가지 모드 구분 (피크타임 얼굴전체 = 80초 고정)
- **신장 보정 규칙:** 바디 레이저 시술 시 기준 신장(남 174cm, 여 163cm) 대비 ±5cm마다 ±30초 보정 (겨드랑이·브라질리언 제외)
- Recharts 기반 차트로 의료진별 시간 비교 시각화

### 4-2. AI 어시스턴트 "페필이"
- **모델:** OpenAI GPT-4o-mini (파인튜닝 모델 교체 가능 — `OPENAI_MODEL` 환경변수)
- **역할:** 시술 순서 추천, 소요시간 안내, 운영 질의응답
- **3대 원칙:** 감염 방지 → 시술 효율 → 동선 최적화
- **웹 검색:** 내부 데이터에 없는 의학·시술 정보는 `web_search_preview` 도구로 실시간 검색 (OpenAI Responses API)
- **대화 내보내기:** 텍스트 파일(.txt)로 다운로드
- **비용 보호:** 단일 메시지 최대 1,500자, 대화 이력 최대 20개

### 4-3. 운영 데이터 관리
- `corrections.json` — 운영 중 발견된 오류 정정 메모. AI 답변 시 **최우선 적용**
- `patch-notes.json` — 버전별 변경 이력, 대시보드 내 표시
- 데이터 수정은 JSON 파일 직접 편집 후 Vercel에 재배포

---

## 5. 데이터 스키마

### genmac.json
```jsonc
{
  "doctorProfiles": [
    { "id": "A_normal", "name": "A대표원장님(평시)", "face": 1.0, "body": 1.0, "injection": 1.0 },
    // face: 얼굴제모 계수, body: 바디제모 계수, injection: 주사시술 계수
  ],
  "faceLaserData": [{ "name": "얼굴전체", "time": 120 }],   // time: 기준 초(sec)
  "bodyLaserData": [{ "name": "종아리무릎포함", "time": 300 }],
  "injectionData":  [{ "name": "보톡스", "baseTimeSec": 300 }]
}
```

### other-procedures.json
```jsonc
[
  {
    "name": "리니어지",
    "team": "피부팀",          // "피부팀" | "간호팀"
    "category": "리프팅",      // 피부팀: "리프팅" | "레이저" | "필"
    "procedure": 30,           // 시술 시간(분)
    "anesthesia": 40           // 마취 시간(분), 0이면 마취 없음
  }
]
```

### corrections.json
```jsonc
[{ "date": "2025-07-01", "topic": "D배원장님 주사계수", "correction": "0.92로 정정" }]
```

### procedure-rules.json
```jsonc
[
  { "name": "보톡스+필러", "procedures": ["보톡스", "필러"], "order": "보톡스 → 필러", "reason": "..." },
  { "name": "주의사항", "description": "레이저 후 즉시 주사 금지" }
]
```

---

## 6. API 명세

### `GET /api/get-data`
대시보드 초기 렌더링에 필요한 모든 정적 데이터를 반환.

**Response:**
```jsonc
{
  "faceLaserData": [...],
  "bodyLaserData": [...],
  "doctorProfiles": [...],
  "injectionData": [...],
  "otherProcedureData": [...],
  "patchNotes": [...]
}
```

---

### `POST /api/chat`
AI 어시스턴트 페필이에게 메시지를 전송.

**Request:**
```jsonc
{ "messages": [{ "role": "user", "content": "보톡스 후 필러 순서 알려줘" }] }
```

**Response:**
```jsonc
{ "response": "보톡스 먼저 시술하시고, 이후 필러를 진행하시면 됩니다..." }
```

**에러:** `400` 메시지 너무 길거나 잘못된 형식 / `405` POST 이외 메서드 / `500` OpenAI 호출 실패

---

## 7. 환경변수

| 변수명 | 필수 | 설명 |
|---|---|---|
| `OPENAI_API_KEY` | 필수 | OpenAI API 키 |
| `OPENAI_MODEL` | 선택 | 사용 모델 (기본: `gpt-4o-mini`). 파인튜닝 모델 사용 시 `ft:gpt-4o-mini-xxxxx` |
| `SHEETS_WEBHOOK_URL` | 선택 | Google Sheets 로그 웹훅 URL (없으면 로그 미기록, 페필이 동작은 정상) |

`.env.example` 참조. Vercel 배포 시 **Settings > Environment Variables**에 등록.

---

## 8. 프론트엔드 구조 (index.html)

빌드 도구 없이 CDN으로 모든 의존성을 로드하는 단일 HTML 파일 구조.

| 라이브러리 | 버전 | 용도 |
|---|---|---|
| React + ReactDOM | 18 | UI 렌더링 |
| Babel Standalone | latest | JSX 브라우저 트랜스파일 |
| Tailwind CSS | latest | 유틸리티 스타일링 |
| Recharts | 2.12.7 | 차트 시각화 |
| Lucide | latest | 아이콘 |
| Marked.js | latest | AI 응답 Markdown → HTML |
| DOMPurify | 3.0.11 | Markdown HTML XSS 방어 |

**주요 함수:**
- `calculateTime(item, doctor)` — 의료진 계수 적용 시술 시간 계산 (10초 단위 반올림)
- `handleExportChat(messages)` — 대화 로그 텍스트 파일 다운로드

---

## 9. 로컬 개발 환경 세팅

```bash
# 1. 의존성 설치 (서버사이드 API용)
npm install

# 2. 환경변수 설정
cp .env.example .env
# .env에 OPENAI_API_KEY 입력

# 3. 개발 서버 실행 (Vercel CLI 필요)
npx vercel dev
# → http://localhost:3000
```

> Vercel CLI 없이 프론트엔드만 확인하려면 VSCode Live Server로 `index.html`을 열면 되지만,  
> `/api/chat` `/api/get-data` 호출은 동작하지 않는다.

---

## 10. 배포

```bash
# Vercel에 프로덕션 배포
npx vercel --prod
```

`data/*.json` 변경 시 반드시 재배포해야 API에 반영된다 (빌드 시점에 `require`로 번들링됨).

---

## 11. 의료진 프로필 (현행)

| ID | 이름 | 얼굴계수 | 바디계수 | 주사계수 | 비고 |
|---|---|---|---|---|---|
| A_normal | A대표원장님(평시) | 1.0 | 1.0 | 1.0 | 기준 의료진 |
| A_peak | A대표원장님(피크) | — | — | — | 얼굴전체 80초 고정 |
| B | B정원장님 | genmac.json 참조 | | | |
| C | C은원장님 | genmac.json 참조 | | | |
| D | D배원장님 | 0.92 (주사) | | | corrections.json 정정 이력 있음 |

---

## 12. 알려진 설계 결정 및 제약

- **단일 HTML 파일:** 배포 단순화 목적. 파일이 커지면 컴포넌트 분리보다 섹션 주석 구분을 우선한다.
- **CDN 의존:** 오프라인 환경에서 동작하지 않는다. 프로덕션 클리닉 네트워크 안정성 전제.
- **corrections.json 최우선:** AI가 `genmac.json`/`procedure-rules.json`과 충돌 시 `corrections.json`을 따른다. 데이터 수정 시 원본 JSON과 corrections 양쪽 정합성을 확인할 것.
- **파인튜닝 준비:** `training.jsonl` 파일 존재. `OPENAI_MODEL`을 파인튜닝 모델 ID로 교체하면 즉시 적용.
- **로그:** Google Sheets 웹훅이 없어도 페필이는 정상 동작. 로그는 선택 기능.
