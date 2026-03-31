import { default as EventEmitter } from 'events';
type MessageID = number | string;
type TrackerKey = number;
type ResponsePayload = [peer: Peer, msg: unknown];
type ResponseResolver = (value: ResponsePayload) => void;
type ResponseRejector = (reason?: unknown) => void;
type OnionMessage = string | Record<string, unknown>;
interface TrackerSocket {
    connected?: boolean;
}
export interface TrackerStats {
    connected: number;
    total: number;
}
export interface Tracker {
    announceUrl: string;
    socket?: TrackerSocket;
    peers?: unknown[];
    announce(opts: AnnounceOptions): void;
    destroy(): void;
}
export interface Peer<SendableMessage = unknown> {
    id: string;
    channelName: string;
    connected?: boolean;
    respond(msg: SendableMessage): Promise<ResponsePayload>;
    isServer(): Promise<boolean>;
    on(event: string, listener: (...args: any[]) => void): void;
    send(data: string): void;
    destroy(): void;
}
interface MessageEnvelope {
    id: MessageID;
    msg: string;
    c?: number;
    last?: boolean;
    o?: 1;
}
interface AnnounceOptions {
    numwant?: number;
    uploaded?: number;
    downloaded?: number;
}
interface RuntimeWebRTC {
    [key: string]: unknown;
}
interface OnionRouteOptions {
    hops?: number;
    through?: string[];
    ttl?: number;
}
type GhostMeshRole = 'client' | 'entry' | 'master' | 'relay';
type KeyMaterial = CryptoKey | string;
export interface IdentityOptions {
    role?: GhostMeshRole;
    publicKey?: KeyMaterial;
    privateKey?: KeyMaterial;
}
export interface HiddenServiceOptions {
    role?: 'client' | 'entry' | 'master';
    serviceName?: string;
    entryPeers?: string[];
    masterPeerId?: string;
    services?: Record<string, string>;
    masterPublicKey?: KeyMaterial;
    revealServer?: boolean;
    minHops?: number;
    through?: string[];
    responseDelayMs?: [number, number];
    fixedPacketBytes?: number;
}
export interface HiddenServiceRequestOptions {
    entryPeerId?: string;
    serviceName?: string;
    masterPublicKey?: KeyMaterial;
    minHops?: number;
    fixedPacketBytes?: number;
}
export interface HiddenServiceRequestContext {
    requestId: string;
    service: string;
    nonce: string;
    peer: Peer;
    clientPublicKey: string;
}
type HiddenServiceHandler = (payload: unknown, context: HiddenServiceRequestContext) => Promise<unknown> | unknown;
interface GhostMeshOptions {
    timeout?: number;
    onion?: OnionRouteOptions | false;
    Onion?: OnionRouteOptions | false;
    iceServers?: RTCIceServer[];
    iceTransportPolicy?: RTCIceTransportPolicy;
    identity?: IdentityOptions;
    hiddenService?: HiddenServiceOptions;
}
export interface OnionRouteInfo {
    circuitId: string;
    route: string[];
}
export interface FileTransferInfo {
    transferId: string;
    name: string;
    mimeType: string;
    size: number;
    chunkSize: number;
    totalChunks: number;
    receivedBytes: number;
    metadata?: Record<string, unknown>;
}
export interface FileChunkEvent {
    transfer: FileTransferInfo;
    chunkIndex: number;
    chunk: Uint8Array;
    offset: number;
    receivedBytes: number;
}
export interface FileStreamOptions {
    start?: number;
    end?: number;
}
type FileSessionStatus = 'offered' | 'streaming' | 'paused' | 'complete' | 'error' | 'sending' | 'sent' | 'canceled';
interface FileChunkRecord {
    chunk: Uint8Array;
    offset: number;
}
interface FileStreamSubscriber {
    controller: ReadableStreamDefaultController<Uint8Array>;
    start: number;
    end: number;
}
interface OnionDeliverPacket {
    __p2ptInternal: 'onion-deliver';
    circuitId: string;
    ttl: number;
    msg: string;
    o?: 1;
}
interface OnionForwardPacket {
    __p2ptInternal: 'onion-forward';
    circuitId: string;
    ttl: number;
    nextPeerId: string;
    payload: string;
}
type OnionPacket = OnionDeliverPacket | OnionForwardPacket;
interface FileTransferOfferPacket {
    __ghostmeshInternal: 'file-offer';
    transferId: string;
    name: string;
    mimeType: string;
    size: number;
    chunkSize: number;
    totalChunks: number;
    metadata?: Record<string, unknown>;
}
interface FileTransferChunkPacket {
    __ghostmeshInternal: 'file-chunk';
    transferId: string;
    chunkIndex: number;
    offset: number;
    data: string;
}
interface FileTransferRangeRequestPacket {
    __ghostmeshInternal: 'file-range-request';
    transferId: string;
    start: number;
    end: number;
}
interface FileTransferCancelPacket {
    __ghostmeshInternal: 'file-cancel';
    transferId: string;
    reason?: string;
}
interface FileTransferEndPacket {
    __ghostmeshInternal: 'file-end';
    transferId: string;
}
type FileTransferPacket = FileTransferOfferPacket | FileTransferChunkPacket | FileTransferRangeRequestPacket | FileTransferCancelPacket | FileTransferEndPacket;
interface IncomingFileTransferState {
    session: FileSession;
}
interface FileSessionController {
    pause?: () => void;
    resume?: () => void;
    cancel?: (reason?: string) => Promise<void> | void;
}
interface FileSendOptions {
    chunkSize?: number;
    metadata?: Record<string, unknown>;
}
interface PendingRequest {
    resolve: ResponseResolver;
    reject: ResponseRejector;
    timeoutId?: ReturnType<typeof setTimeout>;
}
interface ForwardedHiddenServiceRequest {
    timeoutId: ReturnType<typeof setTimeout>;
}
interface RoutedPeer extends Peer<any> {
    routeInfo: OnionRouteInfo;
}
interface RoutedRequestPacket {
    __ghostmeshInternal: 'route-request';
    circuitId: string;
    requestId: string;
    originPeerId: string;
    replyRoute: string[];
    msg: string;
    o?: 1;
}
interface RoutedResponsePacket {
    __ghostmeshInternal: 'route-response';
    circuitId: string;
    requestId: string;
    originPeerId: string;
    msg: string;
    o?: 1;
}
type RoutedPacket = RoutedRequestPacket | RoutedResponsePacket;
interface HiddenServiceCiphertext {
    encryptedKey: string;
    iv: string;
    ciphertext: string;
}
interface HiddenServiceRequestPacket {
    __ghostmeshInternal: 'hidden-service-request';
    service: string;
    requestId: string;
    nonce: string;
    clientPublicKey: string;
    requestedHops: number;
    body: HiddenServiceCiphertext;
    padding?: string;
}
interface HiddenServiceResponsePacket {
    __ghostmeshInternal: 'hidden-service-response';
    service: string;
    requestId: string;
    nonce: string;
    body: HiddenServiceCiphertext;
    realHops: number;
    simulatedHops: number;
    delayedMs: number;
    padding?: string;
}
interface HiddenServiceErrorPayload {
    __ghostmeshInternal: 'hidden-service-error';
    code: 'duplicate-request';
    message: string;
}
interface ServerRevealRequestPacket {
    __ghostmeshInternal: 'server-reveal-request';
    challenge: HiddenServiceCiphertext;
}
type HiddenServicePacket = HiddenServiceRequestPacket | HiddenServiceResponsePacket;
type InternalMessage = FileTransferPacket | RoutedPacket | HiddenServicePacket;
export declare class FileSession extends EventEmitter implements FileTransferInfo {
    transferId: string;
    name: string;
    mimeType: string;
    size: number;
    chunkSize: number;
    totalChunks: number;
    receivedBytes: number;
    metadata?: Record<string, unknown>;
    peerId: string;
    direction: 'incoming' | 'outgoing';
    status: FileSessionStatus;
    private readonly _subscribers;
    private readonly _receivedOffsets;
    private readonly _store;
    private _writeQueue;
    private _completionPromise;
    private _resolveCompletion;
    private _rejectCompletion;
    private _completionSettled;
    private _objectUrl?;
    private readonly _sourceBlob?;
    private readonly _requestRange?;
    private readonly _controller?;
    private _isPaused;
    private _pausePromise?;
    private _resumePause?;
    private _isCanceled;
    constructor(info: FileTransferInfo, peerId: string, direction: 'incoming' | 'outgoing', sourceBlob?: Blob, requestRange?: (start: number, end: number) => Promise<void>, controller?: FileSessionController);
    get progress(): number;
    get canceled(): boolean;
    on(event: 'progress', callback: (session: FileSession, event?: FileChunkEvent) => void): this;
    on(event: 'complete', callback: (session: FileSession) => void): this;
    on(event: 'error', callback: (error: Error, session: FileSession) => void): this;
    on(event: 'pause' | 'resume' | 'cancel', callback: (session: FileSession) => void): this;
    waitUntilComplete(): Promise<void>;
    pause(): void;
    resume(): void;
    cancel(reason?: string): Promise<void>;
    destroy(): Promise<void>;
    _cancelLocal(reason: string): void;
    stream(options?: FileStreamOptions): ReadableStream<Uint8Array>;
    blob(): Promise<Blob>;
    readRange(start?: number, end?: number): Promise<Uint8Array>;
    objectURL(): Promise<string>;
    streamTo(element: HTMLMediaElement | HTMLImageElement): Promise<void>;
    _appendChunk(chunk: Uint8Array, offset: number, event?: FileChunkEvent, storeChunk?: boolean): void;
    _markComplete(): void;
    _markError(error: Error): void;
    _enqueueRecord(subscriber: FileStreamSubscriber, record: FileChunkRecord): void;
    _toArrayBuffer(bytes: Uint8Array): ArrayBuffer;
    _streamBlobRange(blob: Blob, start: number, end: number): ReadableStream<Uint8Array>;
    _streamVideoWithProgressiveBlob(mediaElement: HTMLMediaElement): Promise<void>;
    _getStoredRange(start: number, end: number): Promise<FileChunkRecord[]>;
    _waitWhilePaused(): Promise<void>;
    _finalizeCompletion(): Promise<void>;
}
export default class GhostMesh<SendableMessage = any> extends EventEmitter {
    announceURLs: string[];
    trackers: Record<TrackerKey, Tracker>;
    peers: Record<string, Record<string, Peer<SendableMessage>>>;
    msgChunks: Record<string, string[]>;
    responseWaiting: Record<string, Record<string, ResponseResolver>>;
    pendingRequests: Record<string, PendingRequest>;
    forwardedHiddenServiceRequests: Record<string, ForwardedHiddenServiceRequest>;
    incomingFiles: Record<string, IncomingFileTransferState>;
    outgoingFiles: Record<string, FileSession>;
    identifierString?: string;
    infoHash?: Promise<string>;
    _peerIdBuffer: Uint8Array;
    _peerId: string;
    _peerIdBinary: string;
    _infoHashBuffer?: Uint8Array;
    _infoHashBinary?: string;
    _rtcConfig: RTCConfiguration;
    _options: Required<Pick<GhostMeshOptions, 'timeout'>> & {
        onion: OnionRouteOptions | false;
    };
    _identity: IdentityOptions;
    _hiddenService: HiddenServiceOptions;
    hiddenServiceHandlers: Record<string, HiddenServiceHandler>;
    _wrtc?: RuntimeWebRTC;
    /**
     *
     * @param announceURLs List of announce tracker URLs
     * @param identifierString Identifier used to discover peers in the network
     */
    constructor(announceURLs?: string[], identifierString?: string);
    on(event: 'peerconnect', callback: (peer: Peer<SendableMessage>) => void): this;
    on(event: 'data', callback: (peer: Peer<SendableMessage>, data: unknown) => void): this;
    on(event: 'msg', callback: (peer: Peer<SendableMessage>, msg: unknown) => void): this;
    on(event: 'peerclose', callback: (peer: Peer<SendableMessage>) => void): this;
    on(event: 'trackerconnect', callback: (tracker: Tracker, stats: TrackerStats) => void): this;
    on(event: 'trackerwarning', callback: (error: object, stats: TrackerStats) => void): this;
    on(event: 'onionmsg', callback: (peer: Peer<SendableMessage>, msg: unknown, route: OnionRouteInfo) => void): this;
    on(event: 'file', callback: (peer: Peer<SendableMessage>, session: FileSession) => void): this;
    on(event: 'hiddenserviceerror', callback: (error: Error, info: {
        service: string;
        requestId?: string;
    }) => void): this;
    on(event: 'peer', callback: (peer: Peer<SendableMessage>) => void): this;
    on(event: 'update', callback: (response: {
        announce: string;
    }) => void): this;
    on(event: 'warning', callback: (error: object) => void): this;
    /**
     * Set the identifier string used to discover peers in the network
     */
    setIdentifier(identifierString: string): Promise<void>;
    /**
     * Configure runtime options for transport and default routing.
     */
    setOptions(options: RTCConfiguration & GhostMeshOptions): void;
    /**
     * Connect to network and start discovering peers
     */
    start(): Promise<void>;
    /**
     * Add a tracker
     */
    addTracker(announceURL: string): void;
    /**
     * Remove a tracker without destroying peers
     */
    removeTracker(announceURL: string): void;
    /**
     * Remove a peer from the list if all channels are closed
     */
    _removePeer(peer: Peer<SendableMessage>): false | void;
    /**
     * Send a msg and get response for it
     */
    send(peer: Peer<SendableMessage>, msg: SendableMessage, msgID?: MessageID): Promise<ResponsePayload>;
    /**
     * Send a multi-hop packet through intermediate peers.
     */
    sendOnion(targetPeerId: string, msg: OnionMessage, options?: OnionRouteOptions): OnionRouteInfo;
    /**
     * Send a file in progressive chunks.
     */
    sendFile(peer: Peer<SendableMessage>, file: Blob, options?: FileSendOptions): Promise<FileSession>;
    handleHiddenService(serviceName: string, handler: HiddenServiceHandler): void;
    requestHiddenService(serviceName: string, payload: unknown, options?: HiddenServiceRequestOptions): Promise<unknown>;
    /**
     * Request more peers
     */
    requestMorePeers(): Promise<Record<string, Record<string, Peer<SendableMessage>>>>;
    /**
     * Get basic stats about tracker connections
     */
    getTrackerStats(): TrackerStats;
    /**
     * Destroy object
     */
    destroy(): void;
    /**
     * A custom function binded on Peer object to easily respond back to message
     */
    _peerRespond(peer: Peer<SendableMessage>, msgID: MessageID): (msg: SendableMessage) => Promise<ResponsePayload>;
    /**
     * Handle msg chunks. Returns false until the last chunk is received. Finally returns the entire msg
     */
    _chunkHandler(data: MessageEnvelope): string | false;
    /**
     * Remove all stored chunks of a particular message
     */
    _destroyChunks(msgID: MessageID): void;
    /**
     * Default announce options
     */
    _defaultAnnounceOpts(opts?: AnnounceOptions): AnnounceOptions;
    /**
     * Initialize trackers and fetch peers
     */
    _fetchPeers(): void;
    _createMessageEnvelope(msg: unknown, msgID?: MessageID): MessageEnvelope;
    _sendEnvelope(peer: Peer<SendableMessage>, data: MessageEnvelope, useBackpressure?: boolean): Promise<void>;
    _sendOneWay(peer: Peer<SendableMessage>, msg: unknown, useBackpressure?: boolean): Promise<void>;
    _sendInternalMessage(targetPeerId: string, msg: InternalMessage, route?: string[], useBackpressure?: boolean): Promise<OnionRouteInfo | null>;
    _sendRoutedRequest(targetPeerId: string, msg: SendableMessage, routeOverride?: string[]): Promise<ResponsePayload>;
    _resolveConfiguredRoute(targetPeerId: string): string[];
    _resolveHiddenServiceMasterPeerId(serviceName: string): string | null;
    _resolveHiddenServiceRoute(targetPeerId: string, incomingPeerId?: string, requestedHops?: number): string[];
    _getConnectedPeer(peer: Peer<SendableMessage>): Peer<SendableMessage>;
    _getPeerById(peerId: string): Peer<SendableMessage>;
    _waitForPeerDrain(peer: Peer<SendableMessage>, maxBufferedAmount?: number): Promise<void>;
    _sendRawWithRetry(peer: Peer<SendableMessage>, payload: string): Promise<void>;
    _delay(ms: number): Promise<void>;
    _isOnionPacket(msg: unknown): msg is OnionPacket;
    _isFileTransferPacket(msg: unknown): msg is FileTransferPacket;
    _isRoutedPacket(msg: unknown): msg is RoutedPacket;
    _isHiddenServiceRequestPacket(msg: unknown): msg is HiddenServiceRequestPacket;
    _isHiddenServiceResponsePacket(msg: unknown): msg is HiddenServiceResponsePacket;
    _isServerRevealRequestPacket(msg: unknown): msg is ServerRevealRequestPacket;
    _isHiddenServiceErrorPayload(msg: unknown): msg is HiddenServiceErrorPayload;
    _handleOnionPacket(peer: Peer<SendableMessage>, packet: OnionPacket): void;
    _handleRoutedPacket(peer: Peer<SendableMessage>, packet: RoutedPacket): void;
    _handleHiddenServiceRequest(peer: Peer<SendableMessage>, packet: HiddenServiceRequestPacket): Promise<void>;
    _handleServerRevealRequest(peer: Peer<SendableMessage>, packet: ServerRevealRequestPacket): Promise<void>;
    _handleFileTransferPacket(peer: Peer<SendableMessage>, packet: FileTransferPacket): void;
    _resolveOnionRoute(targetPeerId: string, options: OnionRouteOptions): string[];
    _createRoutedPayload(type: RoutedPacket['__ghostmeshInternal'], msg: unknown, options: Omit<RoutedRequestPacket, '__ghostmeshInternal' | 'msg' | 'o'> | Omit<RoutedResponsePacket, '__ghostmeshInternal' | 'msg' | 'o'>): RoutedPacket;
    _createRoutedPeer(peer: Peer<SendableMessage>, originPeerId: string, circuitId: string, replyRoute?: string[], requestId?: string): RoutedPeer;
    _pickRandomOnionHops(targetPeerId: string, hops: number): string[];
    _decoratePeer(peer: Peer<SendableMessage>): void;
    _createOnionPacket(route: string[], msg: OnionMessage | InternalMessage, circuitId: string, ttl?: number): OnionPacket;
    _sendViaRoute(route: string[], msg: OnionMessage | InternalMessage, circuitId: string, ttl?: number, useBackpressure?: boolean): Promise<void>;
    _createPacketId(): string;
    _peerIsServer(peer: Peer<SendableMessage>): Promise<boolean>;
    _createHiddenServiceForwardKey(packet: HiddenServiceRequestPacket): string;
    _createHiddenServiceErrorResponse(packet: HiddenServiceRequestPacket, message: string): Promise<HiddenServiceResponsePacket>;
    _padHiddenServicePacket<T extends HiddenServicePacket>(packet: T, fixedPacketBytes?: number): T;
    _shapeHiddenServiceResponse(packet: HiddenServiceResponsePacket, route: string[], requestedHops: number, startedAt: number): Promise<HiddenServiceResponsePacket>;
    _bytesToBase64(bytes: Uint8Array): string;
    _base64ToBytes(value: string): Uint8Array;
    _yieldToEventLoop(): Promise<void>;
    _runOutgoingFileTransfer(session: FileSession, peerId: string, file: Blob, transfer: FileTransferInfo, routing: string[]): Promise<void>;
    _reindexTrackers(deletedKey: number): void;
    /**
     * Load the Node.js WebRTC implementation only when needed.
     */
    _ensureWebRTCImplementation(): Promise<void>;
}
export { GhostMesh as P2PT };
