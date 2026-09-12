export default {
  tagline: 'Одноразовый блокчейн Signum для разработки. Сломай, сбрось, начни заново.',
  status: { live: 'в эфире', polling: 'опрос', offline: 'офлайн', scanning: 'сканирование' },
  panel: { nodeState: 'Состояние узла' },
  tile: { height: 'Высота блока', lastBlock: 'Последний блок' },
  entry: {
    apiDocs: { title: 'Документация API', description: 'Интерактивно опробуйте весь JSON API' },
    dashboard: { title: 'Панель мок-узла', description: 'Ковать блоки, изучать счета и транзакции' },
    comingSoon: 'скоро',
  },
  unreachable: { title: 'Нет узла на {{host}}', description: 'Запустите его через ./scripts/start.sh' },
} as const
