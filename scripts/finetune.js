/**
 * 페필이 파인튜닝 실행 스크립트
 *
 * 사용법:
 *   node scripts/finetune.js          → 파인튜닝 작업 시작
 *   node scripts/finetune.js --status → 진행 중인 작업 상태 확인
 *   node scripts/finetune.js --list   → 완료된 모델 목록 확인
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const TRAINING_FILE = path.join(__dirname, '../data/training.jsonl');

async function startFineTuning() {
  console.log('📤 학습 데이터 업로드 중...');

  // 1. training.jsonl 파일 업로드
  const fileStream = fs.createReadStream(TRAINING_FILE);
  const uploadedFile = await openai.files.create({
    file: fileStream,
    purpose: 'fine-tune',
  });
  console.log(`✅ 파일 업로드 완료 | ID: ${uploadedFile.id}`);

  // 2. 파인튜닝 작업 생성
  console.log('\n🚀 파인튜닝 작업 시작 중...');
  const job = await openai.fineTuning.jobs.create({
    training_file: uploadedFile.id,
    model: 'gpt-4o-mini-2024-07-18', // gpt-3.5-turbo-0125 도 가능
    hyperparameters: {
      n_epochs: 3, // 데이터가 적을수록 epoch 높게
    },
  });

  console.log(`✅ 파인튜닝 작업 생성 완료!`);
  console.log(`   Job ID   : ${job.id}`);
  console.log(`   상태     : ${job.status}`);
  console.log(`   기반 모델: ${job.model}`);
  console.log(`\n⏳ 완료까지 보통 10~30분 소요됩니다.`);
  console.log(`\n상태 확인 명령어:`);
  console.log(`   node scripts/finetune.js --status ${job.id}`);
}

async function checkStatus(jobId) {
  if (!jobId) {
    // 최근 작업 목록 조회
    const jobs = await openai.fineTuning.jobs.list({ limit: 5 });
    console.log('\n📋 최근 파인튜닝 작업 목록:');
    for (const job of jobs.data) {
      const icon = job.status === 'succeeded' ? '✅' : job.status === 'failed' ? '❌' : '⏳';
      console.log(`${icon} [${job.status}] ${job.id} | 모델: ${job.fine_tuned_model || '생성 중...'}`);
    }
    return;
  }

  const job = await openai.fineTuning.jobs.retrieve(jobId);
  console.log(`\n📊 파인튜닝 상태:`);
  console.log(`   Job ID       : ${job.id}`);
  console.log(`   상태         : ${job.status}`);
  console.log(`   완료된 모델  : ${job.fine_tuned_model || '아직 생성 중...'}`);

  if (job.status === 'succeeded') {
    console.log(`\n🎉 파인튜닝 완료!`);
    console.log(`\n📌 .env 파일에 아래 줄을 추가하세요:`);
    console.log(`   OPENAI_MODEL=${job.fine_tuned_model}`);
    console.log(`\n📌 Vercel 환경변수에도 동일하게 추가하세요:`);
    console.log(`   vercel.com → face-filter → Settings → Environment Variables`);
  }
}

async function listModels() {
  const jobs = await openai.fineTuning.jobs.list({ limit: 20 });
  const completed = jobs.data.filter(j => j.status === 'succeeded');

  console.log(`\n✅ 완료된 파인튜닝 모델 목록 (${completed.length}개):`);
  for (const job of completed) {
    console.log(`   ${job.fine_tuned_model}`);
  }
}

// 메인 실행
(async () => {
  try {
    const args = process.argv.slice(2);
    if (args[0] === '--status') {
      await checkStatus(args[1]);
    } else if (args[0] === '--list') {
      await listModels();
    } else {
      await startFineTuning();
    }
  } catch (err) {
    console.error('❌ 오류 발생:', err.message);
    process.exit(1);
  }
})();
