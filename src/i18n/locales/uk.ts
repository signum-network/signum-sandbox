export default {
  tagline: 'Власний блокчейн. Без витрат, без ризику, без перешкод.',
  status: { live: 'наживо', polling: 'опитування', offline: 'офлайн', scanning: 'сканування' },
  panel: { nodeState: 'Стан вузла' },
  tile: { height: 'Висота блоку', lastBlock: 'Останній блок' },
  entry: {
    apiDocs: { title: 'Документація API', description: 'Інтерактивно спробуйте повний JSON API' },
    dashboard: { title: 'Панель мок-вузла', description: 'Кувати блоки, досліджувати рахунки й транзакції' },
    comingSoon: 'незабаром',
  },
  unreachable: { title: 'Немає вузла на {{host}}', description: 'Запустіть його через ./scripts/start.sh' },
} as const
