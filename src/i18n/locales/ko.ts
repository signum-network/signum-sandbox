export default {
  tagline: '나만의 블록체인. 비용도, 위험도, 마찰도 없이.',
  status: { live: '실시간', polling: '폴링 중', offline: '오프라인', scanning: '스캔 중' },
  panel: { nodeState: '노드 상태' },
  tile: { height: '블록 높이', lastBlock: '마지막 블록', difficulty: '누적 난이도' },
  entry: {
    apiDocs: { title: 'API 문서', description: '전체 JSON API를 대화식으로 사용해 보기' },
    dashboard: { title: '모의 노드 대시보드', description: '블록 생성, 계정과 트랜잭션 탐색' },
    comingSoon: '곧 제공',
  },
  unreachable: { title: '{{host}}에 노드가 없습니다', description: './scripts/start.sh 로 시작하세요' },
} as const
