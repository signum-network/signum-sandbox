export default {
  tagline: 'Deine eigene Blockchain. Keine Kosten, kein Risiko, keine Reibung.',
  status: { live: 'live', polling: 'Abfrage', offline: 'offline', scanning: 'Scan läuft' },
  panel: { nodeState: 'Node-Zustand' },
  tile: { height: 'Blockhöhe', lastBlock: 'Letzter Block' },
  entry: {
    apiDocs: { title: 'API-Doku', description: 'Die komplette JSON-API interaktiv ausprobieren' },
    dashboard: { title: 'Mock-Node-Dashboard', description: 'Blöcke forgen, Accounts und Transaktionen erkunden' },
    comingSoon: 'kommt als Nächstes',
  },
  unreachable: { title: 'Kein Node auf {{host}}', description: 'Starte ihn mit ./scripts/start.sh' },
} as const
