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
                    debug: 2
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
                // Reconstruct blob from array buffer
                const blob = new Blob([data.buffer], { type: data.mimeType });
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
        if (!this.peer) {
            // Create peer for sending
            this.peer = new Peer({
                debug: 1
            });

            await new Promise((resolve, reject) => {
                this.peer.on('open', resolve);
                this.peer.on('error', reject);
            });
        }

        return new Promise((resolve, reject) => {
            console.log(`Connecting to channel: ${channelName}`);

            const conn = this.peer.connect(channelName, {
                reliable: true
            });

            conn.on('open', async () => {
                console.log('Connected to viewer, sending video...');

                eventBus.publish(Events.BROADCAST_STATUS, {
                    status: 'sending'
                });

                try {
                    // Convert blob to array buffer for transfer
                    const buffer = await videoBlob.arrayBuffer();

                    conn.send({
                        type: 'video',
                        buffer: buffer,
                        mimeType: videoBlob.type,
                        size: videoBlob.size
                    });

                    console.log('Video sent:', videoBlob.size, 'bytes');

                    eventBus.publish(Events.BROADCAST_STATUS, {
                        status: 'sent'
                    });

                    resolve(true);
                } catch (err) {
                    console.error('Send error:', err);
                    reject(err);
                }
            });

            conn.on('error', (err) => {
                console.error('Connection error:', err);
                eventBus.publish(Events.BROADCAST_STATUS, {
                    status: 'error',
                    message: 'Could not connect to viewer'
                });
                reject(err);
            });

            // Timeout if connection doesn't open
            setTimeout(() => {
                if (!conn.open) {
                    reject(new Error('Connection timeout - is viewer online?'));
                }
            }, 10000);
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
