export default {
  tagline: 'Одноразовий блокчейн Signum для розробки. Зламай, скинь, почни заново.',
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
