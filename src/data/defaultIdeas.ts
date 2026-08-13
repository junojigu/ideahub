import { Idea } from '../types';

export const DEFAULT_IDEAS: Idea[] = [
  {
    id: 'ID_1719361200000',
    date: '2026-06-25',
    title: '스마트 오피스 식물 자동 급수 IoT 기획',
    content: '사무실 내 다육식물 및 공기정화 식물들의 토양 수분 농도를 수시로 측정하여 자동으로 물을 급수해주는 스마트 화분 설계안. 라즈베리 파이 센서와 구글 시트 API를 결합하여 급수 주기 데이터를 축적하고, 식물의 최적 생장 패턴을 기계학습으로 분석.',
    tags: ['IoT', '스마트오피스', '하드웨어'],
    sourceUrl: 'https://news.google.com',
    importance: 4,
    views: 42
  },
  {
    id: 'ID_1719361300000',
    date: '2026-06-24',
    title: '제미나이 기반 회의록 요약 자동화 봇',
    content: '팀 미팅 구글 미트 음성을 실시간 STT(Speech-To-Text)로 추출하여 텍스트화 한 뒤, 제미나이 API에 연동하여 세 줄 핵심 요약과 당일 도출된 액션 아이템 목록을 구글 스프레드시트의 주간 보고서 행에 실시간 추가하는 Google Apps Script 기반 봇 구성안.',
    tags: ['AI', '생산성', 'GAS'],
    sourceUrl: 'https://ai.google.dev',
    importance: 5,
    views: 89
  },
  {
    id: 'ID_1719361400000',
    date: '2026-06-22',
    title: '로컬 재래시장 상생 공동 배달 플랫폼 구상',
    content: '대형 마트에 밀려 활기를 잃어가는 전통 시장의 반찬, 과일, 정육 등을 단 한 번의 주문으로 모아서 한 집에 배송해 주는 친환경 바이크 공동 배송 플랫폼. 소상공인들에게는 제로 수수료 혜택을 부여하고, 지역 화폐 결제 시스템을 적극 연동하여 지역 경제 활성화 유도.',
    tags: ['상생', '플랫폼', '지역경제'],
    sourceUrl: '📚 [도서] 골목길 자본론 - 모종린 저',
    importance: 3,
    views: 19
  },
  {
    id: 'ID_1719361500000',
    date: '2026-06-20',
    title: 'D3.js 기반 옵시디언 감성 2D 지식 신경망 시각화',
    content: '노드 간 연관 관계와 상위 테마를 은하수 형태로 연결하는 인터랙티브 D3 물리엔진 시뮬레이터. 클릭 시 관련 아이디어가 즉각 소환되며, 검색어와 연동되어 관련 지식 조각을 한눈에 식별 가능.',
    tags: ['시각화', 'D3', '디자인'],
    sourceUrl: 'https://d3js.org',
    importance: 5,
    views: 130
  },
  {
    id: 'ID_1719361600000',
    date: '2026-06-18',
    title: '오늘 되짚어볼 추천 지식 라테럴 싱킹 알고리즘',
    content: '수많은 아이디어 중 오랫동안 보지 않은 과거 기록을 매일 아침 라테럴 싱킹(측면 사고) 프롬프트와 함께 소환하여 뜻밖의 영감을 제공하는 개인화 지식 선순환 엔진.',
    tags: ['기획', '알고리즘', '생산성'],
    sourceUrl: '📄 [일반] Harvard Business Review - Lateral Thinking in Product Design',
    importance: 4,
    views: 57
  },
  {
    id: 'ID_1719361700000',
    date: '2026-06-15',
    title: '구글 스프레드시트 DB 연동 REST API 구성 파이프라인',
    content: 'Google Apps Script의 doGet과 doPost 핸들러를 확장하여 구글 시트를 서버리스 NoSQL 스타일 JSON 데이터베이스로 활용하는 비동기 데이터 통신 모듈. API Key 검증과 데이터 샌드박싱 구조 포함.',
    tags: ['GAS', 'API', 'DB'],
    sourceUrl: 'https://developers.google.com/apps-script',
    importance: 4,
    views: 73
  }
];
