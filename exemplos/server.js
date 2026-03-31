import GhostMesh from '../dist/ghostmesh.js'

const TRACKERS = [
  process.env.GHOSTMESH_TRACKER || 'ws://127.0.0.1:5001'
]

const IDENTIFIER = process.env.GHOSTMESH_IDENTIFIER || 'ghostmesh-demo'
const SERVICE_NAME = process.env.GHOSTMESH_SERVICE || 'directory'
const REVEAL_SERVER = process.env.GHOSTMESH_REVEAL_SERVER === 'true'

const SERVER_PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDIpdEtEVCAgIjS
unWBjM1gU0D6IWtDKNZENN5z24QQoeBzUh6+eWrMPE+hpA/WPT0CM7cQAemc2DhM
WNvtUiYD9SE/SIO248it60EQPajP4XMB7eE9kU34vocVspmelmz+SeLJfjKzgvwU
BfUJGyQlMb1u4gSCKyQio5rDq+yjxp84LX4DsauXPxJe9n9knOTHfQEDjP+vJdms
Y3Z6IwvLjuKEuH/xOIBGjCBUiBE8ktFenvKgkejGzvgNvMQZZnkaR0kGd7pIqWXn
mgL/zVeIEeRAO7lh9h6hWyM+57XzMqPQEcOMy2fFeHqV0upoZwJKVBIC2X4aExfS
zJhpMz+xAgMBAAECggEACJONbmj/qg9bidQh8R7vjQ8ZDmnF1FVXP0SL6r/2sIuI
H5I3v92DhNepHF9BCkNTgN77IcpOsX9MtaHUQ2MeWvnzMD8CodQ/sb0wsbXaxmzY
m1hWQ6IMv/zaozLYL81SyTlSDK8eZ1h05cvDKwmHrWDgZprg7JD/1rBPcQfN3JGC
9iJWMR2InKNaBRu2Ghm53fWVBzRHO3xQJmoZlAqMpTy0AOAXsnWUrhgDTJRKbBPr
NXeRtZq+sAZDdYwFFsjvNPIBtqFr66UQGuLAzhDwY8HURNMXx1cNT0CWqj5hopau
iWq53HV8rmq05NtLxKcKBEyz4+WXWRRJk9lfM6l1hwKBgQD958e6Ppiq0a5YLbU6
OpA+nEozl7WbTTjCYwgjSQbdWSowV5rcfuxERAFSCnYNgpM7C/sgWfScCOO2YMoA
V+JxtWnhrvtyfCy0nRCjL8uJr8y3tWDsXonXD7HQFK3BZu0FqVzDKCxirq2qn2sp
cq1Pe1gTKLOxZ1FgppHmnjENywKBgQDKTZAKvxDamNHPj27xw/sdrkWsyk/+N+Y1
lfy2/7BG8A8dmCV7H/kzqE99g+ZfQzR1cbI6qhVE5L4XtfZD/AWBKF4Xo80ttkBJ
01sQdvGH9iyhESE+309nIroh4yDUctEvPThUWwjK3TQPxnXpkiBQxnsFaamKt3Nk
joU9wQR48wKBgQDl0MAYFIZsvuN2TtDlRpK/CQmkjyHC0u+YCrkX7wZ2nTkxjmnO
QFesJn2ne26FJfYLkPmZu7JK9UTfE9Zi3ylIULLoolBXvIteY3fmrOEm2+eJNHPp
HlzXOw5vz/fBwV6yLCyZPCiInaD1edwuJO03ruX2WXXkEic3Oy1+NxshZwKBgCbb
dwtZX7ddGw+vETRG3Hj6/E8QHQVLX2BzirLrscQuX/jjPG/F2GvfrEUDjMBHfFAC
oqU5/hPZi9mqDb9JLRV913Ta9ZIOK5MCkb872XCwDCpzy9rzsaCxvua7ZZbo5t0X
+TXatnmgu1s8V3Ghq6tYNFD51qLaUcPCzDzsUhuZAoGBAJQG1IKuGvj0ZkPNNgWS
oh1kjZNIA3Gt6GVzVIj9xGDZTnbwc/kajOLVVwszaTmxMB3RIu1eIzVDz0E5ZHE7
En9QCf8NP4NiYl0+najNM5dDd73SwjsODxHNt4/nSCZr6z1GfdNyiUBtgdw+1aQu
SbEgLAoAyRY2d0sXQyhJlSby
-----END PRIVATE KEY-----`

async function main () {
  const gmesh = new GhostMesh(TRACKERS, IDENTIFIER)

  gmesh.setOptions({
    timeout: 60_000,
    identity: {
      role: 'master',
      privateKey: SERVER_PRIVATE_KEY_PEM
    },
    hiddenService: {
      role: 'master',
      serviceName: SERVICE_NAME,
      revealServer: REVEAL_SERVER,
      fixedPacketBytes: 4096
    }
  })

  gmesh.on('peerconnect', peer => {
    console.log('[server] peer connected:', peer.id)
  })

  gmesh.on('peerclose', peer => {
    console.log('[server] peer disconnected:', peer.id)
  })

  gmesh.handleHiddenService(SERVICE_NAME, async (payload, context) => {
    console.log('[server] hidden request:', context.requestId, payload)

    return {
      ok: true,
      service: SERVICE_NAME,
      requestId: context.requestId,
      serverPeerId: gmesh._peerId,
      received: payload,
      timestamp: new Date().toISOString()
    }
  })

  await gmesh.start()

  console.log('[server] started')
  console.log('[server] identifier:', IDENTIFIER)
  console.log('[server] peer id:', gmesh._peerId)
  console.log('[server] service:', SERVICE_NAME)
  console.log('[server] revealServer:', REVEAL_SERVER)
}

main().catch(error => {
  console.error('[server] fatal error:', error)
  process.exit(1)
})
