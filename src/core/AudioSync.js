export class AudioSync {
    constructor() {
        this.element = new Audio();
        this.element.preload = 'auto';
        this.objectUrl = null;
    }

    async load(url) {
        const audio = this.element;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to load audio: ${url}`);
        }

        if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
        this.objectUrl = URL.createObjectURL(await response.blob());

        await new Promise((resolve, reject) => {
            const cleanup = () => {
                audio.removeEventListener('loadedmetadata', ready);
                audio.removeEventListener('error', failed);
            };
            const ready = () => {
                cleanup();
                resolve();
            };
            const failed = () => {
                cleanup();
                reject(new Error(`Failed to load audio: ${url}`));
            };

            audio.addEventListener('loadedmetadata', ready);
            audio.addEventListener('error', failed);
            audio.src = this.objectUrl;
            audio.load();

            if (audio.readyState >= 1) ready();
        });
    }

    play(offset = 0) {
        const duration = Number.isFinite(this.element.duration)
            ? this.element.duration
            : offset;
        this.element.currentTime = Math.max(0, Math.min(offset, duration));
        return this.element.play();
    }

    pause() {
        this.element.pause();
    }

    resume() {
        return this.element.play();
    }

    seek(time) {
        this.element.currentTime = time;
    }

    reset() {
        this.element.pause();
        this.element.currentTime = 0;
    }

    getCurrentTime() {
        return this.element.currentTime;
    }

    dispose() {
        this.reset();
        this.element.removeAttribute('src');
        this.element.load();
        if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
        this.objectUrl = null;
    }
}
