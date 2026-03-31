import GhostMesh from './src/ghostmesh.ts'

const { createApp, reactive, computed, onMounted, nextTick } = window.Vue

// Default tracker list used by the demo app.
const DEFAULT_TRACKERS = [
  'wss://tracker.openwebtorrent.com',
]

// Default WebRTC connectivity options for the demo.
const DEFAULT_RTC_CONFIG = {
  iceServers: [
    {
      urls: 'stun:stun.relay.metered.ca:80'
    },
    {
      urls: 'turn:standard.relay.metered.ca:80',
      username: '52b28bc12dccae2cb3574a93',
      credential: '0KHzGMSQlDdMkruH'
    },
    {
      urls: 'turn:standard.relay.metered.ca:80?transport=tcp',
      username: '52b28bc12dccae2cb3574a93',
      credential: '0KHzGMSQlDdMkruH'
    },
    {
      urls: 'turn:standard.relay.metered.ca:443',
      username: '52b28bc12dccae2cb3574a93',
      credential: '0KHzGMSQlDdMkruH'
    },
    {
      urls: 'turns:standard.relay.metered.ca:443?transport=tcp',
      username: '52b28bc12dccae2cb3574a93',
      credential: '0KHzGMSQlDdMkruH'
    }
  ]
}

const DIRECT_ACK = 'chat-direct-ack'

const EXAMPLE_SERVER_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
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

const EXAMPLE_SERVER_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyKXRLRFQgICI0rp1gYzN
YFNA+iFrQyjWRDTec9uEEKHgc1IevnlqzDxPoaQP1j09AjO3EAHpnNg4TFjb7VIm
A/UhP0iDtuPIretBED2oz+FzAe3hPZFN+L6HFbKZnpZs/kniyX4ys4L8FAX1CRsk
JTG9buIEgiskIqOaw6vso8afOC1+A7Grlz8SXvZ/ZJzkx30BA4z/ryXZrGN2eiML
y47ihLh/8TiARowgVIgRPJLRXp7yoJHoxs74DbzEGWZ5GkdJBne6SKll55oC/81X
iBHkQDu5YfYeoVsjPue18zKj0BHDjMtnxXh6ldLqaGcCSlQSAtl+GhMX0syYaTM/
sQIDAQAB
-----END PUBLIC KEY-----`

const EXAMPLE_CLIENT_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDhzHot9Apc2YFs
QW6Rz66RE8goNNzzfzarK3HGxC3A683u+ahljorX64YQf91EW1OIIO8D0klvnmPl
GzgBXZ1uD9j7ZOlChh5VkCKZBI2gdE/xOL5/l/Me5PMRAKlGmN66T3lXLbVlAHr0
eyerf84ZWsDbS2sfTBmO4nfr6jjBmw1adVlnaJyhsTVi/H4muZHSVJjBgOkUW52R
HEv3o6vM+5w6wOZjzh/rfxSuzcXau6bKVL0Za7J73Kg0xeutw54TOTSfoXuhKybL
+T8BryGtL2skshX8hGuAVNXQfllrSQyZ3SbAcDl923tHXEsxTlMkO/9KiQxoPauG
zo2TF7lhAgMBAAECggEAK/UpQgH09H95hTA1zNggFWlC+aTU8OhupaMXCsmNWLXv
SNs8j8zQtdlJp7OkyVZ4LBOxRE6vcjXlH6iNXiKx78fRB5vtF0DR7flZ6u0qfza1
i3HvEBruPzD2KvS0f6RqE9498p1Y53lQ9oB1SBtg7amvyuFjUNv5S8pF610VQIdH
voz9qf1tnFk9G2bASOgZ5VrtKDf9wZVOmleSkPob5s415h/KMwFGkijbUMdg+DOi
JqMyUBQ1MjIYGIbmQ1EpOc5VRvIXwoL0eUx0YQADqWEMi4t9gl0LC7csJQAXZZIs
MrWDpHy2kwAIoUP27v2vLhEAqx9ejTwy7G6YjJ3rQwKBgQD7Fj5bytU4dqAneSFK
+h7+yZcEc1C3UoueBY7eLhDWzMcTOeI+AXA/Mm9H/P28JMeJ/3Ud4AjGiRmGOJvD
HiePrar10wDdOs1G7JNk/1WmhkZ/k0JNG+ATlB42TaKL+jbcI7WPYQP4IrFCm0nq
nEoMJA27KkkBK2r09ptqx2grswKBgQDmN48fQtfNEqPzldjCHVEHpKEoLAO17JHi
E5wtstirv68MXNL5MLnsu66BL+M0ggXsVHZxI6VAUFHcE3CzjBmIPg5wdGn8zcmn
fBjrKmvteYslzhe1Qb7pUaXbRX6z5UbDrmSKuMFhS59UFcXI840Ea3mV6y1mZBr+
i0X8xzOsmwKBgQD1zbrSZekC067Jtd2P5vi8+WDsLG/SZ+7ijhJlE7fMcMBa5AnG
JeZbF+a1FMjZjTACuqFO0+oDYmgoa/agtz6He76n1R89dLlNO4C4GPcihMUzU1hO
4IEm6ZQCGVKNsjBOpm6xpIocOupJiHh+Qu6CoDEJD8ZUbMrScTGJARnL3QKBgGDG
7lV35fwBYAaf8XT4mf2aiVy30/+AKXtePwM+8bKRa+bIhq/WefI4m40XMm36Ur8c
aoX5NBirKx5W1cPEm18Ypz1C0uNBJwpPMrJ5LNGxjHsh/flmX/j5J73bov3A3lSY
VQ+zxyc9gQb5+CEXsSowe/Y33Of0IRzsM0ml++UNAoGBALikXIyLFyU/h0Ayyiwy
RCFrTJHQIrzVjHE0GIrfWLKgLkfGDH2KRdtx4kbUWh0Gj1PfOJXysKe99dxNs1T9
qu8jhhgs+DqIz3q7fJK+kEWW4ppN1oUto0JXGcstn8JVCNH3vzCzBhPrVShvzeKW
ocYY3TBr4avdtmNQOViW86J+
-----END PRIVATE KEY-----`

const EXAMPLE_CLIENT_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4cx6LfQKXNmBbEFukc+u
kRPIKDTc8382qytxxsQtwOvN7vmoZY6K1+uGEH/dRFtTiCDvA9JJb55j5Rs4AV2d
bg/Y+2TpQoYeVZAimQSNoHRP8Ti+f5fzHuTzEQCpRpjeuk95Vy21ZQB69Hsnq3/O
GVrA20trH0wZjuJ36+o4wZsNWnVZZ2icobE1Yvx+JrmR0lSYwYDpFFudkRxL96Or
zPucOsDmY84f638Urs3F2rumylS9GWuye9yoNMXrrcOeEzk0n6F7oSsmy/k/Aa8h
rS9rJLIV/IRrgFTV0H5Za0kMmd0mwHA5fdt7R1xLMU5TJDv/SokMaD2rhs6Nkxe5
YQIDAQAB
-----END PUBLIC KEY-----`

// Small helper for stable UI ids when randomUUID is unavailable.
function generateId () {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

function shortPeerId (peerId) {
  if (!peerId) return 'Unknown'
  return `${peerId.slice(0, 10)}…${peerId.slice(-6)}`
}

function timestamp () {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function formatBytes (bytes) {
  if (!Number.isFinite(bytes) || bytes < 1024) {
    return `${bytes || 0} B`
  }

  const units = ['KB', 'MB', 'GB']
  let value = bytes
  let unit = 'B'

  for (const candidate of units) {
    value /= 1024
    unit = candidate
    if (value < 1024) {
      break
    }
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`
}

function toBase64 (bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(view).toString('base64')
  }

  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < view.length; offset += chunkSize) {
    binary += String.fromCharCode(...view.subarray(offset, offset + chunkSize))
  }

  return btoa(binary)
}

function toPem (buffer, label) {
  const base64 = toBase64(buffer)
  const lines = base64.match(/.{1,64}/g) ?? []
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`
}

async function generateRsaPemKeyPair () {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto is not available in this browser')
  }

  const pair = await globalThis.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['encrypt', 'decrypt']
  )

  const [publicKey, privateKey] = await Promise.all([
    globalThis.crypto.subtle.exportKey('spki', pair.publicKey),
    globalThis.crypto.subtle.exportKey('pkcs8', pair.privateKey)
  ])

  return {
    publicKeyPem: toPem(publicKey, 'PUBLIC KEY'),
    privateKeyPem: toPem(privateKey, 'PRIVATE KEY')
  }
}

function parseJsonOrText (value) {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) {
    return {}
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    return {
      text: trimmed
    }
  }
}

function canStreamVideo (mimeType) {
  return typeof MediaSource !== 'undefined' &&
    Boolean(mimeType) &&
    MediaSource.isTypeSupported(mimeType)
}

function isMp4FileName (fileName) {
  return typeof fileName === 'string' && fileName.toLowerCase().endsWith('.mp4')
}

function shouldRenderVideo (transfer) {
  if (!transfer) {
    return false
  }

  return canStreamVideo(transfer.mimeType) || isMp4FileName(transfer.name)
}

function isImageFileName (fileName) {
  return typeof fileName === 'string' && /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(fileName)
}

function shouldRenderImage (transfer) {
  if (!transfer) {
    return false
  }

  return transfer.mimeType?.startsWith('image/') || isImageFileName(transfer.name)
}

function isVideoTransfer (transfer) {
  return shouldRenderVideo(transfer)
}

function isImageTransfer (transfer) {
  return shouldRenderImage(transfer)
}

createApp({
  setup () {
    // Reactive state that drives the whole demo UI.
    const state = reactive({
      identifier: 'ghostmesh-demo',
      trackersText: DEFAULT_TRACKERS.join('\n'),
      peerId: '',
      selectedPeerId: '',
      relayPeerId: '',
      uiMode: 'chat',
      deliveryMode: 'direct',
      hops: 2,
      draft: '',
      selectedFile: null,
      selectedFileName: '',
      hiddenRole: 'client',
      hiddenServiceName: 'directory',
      hiddenEntryPeerId: '',
      hiddenMasterPeerId: '',
      hiddenPublicKey: EXAMPLE_SERVER_PUBLIC_KEY,
      hiddenPrivateKey: EXAMPLE_CLIENT_PRIVATE_KEY,
      hiddenRequestPayload: '{\n  "action": "lookup",\n  "username": "alice"\n}',
      hiddenResponseText: '',
      hiddenStatus: 'Configure this node as client or server.',
      trackerStats: {
        connected: 0,
        total: DEFAULT_TRACKERS.length
      },
      trackers: [],
      peers: [],
      messages: [],
      transfers: [],
      events: [],
      started: false
    })

    let gmesh = null
    const announcedConnectedPeers = new Set()

    // Keep the textarea model editable while still storing it in one place.
    const trackersInput = computed({
      get: () => state.trackersText,
      set: value => {
        state.trackersText = value
      }
    })

    const peerOptions = computed(() => {
      return state.peers.map(peer => ({
        id: peer.id,
        shortId: shortPeerId(peer.id),
        label: shortPeerId(peer.id)
      }))
    })

    const relayOptions = computed(() => {
      return peerOptions.value.filter(peer => peer.id !== state.selectedPeerId)
    })

    const connectedPeerCount = computed(() => state.peers.length)

    const trackerSummary = computed(() => {
      return `${state.trackerStats.connected}/${state.trackerStats.total} tracker connections`
    })

    const isChatMode = computed(() => state.uiMode === 'chat')
    const isClientServerMode = computed(() => state.uiMode === 'client-server')

    const experienceTitle = computed(() => {
      return isChatMode.value ? 'Simple Chat' : 'Client x Server'
    })

    const experienceSummary = computed(() => {
      if (isChatMode.value) {
        return 'Pick a peer, send messages or files, and optionally switch to relay or onion delivery.'
      }

      return 'Use one tab as the server and another as the client to test the hidden-service request flow.'
    })

    const quickSteps = computed(() => {
      if (isChatMode.value) {
        return [
          'Open this page in two tabs with the same identifier.',
          'Select a target peer from the list.',
          'Send a message or choose a file to transfer.'
        ]
      }

      return [
        'Open two tabs with the same identifier.',
        'Set one tab to Server and load the server keys.',
        'Set the other tab to Client, choose an entry client and the server peer, then request the service.'
      ]
    })

    const deliverySummary = computed(() => {
      if (!state.selectedPeerId) {
        return 'Choose a target peer first'
      }

      if (state.deliveryMode === 'direct') {
        return `Direct to ${shortPeerId(state.selectedPeerId)}`
      }

      if (state.deliveryMode === 'relay') {
        return state.relayPeerId
          ? `Relay via ${shortPeerId(state.relayPeerId)}`
          : 'Choose one relay peer'
      }

      return `${Math.max(1, Number(state.hops) || 1)} random hop(s) before ${shortPeerId(state.selectedPeerId)}`
    })

    const canSend = computed(() => {
      if (!state.started || !state.selectedPeerId || !state.draft.trim()) {
        return false
      }

      if (state.deliveryMode === 'relay') {
        return Boolean(state.relayPeerId)
      }

      return true
    })

    const canSendFile = computed(() => {
      return state.started && Boolean(state.selectedPeerId) && Boolean(state.selectedFile)
    })

    const orderedTransfers = computed(() => [...state.transfers].reverse())

    const statusLine = computed(() => {
      if (isClientServerMode.value) {
        if (!state.started) {
          return 'Starting GhostMesh session...'
        }

        if (state.peers.length === 0) {
          return 'Waiting for another tab to connect so you can test client and server roles.'
        }

        if (state.hiddenRole === 'master') {
          return canApplyHiddenConfig.value
            ? 'Server is ready to apply configuration.'
            : 'Load or paste the server private key to continue.'
        }

        if (!state.hiddenEntryPeerId) {
          return 'Pick one connected client as the entry hop.'
        }

        if (!state.hiddenMasterPeerId) {
          return 'Pick the server peer that will answer requests.'
        }

        return 'Client flow ready. Apply the role and request the service.'
      }

      if (!state.started) {
        return 'Starting GhostMesh session...'
      }

      if (state.peers.length === 0) {
        return 'Waiting for peers. Open another tab with the same identifier.'
      }

      if (!state.selectedPeerId) {
        return 'Select a target peer to start chatting.'
      }

      if (state.deliveryMode === 'relay' && !state.relayPeerId) {
        return 'Relay mode needs one intermediate peer.'
      }

      return 'Ready to send.'
    })

    const hiddenRoleSummary = computed(() => {
      if (state.hiddenRole === 'master') {
        return 'Acts as the hidden central server and decrypts requests with the private key.'
      }

      return 'Acts as a client and also forwards encrypted hidden-service traffic to the configured server for other clients.'
    })

    const canApplyHiddenConfig = computed(() => {
      if (!state.started) {
        return false
      }

      if (state.hiddenRole === 'master') {
        return Boolean(state.hiddenPrivateKey.trim() && state.hiddenServiceName.trim())
      }

      return Boolean(state.hiddenMasterPeerId && state.hiddenPublicKey.trim() && state.hiddenServiceName.trim())
    })

    const canRequestHiddenService = computed(() => {
      return state.started &&
        state.hiddenRole === 'client' &&
        Boolean(state.hiddenEntryPeerId) &&
        Boolean(state.hiddenPublicKey.trim()) &&
        Boolean(state.hiddenServiceName.trim())
    })

    function parseTrackers () {
      return state.trackersText
        .split('\n')
        .map(item => item.trim())
        .filter(Boolean)
    }

    function syncPeers () {
      // Mirror GhostMesh internal peers into the simpler UI model.
      if (!gmesh) {
        state.peers = []
        return
      }

      state.peers = Object.keys(gmesh.peers)
        .filter(peerId => {
          const channels = gmesh.peers[peerId]
          return Object.values(channels ?? {}).some(peer => peer.connected)
        })
        .filter(peerId => peerId !== state.peerId)
        .map(peerId => ({ id: peerId }))

      if (!state.peers.some(peer => peer.id === state.selectedPeerId)) {
        state.selectedPeerId = state.peers[0]?.id ?? ''
      }

      if (!state.peers.some(peer => peer.id === state.relayPeerId) || state.relayPeerId === state.selectedPeerId) {
        state.relayPeerId = relayOptions.value[0]?.id ?? ''
      }
    }

    function appendMessage (entry) {
      state.messages.push({
        id: generateId(),
        timestamp: timestamp(),
        ...entry
      })
    }

    function appendTransfer (entry) {
      state.transfers.push({
        id: entry.transferId,
        status: 'pending',
        receivedBytes: 0,
        objectUrl: null,
        previewUrl: null,
        ...entry
      })
    }

    function updateTransfer (transferId, patch) {
      const transfer = state.transfers.find(item => item.id === transferId)
      if (!transfer) {
        return
      }

      Object.assign(transfer, patch)
    }

    function findTransfer (transferId) {
      return state.transfers.find(item => item.id === transferId) ?? null
    }

    function findPeer (peerId) {
      // Prefer an already-connected channel when a peer has multiple channels.
      const channels = gmesh?.peers?.[peerId]
      if (!channels) return null

      return Object.values(channels).find(peer => peer.connected) ?? Object.values(channels)[0] ?? null
    }

    function registerIncomingChat (mode, viaPeerId, payload, route) {
      appendMessage({
        direction: 'incoming',
        mode,
        text: payload.text,
        circuitId: route?.circuitId ?? null,
        meta: `from ${shortPeerId(payload.from)}${viaPeerId ? ` via ${shortPeerId(viaPeerId)}` : ''}`
      })
    }

    function handleDirectMessage (peer, payload) {
      // Direct messages use the normal GhostMesh request/response flow.
      if (!payload || payload.kind !== 'chat-direct') {
        return false
      }

      registerIncomingChat('direct', null, payload)
      peer.respond({
        kind: DIRECT_ACK,
        messageId: payload.messageId
      }).catch(() => {})
      return true
    }

    function handleOnionMessage (peer, payload, route) {
      // Routed messages arrive through the onion/relay path.
      if (!payload || payload.kind !== 'chat-onion') {
        return
      }

      const mode = payload.deliveryMode === 'relay' ? 'relay' : 'onion'
      registerIncomingChat(mode, peer.id, payload, route)
      peer.respond({
        kind: DIRECT_ACK,
        messageId: payload.messageId
      }).catch(() => {})
    }

    function requestPeers () {
      if (!gmesh) return
      gmesh.requestMorePeers()
    }

    async function generateHiddenKeyPair () {
      try {
        const pair = await generateRsaPemKeyPair()
        state.hiddenPublicKey = pair.publicKeyPem
        state.hiddenPrivateKey = pair.privateKeyPem
        state.hiddenStatus = 'RSA key pair generated in the browser.'
      } catch (error) {
        state.hiddenStatus = error.message
      }
    }

    function loadExampleServerKeys () {
      state.hiddenPublicKey = EXAMPLE_SERVER_PUBLIC_KEY
      state.hiddenPrivateKey = EXAMPLE_SERVER_PRIVATE_KEY
      state.hiddenStatus = 'Loaded example server key pair.'
    }

    function loadExampleClientKeys () {
      state.hiddenPublicKey = EXAMPLE_CLIENT_PUBLIC_KEY
      state.hiddenPrivateKey = EXAMPLE_CLIENT_PRIVATE_KEY
      state.hiddenStatus = 'Loaded example client key pair.'
    }

    function useSelectedPeerAsEntry () {
      state.hiddenEntryPeerId = state.selectedPeerId
    }

    function useSelectedPeerAsMaster () {
      state.hiddenMasterPeerId = state.selectedPeerId
    }

    function applyHiddenServiceConfig () {
      if (!gmesh) {
        return
      }

      const serviceName = state.hiddenServiceName.trim()
      const commonHiddenOptions = {
        serviceName,
        minHops: 3,
        responseDelayMs: [1000, 5000],
        fixedPacketBytes: 4096
      }

      if (state.hiddenRole === 'master') {
        gmesh.setOptions({
          identity: {
            role: 'master',
            privateKey: state.hiddenPrivateKey.trim()
          },
          hiddenService: {
            ...commonHiddenOptions,
            role: 'master'
          }
        })

        gmesh.handleHiddenService(serviceName, async (payload, context) => {
          appendMessage({
            direction: 'incoming',
            mode: 'hidden-master',
            text: `Hidden request for "${serviceName}"`,
            circuitId: null,
            meta: `request ${context.requestId} from ${shortPeerId(context.peer.id)}`
          })

          return {
            ok: true,
            service: serviceName,
            masterPeerId: state.peerId,
            requestId: context.requestId,
            receivedAt: new Date().toISOString(),
            payload
          }
        })

        state.hiddenStatus = `Master configured for "${serviceName}".`
        return
      }

      gmesh.setOptions({
        identity: state.hiddenPrivateKey.trim() || state.hiddenPublicKey.trim()
          ? {
              role: 'client',
              publicKey: state.hiddenPublicKey.trim() || undefined,
              privateKey: state.hiddenPrivateKey.trim() || undefined
            }
          : {
              role: 'client'
            },
        hiddenService: {
          ...commonHiddenOptions,
          entryPeers: state.hiddenEntryPeerId ? [state.hiddenEntryPeerId] : [],
          services: {
            [serviceName]: state.hiddenMasterPeerId
          },
          masterPeerId: state.hiddenMasterPeerId,
          masterPublicKey: state.hiddenPublicKey.trim()
        }
      })

      state.hiddenStatus = state.hiddenEntryPeerId
        ? `Client configured. Server: ${shortPeerId(state.hiddenMasterPeerId)}. Entry for requests: ${shortPeerId(state.hiddenEntryPeerId)}.`
        : `Client configured to forward "${serviceName}" to server ${shortPeerId(state.hiddenMasterPeerId)}.`
    }

    async function requestHiddenServiceDemo () {
      if (!gmesh || !canRequestHiddenService.value) {
        return
      }

      try {
        applyHiddenServiceConfig()
        const payload = parseJsonOrText(state.hiddenRequestPayload)
        const response = await gmesh.requestHiddenService(state.hiddenServiceName.trim(), payload, {
          entryPeerId: state.hiddenEntryPeerId,
          masterPublicKey: state.hiddenPublicKey.trim()
        })

        state.hiddenResponseText = JSON.stringify(response, null, 2)
        state.hiddenStatus = 'Hidden service request completed.'
        appendMessage({
          direction: 'outgoing',
          mode: 'hidden-client',
          text: `Requested hidden service "${state.hiddenServiceName.trim()}"`,
          circuitId: null,
          meta: `entry ${shortPeerId(state.hiddenEntryPeerId)}`
        })
      } catch (error) {
        state.hiddenStatus = error.message
        state.hiddenResponseText = ''
        appendMessage({
          direction: 'incoming',
          mode: 'system',
          text: error.message,
          circuitId: null,
          meta: 'hidden service failed'
        })
      }
    }

    function currentOnionOptions () {
      // The UI exposes one delivery selector, which we translate into GhostMesh options.
      if (state.deliveryMode === 'direct') {
        return false
      }

      if (state.deliveryMode === 'relay') {
        return {
          through: [state.relayPeerId]
        }
      }

      return {
        hops: Math.max(1, Number(state.hops) || 1)
      }
    }

    function applyDeliveryOptions () {
      // Apply transport + routing defaults before each send in case the UI changed.
      if (!gmesh) {
        return
      }

      gmesh.setOptions({
        ...DEFAULT_RTC_CONFIG,
        timeout: 60_000,
        onion: currentOnionOptions()
      })
    }

    function onFileSelected (event) {
      state.selectedFile = event.target.files?.[0] ?? null
      state.selectedFileName = state.selectedFile ? `${state.selectedFile.name} (${formatBytes(state.selectedFile.size)})` : ''
    }

    async function attachSessionPreview (session) {
      // Attach media previews only after Vue has rendered the target element.
      await nextTick()

      const mediaId = `transfer-media-${session.transferId}`
      const element = document.getElementById(mediaId)
      if (!element) {
        return
      }

      try {
        if (element instanceof HTMLMediaElement) {
          // Videos/audio stream progressively when possible.
          void session.streamTo(element)
          return
        }

        await session.streamTo(element)

        if (element instanceof HTMLImageElement) {
          updateTransfer(session.transferId, {
            imageUrl: element.src
          })
        }
      } catch (error) {
        updateTransfer(session.transferId, {
          previewError: error.message
        })
      }
    }

    async function sendMessage () {
      if (!canSend.value) {
        return
      }

      const text = state.draft.trim()
      const targetPeerId = state.selectedPeerId
      const messageId = generateId()

      const payload = {
        kind: state.deliveryMode === 'direct' ? 'chat-direct' : 'chat-onion',
        deliveryMode: state.deliveryMode,
        messageId,
        from: state.peerId,
        to: targetPeerId,
        text,
        createdAt: Date.now()
      }

      try {
        const peer = findPeer(targetPeerId)
        if (!peer) {
          throw new Error('Selected peer is not connected')
        }

        // `send()` automatically follows the current delivery options.
        applyDeliveryOptions()
        const [responsePeer] = await gmesh.send(peer, payload)

        appendMessage({
          direction: 'outgoing',
          mode: state.deliveryMode === 'onion'
            ? `onion/${Math.max(1, Number(state.hops) || 1)} hop(s)`
            : state.deliveryMode,
          text,
          circuitId: responsePeer.routeInfo?.circuitId ?? null,
          meta: state.deliveryMode === 'relay'
            ? `to ${shortPeerId(targetPeerId)} via ${shortPeerId(state.relayPeerId)}`
            : `to ${shortPeerId(targetPeerId)}`
        })

        state.draft = ''
      } catch (error) {
        appendMessage({
          direction: 'incoming',
          mode: 'system',
          text: error.message,
          circuitId: null,
          meta: 'send failed'
        })
      }
    }

    async function sendSelectedFile () {
      if (!canSendFile.value) {
        return
      }

      const peer = findPeer(state.selectedPeerId)
      if (!peer) {
        appendMessage({
          direction: 'incoming',
          mode: 'system',
          text: 'Selected peer is not connected',
          circuitId: null,
          meta: 'file send failed'
        })
        return
      }

      try {
        applyDeliveryOptions()
        appendMessage({
          direction: 'incoming',
          mode: 'system',
          text: `Sending file "${state.selectedFile.name}" to ${shortPeerId(state.selectedPeerId)}`,
          circuitId: null,
          meta: 'file transfer'
        })

        // `sendFile()` returns a live FileSession immediately.
        const transfer = await gmesh.sendFile(peer, state.selectedFile, {
          metadata: {
            from: state.peerId
          }
        })

        appendTransfer({
          transferId: transfer.transferId,
          direction: 'outgoing',
          name: transfer.name,
          mimeType: transfer.mimeType,
          size: transfer.size,
          receivedBytes: transfer.receivedBytes,
          status: transfer.status,
          peerId: state.selectedPeerId,
          previewError: null
        })

        // Keep the outgoing transfer card in sync with FileSession events.
        transfer.on('progress', current => {
          updateTransfer(current.transferId, {
            receivedBytes: current.receivedBytes,
            status: current.status
          })
        })

        transfer.on('complete', current => {
          updateTransfer(current.transferId, {
            receivedBytes: current.size,
            status: current.status
          })
        })

        transfer.on('cancel', current => {
          updateTransfer(current.transferId, {
            status: current.status
          })
        })

        transfer.on('error', error => {
          updateTransfer(transfer.transferId, {
            status: 'error',
            previewError: error.message
          })
        })

        state.selectedFile = null
        state.selectedFileName = ''
      } catch (error) {
        appendMessage({
          direction: 'incoming',
          mode: 'system',
          text: error.message,
          circuitId: null,
          meta: 'file send failed'
        })
      }
    }

    async function startSession () {
      const trackers = parseTrackers()
      state.trackers = trackers
      gmesh = new GhostMesh(trackers, state.identifier)
      gmesh.setOptions({
        ...DEFAULT_RTC_CONFIG,
        timeout: 60_000,
        onion: false
      })
      state.peerId = gmesh._peerId

      // Tracker events update the network status line in the UI.
      gmesh.on('trackerconnect', (_, stats) => {
        state.trackerStats = stats
      })

      gmesh.on('trackerwarning', (error, stats) => {
        state.trackerStats = stats
        appendMessage({
          direction: 'incoming',
          mode: 'system',
          text: error.message,
          circuitId: null,
          meta: 'tracker warning'
        })
      })

      gmesh.on('peerconnect', peer => {
        syncPeers()
        if (announcedConnectedPeers.has(peer.id)) {
          return
        }

        announcedConnectedPeers.add(peer.id)
        appendMessage({
          direction: 'incoming',
          mode: 'system',
          text: `Peer connected: ${shortPeerId(peer.id)}`,
          circuitId: null,
          meta: 'network event'
        })
      })

      gmesh.on('peerclose', peer => {
        syncPeers()
        announcedConnectedPeers.delete(peer.id)
        appendMessage({
          direction: 'incoming',
          mode: 'system',
          text: `Peer disconnected: ${shortPeerId(peer.id)}`,
          circuitId: null,
          meta: 'network event'
        })
      })

      // Direct application messages land here.
      gmesh.on('msg', (peer, payload) => {
        if (payload?.kind === DIRECT_ACK) {
          return
        }

        if (!handleDirectMessage(peer, payload)) {
          appendMessage({
            direction: 'incoming',
            mode: 'system',
            text: JSON.stringify(payload),
            circuitId: null,
            meta: `unexpected direct payload from ${shortPeerId(peer.id)}`
          })
        }
      })

      // Routed payloads land here after relay/onion delivery.
      gmesh.on('onionmsg', (peer, payload, route) => {
        handleOnionMessage(peer, payload, route)
      })

      // Incoming files are represented as FileSession instances.
      gmesh.on('file', (peer, session) => {
        appendTransfer({
          transferId: session.transferId,
          direction: 'incoming',
          name: session.name,
          mimeType: session.mimeType,
          size: session.size,
          receivedBytes: 0,
          status: 'receiving',
          peerId: peer.id,
          previewError: null
        })

        if (isVideoTransfer(session) || isImageTransfer(session)) {
          void attachSessionPreview(session)
        }

        session.on('progress', currentSession => {
          updateTransfer(currentSession.transferId, {
            receivedBytes: currentSession.receivedBytes,
            status: currentSession.receivedBytes >= currentSession.size ? 'finalizing' : 'receiving'
          })
        })

        session.on('complete', async currentSession => {
          // Reuse the preview URL when possible to avoid duplicating large blobs.
          const mediaElement = document.getElementById(`transfer-media-${currentSession.transferId}`)
          const previewUrl = mediaElement instanceof HTMLMediaElement
            ? mediaElement.currentSrc || null
            : mediaElement instanceof HTMLImageElement
              ? mediaElement.src || null
              : null
          const shouldKeepPreviewOnly = isVideoTransfer(currentSession) && canStreamVideo(currentSession.mimeType)
          const objectUrl = shouldKeepPreviewOnly
            ? null
            : previewUrl && previewUrl.startsWith('blob:')
              ? previewUrl
              : await currentSession.objectURL()

          updateTransfer(currentSession.transferId, {
            receivedBytes: currentSession.size,
            status: 'complete',
            objectUrl,
            imageUrl: isImageTransfer(currentSession) ? objectUrl : undefined
          })

          appendMessage({
            direction: 'incoming',
            mode: 'system',
            text: `Received file "${currentSession.name}" from ${shortPeerId(peer.id)}`,
            circuitId: null,
            meta: `${formatBytes(currentSession.size)}`
          })
        })

        session.on('error', error => {
          updateTransfer(session.transferId, {
            status: 'error',
            previewError: error.message
          })
        })
      })

      await gmesh.start()
      state.started = true
      syncPeers()
      appendMessage({
        direction: 'incoming',
        mode: 'system',
        text: `Session started with identifier "${state.identifier}"`,
        circuitId: null,
        meta: 'ready'
      })
    }

    onMounted(() => {
      // Start the demo session as soon as the page is mounted.
      startSession()
    })

    return {
      state,
      trackersInput,
      isChatMode,
      isClientServerMode,
      experienceTitle,
      experienceSummary,
      quickSteps,
      peerOptions,
      relayOptions,
      connectedPeerCount,
      trackerSummary,
      deliverySummary,
      canSend,
      canSendFile,
      canApplyHiddenConfig,
      canRequestHiddenService,
      hiddenRoleSummary,
      statusLine,
      orderedTransfers,
      isVideoTransfer,
      isImageTransfer,
      formatBytes,
      requestPeers,
      sendMessage,
      onFileSelected,
      sendSelectedFile,
      generateHiddenKeyPair,
      loadExampleServerKeys,
      loadExampleClientKeys,
      useSelectedPeerAsEntry,
      useSelectedPeerAsMaster,
      applyHiddenServiceConfig,
      requestHiddenServiceDemo
    }
  }
}).mount('#app')
