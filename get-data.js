// 대시보드 프론트엔드에 필요한 모든 데이터를 통합하여 제공하는 API 엔드포인트입니다.

const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  try {
    // Vercel 배포 환경에서 안정적으로 파일을 읽기 위해, 런타임에 직접 파일 경로를 지정하여 읽습니다.
    const dataPath = (fileName) => path.join(process.cwd(), '_data', fileName);
    
    const genmacData = JSON.parse(fs.readFileSync(dataPath('genmac.json'), 'utf8'));
    const otherProcedureData = JSON.parse(fs.readFileSync(dataPath('other-procedures.json'), 'utf8'));
    const patchNotes = JSON.parse(fs.readFileSync(dataPath('patch-notes.json'), 'utf8'));
    
    // 프론트엔드에서 사용하기 편한 형태로 데이터를 조합합니다.
    const dashboardData = {
      ...genmacData,
      otherProcedureData,
      patchNotes,
    };
    res.status(200).json(dashboardData);
  } catch (error) {
    console.error('Error serving dashboard data from /api/get-data:', error);
    res.status(500).json({ error: 'Failed to load dashboard data.' });
  }
};