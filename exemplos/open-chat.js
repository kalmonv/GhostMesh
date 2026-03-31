import GhostMesh from '../dist/ghostmesh.js'

const TRACKERS = [
  process.env.GHOSTMESH_TRACKER || 'ws://127.0.0.1:5001'
]

const IDENTIFIER = process.env.GHOSTMESH_IDENTIFIER || 'ghostmesh-chat'
const TARGET_PEER_ID = process.env.GHOSTMESH_TARGET_PEER_ID || ''
const MESSAGE = process.env.GHOSTMESH_MESSAGE || 'Ola do open-chat'

async function main () {
  const gmesh = new GhostMesh(TRACKERS, IDENTIFIER)

  gmesh.on('peerconnect', async peer => {
    console.log('[chat] peer connected:', peer.id)

    if (!TARGET_PEER_ID || peer.id !== TARGET_PEER_ID) {
      return
    }

    try {
      const [, response] = await gmesh.send(peer, {
        kind: 'chat',
        text: MESSAGE,
        sentAt: Date.now()
      })

      console.log('[chat] response from target:')
      console.log(response)
    } catch (error) {
      console.error('[chat] send failed:', error)
    }
  })

  gmesh.on('msg', async (peer, payload) => {
    console.log('[chat] incoming from', peer.id, payload)

    await peer.respond({
      ok: true,
      echoedText: payload?.text ?? null,
      responderPeerId: gmesh._peerId
    })
  })

  gmesh.on('peerclose', peer => {
    console.log('[chat] peer disconnected:', peer.id)
  })

  await gmesh.start()

  console.log('[chat] started')
  console.log('[chat] identifier:', IDENTIFIER)
  console.log('[chat] peer id:', gmesh._peerId)

  if (!TARGET_PEER_ID) {
    console.log('[chat] set GHOSTMESH_TARGET_PEER_ID to send automatically to a specific peer')
  }
}

main().catch(error => {
  console.error('[chat] fatal error:', error)
  process.exit(1)
})
