// 대시보드 프론트엔드에 필요한 모든 데이터를 통합하여 제공하는 API 엔드포인트입니다.

// 데이터 파일을 빌드 시점에 포함시키기 위해 require를 사용합니다.
const genmacData = require('../data/genmac.json');
const otherProcedureData = require('../data/other-procedures.json');
const patchNotes = require('../data/patch-notes.json');

module.exports = (req, res) => {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
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