/**
 * FirebaseSignaling - WebRTC signaling via Firebase Realtime Database
 * Replaces PeerJS with direct WebRTC + Firebase for signaling
 */
import { eventBus, Events } from '../core/EventBus.js';

// Firebase config
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyB8bEaV3CIjvwfZLSx8CW4FXMBLSzGpAXs",
    authDomain: "stop-motion-share.firebaseapp.com",
    databaseURL: "https://stop-motion-share-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "stop-motion-share",
    storageBucket: "stop-motion-share.firebasestorage.app",
    messagingSenderId: "306828704754",
    appId: "1:306828704754:web:e47ada08f0442871b1496b"
};

// WebRTC config
const RTC_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

export class FirebaseSignaling {
    constructor() {
        this.db = null;
        this.channelRef = null;
        this.peerConnection = null;
        this.dataChannel = null;
        this.isViewer = false;
        this.channelName = '';
        this.onVideoReceived = null;
        this.initialized = false;
    }

    /**
     * Initialize Firebase
     */
    async init() {
        if (this.initialized) return;

        // Dynamically load Firebase SDK
        if (!window.firebase) {
            await this.loadFirebaseSDK();
        }

        // Initialize Firebase app
        if (!firebase.apps.length) {
            firebase.initializeApp(FIREBASE_CONFIG);
        }

        this.db = firebase.database();
        this.initialized = true;
        console.log('Firebase initialized');
    }

    /**
     * Load Firebase SDK dynamically
     */
    async loadFirebaseSDK() {
        return new Promise((resolve, reject) => {
            // Load Firebase app
            const appScript = document.createElement('script');
            appScript.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js';
            appScript.onload = () => {
                // Load Firebase database
                const dbScript = document.createElement('script');
                dbScript.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js';
                dbScript.onload = resolve;
                dbScript.onerror = reject;
                document.head.appendChild(dbScript);
            };
            appScript.onerror = reject;
            document.head.appendChild(appScript);
        });
    }

    /**
     * Start as viewer - wait for incoming connections
     */
    async startViewer(channelName) {
        await this.init();

        this.isViewer = true;
        this.channelName = channelName;
        this.channelRef = this.db.ref('channels/' + channelName);

        // Clear any old data
        await this.channelRef.remove();

        // Mark channel as active with viewer waiting
        await this.channelRef.child('viewer').set({
            active: true,
            timestamp: Date.now()
        });

        // Listen for offers from senders
        this.channelRef.child('offer').on('value', async (snapshot) => {
            const offer = snapshot.val();
            if (offer && offer.sdp) {
                console.log('Received offer, creating answer...');
                await this.handleOffer(offer);
            }
        });

        console.log('Viewer listening on channel:', channelName);
        eventBus.publish(Events.BROADCAST_STATUS, {
            status: 'listening',
            channel: channelName
        });

        return true;
    }

    /**
     * Handle incoming offer from sender
     */
    async handleOffer(offer) {
        // Create peer connection
        this.peerConnection = new RTCPeerConnection(RTC_CONFIG);

        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.channelRef.child('viewerCandidates').push(event.candidate.toJSON());
            }
        };

        // Handle incoming data channel
        this.peerConnection.ondatachannel = (event) => {
            console.log('Data channel received');
            this.dataChannel = event.channel;
            this.setupDataChannel();
        };

        // Set remote description (the offer)
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

        // Create and set local description (the answer)
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        // Send answer to Firebase
        await this.channelRef.child('answer').set({
            type: answer.type,
            sdp: answer.sdp
        });

        // Listen for sender's ICE candidates
        this.channelRef.child('senderCandidates').on('child_added', async (snapshot) => {
            const candidate = snapshot.val();
            if (candidate) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }
        });
    }

    /**
     * Setup data channel event handlers
     */
    setupDataChannel() {
        // For reassembling chunked messages
        this.receivedChunks = [];
        this.expectedChunks = 0;

        this.dataChannel.onopen = () => {
            console.log('Data channel open');
        };

        this.dataChannel.onmessage = (event) => {
            // Handle received video data (may be chunked)
            try {
                const message = JSON.parse(event.data);

                if (message.type === 'chunk') {
                    // Chunked transfer
                    console.log(`Received chunk ${message.index + 1}/${message.total}`);
                    this.receivedChunks[message.index] = message.data;
                    this.expectedChunks = message.total;

                    // Check if we have all chunks
                    const received = this.receivedChunks.filter(c => c !== undefined).length;
                    if (received === this.expectedChunks) {
                        console.log('All chunks received, reassembling...');
                        const fullData = this.receivedChunks.join('');
                        const blob = this.base64ToBlob(fullData, message.mimeType);
                        console.log('Video blob created:', blob.size, 'bytes');
                        eventBus.publish(Events.VIDEO_RECEIVED, { blob });

                        // Reset for next transfer
                        this.receivedChunks = [];
                        this.expectedChunks = 0;
                    }
                } else if (message.type === 'video') {
                    // Single message (small video)
                    console.log('Received complete video');
                    const blob = this.base64ToBlob(message.data, message.mimeType);
                    console.log('Video blob created:', blob.size, 'bytes');
                    eventBus.publish(Events.VIDEO_RECEIVED, { blob });
                }
            } catch (e) {
                console.error('Error processing received data:', e);
            }
        };

        this.dataChannel.onerror = (error) => {
            console.error('Data channel error:', error);
        };

        this.dataChannel.onclose = () => {
            console.log('Data channel closed');
        };
    }

    /**
     * Send video to viewer
     */
    async sendVideo(videoBlob, channelName) {
        await this.init();

        this.channelName = channelName;
        this.channelRef = this.db.ref('channels/' + channelName);

        // Check if viewer is active
        const viewerSnapshot = await this.channelRef.child('viewer').once('value');
        const viewer = viewerSnapshot.val();

        if (!viewer || !viewer.active) {
            throw new Error('No viewer on channel');
        }

        // Create peer connection
        this.peerConnection = new RTCPeerConnection(RTC_CONFIG);

        // Create data channel
        this.dataChannel = this.peerConnection.createDataChannel('video', {
            ordered: true
        });

        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.channelRef.child('senderCandidates').push(event.candidate.toJSON());
            }
        };

        // Create offer
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);

        // Clear old signaling data and send offer
        await this.channelRef.child('offer').remove();
        await this.channelRef.child('answer').remove();
        await this.channelRef.child('senderCandidates').remove();
        await this.channelRef.child('viewerCandidates').remove();

        await this.channelRef.child('offer').set({
            type: offer.type,
            sdp: offer.sdp
        });

        // Wait for answer
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, 15000);

            this.channelRef.child('answer').on('value', async (snapshot) => {
                const answer = snapshot.val();
                if (answer && answer.sdp) {
                    console.log('Received answer');
                    clearTimeout(timeout);

                    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

                    // Listen for viewer's ICE candidates
                    this.channelRef.child('viewerCandidates').on('child_added', async (snapshot) => {
                        const candidate = snapshot.val();
                        if (candidate) {
                            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                        }
                    });

                    // Wait for data channel to open, then send
                    this.dataChannel.onopen = async () => {
                        console.log('Data channel open, sending video...');
                        try {
                            await this.sendVideoData(videoBlob);
                            resolve(true);
                        } catch (e) {
                            reject(e);
                        }
                    };

                    this.dataChannel.onerror = (e) => {
                        reject(new Error('Data channel error'));
                    };
                }
            });
        });
    }

    /**
     * Send video data over data channel
     */
    async sendVideoData(videoBlob) {
        // Convert to base64
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
        });
        reader.readAsDataURL(videoBlob);
        const base64Data = await base64Promise;

        // Chunk size (keep well under typical WebRTC limits)
        const CHUNK_SIZE = 16000;
        const base64Only = base64Data.split(',')[1]; // Remove data URL prefix
        const mimeType = videoBlob.type;

        if (base64Only.length < CHUNK_SIZE) {
            // Small enough to send in one message
            const message = JSON.stringify({
                type: 'video',
                data: base64Data,
                mimeType: mimeType,
                size: videoBlob.size
            });
            this.dataChannel.send(message);
            console.log('Video sent in single message:', videoBlob.size, 'bytes');
        } else {
            // Split into chunks
            const totalChunks = Math.ceil(base64Only.length / CHUNK_SIZE);
            console.log(`Sending video in ${totalChunks} chunks...`);

            for (let i = 0; i < totalChunks; i++) {
                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, base64Only.length);
                const chunkData = base64Only.slice(start, end);

                const chunk = JSON.stringify({
                    type: 'chunk',
                    index: i,
                    total: totalChunks,
                    data: chunkData,
                    mimeType: mimeType
                });

                this.dataChannel.send(chunk);

                // Small delay to prevent buffer overflow
                if (i < totalChunks - 1) {
                    await new Promise(r => setTimeout(r, 5));
                }
            }
            console.log('All chunks sent');
        }

        console.log('Video sent:', videoBlob.size, 'bytes');
        eventBus.publish(Events.BROADCAST_STATUS, { status: 'sent' });
    }

    /**
     * Convert base64 to Blob
     * @param {string} base64Data - Either data URL or raw base64 string
     * @param {string} mimeType - MIME type for the blob
     */
    base64ToBlob(base64Data, mimeType) {
        // Handle both data URL format and raw base64
        const base64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
        const byteString = atob(base64);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ab], { type: mimeType });
    }

    /**
     * Stop and cleanup
     */
    stop() {
        if (this.channelRef) {
            this.channelRef.off();
            if (this.isViewer) {
                this.channelRef.child('viewer').remove();
            }
        }
        if (this.dataChannel) {
            this.dataChannel.close();
        }
        if (this.peerConnection) {
            this.peerConnection.close();
        }
        this.isViewer = false;
        this.channelName = '';
        eventBus.publish(Events.BROADCAST_STATUS, { status: 'stopped' });
    }

    get isViewerMode() {
        return this.isViewer;
    }
}
