# Documentation

* [Class: `GhostMesh extends EventEmitter`](#class-ghostmesh-extends-eventemitter)
* [Events](#events)
* [Constructor](#constructor)
* [Methods](#methods)
  * [`setIdentifier(identifierString)`](#setidentifieridentifierstring)
  * [`setOptions(options)`](#setoptionsoptions)
  * [`start()`](#start)
  * [`requestMorePeers()`](#requestmorepeers)
  * [`send(peer, msg[, msgID = ''])`](#sendpeer-msg-msgid--)
  * [`sendFile(peer, file[, options])`](#sendfilepeer-file-options)
  * [`destroy()`](#destroy)

## Class: `GhostMesh extends EventEmitter`
The `GhostMesh` class is exposed by the `ghostmesh` module:

```javascript
import GhostMesh from 'ghostmesh'
```

In TypeScript, you can use:

```typescript
import GhostMesh from 'ghostmesh'
```

This is the base class that needs to be instantiated to use this library. It provides the API to implement P2P connections, communicate messages (even large content!) using WebTorrent WebSocket Trackers as the signalling server.

## Events

### `peerconnect`
This event is emitted when a new peer connects.

Arguments passed to Event Handler: `peer` Object

### `data`
This event is emitted for every chunk of data received.

Arguments passed to Event Handler: `peer` Object, `data` Object

### `msg`
This event is emitted once all the chunks are received for a message.

Arguments passed to Event Handler: `peer` Object, `msg` Object

### `peerclose`
This event is emitted when a peer disconnects.

Arguments passed to Event Handler: `peer` Object

### `trackerconnect`
This event is emitted when a successful connection to tracker is made.

Arguments passed to Event Handler: `WebSocketTracker` Object, `stats` Object

### `trackerwarning`
This event is emitted when some error happens with connection to tracker.

Arguments passed to Event Handler: `Error` object, `stats` Object

## Constructor

### `new GhostMesh(announceURLs = [], identifierString = '')`

Creates a new GhostMesh instance.

Arguments:

* `announceURLs: string[]`
  List of WebTorrent tracker announce URLs.
* `identifierString: string`
  Identifier used to discover peers in the network.

```javascript
// Find public WebTorrent tracker URLs here : https://github.com/ngosang/trackerslist/blob/master/trackers_all_ws.txt
const trackersAnnounceURLs = [
  "wss://tracker.openwebtorrent.com",
  "wss://tracker.sloppyta.co:443/",
  "wss://tracker.novage.com.ua:443/",
  "wss://tracker.btorrent.xyz:443/",
]

// This 'myApp' is called identifier and should be unique to your app
const gmesh = new GhostMesh(trackersAnnounceURLs, 'myApp')
```

In TypeScript, `GhostMesh` accepts an optional type parameter to constrain the messages you send. It does not constrain received messages, since any peer can send any payload.

```typescript
type Msg = 'hello' | { goodbye: boolean }
const gmesh = new GhostMesh<Msg>(trackersAnnounceURLs, 'myApp')

gmesh.send(peer, 'some_message') // TypeScript error
gmesh.send(peer, 'hello') // ok
gmesh.send(peer, { goodbye: true }) // ok
```

## Methods

### `setIdentifier(identifierString)`

Sets the identifier string used to discover peers in the network.

Arguments:

* `identifierString: string`

Returns: `Promise<void>`

### `setOptions(options)`

Sets runtime transport and delivery defaults.

Arguments:

* `options: RTCConfiguration & GhostMeshOptions`

Returns: `void`

Example:

```typescript
gmesh.setOptions({
  timeout: 60_000,
  iceTransportPolicy: 'relay',
  iceServers: [
    {
      urls: 'turn:turn.example.com:3478',
      username: 'user',
      credential: 'pass'
    }
  ]
})
```

### `start()`

Connects to the network and starts discovering peers.

Arguments: None

Returns: `Promise<void>`

In Node.js, this method will try to load `@roamhq/wrtc`. Install it if you want to run GhostMesh outside the browser.

### `requestMorePeers()`

Requests more peers from the configured trackers.

Arguments: None

Returns: `Promise<peers>`

### `send(peer, msg[, msgID = ''])`

Sends a message to a peer and resolves with the response.

Arguments:

* `peer: Peer`
  The target peer.
* `msg: unknown`
  The message payload. Strings and JSON-serializable objects are supported.
* `msgID: number | string`
  Internal message id used for responses. You normally do not need to provide it manually.

Returns: `Promise<[peer, msg]>`

### `sendFile(peer, file[, options])`

Sends a file and returns a live `FileSession`.

Arguments:

* `peer: Peer`
* `file: Blob | File`
* `options: { chunkSize?: number, metadata?: Record<string, unknown> }`

Returns: `Promise<FileSession>`

### `destroy()`

Destroys the GhostMesh instance, all active peer connections and tracker connections.

Arguments: None

Returns: `void`
