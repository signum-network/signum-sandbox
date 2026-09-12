export default {
  tagline: 'Una cadena Signum desechable donde desarrollar. Rómpela, reiníciala, empieza de nuevo.',
  status: { live: 'en vivo', polling: 'consultando', offline: 'sin conexión', scanning: 'escaneando' },
  panel: { nodeState: 'Estado del nodo' },
  tile: { height: 'Altura de bloque', lastBlock: 'Último bloque' },
  entry: {
    apiDocs: { title: 'Documentación API', description: 'Prueba toda la API JSON de forma interactiva' },
    dashboard: { title: 'Panel del nodo mock', description: 'Forja bloques, explora cuentas y transacciones' },
    comingSoon: 'próximamente',
  },
  unreachable: { title: 'No hay nodo en {{host}}', description: 'Inícialo con ./scripts/start.sh' },
} as const
