import GhostMesh from '../dist/ghostmesh.js'

const TRACKERS = [
  process.env.GHOSTMESH_TRACKER || 'ws://127.0.0.1:5001'
]

const IDENTIFIER = process.env.GHOSTMESH_IDENTIFIER || 'ghostmesh-demo'
const SERVICE_NAME = process.env.GHOSTMESH_SERVICE || 'directory'
const ENTRY_PEER_ID = process.env.GHOSTMESH_ENTRY_PEER_ID || ''
const SERVER_PEER_ID = process.env.GHOSTMESH_SERVER_PEER_ID || ''

const CLIENT_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4cx6LfQKXNmBbEFukc+u
kRPIKDTc8382qytxxsQtwOvN7vmoZY6K1+uGEH/dRFtTiCDvA9JJb55j5Rs4AV2d
bg/Y+2TpQoYeVZAimQSNoHRP8Ti+f5fzHuTzEQCpRpjeuk95Vy21ZQB69Hsnq3/O
GVrA20trH0wZjuJ36+o4wZsNWnVZZ2icobE1Yvx+JrmR0lSYwYDpFFudkRxL96Or
zPucOsDmY84f638Urs3F2rumylS9GWuye9yoNMXrrcOeEzk0n6F7oSsmy/k/Aa8h
rS9rJLIV/IRrgFTV0H5Za0kMmd0mwHA5fdt7R1xLMU5TJDv/SokMaD2rhs6Nkxe5
YQIDAQAB
-----END PUBLIC KEY-----`

const SERVER_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyKXRLRFQgICI0rp1gYzN
YFNA+iFrQyjWRDTec9uEEKHgc1IevnlqzDxPoaQP1j09AjO3EAHpnNg4TFjb7VIm
A/UhP0iDtuPIretBED2oz+FzAe3hPZFN+L6HFbKZnpZs/kniyX4ys4L8FAX1CRsk
JTG9buIEgiskIqOaw6vso8afOC1+A7Grlz8SXvZ/ZJzkx30BA4z/ryXZrGN2eiML
y47ihLh/8TiARowgVIgRPJLRXp7yoJHoxs74DbzEGWZ5GkdJBne6SKll55oC/81X
iBHkQDu5YfYeoVsjPue18zKj0BHDjMtnxXh6ldLqaGcCSlQSAtl+GhMX0syYaTM/
sQIDAQAB
-----END PUBLIC KEY-----`

async function main () {
  if (!ENTRY_PEER_ID) {
    throw new Error('Set GHOSTMESH_ENTRY_PEER_ID with the entry peer id')
  }

  if (!SERVER_PEER_ID) {
    throw new Error('Set GHOSTMESH_SERVER_PEER_ID with the server peer id')
  }

  const gmesh = new GhostMesh(TRACKERS, IDENTIFIER)

  gmesh.setOptions({
    timeout: 60_000,
    identity: {
      role: 'client',
      publicKey: CLIENT_PUBLIC_KEY_PEM
    },
    hiddenService: {
      serviceName: SERVICE_NAME,
      entryPeers: [ENTRY_PEER_ID],
      masterPeerId: SERVER_PEER_ID,
      masterPublicKey: SERVER_PUBLIC_KEY_PEM,
      fixedPacketBytes: 4096
    }
  })

  gmesh.on('peerconnect', peer => {
    console.log('[client] peer connected:', peer.id)
  })

  gmesh.on('peerclose', peer => {
    console.log('[client] peer disconnected:', peer.id)
  })

  await gmesh.start()

  console.log('[client] started')
  console.log('[client] identifier:', IDENTIFIER)
  console.log('[client] peer id:', gmesh._peerId)
  console.log('[client] entry peer:', ENTRY_PEER_ID)
  console.log('[client] server peer:', SERVER_PEER_ID)

  const response = await gmesh.requestHiddenService(SERVICE_NAME, {
    action: 'lookup',
    username: 'alice'
  }, {
    entryPeerId: ENTRY_PEER_ID,
    masterPublicKey: SERVER_PUBLIC_KEY_PEM
  })

  console.log('[client] hidden response:')
  console.log(JSON.stringify(response, null, 2))
}

main().catch(error => {
  console.error('[client] fatal error:', error)
  process.exit(1)
})
