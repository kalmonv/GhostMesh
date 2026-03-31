# GhostMesh Network Models

This file summarizes the communication models used by the project and the demo.

## 1. Direct Message

Basic flow between two connected peers.

```mermaid
sequenceDiagram
    participant A as Client A
    participant B as Client B

    A->>B: send(msg)
    B->>B: process payload
    B-->>A: peer.respond(response)
```

Notes:

* Lowest latency.
* The destination peer knows who sent the message.
* No extra obfuscation layer.

How to use:

```ts
import GhostMesh from 'ghostmesh'

const gmesh = new GhostMesh(['wss://tracker.openwebtorrent.com'], 'my-app')

gmesh.on('msg', async (peer, msg) => {
  console.log('received', msg)
  await peer.respond({ ok: true })
})

await gmesh.start()

const peer = Object.values((await gmesh.requestMorePeers())['peer-id'] ?? {})[0]
if (peer) {
  const [, response] = await gmesh.send(peer, {
    type: 'direct',
    text: 'hello'
  })

  console.log(response)
}
```

## 2. Relay Message

An intermediate peer forwards the message to the destination.

```mermaid
sequenceDiagram
    participant A as Client A
    participant R as Relay
    participant B as Client B

    A->>R: routed packet
    R->>B: forward packet
    B->>B: process final payload
    B-->>R: routed response
    R-->>A: forward response
```

Notes:

* The relay knows it forwarded traffic between two sides.
* The relay is not the final destination.
* The path is more flexible than direct delivery.

How to use:

```ts
gmesh.setOptions({
  onion: {
    through: ['relay-peer-id']
  }
})

const [peer, response] = await gmesh.send(targetPeer, {
  type: 'relay',
  text: 'message going through a relay'
})

console.log(peer.id, response)
```

## 3. Onion / Multi-hop

The payload passes through multiple peers before reaching the destination.

```mermaid
sequenceDiagram
    participant A as Client A
    participant H1 as Hop 1
    participant H2 as Hop 2
    participant B as Client B

    A->>H1: onion packet
    H1->>H2: remaining layer
    H2->>B: final payload
    B-->>H2: response
    H2-->>H1: routed response
    H1-->>A: final response
```

Notes:

* Each hop only knows the next step in the route.
* This reduces direct exposure, but it does not provide strong anonymity.
* The project treats this as lightweight obfuscation, not Tor-like privacy.

How to use:

```ts
gmesh.setOptions({
  onion: {
    hops: 2
  }
})

const [peer, response] = await gmesh.send(targetPeer, {
  type: 'onion',
  text: 'message with random hops'
})

console.log(peer.routeInfo, response)
```

## 4. File Transfer

Files follow the currently active delivery strategy.

```mermaid
flowchart LR
    F[Local file] --> C[Chunking]
    C --> T[GhostMesh transfer]
    T --> R[Reception]
    R --> A[Reassembly]
    A --> P[Preview or download]
```

Notes:

* The file is split into chunks.
* `FileSession` tracks progress, pause, cancel, and completion.
* Videos and images can receive progressive previews in the demo.

How to use:

```ts
const session = await gmesh.sendFile(targetPeer, file, {
  chunkSize: 12 * 1024,
  metadata: {
    purpose: 'demo'
  }
})

session.on('progress', current => {
  console.log(current.receivedBytes, current.size)
})

session.on('complete', current => {
  console.log('file sent', current.transferId)
})
```

Receiving:

```ts
gmesh.on('file', async (peer, session) => {
  console.log('incoming file from', peer.id, session.name)

  session.on('complete', async current => {
    const blob = await current.blob()
    console.log('download ready', blob.size)
  })
})
```

## 5. Hidden Service / Central Server

Model used in the demo with a client and a central server.

```mermaid
sequenceDiagram
    participant C1 as Requesting Client
    participant E as Entry Client
    participant S as Central Server

    C1->>C1: encrypt payload with the server public key
    C1->>E: requestHiddenService()
    E->>S: forward packet without reading content
    S->>S: decrypt with the server private key
    S->>S: run handleHiddenService()
    S->>S: protect the response for the client
    S-->>E: hidden-service-response
    E-->>C1: forward response
    C1->>C1: receive protected response
```

Notes:

* Any client can also act as an entry point.
* The intermediate peer forwards the packet but cannot open the encrypted body.
* The central server needs the correct private key to read the request.
* A server only reveals its identity to probes when `revealServer` is explicitly enabled.

How to use on the server:

```ts
gmesh.setOptions({
  identity: {
    role: 'master',
    privateKey: SERVER_PRIVATE_KEY_PEM
  },
  hiddenService: {
    role: 'master',
    serviceName: 'directory',
    revealServer: true,
    fixedPacketBytes: 4096
  }
})

gmesh.handleHiddenService('directory', async (payload, context) => {
  console.log('hidden request', context.requestId, payload)

  return {
    ok: true,
    payload
  }
})
```

How to use on the client:

```ts
gmesh.setOptions({
  identity: {
    role: 'client',
    publicKey: CLIENT_PUBLIC_KEY_PEM
  },
  hiddenService: {
    serviceName: 'directory',
    entryPeers: ['entry-peer-id'],
    masterPeerId: 'server-peer-id',
    masterPublicKey: SERVER_PUBLIC_KEY_PEM,
    fixedPacketBytes: 4096
  }
})

const response = await gmesh.requestHiddenService('directory', {
  action: 'lookup',
  username: 'alice'
}, {
  entryPeerId: 'entry-peer-id',
  masterPublicKey: SERVER_PUBLIC_KEY_PEM
})

console.log(response)
```

How to detect whether a peer is the revealed server:

```ts
gmesh.setOptions({
  hiddenService: {
    masterPublicKey: SERVER_PUBLIC_KEY_PEM
  }
})

const revealed = await peer.isServer()
console.log(revealed)
```

## 6. Keys and Security

The project uses hybrid encryption:

* RSA-OAEP protects the symmetric key.
* AES-GCM protects the payload body.

### 6.1 Client request to the server

```mermaid
flowchart TD
    P[Original payload] --> A[AES-GCM encrypts the body]
    K[Random AES key] --> A
    K --> R[RSA-OAEP with the server public key]
    A --> PKT[Encrypted packet]
    R --> PKT
    PKT --> NET[Mesh / entry client]
```

Result:

* Only the server with the matching private key can open the AES key.
* The intermediate peer can see the packet, but not the useful content.

Matching snippet:

```ts
const response = await gmesh.requestHiddenService('directory', {
  action: 'lookup',
  username: 'alice'
}, {
  entryPeerId: 'entry-peer-id',
  masterPublicKey: SERVER_PUBLIC_KEY_PEM
})
```

### 6.2 Server response to the client

```mermaid
flowchart TD
    SRV[Server response] --> A2[AES-GCM encrypts the body]
    K2[Random AES key] --> A2
    K2 --> R2[RSA-OAEP with the client public key]
    A2 --> PKT2[Encrypted packet]
    R2 --> PKT2
    PKT2 --> CLI[Original client]
    CLI --> DEC[Consumes the protected response]
```

Result:

* Only the requesting client can consume the intended response for that request flow.

Matching snippet:

```ts
gmesh.handleHiddenService('directory', async (payload) => {
  return {
    ok: true,
    echo: payload
  }
})
```

Note:

* In this documentation, the visible client example does not configure its own private key.
* The visible client example only uses a public key.

## 7. What is protected and what is not

### Protected

* Request content sent to the server.
* Response content returned to the client.
* Payload readability by the intermediate peer.

### Not fully protected

* Network metadata.
* Which peers are connected to each other.
* The fact that one client is forwarding something for another.
* Strong anonymity against path observers.

## 8. Quick map of the models

```mermaid
flowchart TD
    GM[GhostMesh] --> D[Direct]
    GM --> R[Relay]
    GM --> O[Onion]
    GM --> F[File Transfer]
    GM --> H[Hidden Service]
    H --> C[Client]
    H --> E[Entry client]
    H --> S[Central server]
    H --> K[Public and private keys]
```

## 9. Practical summary

* `Direct`: simplest and fastest.
* `Relay`: uses one intermediate peer.
* `Onion`: uses multiple hops.
* `File Transfer`: uses chunks and `FileSession`.
* `Hidden Service`: the client encrypts toward the server, an intermediate peer forwards the packet, and the server sends a protected response back to the client.
