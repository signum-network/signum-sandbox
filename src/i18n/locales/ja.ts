export default {
  tagline: '自分だけのブロックチェーン。コストなし、リスクなし、摩擦なし。',
  status: { live: 'ライブ', polling: 'ポーリング中', offline: 'オフライン', scanning: 'スキャン中' },
  panel: { nodeState: 'ノードの状態' },
  tile: { height: 'ブロック高', lastBlock: '最新ブロック' },
  entry: {
    apiDocs: { title: 'API ドキュメント', description: 'JSON API をインタラクティブに試す' },
    dashboard: { title: 'モックノード ダッシュボード', description: 'ブロックを生成し、アカウントと取引を確認' },
    comingSoon: '近日公開',
  },
  unreachable: { title: '{{host}} にノードがありません', description: './scripts/start.sh で起動してください' },
} as const
