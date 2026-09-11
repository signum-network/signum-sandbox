export default {
  tagline: 'Your own blockchain. No costs, no risk, no friction.',
  status: {
    live: 'live',
    polling: 'polling',
    offline: 'offline',
    scanning: 'scanning',
  },
  panel: { nodeState: 'Node State' },
  tile: {
    height: 'Block Height',
    lastBlock: 'Last Block',
    difficulty: 'Cumulative Difficulty',
  },
  entry: {
    apiDocs: { title: 'API Docs', description: 'Try the full JSON API interactively' },
    dashboard: { title: 'Mock Node Dashboard', description: 'Forge blocks, explore accounts and transactions' },
    comingSoon: 'coming next',
  },
  unreachable: {
    title: 'No node at {{host}}',
    description: 'Start it with ./scripts/start.sh',
  },
} as const
