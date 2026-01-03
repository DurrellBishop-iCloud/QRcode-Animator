/**
 * ServerUploader - Upload videos/images to server
 * Port of Swift ImageBroadcaster
 */
import { eventBus, Events } from '../core/EventBus.js';
import { settings } from '../managers/SettingsManager.js';

export class ServerUploader {
    constructor() {
        this.isConnected = false;
        this.lastError = null;
    }

    /**
     * Get full server URL
     * @returns {string} Server URL
     */
    getServerUrl() {
        let address = settings.serverAddress;

        if (!address) {
            return null;
        }

        if (!address.startsWith('http://') && !address.startsWith('https://')) {
            address = `http://${address}`;
        }

        return address;
    }

    /**
     * Upload video blob to server
     * @param {Blob} blob - Video blob
     * @returns {Promise<boolean>} Success status
     */
    async uploadVideo(blob) {
        const baseUrl = this.getServerUrl();

        if (!baseUrl) {
            console.warn('No server address configured');
            return false;
        }

        const url = `${baseUrl}/upload`;

        eventBus.publish(Events.UPLOAD_STARTED, { size: blob.size, type: 'video' });
        console.log(`Uploading video to ${url}, size: ${blob.size} bytes`);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': blob.type || 'video/webm'
                },
                body: blob
            });

            if (response.ok) {
                this.isConnected = true;
                this.lastError = null;
                eventBus.publish(Events.UPLOAD_COMPLETE, { success: true });
                console.log('Video upload successful');
                return true;
            } else {
                const error = `Server error: ${response.status}`;
                this.isConnected = false;
                this.lastError = error;
                eventBus.publish(Events.UPLOAD_ERROR, { error });
                console.error('Video upload failed:', error);
                return false;
            }

        } catch (error) {
            this.isConnected = false;
            this.lastError = error.message;
            eventBus.publish(Events.UPLOAD_ERROR, { error: error.message });
            console.error('Video upload error:', error);
            return false;
        }
    }

    /**
     * Upload image blob to server
     * @param {Blob} blob - Image blob (JPEG)
     * @returns {Promise<boolean>} Success status
     */
    async uploadImage(blob) {
        const baseUrl = this.getServerUrl();

        if (!baseUrl) {
            console.warn('No server address configured');
            return false;
        }

        const url = `${baseUrl}/upload`;

        eventBus.publish(Events.UPLOAD_STARTED, { size: blob.size, type: 'image' });
        console.log(`Uploading image to ${url}, size: ${blob.size} bytes`);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'image/jpeg'
                },
                body: blob
            });

            if (response.ok) {
                this.isConnected = true;
                this.lastError = null;
                eventBus.publish(Events.UPLOAD_COMPLETE, { success: true });
                console.log('Image upload successful');
                return true;
            } else {
                const error = `Server error: ${response.status}`;
                this.isConnected = false;
                this.lastError = error;
                eventBus.publish(Events.UPLOAD_ERROR, { error });
                console.error('Image upload failed:', error);
                return false;
            }

        } catch (error) {
            this.isConnected = false;
            this.lastError = error.message;
            eventBus.publish(Events.UPLOAD_ERROR, { error: error.message });
            console.error('Image upload error:', error);
            return false;
        }
    }

    /**
     * Test connection to server
     * @returns {Promise<boolean>} Connection status
     */
    async testConnection() {
        const baseUrl = this.getServerUrl();

        if (!baseUrl) {
            return false;
        }

        try {
            const response = await fetch(baseUrl, {
                method: 'HEAD',
                mode: 'no-cors' // May be needed for local network
            });
            this.isConnected = true;
            return true;
        } catch {
            this.isConnected = false;
            return false;
        }
    }
}
