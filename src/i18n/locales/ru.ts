export default {
  tagline: 'Собственный блокчейн. Без затрат, без риска, без трения.',
  status: { live: 'в эфире', polling: 'опрос', offline: 'офлайн', scanning: 'сканирование' },
  panel: { nodeState: 'Состояние узла' },
  tile: { height: 'Высота блока', lastBlock: 'Последний блок', difficulty: 'Совокупная сложность' },
  entry: {
    apiDocs: { title: 'Документация API', description: 'Интерактивно опробуйте весь JSON API' },
    dashboard: { title: 'Панель мок-узла', description: 'Ковать блоки, изучать счета и транзакции' },
    comingSoon: 'скоро',
  },
  unreachable: { title: 'Нет узла на {{host}}', description: 'Запустите его через ./scripts/start.sh' },
} as const
