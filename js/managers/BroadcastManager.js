/**
 * BroadcastManager - WebRTC peer-to-peer video sharing via PeerJS
 * Allows one device to be a "viewer" that receives videos from creators
 */
import { eventBus, Events } from '../core/EventBus.js';
import { settings } from './SettingsManager.js';

export class BroadcastManager {
    constructor() {
        this.peer = null;
        this.connections = new Map(); // Track connected creators
        this.isViewer = false;
        this.channelName = '';
        this.onVideoReceived = null; // Callback for received videos
    }

    /**
     * Start as a viewer - listen for incoming videos
     * @param {string} channelName - The channel to listen on
     * @returns {Promise<boolean>} Success
     */
    async startViewer(channelName) {
        if (this.peer) {
            this.stop();
        }

        // Check if PeerJS is loaded
        if (typeof Peer === 'undefined') {
            console.error('PeerJS not loaded!');
            throw new Error('PeerJS library not loaded');
        }

        this.channelName = channelName;
        this.isViewer = true;

        console.log('Starting viewer on channel:', channelName);

        return new Promise((resolve, reject) => {
            // Create peer with channel name as ID (viewer claims the channel)
            try {
                this.peer = new Peer(channelName, {
                    debug: 2,
                    config: {
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:stun1.l.google.com:19302' }
                        ]
                    }
                });
            } catch (e) {
                console.error('Failed to create Peer:', e);
                reject(e);
                return;
            }

            this.peer.on('open', (id) => {
                console.log(`Viewer registered on channel: ${id}`);
                eventBus.publish(Events.BROADCAST_STATUS, {
                    status: 'listening',
                    channel: channelName
                });
                resolve(true);
            });

            this.peer.on('connection', (conn) => {
                console.log('Creator connected:', conn.peer);
                this.handleIncomingConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.error('Peer error:', err);
                if (err.type === 'unavailable-id') {
                    eventBus.publish(Events.BROADCAST_STATUS, {
                        status: 'error',
                        message: 'Channel name already taken'
                    });
                } else {
                    eventBus.publish(Events.BROADCAST_STATUS, {
                        status: 'error',
                        message: err.message
                    });
                }
                reject(err);
            });

            this.peer.on('disconnected', () => {
                console.log('Peer disconnected, attempting reconnect...');
                this.peer.reconnect();
            });
        });
    }

    /**
     * Handle incoming connection from a creator
     */
    handleIncomingConnection(conn) {
        this.connections.set(conn.peer, conn);

        conn.on('open', () => {
            console.log('Connection open with:', conn.peer);
            eventBus.publish(Events.BROADCAST_STATUS, {
                status: 'connected',
                peer: conn.peer
            });
        });

        conn.on('data', (data) => {
            console.log('Received data, type:', data.type);

            if (data.type === 'video') {
                // Convert base64 data URL back to blob
                const base64Data = data.data;
                const byteString = atob(base64Data.split(',')[1]);
                const mimeType = data.mimeType || base64Data.split(',')[0].split(':')[1].split(';')[0];
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) {
                    ia[i] = byteString.charCodeAt(i);
                }
                const blob = new Blob([ab], { type: mimeType });
                console.log('Received video:', blob.size, 'bytes');

                eventBus.publish(Events.VIDEO_RECEIVED, { blob });

                if (this.onVideoReceived) {
                    this.onVideoReceived(blob);
                }
            }
        });

        conn.on('close', () => {
            console.log('Connection closed:', conn.peer);
            this.connections.delete(conn.peer);
        });

        conn.on('error', (err) => {
            console.error('Connection error:', err);
        });
    }

    /**
     * Send video to viewer (called by creator)
     * @param {Blob} videoBlob - The video to send
     * @param {string} channelName - The channel to send to
     * @returns {Promise<boolean>} Success
     */
    async sendVideo(videoBlob, channelName) {
        // Always create fresh peer for sending (avoids stale connection issues)
        if (this.peer && !this.isViewer) {
            this.peer.destroy();
            this.peer = null;
        }

        // Check if PeerJS is loaded
        if (typeof Peer === 'undefined') {
            console.error('PeerJS not loaded!');
            throw new Error('PeerJS library not loaded');
        }

        console.log('Creating sender peer...');

        // Create new peer for this send with explicit config for Safari compatibility
        const senderPeer = new Peer({
            debug: 2,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        return new Promise((resolve, reject) => {
            let connected = false;
            let timeoutId;

            senderPeer.on('open', (id) => {
                console.log('Sender peer ready:', id);
                console.log('Connecting to channel:', channelName);

                const conn = senderPeer.connect(channelName, {
                    reliable: true,
                    serialization: 'json'
                });

                conn.on('open', async () => {
                    connected = true;
                    clearTimeout(timeoutId);
                    console.log('Connected to viewer, sending video...');

                    eventBus.publish(Events.BROADCAST_STATUS, {
                        status: 'sending'
                    });

                    try {
                        // Convert blob to base64 string (more compatible than ArrayBuffer)
                        const reader = new FileReader();
                        const base64Promise = new Promise((res, rej) => {
                            reader.onload = () => res(reader.result);
                            reader.onerror = rej;
                        });
                        reader.readAsDataURL(videoBlob);
                        const base64Data = await base64Promise;

                        conn.send({
                            type: 'video',
                            data: base64Data,
                            mimeType: videoBlob.type,
                            size: videoBlob.size
                        });

                        console.log('Video sent:', videoBlob.size, 'bytes');

                        eventBus.publish(Events.BROADCAST_STATUS, {
                            status: 'sent'
                        });

                        // Clean up after short delay
                        setTimeout(() => {
                            conn.close();
                            senderPeer.destroy();
                        }, 1000);

                        resolve(true);
                    } catch (err) {
                        console.error('Send error:', err);
                        senderPeer.destroy();
                        reject(err);
                    }
                });

                conn.on('error', (err) => {
                    console.error('Connection error:', err);
                    eventBus.publish(Events.BROADCAST_STATUS, {
                        status: 'error',
                        message: 'Could not connect to viewer'
                    });
                    senderPeer.destroy();
                    reject(err);
                });
            });

            senderPeer.on('error', (err) => {
                console.error('Sender peer error:', err);
                senderPeer.destroy();
                reject(err);
            });

            // Timeout if connection doesn't complete
            timeoutId = setTimeout(() => {
                if (!connected) {
                    console.error('Connection timeout');
                    senderPeer.destroy();
                    reject(new Error('Connection timeout - is viewer online?'));
                }
            }, 15000);
        });
    }

    /**
     * Stop broadcasting/viewing
     */
    stop() {
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        this.connections.clear();
        this.isViewer = false;
        this.channelName = '';

        eventBus.publish(Events.BROADCAST_STATUS, { status: 'stopped' });
    }

    /**
     * Check if currently viewing
     */
    get isViewerMode() {
        return this.isViewer && this.peer && !this.peer.destroyed;
    }
}
