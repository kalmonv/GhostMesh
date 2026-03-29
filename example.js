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
      deliveryMode: 'direct',
      hops: 2,
      draft: '',
      selectedFileName: '',
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
    let selectedFile = null

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
      return state.started && Boolean(state.selectedPeerId) && Boolean(selectedFile)
    })

    const orderedTransfers = computed(() => [...state.transfers].reverse())

    const statusLine = computed(() => {
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
      selectedFile = event.target.files?.[0] ?? null
      state.selectedFileName = selectedFile ? `${selectedFile.name} (${formatBytes(selectedFile.size)})` : ''
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
          text: `Sending file "${selectedFile.name}" to ${shortPeerId(state.selectedPeerId)}`,
          circuitId: null,
          meta: 'file transfer'
        })

        // `sendFile()` returns a live FileSession immediately.
        const transfer = await gmesh.sendFile(peer, selectedFile, {
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

        selectedFile = null
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
      peerOptions,
      relayOptions,
      connectedPeerCount,
      trackerSummary,
      deliverySummary,
      canSend,
      canSendFile,
      statusLine,
      orderedTransfers,
      isVideoTransfer,
      isImageTransfer,
      formatBytes,
      requestPeers,
      sendMessage,
      onFileSelected,
      sendSelectedFile
    }
  }
}).mount('#app')
