# GhostMesh

GhostMesh is a WebRTC P2P messaging and file-transfer library that uses WebTorrent-style WebSocket trackers as the signaling layer.

The main class is `GhostMesh`. A `P2PT` alias is still exported for backward compatibility.

It works in:

* browsers
* Node.js
* TypeScript projects

## Overview

GhostMesh helps you:

* discover peers through WebSocket trackers
* exchange direct messages and JSON payloads
* send large messages with automatic chunking
* send files with progress tracking through `FileSession`
* stream media progressively in the browser
* configure STUN and TURN servers with `setOptions()`
* use relay or lightweight onion-style multi-hop routing
* expose a hidden master service through entry peers with encrypted request/response payloads

## Installation

### npm

```bash
npm install ghostmesh
```

### Node.js WebRTC support

If you want to run GhostMesh in Node.js, also install the optional WebRTC package:

```bash
npm install ghostmesh @roamhq/wrtc
```

GhostMesh loads `@roamhq/wrtc` automatically when `start()` runs in Node.js.

## CDN

### jsDelivr from GitHub

```html
<script src="https://cdn.jsdelivr.net/gh/kalmonv/GhostMesh/dist/ghostmesh.iife.js"></script>
```

### jsDelivr from npm

```html
<script src="https://cdn.jsdelivr.net/npm/ghostmesh@1.0.1/dist/ghostmesh.iife.js"></script>
```

When using the IIFE build in the browser, the constructor is exposed directly as `window.GhostMesh`:

```html
<script src="https://cdn.jsdelivr.net/npm/ghostmesh@1.0.1/dist/ghostmesh.iife.js"></script>
<script>
  const gmesh = new GhostMesh(['wss://tracker.openwebtorrent.com'], 'my-app')
</script>
```

## Live Demo

Try the interactive multi-peer chat and file transfer demo on CodePen:

* [GhostMesh Demo on CodePen](https://codepen.io/kalmonv/pen/GgjQzga)

## Quick Start

```ts
import GhostMesh from 'ghostmesh'

const trackers = [
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.btorrent.xyz',
  'wss://tracker.webtorrent.dev'
]

const gmesh = new GhostMesh(trackers, 'my-app')

gmesh.on('peerconnect', async (peer) => {
  console.log('peer connected', peer.id)

  const [responsePeer, response] = await gmesh.send(peer, {
    hello: 'world'
  })

  console.log('response from', responsePeer.id, response)
})

gmesh.on('msg', async (peer, msg) => {
  console.log('message from', peer.id, msg)
  await peer.respond({ ok: true })
})

await gmesh.start()
```

## Core API

### Constructor

```ts
const gmesh = new GhostMesh(trackers, identifier)
```

* `trackers`
  Array of WebSocket tracker URLs.
* `identifier`
  Shared identifier used to discover peers on the same network.

### Main events

* `peerconnect`
  Fired when a peer becomes available.
* `msg`
  Fired when a full message is received.
* `data`
  Fired for raw incoming chunks.
* `peerclose`
  Fired when a peer disconnects.
* `trackerconnect`
  Fired when a tracker connection succeeds.
* `trackerwarning`
  Fired when a tracker warns or fails.
* `onionmsg`
  Fired when a routed multi-hop message reaches its final target.
* `file`
  Fired when a file transfer starts and gives you a `FileSession`.

## Messaging

### Send a string

```ts
await gmesh.send(peer, 'hello')
```

### Send JSON

```ts
await gmesh.send(peer, {
  type: 'chat',
  text: 'hello'
})
```

### Respond to a message

```ts
gmesh.on('msg', async (peer, msg) => {
  console.log(msg)
  await peer.respond({ ok: true })
})
```

### Large messages

GhostMesh automatically chunks and reassembles large payloads, so `send()` works for regular strings and JSON objects without extra setup.

## File Transfers

### Send a file

```ts
const session = await gmesh.sendFile(peer, file, {
  chunkSize: 12 * 1024,
  metadata: {
    purpose: 'video'
  }
})

console.log(session.transferId)
console.log(session.status)
console.log(session.progress)

session.on('progress', current => {
  console.log(current.receivedBytes, current.progress)
})

session.on('complete', current => {
  console.log('sent', current.transferId)
})
```

`sendFile()` returns immediately with a live `FileSession`, so you can monitor and control the transfer while it is still running.

### Receive a file

```ts
gmesh.on('file', async (peer, file) => {
  console.log('incoming file from', peer.id, file.name)

  file.on('progress', session => {
    console.log(session.receivedBytes, session.progress)
  })

  file.on('complete', async session => {
    const blob = await session.blob()
    console.log('ready', blob.size)
  })
})
```

## FileSession

`FileSession` is the object returned by `sendFile()` and also the object emitted by the `file` event.

### Properties

* `transferId`
* `name`
* `mimeType`
* `size`
* `chunkSize`
* `totalChunks`
* `receivedBytes`
* `metadata`
* `peerId`
* `direction`
* `status`
* `progress`
* `canceled`

### Methods

* `blob()`
  Resolves to the final `Blob`.
* `readRange(start, end)`
  Reads a byte range from the local transfer cache.
* `stream(options?)`
  Returns a `ReadableStream<Uint8Array>`.
* `streamTo(element)`
  Streams to `<video>`, `<audio>` or `<img>` in the browser when possible.
* `waitUntilComplete()`
  Resolves when the transfer completes.
* `pause()`
  Pauses an outgoing transfer.
* `resume()`
  Resumes a paused outgoing transfer.
* `cancel(reason?)`
  Cancels the transfer and notifies the remote peer.
* `destroy()`
  Alias for `cancel('Transfer destroyed')`.

### Session events

* `progress`
* `complete`
* `error`
* `pause`
* `resume`
* `cancel`

## Media Streaming

GhostMesh includes a progressive file-transfer layer on top of the message transport.

Current protocol flow:

1. sender emits `file-offer`
2. sender emits ordered `file-chunk` packets
3. receiver may request targeted byte ranges with `file-range-request`
4. sender emits `file-end`
5. receiver works with a `FileSession`

### Browser video playback

```ts
gmesh.on('file', async (_peer, file) => {
  const video = document.querySelector('video')
  if (video) {
    await file.streamTo(video)
  }
})
```

The browser demo uses `FileSession.streamTo(...)` to start compatible videos before the entire file is downloaded. If `MediaSource` is not usable for that file, GhostMesh falls back to progressive blob-based playback.

### Current trade-offs

* transfers are optimized for simplicity, not peak throughput
* chunks are serialized as base64 inside the current protocol
* the main transfer path is still sequential
* incoming browser transfers can use `IndexedDB` as a cache-backed store for larger files
* range-based playback support is still lightweight compared to a system like WebTorrent

## Transport Options

Use `setOptions()` before `start()` to configure WebRTC and default routing behavior.

```ts
const gmesh = new GhostMesh(trackers, 'my-app')

gmesh.setOptions({
  timeout: 60_000,
  iceTransportPolicy: 'relay',
  iceServers: [
    {
      urls: 'turn:turn.example.com:3478',
      username: 'user',
      credential: 'pass'
    }
  ],
  onion: {
    through: [relayPeerId]
  }
})

await gmesh.start()
```

### Supported options

* `timeout`
  Default response timeout in milliseconds. Default: `60000`.
* `iceServers`
  Passed to `RTCPeerConnection`.
* `iceTransportPolicy`
  Useful when you want to force relay mode.
* `onion`
  Default routed delivery strategy for `send()` and `sendFile()`.
* `Onion`
  Accepted as a compatibility alias.
* `identity`
  Optional local role and RSA key material used by hidden services.
* `hiddenService`
  Hidden-master routing, entry peer selection, response shaping and master public key settings.

### Privacy note

Using `iceTransportPolicy: 'relay'` reduces direct IP exposure to peers, but it does not make WebRTC anonymous. Your TURN server still sees relay activity and metadata.

## Hidden Master Services

GhostMesh now includes a lightweight hidden-service layer on top of the existing onion routing.

The goal is:

* clients only know one entry peer
* entry peers know how to reach the hidden master
* the request body is encrypted with the master's public key
* the response body is encrypted for the requesting client
* entry peers can simulate a minimum route depth with delayed responses when the mesh is small

### Hidden service options

```ts
gmesh.setOptions({
  identity: {
    role: 'client',
    publicKey: CLIENT_PUBLIC_KEY_PEM,
    privateKey: CLIENT_PRIVATE_KEY_PEM
  },
  hiddenService: {
    serviceName: 'directory',
    entryPeers: ['entry-peer-id-1', 'entry-peer-id-2'],
    masterPublicKey: MASTER_PUBLIC_KEY_PEM,
    minHops: 3,
    responseDelayMs: [1000, 5000],
    fixedPacketBytes: 4096
  }
})
```

### Client request

```ts
const response = await gmesh.requestHiddenService('directory', {
  action: 'lookup',
  username: 'alice'
})

console.log(response)
```

If the client does not provide `identity.publicKey` and `identity.privateKey`, `requestHiddenService()` creates a temporary RSA keypair for that request and uses it for the encrypted response.

### Entry peer setup

Entry peers forward hidden-service requests without being able to read the encrypted body.

```ts
gmesh.setOptions({
  identity: {
    role: 'entry'
  },
  hiddenService: {
    role: 'entry',
    services: {
      directory: MASTER_PEER_ID
    },
    minHops: 3,
    responseDelayMs: [1000, 5000],
    fixedPacketBytes: 4096
  }
})
```

When the route to the master is shorter than `minHops`, the entry peer keeps the response for a random delay inside `responseDelayMs` so a short path looks less obvious.

### Master setup

The master only needs its private key and a handler for the service name.

```ts
gmesh.setOptions({
  identity: {
    role: 'master',
    privateKey: MASTER_PRIVATE_KEY_PEM
  },
  hiddenService: {
    role: 'master',
    serviceName: 'directory',
    fixedPacketBytes: 4096
  }
})

gmesh.handleHiddenService('directory', async (payload, context) => {
  console.log('hidden request', context.requestId, payload)

  return {
    ok: true,
    peers: ['alice', 'bob']
  }
})
```

### Key format

`identity.publicKey`, `identity.privateKey` and `hiddenService.masterPublicKey` accept:

* PEM strings for RSA-OAEP keys
* already-imported `CryptoKey` instances

GhostMesh uses Web Crypto to encrypt the hidden-service body with AES-GCM and wraps the AES key with RSA-OAEP.

## Relay and Onion Routing

GhostMesh includes a lightweight onion-style routing base. This is best thought of as relay-based obfuscation, not strong anonymity.

For most apps, the recommended approach is:

1. configure routing defaults once with `setOptions()`
2. call `send()` and `sendFile()` normally

### Automatic routing with `send()`

```ts
gmesh.setOptions({
  timeout: 60_000,
  onion: {
    hops: 2
  }
})

const [peer, response] = await gmesh.send(targetPeer, {
  type: 'chat',
  text: 'hello through the default route'
})
```

### Explicit relay with `sendOnion()`

```ts
gmesh.sendOnion(targetPeerId, {
  type: 'chat',
  text: 'hello through relay'
}, {
  through: [relayPeerId]
})
```

### Receive routed messages

```ts
gmesh.on('onionmsg', (peer, msg, route) => {
  console.log('delivered by', peer.id)
  console.log('circuit', route.circuitId)
  console.log('payload', msg)
})
```

### Current limitations

* intermediate peers can still inspect payloads
* there is no layered encryption yet
* timing analysis is still possible

## How Peer Discovery Works

GhostMesh uses a shared identifier to connect peers interested in the same application or room.

Flow:

1. you create a `GhostMesh` instance with an identifier
2. GhostMesh converts that identifier into an info hash
3. that info hash is announced to WebSocket trackers
4. trackers return peers using the same identifier
5. peers establish WebRTC data channels

Example:

```ts
const gmesh = new GhostMesh(trackers, 'my-chat-room')
```

## Demo

This repository includes a browser demo in:

* [index.html](/home/kalmon/Projetos/P2PT/index.html)
* [example.js](/home/kalmon/Projetos/P2PT/example.js)

The demo supports:

* direct messaging
* relay mode through a chosen peer
* onion-style mode with configurable hops
* file uploads and downloads
* progressive media preview

## Development

### Start the demo

```bash
npm run dev
```

### Start local trackers

```bash
npm run trackers
```

### Run tests

```bash
npm test
```

### Build

```bash
npm run build
```

Build output:

* `dist/ghostmesh.js`
* `dist/ghostmesh.cjs`
* `dist/ghostmesh.iife.js`
* `dist/ghostmesh.d.ts`

## Publishing and jsDelivr

If you want jsDelivr to serve files directly from your GitHub repository, commit and push `dist/`.

Typical release flow:

```bash
npm run build
git add dist README.md package.json
git commit -m "build: update dist"
git push
```

After that, jsDelivr can serve:

```html
<script src="https://cdn.jsdelivr.net/gh/kalmonv/GhostMesh/dist/ghostmesh.iife.js"></script>
```

## More Docs

More API detail is available in:

* [api-docs.md](https://github.com/kalmonv/GhostMesh/blob/main/api-docs.md)

## Projects Built With P2PT / GhostMesh

* [P2Wiki](//github.com/subins2000/p2wiki)
* [P2Chat](//github.com/subins2000/p2chat)
* [Vett](//github.com/subins2000/vett)
* [WebDrop](//github.com/subins2000/WebDrop)
* [Board-IO](//github.com/elvistony/board-io)
* [Rock Paper Scissor](https://github.com/prinzpiuz/Stone-Paper-Scissor)
* [Vaportrade](//github.com/arilotter/vaportrade)
