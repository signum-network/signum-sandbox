export default {
  tagline: 'Uma cadeia Signum descartável para desenvolver. Quebre-a, reinicie-a, comece de novo.',
  status: { live: 'ao vivo', polling: 'consultando', offline: 'desligado', scanning: 'a analisar' },
  panel: { nodeState: 'Estado do nó' },
  tile: { height: 'Altura do bloco', lastBlock: 'Último bloco' },
  entry: {
    apiDocs: { title: 'Documentação da API', description: 'Experimente toda a API JSON de forma interativa' },
    dashboard: { title: 'Painel do nó mock', description: 'Forje blocos, explore contas e transações' },
    comingSoon: 'em breve',
  },
  unreachable: { title: 'Nenhum nó em {{host}}', description: 'Inicie-o com ./scripts/start.sh' },
} as const
