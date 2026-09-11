export default {
  tagline: '你自己的区块链。零成本、零风险、零阻力。',
  status: { live: '实时', polling: '轮询中', offline: '离线', scanning: '扫描中' },
  panel: { nodeState: '节点状态' },
  tile: { height: '区块高度', lastBlock: '最新区块', difficulty: '累计难度' },
  entry: {
    apiDocs: { title: 'API 文档', description: '交互式体验完整的 JSON API' },
    dashboard: { title: '模拟节点面板', description: '铸造区块，浏览账户与交易' },
    comingSoon: '即将推出',
  },
  unreachable: { title: '{{host}} 上没有节点', description: '用 ./scripts/start.sh 启动它' },
} as const
