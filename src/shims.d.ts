declare module 'bittorrent-tracker/websocket-tracker' {
  export default class WebSocketTracker {
    announceUrl: string
    socket?: { connected?: boolean }
    peers?: unknown[]
    constructor(client: unknown, announceUrl: string)
    announce(opts: { numwant?: number, uploaded?: number, downloaded?: number }): void
    destroy(): void
  }
}
