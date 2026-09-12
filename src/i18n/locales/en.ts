export default {
  tagline: 'A throwaway Signum chain to build against. Break it, reset it, start over.',
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
