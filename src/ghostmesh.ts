/**
 * Peer 2 Peer WebRTC connections with WebTorrent Trackers as signalling server
 * Copyright Subin Siby <mail@subinsb.com>, 2020
 * Licensed under MIT
 */

import WebSocketTracker from 'bittorrent-tracker/websocket-tracker'
import EventEmitter from 'events'
import Debug from 'debug'
import { sha1 } from 'js-sha1'
import { randomBytes, arr2hex, hex2bin, hex2arr, hash, arr2text } from 'uint8-util'

const debug = Debug('p2pt')

/**
 * This character would be prepended to easily identify JSON msgs
 */
const JSON_MESSAGE_IDENTIFIER = '^'

/**
 * WebRTC data channel limit beyond which data is split into chunks
 * Chose 16KB considering Chromium
 * https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels#Concerns_with_large_messages
 */
const MAX_MESSAGE_LENGTH = 16000

type MessageID = number | string
type TrackerKey = number
type ResponsePayload = [peer: Peer, msg: unknown]
type ResponseResolver = (value: ResponsePayload) => void
type ResponseRejector = (reason?: unknown) => void
type OnionMessage = string | Record<string, unknown>

interface TrackerSocket {
  connected?: boolean
}

export interface TrackerStats {
  connected: number
  total: number
}

export interface Tracker {
  announceUrl: string
  socket?: TrackerSocket
  peers?: unknown[]
  announce(opts: AnnounceOptions): void
  destroy(): void
}

export interface Peer<SendableMessage = unknown> {
  id: string
  channelName: string
  connected?: boolean
  respond(msg: SendableMessage): Promise<ResponsePayload>
  on(event: string, listener: (...args: any[]) => void): void
  send(data: string): void
  destroy(): void
}

interface MessageEnvelope {
  id: MessageID
  msg: string
  c?: number
  last?: boolean
  o?: 1
}

interface AnnounceOptions {
  numwant?: number
  uploaded?: number
  downloaded?: number
}

interface RuntimeWebRTC {
  [key: string]: unknown
}

interface DataChannelLike {
  bufferedAmount?: number
  readyState?: string
}

interface InternalPeer<SendableMessage = unknown> extends Peer<SendableMessage> {
  _channel?: DataChannelLike
}

async function createInfoHash (identifierString: string): Promise<string> {
  try {
    return await hash(identifierString, 'hex') as string
  } catch (error) {
    return sha1(identifierString)
  }
}

interface OnionRouteOptions {
  hops?: number
  through?: string[]
  ttl?: number
}

type GhostMeshRole = 'client' | 'entry' | 'master' | 'relay'
type KeyMaterial = CryptoKey | string

export interface IdentityOptions {
  role?: GhostMeshRole
  publicKey?: KeyMaterial
  privateKey?: KeyMaterial
}

export interface HiddenServiceOptions {
  role?: 'client' | 'entry' | 'master'
  serviceName?: string
  entryPeers?: string[]
  masterPeerId?: string
  services?: Record<string, string>
  masterPublicKey?: KeyMaterial
  minHops?: number
  through?: string[]
  responseDelayMs?: [number, number]
  fixedPacketBytes?: number
}

export interface HiddenServiceRequestOptions {
  entryPeerId?: string
  serviceName?: string
  masterPublicKey?: KeyMaterial
  minHops?: number
  fixedPacketBytes?: number
}

export interface HiddenServiceRequestContext {
  requestId: string
  service: string
  nonce: string
  peer: Peer
  clientPublicKey: string
}

type HiddenServiceHandler = (payload: unknown, context: HiddenServiceRequestContext) => Promise<unknown> | unknown

interface GhostMeshOptions {
  timeout?: number
  onion?: OnionRouteOptions | false
  Onion?: OnionRouteOptions | false
  iceServers?: RTCIceServer[]
  iceTransportPolicy?: RTCIceTransportPolicy
  identity?: IdentityOptions
  hiddenService?: HiddenServiceOptions
}

export interface OnionRouteInfo {
  circuitId: string
  route: string[]
}

export interface FileTransferInfo {
  transferId: string
  name: string
  mimeType: string
  size: number
  chunkSize: number
  totalChunks: number
  receivedBytes: number
  metadata?: Record<string, unknown>
}

export interface FileChunkEvent {
  transfer: FileTransferInfo
  chunkIndex: number
  chunk: Uint8Array
  offset: number
  receivedBytes: number
}

export interface FileStreamOptions {
  start?: number
  end?: number
}

type FileSessionStatus = 'offered' | 'streaming' | 'paused' | 'complete' | 'error' | 'sending' | 'sent' | 'canceled'

interface FileChunkRecord {
  chunk: Uint8Array
  offset: number
}

interface FileStreamSubscriber {
  controller: ReadableStreamDefaultController<Uint8Array>
  start: number
  end: number
}

interface OnionDeliverPacket {
  __p2ptInternal: 'onion-deliver'
  circuitId: string
  ttl: number
  msg: string
  o?: 1
}

interface OnionForwardPacket {
  __p2ptInternal: 'onion-forward'
  circuitId: string
  ttl: number
  nextPeerId: string
  payload: string
}

type OnionPacket = OnionDeliverPacket | OnionForwardPacket

interface FileTransferOfferPacket {
  __ghostmeshInternal: 'file-offer'
  transferId: string
  name: string
  mimeType: string
  size: number
  chunkSize: number
  totalChunks: number
  metadata?: Record<string, unknown>
}

interface FileTransferChunkPacket {
  __ghostmeshInternal: 'file-chunk'
  transferId: string
  chunkIndex: number
  offset: number
  data: string
}

interface FileTransferRangeRequestPacket {
  __ghostmeshInternal: 'file-range-request'
  transferId: string
  start: number
  end: number
}

interface FileTransferCancelPacket {
  __ghostmeshInternal: 'file-cancel'
  transferId: string
  reason?: string
}

interface FileTransferEndPacket {
  __ghostmeshInternal: 'file-end'
  transferId: string
}

type FileTransferPacket = FileTransferOfferPacket | FileTransferChunkPacket | FileTransferRangeRequestPacket | FileTransferCancelPacket | FileTransferEndPacket

interface IncomingFileTransferState {
  session: FileSession
}

interface FileSessionController {
  pause?: () => void
  resume?: () => void
  cancel?: (reason?: string) => Promise<void> | void
}

interface FileSendOptions {
  chunkSize?: number
  metadata?: Record<string, unknown>
}

interface FileChunkStore {
  put(record: FileChunkRecord): Promise<void>
  getRange(start: number, end: number): Promise<FileChunkRecord[]>
  clear(): Promise<void>
}

interface PendingRequest {
  resolve: ResponseResolver
  reject: ResponseRejector
  timeoutId?: ReturnType<typeof setTimeout>
}

interface RoutedPeer extends Peer<any> {
  routeInfo: OnionRouteInfo
}

interface RoutedRequestPacket {
  __ghostmeshInternal: 'route-request'
  circuitId: string
  requestId: string
  originPeerId: string
  replyRoute: string[]
  msg: string
  o?: 1
}

interface RoutedResponsePacket {
  __ghostmeshInternal: 'route-response'
  circuitId: string
  requestId: string
  originPeerId: string
  msg: string
  o?: 1
}

type RoutedPacket = RoutedRequestPacket | RoutedResponsePacket

interface HiddenServiceCiphertext {
  encryptedKey: string
  iv: string
  ciphertext: string
}

interface HiddenServiceRequestPacket {
  __ghostmeshInternal: 'hidden-service-request'
  service: string
  requestId: string
  nonce: string
  clientPublicKey: string
  requestedHops: number
  body: HiddenServiceCiphertext
  padding?: string
}

interface HiddenServiceResponsePacket {
  __ghostmeshInternal: 'hidden-service-response'
  service: string
  requestId: string
  nonce: string
  body: HiddenServiceCiphertext
  realHops: number
  simulatedHops: number
  delayedMs: number
  padding?: string
}

type HiddenServicePacket = HiddenServiceRequestPacket | HiddenServiceResponsePacket
type InternalMessage = FileTransferPacket | RoutedPacket | HiddenServicePacket

const DEFAULT_FILE_CHUNK_SIZE = 12 * 1024
const DEFAULT_REQUEST_TIMEOUT = 60 * 1000
const MAX_BUFFERED_AMOUNT_BEFORE_WAIT = 256 * 1024
const SEND_RETRY_DELAY_MS = 25
const SEND_RETRY_ATTEMPTS = 80
const INDEXED_DB_FILE_THRESHOLD = 2 * 1024 * 1024
const PROGRESSIVE_PREVIEW_START_BYTES = 768 * 1024
const PROGRESSIVE_PREVIEW_UPDATE_BYTES = 2 * 1024 * 1024
const DEFAULT_HIDDEN_SERVICE_MIN_HOPS = 3

function getSubtleCrypto (): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw new Error('Web Crypto is required for hidden service encryption')
  }

  return subtle
}

function encodeBase64 (bytes: ArrayBuffer | Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).toString('base64')
  }

  let binary = ''
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  for (let index = 0; index < view.length; index++) {
    binary += String.fromCharCode(view[index])
  }

  return btoa(binary)
}

function decodeBase64 (value: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64'))
  }

  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function toArrayBuffer (bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function stripPemHeaders (pem: string): string {
  return pem.replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '')
}

function toPem (buffer: ArrayBuffer, label: string): string {
  const base64 = encodeBase64(buffer)
  const lines = base64.match(/.{1,64}/g) ?? []
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`
}

async function importRsaPublicKey (keyMaterial: KeyMaterial): Promise<CryptoKey> {
  if (typeof keyMaterial !== 'string') {
    return keyMaterial
  }

  return await getSubtleCrypto().importKey(
    'spki',
    toArrayBuffer(decodeBase64(stripPemHeaders(keyMaterial))),
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256'
    },
    true,
    ['encrypt']
  )
}

async function importRsaPrivateKey (keyMaterial: KeyMaterial): Promise<CryptoKey> {
  if (typeof keyMaterial !== 'string') {
    return keyMaterial
  }

  return await getSubtleCrypto().importKey(
    'pkcs8',
    toArrayBuffer(decodeBase64(stripPemHeaders(keyMaterial))),
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256'
    },
    true,
    ['decrypt']
  )
}

async function exportRsaPublicKeyPem (key: CryptoKey): Promise<string> {
  const exported = await getSubtleCrypto().exportKey('spki', key)
  return toPem(exported, 'PUBLIC KEY')
}

async function createRsaKeyPair (): Promise<CryptoKeyPair> {
  return await getSubtleCrypto().generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['encrypt', 'decrypt']
  ) as CryptoKeyPair
}

async function encryptHiddenPayload (payload: unknown, publicKeyMaterial: KeyMaterial): Promise<HiddenServiceCiphertext> {
  const subtle = getSubtleCrypto()
  const rsaPublicKey = await importRsaPublicKey(publicKeyMaterial)
  const aesKey = await subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256
    },
    true,
    ['encrypt', 'decrypt']
  )
  const iv = randomBytes(12)
  const plaintext = new TextEncoder().encode(JSON.stringify(payload))
  const ciphertext = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv)
    },
    aesKey,
    plaintext
  )
  const rawAesKey = await subtle.exportKey('raw', aesKey)
  const encryptedKey = await subtle.encrypt(
    {
      name: 'RSA-OAEP'
    },
    rsaPublicKey,
    rawAesKey
  )

  return {
    encryptedKey: encodeBase64(encryptedKey),
    iv: encodeBase64(iv),
    ciphertext: encodeBase64(ciphertext)
  }
}

async function decryptHiddenPayload (payload: HiddenServiceCiphertext, privateKeyMaterial: KeyMaterial): Promise<unknown> {
  const subtle = getSubtleCrypto()
  const rsaPrivateKey = await importRsaPrivateKey(privateKeyMaterial)
  const rawAesKey = await subtle.decrypt(
    {
      name: 'RSA-OAEP'
    },
    rsaPrivateKey,
    toArrayBuffer(decodeBase64(payload.encryptedKey))
  )
  const aesKey = await subtle.importKey(
    'raw',
    rawAesKey,
    {
      name: 'AES-GCM'
    },
    false,
    ['decrypt']
  )
  const plaintext = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(decodeBase64(payload.iv))
    },
    aesKey,
    toArrayBuffer(decodeBase64(payload.ciphertext))
  )

  return JSON.parse(new TextDecoder().decode(plaintext))
}

class MemoryFileChunkStore implements FileChunkStore {
  private readonly chunks = new Map<number, Uint8Array>()

  async put (record: FileChunkRecord): Promise<void> {
    this.chunks.set(record.offset, record.chunk.slice())
  }

  async getRange (start: number, end: number): Promise<FileChunkRecord[]> {
    if (end <= start) {
      return []
    }

    return [...this.chunks.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([offset, chunk]) => ({ offset, chunk: chunk.slice() }))
      .filter(record => record.offset < end && (record.offset + record.chunk.length) > start)
  }

  async clear (): Promise<void> {
    this.chunks.clear()
  }
}

class IndexedDbFileChunkStore implements FileChunkStore {
  private readonly transferId: string
  private readonly databasePromise: Promise<IDBDatabase>

  constructor (transferId: string) {
    this.transferId = transferId
    this.databasePromise = this._open()
  }

  async put (record: FileChunkRecord): Promise<void> {
    const database = await this.databasePromise
    const transaction = database.transaction('chunks', 'readwrite')
    const store = transaction.objectStore('chunks')

    store.put({
      transferId: this.transferId,
      offset: record.offset,
      chunk: record.chunk.buffer.slice(record.chunk.byteOffset, record.chunk.byteOffset + record.chunk.byteLength)
    })

    await this._waitForTransaction(transaction)
  }

  async getRange (start: number, end: number): Promise<FileChunkRecord[]> {
    if (end <= start) {
      return []
    }

    const database = await this.databasePromise
    const transaction = database.transaction('chunks', 'readonly')
    const store = transaction.objectStore('chunks')
    const request = store.getAll(IDBKeyRange.bound([this.transferId, start], [this.transferId, Math.max(start, end - 1)]))
    const rows = await this._waitForRequest<Array<{ offset: number, chunk: ArrayBuffer }>>(request)

    return rows.map(row => ({
      offset: row.offset,
      chunk: new Uint8Array(row.chunk)
    }))
  }

  async clear (): Promise<void> {
    const database = await this.databasePromise
    const transaction = database.transaction('chunks', 'readwrite')
    const store = transaction.objectStore('chunks')
    const request = store.delete(IDBKeyRange.bound([this.transferId, 0], [this.transferId, Number.MAX_SAFE_INTEGER]))

    await this._waitForRequest(request)
    await this._waitForTransaction(transaction)
  }

  async _open (): Promise<IDBDatabase> {
    const request = indexedDB.open('ghostmesh-file-cache', 1)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains('chunks')) {
        database.createObjectStore('chunks', { keyPath: ['transferId', 'offset'] })
      }
    }

    return await this._waitForRequest<IDBDatabase>(request)
  }

  _waitForRequest<T> (request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
    })
  }

  _waitForTransaction (transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    })
  }
}

function createFileChunkStore (transferId: string, direction: 'incoming' | 'outgoing', size: number): FileChunkStore {
  if (
    direction === 'incoming' &&
    typeof indexedDB !== 'undefined' &&
    size >= INDEXED_DB_FILE_THRESHOLD
  ) {
    return new IndexedDbFileChunkStore(transferId)
  }

  return new MemoryFileChunkStore()
}

export class FileSession extends EventEmitter implements FileTransferInfo {
  transferId: string
  name: string
  mimeType: string
  size: number
  chunkSize: number
  totalChunks: number
  receivedBytes: number
  metadata?: Record<string, unknown>
  peerId: string
  direction: 'incoming' | 'outgoing'
  status: FileSessionStatus
  private readonly _subscribers: Set<FileStreamSubscriber>
  private readonly _receivedOffsets: Set<number>
  private readonly _store: FileChunkStore
  private _writeQueue: Promise<void>
  private _completionPromise: Promise<void>
  private _resolveCompletion!: () => void
  private _rejectCompletion!: (reason?: unknown) => void
  private _completionSettled: boolean
  private _objectUrl?: string
  private readonly _sourceBlob?: Blob
  private readonly _requestRange?: (start: number, end: number) => Promise<void>
  private readonly _controller?: FileSessionController
  private _isPaused: boolean
  private _pausePromise?: Promise<void>
  private _resumePause?: () => void
  private _isCanceled: boolean

  constructor (
    info: FileTransferInfo,
    peerId: string,
    direction: 'incoming' | 'outgoing',
    sourceBlob?: Blob,
    requestRange?: (start: number, end: number) => Promise<void>,
    controller?: FileSessionController
  ) {
    super()
    this.transferId = info.transferId
    this.name = info.name
    this.mimeType = info.mimeType
    this.size = info.size
    this.chunkSize = info.chunkSize
    this.totalChunks = info.totalChunks
    this.receivedBytes = info.receivedBytes
    this.metadata = info.metadata
    this.peerId = peerId
    this.direction = direction
    this.status = direction === 'incoming' ? 'offered' : 'sending'
    this._subscribers = new Set()
    this._receivedOffsets = new Set()
    this._store = createFileChunkStore(info.transferId, direction, info.size)
    this._writeQueue = Promise.resolve()
    this._completionSettled = false
    this._sourceBlob = sourceBlob
    this._requestRange = requestRange
    this._controller = controller
    this._isPaused = false
    this._isCanceled = false
    this._completionPromise = new Promise((resolve, reject) => {
      this._resolveCompletion = resolve
      this._rejectCompletion = reject
    })
  }

  get progress (): number {
    if (this.size <= 0) {
      return 0
    }

    return Math.min(1, this.receivedBytes / this.size)
  }

  get canceled (): boolean {
    return this._isCanceled
  }

  override on (event: 'progress', callback: (session: FileSession, event?: FileChunkEvent) => void): this
  override on (event: 'complete', callback: (session: FileSession) => void): this
  override on (event: 'error', callback: (error: Error, session: FileSession) => void): this
  override on (event: 'pause' | 'resume' | 'cancel', callback: (session: FileSession) => void): this
  override on (event: string | symbol, callback: (...args: any[]) => void): this {
    return super.on(event, callback)
  }

  async waitUntilComplete (): Promise<void> {
    await this._completionPromise
  }

  pause (): void {
    if (this._isCanceled || this.status === 'complete' || this.status === 'sent' || this.status === 'error') {
      return
    }

    this._isPaused = true
    this.status = 'paused'

    if (!this._pausePromise) {
      this._pausePromise = new Promise(resolve => {
        this._resumePause = resolve
      })
    }

    this._controller?.pause?.()
    this.emit('pause', this)
  }

  resume (): void {
    if (!this._isPaused || this._isCanceled) {
      return
    }

    this._isPaused = false
    this.status = this.direction === 'incoming' ? 'streaming' : 'sending'
    this._resumePause?.()
    this._pausePromise = undefined
    this._resumePause = undefined
    this._controller?.resume?.()
    this.emit('resume', this)
  }

  async cancel (reason = 'Transfer canceled'): Promise<void> {
    if (this._isCanceled || this.status === 'complete' || this.status === 'sent' || this.status === 'error') {
      return
    }

    this._cancelLocal(reason)
    await this._controller?.cancel?.(reason)
  }

  async destroy (): Promise<void> {
    await this.cancel('Transfer destroyed')
  }

  _cancelLocal (reason: string): void {
    if (this._isCanceled || this.status === 'complete' || this.status === 'sent' || this.status === 'error') {
      return
    }

    this._isCanceled = true
    this.status = 'canceled'
    this._resumePause?.()
    this._pausePromise = undefined
    this._resumePause = undefined

    if (!this._completionSettled) {
      this._completionSettled = true
      this._rejectCompletion(new Error(reason))
    }

    this.emit('cancel', this)
  }

  stream (options: FileStreamOptions = {}): ReadableStream<Uint8Array> {
    const ReadableStreamCtor = globalThis.ReadableStream
    if (typeof ReadableStreamCtor === 'undefined') {
      throw new Error('ReadableStream is not available in this environment')
    }

    const start = Math.max(0, options.start ?? 0)
    const end = Math.min(this.size, options.end ?? this.size)

    if (this._sourceBlob) {
      return this._streamBlobRange(this._sourceBlob, start, end)
    }

    const session = this

    return new ReadableStreamCtor<Uint8Array>({
      async start (controller) {
        const subscriber: FileStreamSubscriber = { controller, start, end }
        session._subscribers.add(subscriber)

        try {
          if (session.direction === 'incoming' && session.status !== 'complete' && session._requestRange && start > 0) {
            await session._requestRange(start, Math.min(end, start + (session.chunkSize * 8)))
          }

          const records = await session._getStoredRange(start, end)
          for (const record of records) {
            session._enqueueRecord(subscriber, record)
          }
        } catch (error) {
          controller.error(error)
          session._subscribers.delete(subscriber)
          return
        }

        if (session.status === 'complete' || session.status === 'sent') {
          controller.close()
          session._subscribers.delete(subscriber)
        }

        if (session.status === 'error') {
          controller.error(new Error(`File session ${session.transferId} failed`))
          session._subscribers.delete(subscriber)
        }
      },
      cancel () {
        for (const subscriber of session._subscribers) {
          if (subscriber.start === start && subscriber.end === end) {
            session._subscribers.delete(subscriber)
          }
        }
      }
    })
  }

  async blob (): Promise<Blob> {
    if (this._sourceBlob) {
      return this._sourceBlob
    }

    if (this.status === 'canceled') {
      throw new Error(`File session ${this.transferId} was canceled`)
    }

    if (this.status !== 'complete' && this.status !== 'sent') {
      await this._completionPromise
    }

    const records = await this._getStoredRange(0, this.size)

    return new Blob(records.map(record => this._toArrayBuffer(record.chunk)), {
      type: this.mimeType || 'application/octet-stream'
    })
  }

  async readRange (start = 0, end = this.size): Promise<Uint8Array> {
    if (this._sourceBlob) {
      return new Uint8Array(await this._sourceBlob.slice(start, end).arrayBuffer())
    }

    if (this.status === 'canceled') {
      throw new Error(`File session ${this.transferId} was canceled`)
    }

    const records = await this._getStoredRange(start, end)
    const totalLength = records.reduce((size, record) => {
      const sliceStart = Math.max(start, record.offset)
      const sliceEnd = Math.min(end, record.offset + record.chunk.length)
      return size + Math.max(0, sliceEnd - sliceStart)
    }, 0)
    const merged = new Uint8Array(totalLength)
    let cursor = 0

    for (const record of records) {
      const sliceStart = Math.max(start, record.offset)
      const sliceEnd = Math.min(end, record.offset + record.chunk.length)
      if (sliceStart >= sliceEnd) {
        continue
      }

      const localStart = sliceStart - record.offset
      const localEnd = sliceEnd - record.offset
      merged.set(record.chunk.slice(localStart, localEnd), cursor)
      cursor += localEnd - localStart
    }

    return merged
  }

  async objectURL (): Promise<string> {
    if (!this._objectUrl) {
      this._objectUrl = URL.createObjectURL(await this.blob())
    }

    return this._objectUrl
  }

  async streamTo (element: HTMLMediaElement | HTMLImageElement): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('streamTo() is only available in browser environments')
    }

    if (typeof HTMLImageElement !== 'undefined' && element instanceof HTMLImageElement) {
      element.src = await this.objectURL()
      return
    }

    const mediaElement = element as HTMLMediaElement
    const isVideo = this.mimeType.startsWith('video/')
    const canUseMediaSource = typeof MediaSource !== 'undefined' &&
      Boolean(this.mimeType) &&
      MediaSource.isTypeSupported(this.mimeType)

    if (!canUseMediaSource) {
      if (isVideo) {
        await this._streamVideoWithProgressiveBlob(mediaElement)
        return
      }

      mediaElement.src = await this.objectURL()
      return
    }

    const mediaSource = new MediaSource()
    const mediaUrl = URL.createObjectURL(mediaSource)
    mediaElement.src = mediaUrl

    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false
        const resolveOnce = () => {
          if (!settled) {
            settled = true
            resolve()
          }
        }
        const rejectOnce = (error: unknown) => {
          if (!settled) {
            settled = true
            reject(error)
          }
        }

        mediaElement.addEventListener('error', () => {
          rejectOnce(mediaElement.error ?? new Error(`Failed to play ${this.name}`))
        }, { once: true })

        mediaSource.addEventListener('sourceopen', () => {
          try {
            const sourceBuffer = mediaSource.addSourceBuffer(this.mimeType)
            sourceBuffer.mode = 'sequence'

            const queue: ArrayBuffer[] = []
            let reading = false
            let streamDone = false

            const flush = async () => {
              if (reading || sourceBuffer.updating) {
                return
              }

              if (queue.length > 0) {
                const next = queue.shift()!
                sourceBuffer.appendBuffer(next)
                return
              }

              if (streamDone && mediaSource.readyState === 'open') {
                mediaSource.endOfStream()
                resolveOnce()
              }
            }

            sourceBuffer.addEventListener('error', () => {
              rejectOnce(new Error(`MediaSource append failed for ${this.name}`))
            })

            sourceBuffer.addEventListener('updateend', () => {
              void flush()
            })

            const reader = this.stream().getReader()
            const readLoop = async () => {
              reading = true
              try {
                while (true) {
                  const { value, done } = await reader.read()
                  if (done) {
                    streamDone = true
                    break
                  }

                  queue.push(this._toArrayBuffer(value))
                  await flush()
                }
              } catch (error) {
                rejectOnce(error)
                return
              } finally {
                reading = false
                await flush()
              }
            }

            void readLoop()
          } catch (error) {
            rejectOnce(error)
          }
        }, { once: true })
      })
    } catch (error) {
      URL.revokeObjectURL(mediaUrl)
      if (isVideo) {
        await this._streamVideoWithProgressiveBlob(mediaElement)
        return
      }

      mediaElement.src = await this.objectURL()
      return
    }
  }

  _appendChunk (chunk: Uint8Array, offset: number, event?: FileChunkEvent, storeChunk = true): void {
    if (this._isCanceled) {
      return
    }

    if (storeChunk && this._receivedOffsets.has(offset)) {
      return
    }

    if (storeChunk) {
      this._receivedOffsets.add(offset)
    }

    this.status = this.direction === 'incoming' ? 'streaming' : 'sending'
    this.receivedBytes = Math.min(this.size, Math.max(this.receivedBytes, offset + chunk.length))

    const record = {
      chunk: chunk.slice(),
      offset
    }

    if (storeChunk) {
      this._writeQueue = this._writeQueue
        .then(async () => {
          await this._store.put(record)
        })
        .catch(error => {
          this._markError(error instanceof Error ? error : new Error(String(error)))
        })
    }

    for (const subscriber of this._subscribers) {
      this._enqueueRecord(subscriber, record)
    }

    this.emit('progress', this, event)
  }

  _markComplete (): void {
    void this._finalizeCompletion()
  }

  _markError (error: Error): void {
    if (this._isCanceled) {
      return
    }

    this.status = 'error'

    for (const subscriber of this._subscribers) {
      subscriber.controller.error(error)
    }
    this._subscribers.clear()

    if (!this._completionSettled) {
      this._completionSettled = true
      this._rejectCompletion(error)
    }

    this.emit('error', error, this)
  }

  _enqueueRecord (subscriber: FileStreamSubscriber, record: FileChunkRecord): void {
    const recordStart = record.offset
    const recordEnd = record.offset + record.chunk.length
    const sliceStart = Math.max(subscriber.start, recordStart)
    const sliceEnd = Math.min(subscriber.end, recordEnd)

    if (sliceStart >= sliceEnd) {
      return
    }

    const localStart = sliceStart - recordStart
    const localEnd = sliceEnd - recordStart
    subscriber.controller.enqueue(record.chunk.slice(localStart, localEnd))
  }

  _toArrayBuffer (bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  }

  _streamBlobRange (blob: Blob, start: number, end: number): ReadableStream<Uint8Array> {
    return blob.slice(start, end).stream() as ReadableStream<Uint8Array>
  }

  async _streamVideoWithProgressiveBlob (mediaElement: HTMLMediaElement): Promise<void> {
    let lastPreviewBytes = 0
    let previewUrl: string | undefined
    let previewInFlight = false

    const revokePreviewUrl = () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
        previewUrl = undefined
      }
    }

    const updatePreview = async (force = false) => {
      if (previewInFlight) {
        return
      }

      const availableBytes = this.receivedBytes
      if (availableBytes <= 0) {
        return
      }

      if (!force) {
        if (availableBytes < PROGRESSIVE_PREVIEW_START_BYTES) {
          return
        }

        if ((availableBytes - lastPreviewBytes) < PROGRESSIVE_PREVIEW_UPDATE_BYTES) {
          return
        }
      }

      previewInFlight = true
      const previousTime = mediaElement.currentTime || 0
      const wasPaused = mediaElement.paused

      try {
        const bytes = await this.readRange(0, availableBytes)
        if (bytes.byteLength <= 0) {
          return
        }

        const nextPreviewUrl = URL.createObjectURL(new Blob([this._toArrayBuffer(bytes)], {
          type: this.mimeType || 'video/mp4'
        }))

        mediaElement.src = nextPreviewUrl
        mediaElement.load()

        mediaElement.addEventListener('loadedmetadata', () => {
          try {
            if (previousTime > 0 && Number.isFinite(mediaElement.duration)) {
              mediaElement.currentTime = Math.min(previousTime, Math.max(0, mediaElement.duration - 0.25))
            }
          } catch {}

          if (!wasPaused || previousTime > 0) {
            void mediaElement.play().catch(() => {})
          }
        }, { once: true })

        revokePreviewUrl()
        previewUrl = nextPreviewUrl
        lastPreviewBytes = availableBytes
      } finally {
        previewInFlight = false
      }
    }

    const onProgress = () => {
      void updatePreview()
    }

    this.on('progress', onProgress)

    try {
      await updatePreview(true)
      await this._completionPromise.catch(() => {})
      await updatePreview(true)
    } finally {
      this.removeListener('progress', onProgress)
    }
  }

  async _getStoredRange (start: number, end: number): Promise<FileChunkRecord[]> {
    await this._writeQueue
    return await this._store.getRange(start, end)
  }

  async _waitWhilePaused (): Promise<void> {
    if (this._pausePromise) {
      await this._pausePromise
    }
  }

  async _finalizeCompletion (): Promise<void> {
    if (this._isCanceled) {
      return
    }

    try {
      await this._writeQueue
    } catch (error) {
      this._markError(error instanceof Error ? error : new Error(String(error)))
      return
    }

    this.status = this.direction === 'incoming' ? 'complete' : 'sent'

    for (const subscriber of this._subscribers) {
      subscriber.controller.close()
    }
    this._subscribers.clear()

    if (!this._completionSettled) {
      this._completionSettled = true
      this._resolveCompletion()
    }

    this.emit('complete', this)
  }
}

export default class GhostMesh<SendableMessage = any> extends EventEmitter {
  announceURLs: string[]
  trackers: Record<TrackerKey, Tracker>
  peers: Record<string, Record<string, Peer<SendableMessage>>>
  msgChunks: Record<string, string[]>
  responseWaiting: Record<string, Record<string, ResponseResolver>>
  pendingRequests: Record<string, PendingRequest>
  incomingFiles: Record<string, IncomingFileTransferState>
  outgoingFiles: Record<string, FileSession>
  identifierString?: string
  infoHash?: Promise<string>
  _peerIdBuffer: Uint8Array
  _peerId: string
  _peerIdBinary: string
  _infoHashBuffer?: Uint8Array
  _infoHashBinary?: string
  _rtcConfig: RTCConfiguration
  _options: Required<Pick<GhostMeshOptions, 'timeout'>> & { onion: OnionRouteOptions | false }
  _identity: IdentityOptions
  _hiddenService: HiddenServiceOptions
  hiddenServiceHandlers: Record<string, HiddenServiceHandler>
  _wrtc?: RuntimeWebRTC

  /**
   *
   * @param announceURLs List of announce tracker URLs
   * @param identifierString Identifier used to discover peers in the network
   */
  constructor (announceURLs: string[] = [], identifierString = '') {
    super()

    this.announceURLs = [...announceURLs]
    this.trackers = {}
    this.peers = {}
    this.msgChunks = {}
    this.responseWaiting = {}
    this.pendingRequests = {}
    this.incomingFiles = {}
    this.outgoingFiles = {}
    this._rtcConfig = {
      iceServers: []
    }
    this._options = {
      timeout: DEFAULT_REQUEST_TIMEOUT,
      onion: false
    }
    this._identity = {}
    this._hiddenService = {
      entryPeers: [],
      services: {},
      minHops: DEFAULT_HIDDEN_SERVICE_MIN_HOPS,
      responseDelayMs: [1000, 5000]
    }
    this.hiddenServiceHandlers = {}

    if (identifierString) { void this.setIdentifier(identifierString) }

    this._peerIdBuffer = randomBytes(20)
    this._peerId = arr2hex(this._peerIdBuffer)
    this._peerIdBinary = hex2bin(this._peerId)

    debug('my peer id: ' + this._peerId)
  }

  override on(event: 'peerconnect', callback: (peer: Peer<SendableMessage>) => void): this
  override on(event: 'data', callback: (peer: Peer<SendableMessage>, data: unknown) => void): this
  override on(event: 'msg', callback: (peer: Peer<SendableMessage>, msg: unknown) => void): this
  override on(event: 'peerclose', callback: (peer: Peer<SendableMessage>) => void): this
  override on(event: 'trackerconnect', callback: (tracker: Tracker, stats: TrackerStats) => void): this
  override on(event: 'trackerwarning', callback: (error: object, stats: TrackerStats) => void): this
  override on(event: 'onionmsg', callback: (peer: Peer<SendableMessage>, msg: unknown, route: OnionRouteInfo) => void): this
  override on(event: 'file', callback: (peer: Peer<SendableMessage>, session: FileSession) => void): this
  override on(event: 'hiddenserviceerror', callback: (error: Error, info: { service: string, requestId?: string }) => void): this
  override on(event: 'peer', callback: (peer: Peer<SendableMessage>) => void): this
  override on(event: 'update', callback: (response: { announce: string }) => void): this
  override on(event: 'warning', callback: (error: object) => void): this
  override on(event: string | symbol, callback: (...args: any[]) => void): this {
    return super.on(event, callback)
  }

  /**
   * Set the identifier string used to discover peers in the network
   */
  async setIdentifier (identifierString: string): Promise<void> {
    this.identifierString = identifierString
    this.infoHash = createInfoHash(identifierString)
    this._infoHashBuffer = hex2arr((await this.infoHash).toLowerCase())
    this._infoHashBinary = hex2bin((await this.infoHash).toLowerCase())
  }

  /**
   * Configure runtime options for transport and default routing.
   */
  setOptions (options: RTCConfiguration & GhostMeshOptions): void {
    const onionOptions = options.onion ?? options.Onion

    this._rtcConfig = {
      ...this._rtcConfig,
      ...options,
      iceServers: options.iceServers ? [...options.iceServers] : [...(this._rtcConfig.iceServers ?? [])]
    }

    if ('timeout' in options && typeof options.timeout === 'number' && Number.isFinite(options.timeout)) {
      this._options.timeout = Math.max(1000, options.timeout)
    }

    if (onionOptions === false) {
      this._options.onion = false
    } else if (onionOptions) {
      this._options.onion = {
        ...(this._options.onion || {}),
        ...onionOptions
      }
    }

    if (options.identity) {
      this._identity = {
        ...this._identity,
        ...options.identity
      }
    }

    if (options.hiddenService) {
      this._hiddenService = {
        ...this._hiddenService,
        ...options.hiddenService,
        entryPeers: options.hiddenService.entryPeers ? [...options.hiddenService.entryPeers] : [...(this._hiddenService.entryPeers ?? [])],
        services: options.hiddenService.services ? { ...(this._hiddenService.services ?? {}), ...options.hiddenService.services } : { ...(this._hiddenService.services ?? {}) }
      }
    }
  }

  /**
   * Connect to network and start discovering peers
   */
  async start (): Promise<void> {
    await this.infoHash
    await this._ensureWebRTCImplementation()

    this.on('peer', (peer: Peer<SendableMessage>) => {
      let newpeer = false
      if (!this.peers[peer.id]) {
        newpeer = true
        this.peers[peer.id] = {}
        this.responseWaiting[peer.id] = {}
      }

      peer.on('connect', () => {
        if (!this.peers[peer.id]) {
          this.peers[peer.id] = {}
        }
        if (!this.responseWaiting[peer.id]) {
          this.responseWaiting[peer.id] = {}
        }

        /**
         * Multiple data channels to one peer is possible
         * The `peer` object actually refers to a peer with a data channel. Even though it may have same `id` (peerID) property, the data channel will be different. Different trackers giving the same "peer" will give the `peer` object with different channels.
         * We will store all channels as backups in case any one of them fails
         * A peer is removed if all data channels become unavailable
         */
        this.peers[peer.id][peer.channelName] = peer

        if (newpeer) {
          this.emit('peerconnect', peer)
        }
      })

      peer.on('data', (incomingData: unknown) => {
        this.emit('data', peer, incomingData)

        let data = incomingData
        if (ArrayBuffer.isView(data)) data = arr2text(data as Uint8Array)

        debug('got a message from ' + peer.id)

        if (typeof data === 'string' && data[0] === JSON_MESSAGE_IDENTIFIER) {
          try {
            const parsedData = JSON.parse(data.slice(1)) as MessageEnvelope

            // A respond function
            peer.respond = this._peerRespond(peer, parsedData.id)

            const completedMessage = this._chunkHandler(parsedData)

            // msg fully retrieved
            if (completedMessage !== false) {
              let msg: unknown = completedMessage

              if (parsedData.o) {
                msg = JSON.parse(completedMessage) as unknown
              }

              if (this._isOnionPacket(msg)) {
                this._handleOnionPacket(peer, msg)
              } else if (this._isRoutedPacket(msg)) {
                this._handleRoutedPacket(peer, msg)
              } else if (this._isHiddenServiceRequestPacket(msg)) {
                void this._handleHiddenServiceRequest(peer, msg)
              } else if (this._isFileTransferPacket(msg)) {
                this._handleFileTransferPacket(peer, msg)
              } else if (this.responseWaiting[peer.id]?.[String(parsedData.id)]) {
                /**
                 * If there's someone waiting for a response, call them
                 */
                this.responseWaiting[peer.id][String(parsedData.id)]([peer, msg])
                delete this.responseWaiting[peer.id][String(parsedData.id)]
              } else {
                this.emit('msg', peer, msg)
              }
              this._destroyChunks(parsedData.id)
            }
          } catch (error) {
            console.log(error)
          }
        }
      })

      peer.on('error', err => {
        this._removePeer(peer)
        debug('Error in connection : ' + err)
      })

      // ferros simple-peer uses close
      peer.on('close', () => {
        this._removePeer(peer)
        debug('Connection closed with ' + peer.id)
      })

      // @thaunknown/simple-peer uses disconnect
      peer.on('disconnect', () => {
        this._removePeer(peer)
        debug('Connection disconnected with ' + peer.id)
      })
    })

    // Tracker responded to the announce request
    this.on('update', (response: { announce: string }) => {
      const tracker = this.trackers[this.announceURLs.indexOf(response.announce)]

      this.emit(
        'trackerconnect',
        tracker,
        this.getTrackerStats()
      )
    })

    // Errors in tracker connection
    this.on('warning', (err: object) => {
      this.emit(
        'trackerwarning',
        err,
        this.getTrackerStats()
      )
    })

    this._fetchPeers()
  }

  /**
   * Add a tracker
   */
  addTracker (announceURL: string): void {
    if (this.announceURLs.indexOf(announceURL) !== -1) {
      throw new Error('Tracker already added')
    }

    const key = this.announceURLs.push(announceURL) - 1

    this.trackers[key] = new WebSocketTracker(this, announceURL) as Tracker
    this.trackers[key].announce(this._defaultAnnounceOpts())
  }

  /**
   * Remove a tracker without destroying peers
   */
  removeTracker (announceURL: string): void {
    const key = this.announceURLs.indexOf(announceURL)

    if (key === -1) {
      return
    }

    // hack to not destroy peers
    this.trackers[key].peers = []
    this.trackers[key].destroy()

    delete this.trackers[key]
    this.announceURLs.splice(key, 1)
    this._reindexTrackers(key)
  }

  /**
   * Remove a peer from the list if all channels are closed
   */
  _removePeer (peer: Peer<SendableMessage>): false | void {
    if (!this.peers[peer.id]) { return false }

    delete this.peers[peer.id][peer.channelName]

    // All data channels are gone. Peer lost
    if (Object.keys(this.peers[peer.id]).length === 0) {
      this.emit('peerclose', peer)

      delete this.responseWaiting[peer.id]
      delete this.peers[peer.id]
    }
  }

  /**
   * Send a msg and get response for it
   */
  send (peer: Peer<SendableMessage>, msg: SendableMessage, msgID: MessageID = ''): Promise<ResponsePayload> {
    if (msgID === '' && this._options.onion) {
      return this._sendRoutedRequest(peer.id, msg)
    }

    return new Promise((resolve, reject) => {
      let data: MessageEnvelope

      try {
        peer = this._getConnectedPeer(peer)

        if (!this.responseWaiting[peer.id]) {
          this.responseWaiting[peer.id] = {}
        }
        data = this._createMessageEnvelope(msg, msgID)
        this.responseWaiting[peer.id][String(data.id)] = resolve
      } catch (error) {
        reject(Error('Connection to peer closed' + error))
        return
      }

      this._sendEnvelope(peer, data, true)
        .then(() => {
          debug('sent a message to ' + peer.id)
        })
        .catch(error => {
          delete this.responseWaiting[peer.id][String(data.id)]
          reject(Error('Connection to peer closed' + error))
        })
    })
  }

  /**
   * Send a multi-hop packet through intermediate peers.
   */
  sendOnion (targetPeerId: string, msg: OnionMessage, options: OnionRouteOptions = {}): OnionRouteInfo {
    const route = this._resolveOnionRoute(targetPeerId, options)
    const circuitId = this._createPacketId()
    void this._sendViaRoute(route, msg, circuitId, options.ttl, true)

    return {
      circuitId,
      route
    }
  }

  /**
   * Send a file in progressive chunks.
   */
  async sendFile (peer: Peer<SendableMessage>, file: Blob, options: FileSendOptions = {}): Promise<FileSession> {
    const connectedPeer = this._getConnectedPeer(peer)
    const chunkSize = Math.max(1024, options.chunkSize ?? DEFAULT_FILE_CHUNK_SIZE)
    const transferId = this._createPacketId()
    const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize))
    const routing = this._resolveConfiguredRoute(connectedPeer.id)
    const transfer: FileTransferInfo = {
      transferId,
      name: file instanceof File ? file.name : `ghostmesh-${transferId}`,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      chunkSize,
      totalChunks,
      receivedBytes: 0,
      metadata: options.metadata
    }
    const session = new FileSession(
      transfer,
      connectedPeer.id,
      'outgoing',
      file,
      undefined,
      {
        cancel: async (reason) => {
          try {
            await this._sendInternalMessage(connectedPeer.id, {
              __ghostmeshInternal: 'file-cancel',
              transferId,
              reason
            } satisfies FileTransferCancelPacket, routing, true)
          } catch {}

          delete this.outgoingFiles[transferId]
        }
      }
    )
    this.outgoingFiles[transferId] = session

    void this._runOutgoingFileTransfer(session, connectedPeer.id, file, transfer, routing)
    return session
  }

  handleHiddenService (serviceName: string, handler: HiddenServiceHandler): void {
    this.hiddenServiceHandlers[serviceName] = handler
  }

  async requestHiddenService (
    serviceName: string,
    payload: unknown,
    options: HiddenServiceRequestOptions = {}
  ): Promise<unknown> {
    const configuredEntryPeers = options.entryPeerId ? [options.entryPeerId] : (this._hiddenService.entryPeers ?? [])
    if (configuredEntryPeers.length === 0) {
      throw new Error('No hidden service entry peer configured')
    }

    const entryPeerId = configuredEntryPeers[Math.floor(Math.random() * configuredEntryPeers.length)]
    const entryPeer = this._getPeerById(entryPeerId)
    const masterPublicKey = options.masterPublicKey ?? this._hiddenService.masterPublicKey
    if (!masterPublicKey) {
      throw new Error('Hidden service requests require masterPublicKey')
    }

    const clientKeyPair = this._identity.publicKey && this._identity.privateKey
      ? {
          publicKey: await importRsaPublicKey(this._identity.publicKey),
          privateKey: await importRsaPrivateKey(this._identity.privateKey)
        }
      : await createRsaKeyPair()
    const clientPublicKey = await exportRsaPublicKeyPem(clientKeyPair.publicKey)
    const requestId = this._createPacketId()
    const nonce = this._createPacketId()
    const requestedHops = Math.max(1, options.minHops ?? this._hiddenService.minHops ?? DEFAULT_HIDDEN_SERVICE_MIN_HOPS)
    const requestPacket = this._padHiddenServicePacket({
      __ghostmeshInternal: 'hidden-service-request',
      service: options.serviceName ?? serviceName ?? this._hiddenService.serviceName,
      requestId,
      nonce,
      clientPublicKey,
      requestedHops,
      body: await encryptHiddenPayload(payload, masterPublicKey)
    } satisfies HiddenServiceRequestPacket, options.fixedPacketBytes ?? this._hiddenService.fixedPacketBytes)
    const [, response] = await this.send(entryPeer, requestPacket as SendableMessage)

    if (!this._isHiddenServiceResponsePacket(response)) {
      throw new Error('Entry peer returned an invalid hidden service response')
    }

    if (response.requestId !== requestId || response.nonce !== nonce) {
      throw new Error('Hidden service response nonce mismatch')
    }

    return await decryptHiddenPayload(response.body, clientKeyPair.privateKey)
  }

  /**
   * Request more peers
   */
  requestMorePeers (): Promise<Record<string, Record<string, Peer<SendableMessage>>>> {
    return new Promise(resolve => {
      for (const key in this.trackers) {
        this.trackers[Number(key)].announce(this._defaultAnnounceOpts())
      }
      resolve(this.peers)
    })
  }

  /**
   * Get basic stats about tracker connections
   */
  getTrackerStats (): TrackerStats {
    let connectedCount = 0
    for (const key in this.trackers) {
      if (this.trackers[Number(key)].socket && this.trackers[Number(key)].socket?.connected) {
        connectedCount++
      }
    }

    return {
      connected: connectedCount,
      total: this.announceURLs.length
    }
  }

  /**
   * Destroy object
   */
  destroy (): void {
    let key: string
    for (key in this.peers) {
      for (const key2 in this.peers[key]) {
        this.peers[key][key2].destroy()
      }
    }
    for (key in this.trackers) {
      this.trackers[Number(key)].destroy()
    }
  }

  /**
   * A custom function binded on Peer object to easily respond back to message
   */
  _peerRespond (peer: Peer<SendableMessage>, msgID: MessageID) {
    return (msg: SendableMessage) => {
      return this.send(peer, msg, msgID)
    }
  }

  /**
   * Handle msg chunks. Returns false until the last chunk is received. Finally returns the entire msg
   */
  _chunkHandler (data: MessageEnvelope): string | false {
    if (!this.msgChunks[String(data.id)]) {
      this.msgChunks[String(data.id)] = []
    }

    this.msgChunks[String(data.id)][data.c ?? 0] = data.msg

    if (data.last) {
      const completeMsg = this.msgChunks[String(data.id)].join('')
      return completeMsg
    } else {
      return false
    }
  }

  /**
   * Remove all stored chunks of a particular message
   */
  _destroyChunks (msgID: MessageID): void {
    delete this.msgChunks[String(msgID)]
  }

  /**
   * Default announce options
   */
  _defaultAnnounceOpts (opts: AnnounceOptions = {}): AnnounceOptions {
    if (opts.numwant == null) opts.numwant = 50

    if (opts.uploaded == null) opts.uploaded = 0
    if (opts.downloaded == null) opts.downloaded = 0

    return opts
  }

  /**
   * Initialize trackers and fetch peers
   */
  _fetchPeers (): void {
    for (const key in this.announceURLs) {
      this.trackers[Number(key)] = new WebSocketTracker(this, this.announceURLs[Number(key)]) as Tracker
      this.trackers[Number(key)].announce(this._defaultAnnounceOpts())
    }
  }

  _createMessageEnvelope (msg: unknown, msgID: MessageID = ''): MessageEnvelope {
    const data: MessageEnvelope = {
      id: msgID !== '' ? msgID : Math.floor(Math.random() * 100000 + 100000),
      msg: msg as string
    }

    if (typeof msg === 'object') {
      data.msg = JSON.stringify(msg)
      data.o = 1
    }

    return data
  }

  async _sendEnvelope (peer: Peer<SendableMessage>, data: MessageEnvelope, useBackpressure = false): Promise<void> {
    let chunks = 0
    let remaining = ''
    let chunkData: MessageEnvelope = { ...data }

    while (chunkData.msg.length > 0) {
      chunkData.c = chunks

      remaining = chunkData.msg.slice(MAX_MESSAGE_LENGTH)
      chunkData.msg = chunkData.msg.slice(0, MAX_MESSAGE_LENGTH)

      if (!remaining) {
        chunkData.last = true
      } else {
        delete chunkData.last
      }

      const payload = JSON_MESSAGE_IDENTIFIER + JSON.stringify(chunkData)

      if (useBackpressure) {
        await this._sendRawWithRetry(peer, payload)
      } else {
        peer.send(payload)
      }

      chunkData = {
        ...chunkData,
        msg: remaining
      }
      chunks++
    }
  }

  async _sendOneWay (peer: Peer<SendableMessage>, msg: unknown, useBackpressure = false): Promise<void> {
    const connectedPeer = this._getConnectedPeer(peer)
    const data = this._createMessageEnvelope(msg)

    await this._sendEnvelope(connectedPeer, data, useBackpressure)
    debug('sent a one-way message to ' + connectedPeer.id)
  }

  async _sendInternalMessage (targetPeerId: string, msg: InternalMessage, route: string[] = [], useBackpressure = false): Promise<OnionRouteInfo | null> {
    if (route.length > 0) {
      const circuitId = this._createPacketId()
      await this._sendViaRoute(route, msg, circuitId, undefined, useBackpressure)
      return {
        circuitId,
        route
      }
    }

    const peer = this._getPeerById(targetPeerId)
    await this._sendOneWay(peer, msg, useBackpressure)
    return null
  }

  _sendRoutedRequest (targetPeerId: string, msg: SendableMessage, routeOverride?: string[]): Promise<ResponsePayload> {
    const route = routeOverride ?? this._resolveConfiguredRoute(targetPeerId)
    if (route.length === 0) {
      const peer = this._getPeerById(targetPeerId)
      return this.send(peer, msg, '')
    }

    return new Promise((resolve, reject) => {
      const requestId = this._createPacketId()
      const circuitId = this._createPacketId()
      const replyRoute = [...route.slice(0, -1)].reverse()
      replyRoute.push(this._peerId)

      const timeoutId = setTimeout(() => {
        delete this.pendingRequests[requestId]
        reject(new Error(`Timed out waiting for routed response after ${this._options.timeout}ms`))
      }, this._options.timeout)

      this.pendingRequests[requestId] = {
        resolve,
        reject,
        timeoutId
      }

      this._sendViaRoute(route, this._createRoutedPayload('route-request', msg, {
        circuitId,
        requestId,
        originPeerId: this._peerId,
        replyRoute
      }), circuitId, undefined, true).catch(error => {
        if (this.pendingRequests[requestId]?.timeoutId) {
          clearTimeout(this.pendingRequests[requestId].timeoutId)
        }
        delete this.pendingRequests[requestId]
        reject(error)
      })
    })
  }

  _resolveConfiguredRoute (targetPeerId: string): string[] {
    if (!this._options.onion) {
      return []
    }

    return this._resolveOnionRoute(targetPeerId, this._options.onion)
  }

  _resolveHiddenServiceMasterPeerId (serviceName: string): string | null {
    if (this._hiddenService.services?.[serviceName]) {
      return this._hiddenService.services[serviceName]
    }

    if (this._hiddenService.serviceName === serviceName && this._hiddenService.masterPeerId) {
      return this._hiddenService.masterPeerId
    }

    return this._hiddenService.masterPeerId ?? null
  }

  _resolveHiddenServiceRoute (targetPeerId: string, incomingPeerId?: string, requestedHops = DEFAULT_HIDDEN_SERVICE_MIN_HOPS): string[] {
    const explicitThrough = this._hiddenService.through ? [...this._hiddenService.through] : []
    if (explicitThrough.length > 0) {
      return [...explicitThrough, targetPeerId]
    }

    const intermediatesNeeded = Math.max(0, requestedHops - 1)
    const candidates = Object.keys(this.peers).filter(peerId => peerId !== targetPeerId && peerId !== incomingPeerId)
    const through: string[] = []

    for (let index = 0; index < intermediatesNeeded && candidates.length > 0; index++) {
      const randomIndex = Math.floor(Math.random() * candidates.length)
      through.push(candidates.splice(randomIndex, 1)[0])
    }

    return [...through, targetPeerId]
  }

  _getConnectedPeer (peer: Peer<SendableMessage>): Peer<SendableMessage> {
    /**
     * Maybe peer channel is closed, so use a different channel if available.
     */
    if (!peer.connected) {
      for (const index in this.peers[peer.id]) {
        const candidate = this.peers[peer.id][index]
        if (candidate.connected) {
          return candidate
        }
      }
    }

    if (!peer.connected) {
      throw new Error(`No connected channel available for peer ${peer.id}`)
    }

    return peer
  }

  _getPeerById (peerId: string): Peer<SendableMessage> {
    const channels = this.peers[peerId]

    if (!channels) {
      throw new Error(`Peer ${peerId} is not connected`)
    }

    for (const key in channels) {
      if (channels[key].connected) {
        return channels[key]
      }
    }

    throw new Error(`Peer ${peerId} does not have an active data channel`)
  }

  async _waitForPeerDrain (peer: Peer<SendableMessage>, maxBufferedAmount = MAX_BUFFERED_AMOUNT_BEFORE_WAIT): Promise<void> {
    const connectedPeer = this._getConnectedPeer(peer) as InternalPeer<SendableMessage>
    const channel = connectedPeer._channel

    if (!channel || typeof channel.bufferedAmount !== 'number') {
      return
    }

    while (connectedPeer.connected && channel.readyState === 'open' && channel.bufferedAmount > maxBufferedAmount) {
      await this._delay(SEND_RETRY_DELAY_MS)
    }
  }

  async _sendRawWithRetry (peer: Peer<SendableMessage>, payload: string): Promise<void> {
    const connectedPeer = this._getConnectedPeer(peer) as InternalPeer<SendableMessage>

    for (let attempt = 0; attempt < SEND_RETRY_ATTEMPTS; attempt++) {
      await this._waitForPeerDrain(connectedPeer)

      try {
        connectedPeer.send(payload)
        return
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (!message.includes('send queue is full')) {
          throw error
        }

        await this._delay(SEND_RETRY_DELAY_MS)
      }
    }

    throw new Error('Timed out waiting for RTCDataChannel capacity')
  }

  _delay (ms: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, ms)
    })
  }

  _isOnionPacket (msg: unknown): msg is OnionPacket {
    return typeof msg === 'object' && msg !== null && '__p2ptInternal' in msg
  }

  _isFileTransferPacket (msg: unknown): msg is FileTransferPacket {
    return typeof msg === 'object' &&
      msg !== null &&
      '__ghostmeshInternal' in msg &&
      (
        msg.__ghostmeshInternal === 'file-offer' ||
        msg.__ghostmeshInternal === 'file-chunk' ||
        msg.__ghostmeshInternal === 'file-range-request' ||
        msg.__ghostmeshInternal === 'file-cancel' ||
        msg.__ghostmeshInternal === 'file-end'
      )
  }

  _isRoutedPacket (msg: unknown): msg is RoutedPacket {
    return typeof msg === 'object' &&
      msg !== null &&
      '__ghostmeshInternal' in msg &&
      (msg.__ghostmeshInternal === 'route-request' || msg.__ghostmeshInternal === 'route-response')
  }

  _isHiddenServiceRequestPacket (msg: unknown): msg is HiddenServiceRequestPacket {
    return typeof msg === 'object' &&
      msg !== null &&
      '__ghostmeshInternal' in msg &&
      msg.__ghostmeshInternal === 'hidden-service-request'
  }

  _isHiddenServiceResponsePacket (msg: unknown): msg is HiddenServiceResponsePacket {
    return typeof msg === 'object' &&
      msg !== null &&
      '__ghostmeshInternal' in msg &&
      msg.__ghostmeshInternal === 'hidden-service-response'
  }

  _handleOnionPacket (peer: Peer<SendableMessage>, packet: OnionPacket): void {
    if (packet.ttl <= 0) {
      return
    }

    if (packet.__p2ptInternal === 'onion-forward') {
      const nextPeer = this._getPeerById(packet.nextPeerId)
      const nextPayload = JSON.parse(packet.payload) as OnionPacket
      nextPayload.ttl = packet.ttl - 1
      void this._sendOneWay(nextPeer, nextPayload, true)
      return
    }

    let msg: unknown = packet.msg
    if (packet.o) {
      msg = JSON.parse(packet.msg)
    }

    if (this._isRoutedPacket(msg)) {
      this._handleRoutedPacket(peer, msg)
      return
    }

    if (this._isFileTransferPacket(msg)) {
      this._handleFileTransferPacket(peer, msg)
      return
    }

    this.emit('onionmsg', peer, msg, {
      circuitId: packet.circuitId,
      route: []
    })
  }

  _handleRoutedPacket (peer: Peer<SendableMessage>, packet: RoutedPacket): void {
    if (packet.__ghostmeshInternal === 'route-response') {
      const pending = this.pendingRequests[packet.requestId]
      if (!pending) {
        return
      }

      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId)
      }

      let msg: unknown = packet.msg
      if (packet.o) {
        msg = JSON.parse(packet.msg)
      }

      delete this.pendingRequests[packet.requestId]
      pending.resolve([this._createRoutedPeer(peer, packet.originPeerId, packet.circuitId), msg])
      return
    }

    let msg: unknown = packet.msg
    if (packet.o) {
      msg = JSON.parse(packet.msg)
    }

    if (this._isHiddenServiceRequestPacket(msg)) {
      const routedPeer = this._createRoutedPeer(peer, packet.originPeerId, packet.circuitId, packet.replyRoute, packet.requestId)
      void this._handleHiddenServiceRequest(routedPeer, msg)
      return
    }

    const routedPeer = this._createRoutedPeer(peer, packet.originPeerId, packet.circuitId, packet.replyRoute, packet.requestId)
    this.emit('onionmsg', routedPeer, msg, {
      circuitId: packet.circuitId,
      route: packet.replyRoute.slice().reverse()
    })
    this.emit('msg', routedPeer, msg)
  }

  async _handleHiddenServiceRequest (peer: Peer<SendableMessage>, packet: HiddenServiceRequestPacket): Promise<void> {
    try {
      const handler = this.hiddenServiceHandlers[packet.service]

      if (handler) {
        if (!this._identity.privateKey) {
          throw new Error(`Hidden service "${packet.service}" requires identity.privateKey`)
        }

        const payload = await decryptHiddenPayload(packet.body, this._identity.privateKey)
        const result = await handler(payload, {
          requestId: packet.requestId,
          service: packet.service,
          nonce: packet.nonce,
          peer,
          clientPublicKey: packet.clientPublicKey
        })
        const responsePacket = this._padHiddenServicePacket({
          __ghostmeshInternal: 'hidden-service-response',
          service: packet.service,
          requestId: packet.requestId,
          nonce: packet.nonce,
          body: await encryptHiddenPayload(result, packet.clientPublicKey),
          realHops: 0,
          simulatedHops: 0,
          delayedMs: 0
        } satisfies HiddenServiceResponsePacket, this._hiddenService.fixedPacketBytes)

        await peer.respond(responsePacket as SendableMessage)
        return
      }

      const masterPeerId = this._resolveHiddenServiceMasterPeerId(packet.service)
      if (!masterPeerId) {
        throw new Error(`No hidden service route configured for "${packet.service}"`)
      }

      const route = this._resolveHiddenServiceRoute(masterPeerId, peer.id, packet.requestedHops)
      const startedAt = Date.now()
      const [, response] = await this._sendRoutedRequest(masterPeerId, packet as unknown as SendableMessage, route)
      if (!this._isHiddenServiceResponsePacket(response)) {
        throw new Error(`Hidden service "${packet.service}" returned an invalid response packet`)
      }

      const shapedResponse = await this._shapeHiddenServiceResponse(response, route, packet.requestedHops, startedAt)
      await peer.respond(shapedResponse as SendableMessage)
    } catch (error) {
      this.emit(
        'hiddenserviceerror',
        error instanceof Error ? error : new Error(String(error)),
        {
          service: packet.service,
          requestId: packet.requestId
        }
      )
    }
  }

  _handleFileTransferPacket (peer: Peer<SendableMessage>, packet: FileTransferPacket): void {
    if (packet.__ghostmeshInternal === 'file-offer') {
      const info: FileTransferInfo = {
        transferId: packet.transferId,
        name: packet.name,
        mimeType: packet.mimeType,
        size: packet.size,
        chunkSize: packet.chunkSize,
        totalChunks: packet.totalChunks,
        receivedBytes: 0,
        metadata: packet.metadata
      }
      const session = new FileSession(
        info,
        peer.id,
        'incoming',
        undefined,
        async (start, end) => {
          await this._sendInternalMessage(peer.id, {
            __ghostmeshInternal: 'file-range-request',
            transferId: packet.transferId,
            start,
            end
          } satisfies FileTransferRangeRequestPacket, [], true)
        },
        {
          cancel: async (reason) => {
            try {
              await this._sendInternalMessage(peer.id, {
                __ghostmeshInternal: 'file-cancel',
                transferId: packet.transferId,
                reason
              } satisfies FileTransferCancelPacket, [], true)
            } catch {}

            delete this.incomingFiles[packet.transferId]
          }
        }
      )

      this.incomingFiles[packet.transferId] = { session }
      this.emit('file', peer, session)
      return
    }

    if (packet.__ghostmeshInternal === 'file-range-request') {
      const session = this.outgoingFiles[packet.transferId]
      if (!session) {
        return
      }

      void (async () => {
        try {
          const range = await session.readRange(packet.start, packet.end)
          if (range.byteLength === 0) {
            return
          }

          await this._sendInternalMessage(peer.id, {
            __ghostmeshInternal: 'file-chunk',
            transferId: packet.transferId,
            chunkIndex: Math.floor(packet.start / Math.max(1, session.chunkSize)),
            offset: packet.start,
            data: this._bytesToBase64(range)
          } satisfies FileTransferChunkPacket, [], true)
        } catch (error) {
          debug(`Failed to serve range for ${packet.transferId}: ${String(error)}`)
        }
      })()
      return
    }

    if (packet.__ghostmeshInternal === 'file-cancel') {
      const outgoingSession = this.outgoingFiles[packet.transferId]
      if (outgoingSession) {
        outgoingSession._cancelLocal(packet.reason ?? 'Remote peer canceled transfer')
        delete this.outgoingFiles[packet.transferId]
      }

      const incomingState = this.incomingFiles[packet.transferId]
      if (incomingState) {
        incomingState.session._cancelLocal(packet.reason ?? 'Remote peer canceled transfer')
        delete this.incomingFiles[packet.transferId]
      }

      return
    }

    const transferState = this.incomingFiles[packet.transferId]
    if (!transferState) {
      return
    }

    const session = transferState.session

    if (packet.__ghostmeshInternal === 'file-chunk') {
      const chunk = this._base64ToBytes(packet.data)
      session.receivedBytes = Math.min(
        session.size,
        packet.offset + chunk.length
      )
      const event = {
        transfer: {
          transferId: session.transferId,
          name: session.name,
          mimeType: session.mimeType,
          size: session.size,
          chunkSize: session.chunkSize,
          totalChunks: session.totalChunks,
          receivedBytes: session.receivedBytes,
          metadata: session.metadata
        },
        chunkIndex: packet.chunkIndex,
        chunk,
        offset: packet.offset,
        receivedBytes: session.receivedBytes
      } satisfies FileChunkEvent

      session._appendChunk(chunk, packet.offset, event)
      return
    }

    session._markComplete()
    delete this.incomingFiles[packet.transferId]
  }

  _resolveOnionRoute (targetPeerId: string, options: OnionRouteOptions): string[] {
    const explicitRoute = options.through ? [...options.through] : this._pickRandomOnionHops(targetPeerId, options.hops ?? 2)
    const route = [...explicitRoute, targetPeerId]
    const uniquePeers = new Set(route)

    if (targetPeerId === this._peerId) {
      throw new Error('Cannot build an onion route to the current peer')
    }

    if (route.length === 0) {
      throw new Error('Onion route requires at least one destination peer')
    }

    if (uniquePeers.size !== route.length) {
      throw new Error('Onion route cannot contain duplicate peers')
    }

    for (const peerId of route) {
      this._getPeerById(peerId)
    }

    return route
  }

  _createRoutedPayload (
    type: RoutedPacket['__ghostmeshInternal'],
    msg: unknown,
    options: Omit<RoutedRequestPacket, '__ghostmeshInternal' | 'msg' | 'o'> | Omit<RoutedResponsePacket, '__ghostmeshInternal' | 'msg' | 'o'>
  ): RoutedPacket {
    const packet: RoutedPacket = {
      __ghostmeshInternal: type,
      ...options,
      msg: typeof msg === 'object' ? JSON.stringify(msg) : String(msg)
    } as RoutedPacket

    if (typeof msg === 'object') {
      packet.o = 1
    }

    return packet
  }

  _createRoutedPeer (
    peer: Peer<SendableMessage>,
    originPeerId: string,
    circuitId: string,
    replyRoute: string[] = [],
    requestId?: string
  ): RoutedPeer {
    const routedPeer = Object.create(peer) as RoutedPeer
    routedPeer.id = originPeerId
    routedPeer.channelName = `onion:${circuitId}`
    routedPeer.connected = true
    routedPeer.routeInfo = {
      circuitId,
      route: replyRoute.slice().reverse()
    }
    routedPeer.respond = async (msg: SendableMessage) => {
      if (replyRoute.length === 0) {
        throw new Error('No reply route available for this routed message')
      }

      const response = this._createRoutedPayload('route-response', msg, {
        circuitId,
        requestId: requestId ?? circuitId,
        originPeerId: this._peerId
      } as Omit<RoutedResponsePacket, '__ghostmeshInternal' | 'msg' | 'o'>)

      await this._sendViaRoute(replyRoute, response, circuitId, undefined, true)
      return [routedPeer, msg]
    }

    return routedPeer
  }

  _pickRandomOnionHops (targetPeerId: string, hops: number): string[] {
    const candidates = Object.keys(this.peers).filter(peerId => peerId !== targetPeerId)
    const route: string[] = []

    for (let index = 0; index < Math.max(hops, 0) && candidates.length > 0; index++) {
      const randomIndex = Math.floor(Math.random() * candidates.length)
      route.push(candidates.splice(randomIndex, 1)[0])
    }

    return route
  }

  _createOnionPacket (route: string[], msg: OnionMessage | InternalMessage, circuitId: string, ttl = route.length + 1): OnionPacket {
    let packet: OnionPacket = {
      __p2ptInternal: 'onion-deliver',
      circuitId,
      ttl,
      msg: typeof msg === 'object' ? JSON.stringify(msg) : msg
    }

    if (typeof msg === 'object') {
      packet.o = 1
    }

    for (let index = route.length - 2; index >= 0; index--) {
      packet = {
        __p2ptInternal: 'onion-forward',
        circuitId,
        ttl: ttl - (route.length - 1 - index),
        nextPeerId: route[index + 1],
        payload: JSON.stringify(packet)
      }
    }

    return packet
  }

  async _sendViaRoute (route: string[], msg: OnionMessage | InternalMessage, circuitId: string, ttl = route.length + 1, useBackpressure = false): Promise<void> {
    const packet = this._createOnionPacket(route, msg, circuitId, ttl)
    const firstPeer = this._getPeerById(route[0])
    await this._sendOneWay(firstPeer, packet, useBackpressure)
  }

  _createPacketId (): string {
    return arr2hex(randomBytes(8))
  }

  _padHiddenServicePacket<T extends HiddenServicePacket> (packet: T, fixedPacketBytes?: number): T {
    if (!fixedPacketBytes || fixedPacketBytes <= 0) {
      return packet
    }

    const paddedPacket = { ...packet }
    const currentSize = JSON.stringify(paddedPacket).length
    const paddingLength = Math.max(0, fixedPacketBytes - currentSize)

    if (paddingLength > 0) {
      paddedPacket.padding = '0'.repeat(paddingLength)
    }

    return paddedPacket as T
  }

  async _shapeHiddenServiceResponse (
    packet: HiddenServiceResponsePacket,
    route: string[],
    requestedHops: number,
    startedAt: number
  ): Promise<HiddenServiceResponsePacket> {
    const realHops = Math.max(1, route.length + 1)
    const simulatedHops = Math.max(realHops, requestedHops)
    let delayedMs = 0

    if (realHops < simulatedHops) {
      const [minDelay, maxDelay] = this._hiddenService.responseDelayMs ?? [1000, 5000]
      const delayRange = Math.max(0, maxDelay - minDelay)
      delayedMs = minDelay + Math.floor(Math.random() * (delayRange + 1))
      const elapsed = Date.now() - startedAt
      const remainingDelay = Math.max(0, delayedMs - elapsed)
      if (remainingDelay > 0) {
        await this._delay(remainingDelay)
      }
    }

    return this._padHiddenServicePacket({
      ...packet,
      realHops,
      simulatedHops,
      delayedMs
    }, this._hiddenService.fixedPacketBytes)
  }

  _bytesToBase64 (bytes: Uint8Array): string {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(bytes).toString('base64')
    }

    let binary = ''
    const chunkLength = 0x8000
    for (let index = 0; index < bytes.length; index += chunkLength) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkLength))
    }
    return btoa(binary)
  }

  _base64ToBytes (value: string): Uint8Array {
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(value, 'base64'))
    }

    const binary = atob(value)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index++) {
      bytes[index] = binary.charCodeAt(index)
    }
    return bytes
  }

  async _yieldToEventLoop (): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 0))
  }

  async _runOutgoingFileTransfer (
    session: FileSession,
    peerId: string,
    file: Blob,
    transfer: FileTransferInfo,
    routing: string[]
  ): Promise<void> {
    try {
      await this._sendInternalMessage(peerId, {
        __ghostmeshInternal: 'file-offer',
        transferId: transfer.transferId,
        name: transfer.name,
        mimeType: transfer.mimeType,
        size: transfer.size,
        chunkSize: transfer.chunkSize,
        totalChunks: transfer.totalChunks,
        metadata: transfer.metadata
      } satisfies FileTransferOfferPacket, routing, true)

      for (let chunkIndex = 0; chunkIndex < transfer.totalChunks; chunkIndex++) {
        if (session.canceled) {
          return
        }

        await session._waitWhilePaused()

        if (session.canceled) {
          return
        }

        const offset = chunkIndex * transfer.chunkSize
        const chunkBuffer = await file.slice(offset, offset + transfer.chunkSize).arrayBuffer()
        const chunk = new Uint8Array(chunkBuffer)
        const event = {
          transfer: { ...transfer },
          chunkIndex,
          chunk,
          offset,
          receivedBytes: Math.min(file.size, offset + chunk.length)
        } satisfies FileChunkEvent

        await this._sendInternalMessage(peerId, {
          __ghostmeshInternal: 'file-chunk',
          transferId: transfer.transferId,
          chunkIndex,
          offset,
          data: this._bytesToBase64(chunk)
        } satisfies FileTransferChunkPacket, routing, true)

        transfer.receivedBytes = event.receivedBytes
        session._appendChunk(chunk, offset, event, false)

        if (chunkIndex % 8 === 0) {
          await this._yieldToEventLoop()
        }
      }

      if (session.canceled) {
        return
      }

      await this._sendInternalMessage(peerId, {
        __ghostmeshInternal: 'file-end',
        transferId: transfer.transferId
      } satisfies FileTransferEndPacket, routing, true)

      session._markComplete()
      delete this.outgoingFiles[transfer.transferId]
    } catch (error) {
      session._markError(error instanceof Error ? error : new Error(String(error)))
      delete this.outgoingFiles[transfer.transferId]
    }
  }

  _reindexTrackers (deletedKey: number): void {
    const nextTrackers: Record<number, Tracker> = {}

    for (const key in this.trackers) {
      const numericKey = Number(key)
      const nextKey = numericKey > deletedKey ? numericKey - 1 : numericKey
      nextTrackers[nextKey] = this.trackers[numericKey]
    }

    this.trackers = nextTrackers
  }

  /**
   * Load the Node.js WebRTC implementation only when needed.
   */
  async _ensureWebRTCImplementation (): Promise<void> {
    if (this._wrtc || typeof window !== 'undefined') {
      return
    }

    try {
      const { default: wrtc } = await import('@roamhq/wrtc')
      this._wrtc = wrtc as RuntimeWebRTC
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(
        `Failed to load @roamhq/wrtc in Node.js. Install the optional dependency to use GhostMesh outside the browser. Original error: ${message}`
      )
    }
  }
}

export { GhostMesh as P2PT }
