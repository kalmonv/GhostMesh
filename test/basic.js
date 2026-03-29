import test from './utils.js'

const GhostMesh = (await import('../src/ghostmesh.ts')).default

const announceURLs = [
  'ws://localhost:5000'
]

// WebSocketTracker keeps same copy of WebSocket connection to
// same URL, to avoid that we add a / to trick it as another server
const announceURLsSet2 = [
  'ws://localhost:5000/'
]

const announceURLs1 = [
  'ws://localhost:5001'
]

test('character message', function (t) {
  const p2pt1 = new GhostMesh(announceURLs, 'p2pt')
  const p2pt2 = new GhostMesh(announceURLsSet2, 'p2pt')

  p2pt1.on('peerconnect', (peer) => {
    p2pt1.send(peer, 'hello')
  })

  p2pt2.on('msg', (peer, msg) => {
    t.equal(msg, 'hello')

    p2pt1.destroy()
    p2pt2.destroy()
    t.end()
  })

  p2pt1.start()
  p2pt2.start()
})

test('chained messages', function (t) {
  const p2pt1 = new GhostMesh(announceURLs, 'p2pt')
  const p2pt2 = new GhostMesh(announceURLsSet2, 'p2pt')

  p2pt1.on('peerconnect', (peer) => {
    p2pt1
      .send(peer, 'hello')
      .then(([peer, msg]) => {
        t.equal(msg, 'hi')
        return peer.respond('how are you ?')
      })
      .then(([peer, msg]) => {
        t.equal(msg, 'fine')
        return peer.respond('byeee')
      })
      .then(([peer, msg]) => {
        t.equal(msg, 'bye!')

        p2pt1.destroy()
        p2pt2.destroy()

        t.end()
      })
  })

  p2pt2.on('msg', (peer, msg) => {
    if (msg === 'hello') {
      t.equal(msg, 'hello')
      peer
        .respond('hi')
        .then(([peer, msg]) => {
          t.equal(msg, 'how are you ?')
          return peer.respond('fine')
        })
        .then(([peer, msg]) => {
          t.equal(msg, 'byeee')
          return peer.respond('bye!')
        })
    }
  })

  p2pt1.start()
  setTimeout(() => { p2pt2.start() }, 1000)
})

test('tracker connections', function (t) {
  const p2pt1 = new GhostMesh(announceURLs, 'p2pt')
  const p2pt2 = new GhostMesh(['ws://127.0.0.1:404'], 'p2pt')

  p2pt1.on('trackerconnect', (tracker, status) => {
    t.equal(tracker.announceUrl, announceURLs[0])

    t.equal(status.connected, 1)
    t.equal(status.total, 1)

    p2pt1.destroy()
    p2pt2.start()
  })

  p2pt2.on('trackerwarning', (error, status) => {
    t.match(error.message, /error(.*?)ws:\/\/127\.0\.0\.1:404/gi)

    t.equal(status.connected, 0)
    t.equal(status.total, 1)

    p2pt2.destroy()

    t.end()
  })

  p2pt1.start()
})

test('peer connections', function (t) {
  // Different trackers will give same peer with same ID, but different data channels.
  // "peer" is essentially a "data channel".
  // This test will check if the second data channel is used if first is closed.

  const twoTrackers = [announceURLs[0], announceURLs1[0]]
  
  const p2pt1 = new GhostMesh(twoTrackers, 'p2pt')
  const p2pt2 = new GhostMesh(twoTrackers, 'p2pt')

  let peerCloseEvents = 0

  const endTest = () => {
    if (peerCloseEvents === 2) {
      p2pt1.destroy()
      p2pt2.destroy()
      t.end()
    }
  }

  p2pt1.on('peerclose', (peer) => {
    t.pass('Close event emitted on p2ptp1')
    peerCloseEvents++

    endTest()
  })

  p2pt2.on('peerclose', (peer) => {
    t.pass('Close event emitted on p2ptp2')
    peerCloseEvents++

    endTest()
  })

  p2pt1.on('msg', (peer, msg) => {
    if (msg === 'hello') {
      // Received by second channel
      t.pass('Received by second channel')
      peer.destroy()
    }
  })

  const interval = setInterval(() => {
    const peerId = Object.keys(p2pt2.peers)[0]
    const numberOfDataChannels = Object.keys(p2pt2.peers[peerId] ?? {}).length

    if (numberOfDataChannels === 2) {
      const channel1 = p2pt2.peers[peerId][Object.keys(p2pt2.peers[peerId])[0]]
      channel1.destroy()

      setTimeout(() => {
        // This is inside a timeout to ensure that the channel is destroyed before sending.
        // There's a logic in simple-peer to not destroy channel until all data is sent.
        // If we call send instantly, it might get queued to be sent via channel 1 itself.

        p2pt2.send(channel1, 'hello') // The other channel will be used to send by p2pt automatically
      }, 1000)

      clearInterval(interval)
    }
  }, 100)

  p2pt1.start()
  p2pt2.start()
})


test('tracker addition', function (t) {
  const p2pt1 = new GhostMesh(announceURLs, 'p2pt')
  const p2pt2 = new GhostMesh(announceURLs1, 'p2pt')

  p2pt1.on('peerconnect', (peer) => {
    t.pass('Connect event emitted')

    p2pt1.destroy()
    p2pt2.destroy()
    t.end()
  })

  p2pt1.start()
  p2pt2.start()

  // let 1st p2pt1 know of tracker p2pt2 is using
  setTimeout(() => { p2pt1.addTracker(announceURLs1[0]) }, 1000)
})

test('tracker removal', function (t) {
  const p2pt1 = new GhostMesh(announceURLs, 'p2pt')
  const p2pt2 = new GhostMesh(announceURLsSet2, 'p2pt')

  p2pt1.on('msg', (peer, msg) => {
    if (msg === 'hello') {
      t.pass('Connection remained after tracker removal')

      p2pt1.destroy()
      p2pt2.destroy()
      t.end()
    }
  })

  p2pt2.on('peerconnect', peer => {
    p2pt2.removeTracker(announceURLsSet2[0])

    setTimeout(() => {
      p2pt2.send(peer, 'hello')
    }, 1000)
  })

  p2pt1.start()
  p2pt2.start()
})

test('onion routing', function (t) {
  const p2pt1 = new GhostMesh(announceURLs, 'p2pt-onion')
  const p2pt2 = new GhostMesh(announceURLsSet2, 'p2pt-onion')
  const p2pt3 = new GhostMesh(announceURLs1, 'p2pt-onion')

  const interval = setInterval(() => {
    const p1HasP2 = Boolean(p2pt1.peers[p2pt2._peerId])
    const p1HasP3 = Boolean(p2pt1.peers[p2pt3._peerId])
    const p2HasP3 = Boolean(p2pt2.peers[p2pt3._peerId])

    if (p1HasP2 && p1HasP3 && p2HasP3) {
      clearInterval(interval)

      p2pt1.sendOnion(
        p2pt3._peerId,
        { hello: 'through relay' },
        { through: [p2pt2._peerId] }
      )
    }
  }, 100)

  p2pt3.on('onionmsg', (peer, msg, route) => {
    t.equal(peer.id, p2pt2._peerId, 'Onion message delivered by the relay peer')
    t.equal(msg.hello, 'through relay', 'Onion payload delivered to the target peer')
    t.ok(typeof route.circuitId === 'string', 'Onion route exposes a circuit identifier')

    clearInterval(interval)
    p2pt1.destroy()
    p2pt2.destroy()
    p2pt3.destroy()
    t.end()
  })

  p2pt1.start()
  p2pt2.start()
  p2pt3.start()
})

test('setOptions routed send with reply route', function (t) {
  const p2pt1 = new GhostMesh(announceURLs, 'p2pt-options')
  const p2pt2 = new GhostMesh(announceURLsSet2, 'p2pt-options')
  const p2pt3 = new GhostMesh(announceURLs1, 'p2pt-options')

  p2pt1.setOptions({
    timeout: 60_000,
    onion: {
      through: [p2pt2._peerId]
    }
  })

  const interval = setInterval(() => {
    const p1HasP2 = Boolean(p2pt1.peers[p2pt2._peerId])
    const p1HasP3 = Boolean(p2pt1.peers[p2pt3._peerId])
    const p2HasP3 = Boolean(p2pt2.peers[p2pt3._peerId])

    if (p1HasP2 && p1HasP3 && p2HasP3) {
      clearInterval(interval)

      const peer = p2pt1.peers[p2pt3._peerId][Object.keys(p2pt1.peers[p2pt3._peerId])[0]]
      p2pt1.send(peer, { hello: 'auto route' }).then(([responsePeer, msg]) => {
        t.equal(responsePeer.id, p2pt3._peerId, 'Response resolves to the destination peer id')
        t.equal(msg.hello, 'auto reply', 'Reply returned through the reverse route')

        p2pt1.destroy()
        p2pt2.destroy()
        p2pt3.destroy()
        t.end()
      })
    }
  }, 100)

  p2pt3.on('msg', (peer, msg) => {
    if (msg.hello === 'auto route') {
      t.equal(peer.id, p2pt1._peerId, 'Routed peer exposes the origin peer id')
      peer.respond({ hello: 'auto reply' })
    }
  })

  p2pt1.start()
  p2pt2.start()
  p2pt3.start()
})
