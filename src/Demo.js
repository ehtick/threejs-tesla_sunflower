import * as THREE from 'three';
import { TDSLoader } from 'three/addons/loaders/TDSLoader.js';
import { EffectManager } from './core/EffectManager.js';
import { AudioSync } from './core/AudioSync.js';
import { getRandomState, setRandomState } from './core/Random.js';

import { SpinZoom } from './effects/SpinZoom.js';
import { ShadeBall } from './effects/ShadeBall.js';
import { Splines } from './effects/Splines.js';
import { FFDEnv } from './effects/FFDEnv.js';
import { Bands } from './effects/Bands.js';
import { EnergyStream } from './effects/EnergyStream.js';
import { Tubes } from './effects/Tubes.js';
import { PolkaLike } from './effects/PolkaLike.js';
import { Tree } from './effects/Tree.js';
import { FaceMorph } from './effects/FaceMorph.js';
import { Credits } from './effects/Credits.js';

const ASPECT = 4 / 3;
const FOV = 2 * Math.atan(0.45) * 180 / Math.PI;
const DURATION = 254;

export class Demo {
    constructor(container) {
        this.container = container;
        this.renderer = null;
        this.camera = null;
        this.effectManager = new EffectManager();
        this.audio = new AudioSync();
        this.assets = {};
        this.currentTime = 0;
        this.duration = DURATION;
        this.isActive = false;
        this.seekStartTime = null;
        this.frameId = null;
        this.onEnded = null;
        this.onResize = this.onResize.bind(this);
        this.onAudioPlay = this.onAudioPlay.bind(this);
        this.onAudioPause = this.onAudioPause.bind(this);
        this.onAudioSeeking = this.onAudioSeeking.bind(this);
        this.onAudioSeeked = this.onAudioSeeked.bind(this);
        this.onAudioEnded = this.onAudioEnded.bind(this);

        const info = document.getElementById('info');
        this.infoElement = info && getComputedStyle(info).display !== 'none' ? info : null;
    }

    async init() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: false,
            alpha: false
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0x000000, 1);
        this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
        this.renderer.toneMapping = THREE.NoToneMapping;
        this.renderer.autoClear = false;
        this.renderer.sortObjects = false;
        this.container.appendChild(this.renderer.domElement);

        this.camera = new THREE.PerspectiveCamera(FOV, ASPECT, 1, 1000);
        window.addEventListener('resize', this.onResize);
        this.onResize();

        await this.loadAssets();
        this.setupEffects();
        this.initialRandomState = getRandomState();
        this.effectManager.initAll(this.assets);
        await this.audio.load('assets/audio/tournesol.mp3');
        this.audio.element.addEventListener('play', this.onAudioPlay);
        this.audio.element.addEventListener('pause', this.onAudioPause);
        this.audio.element.addEventListener('seeking', this.onAudioSeeking);
        this.audio.element.addEventListener('seeked', this.onAudioSeeked);
        this.audio.element.addEventListener('ended', this.onAudioEnded);
    }

    async loadAssets() {
        const textureLoader = new THREE.TextureLoader();

        const textureNames = [
            'sphere.jpg',
            'sphere1.jpg',
            'gothickiemura02.jpg',
            'kalatus1-01.png',
            'flare02.jpg',
            'max_t3.jpg',
            'max_t1.jpg',
            'blend.png',
            'blend2.png',
            'polka.png',
            'y6.jpg',
            'y7.jpg',
            'y2.jpg',
            't1a.jpg',
            't1b.jpg',
            'face.jpg',
            'cred-saffron01.png',
            'cred-yoghurt01.png',
            'cred-radixlluvia01.png'
        ];

        this.assets.textures = {};
        await Promise.all(textureNames.map(async (name) => {
            const texture = await textureLoader.loadAsync(`assets/textures/${name}`);
            texture.flipY = false;
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.magFilter = THREE.LinearFilter;
            texture.minFilter = THREE.LinearFilter;
            texture.generateMipmaps = false;
            texture.colorSpace = THREE.NoColorSpace;
            texture.needsUpdate = true;
            const key = name.replace(/\.[^.]+$/, '').replace(/-/g, '_');
            this.assets.textures[key] = texture;
        }));

        const modelManager = new THREE.LoadingManager();
        modelManager.setURLModifier(url =>
            url.endsWith('MAP8D.JPG') ? 'assets/textures/t1a.jpg' : url
        );
        const tdsLoader = new TDSLoader(modelManager);

        const [meta, faces, tree] = await Promise.all([
            tdsLoader.loadAsync('assets/models/META.3DS'),
            tdsLoader.loadAsync('assets/models/FACES.3DS'),
            tdsLoader.loadAsync('assets/models/KBUU2.3DS')
        ]);
        this.assets.models = { meta, faces, tree };
    }

    setupEffects() {
        this.effectManager.addEffect(new SpinZoom(), 0, 24.5);
        this.effectManager.addEffect(new ShadeBall(), 24.5, 48.5);
        this.effectManager.addEffect(new Splines(), 48.5, 67.7);
        this.effectManager.addEffect(new FFDEnv(), 67.7, 87);
        this.effectManager.addEffect(new Bands(), 69, 85);
        this.effectManager.addEffect(new EnergyStream(), 87, 145);
        this.effectManager.addEffect(new Tubes(), 145, 165);
        this.effectManager.addEffect(new PolkaLike(), 165, 203);
        this.effectManager.addEffect(new Tree(), 186, 201);
        this.effectManager.addEffect(new FaceMorph(), 203, 222.5);
        this.effectManager.addEffect(new Credits(), 222.5, DURATION);
    }

    onResize() {
        const viewportWidth = this.container.clientWidth || window.innerWidth;
        const viewportHeight = this.container.clientHeight || window.innerHeight;
        const width = Math.min(viewportWidth, viewportHeight * ASPECT);
        const height = width / ASPECT;

        // Keep the source's 4:3 frame centered in the viewport.
        this.renderer.setSize(width, height);

        this.camera.aspect = ASPECT;
        this.camera.updateProjectionMatrix();

        if (this.isActive && this.audio.element.paused) {
            const randomState = getRandomState();
            this.renderFrame(this.currentTime);
            setRandomState(randomState);
        }
    }

    async start(offset = 0) {
        if (this.isActive) return;

        if (offset === 0) {
            this.effectManager.reset();
            setRandomState(this.initialRandomState);
        }

        this.currentTime = offset;
        this.isActive = true;

        try {
            await this.audio.play(offset);
        } catch (error) {
            this.stop();
            throw error;
        }
    }

    pause() {
        if (this.isActive && !this.audio.element.paused) this.audio.pause();
    }

    async resume() {
        if (!this.isActive || !this.audio.element.paused) return;
        await this.audio.resume();
    }

    async togglePause() {
        if (!this.isActive) return;

        if (this.audio.element.paused) {
            await this.resume();
        } else {
            this.pause();
        }
    }

    seekBy(seconds) {
        if (!this.isActive) return;

        const time = this.audio.getCurrentTime() + seconds;
        this.audio.seek(Math.max(0, Math.min(time, this.duration)));
    }

    onAudioPlay() {
        if (!this.isActive) {
            this.audio.pause();
            return;
        }
        this.animate();
    }

    onAudioPause() {
        this.cancelAnimation();
        this.currentTime = this.audio.getCurrentTime();
    }

    onAudioSeeking() {
        if (!this.isActive) return;
        if (this.seekStartTime === null) this.seekStartTime = this.currentTime;
        this.cancelAnimation();
    }

    onAudioSeeked() {
        if (!this.isActive) {
            this.seekStartTime = null;
            return;
        }

        const time = this.audio.getCurrentTime();

        if (time >= this.duration) {
            this.finish();
            return;
        }

        if (this.seekStartTime !== null && time < this.seekStartTime) {
            this.effectManager.reset();
            setRandomState(this.initialRandomState);
        }

        this.seekStartTime = null;
        this.currentTime = time;
        if (this.audio.element.paused) {
            this.renderFrame(time);
            this.updateInfo();
        } else {
            this.animate();
        }
    }

    onAudioEnded() {
        this.finish();
    }

    finish() {
        if (!this.isActive) return;
        this.stop();
        this.onEnded?.();
    }

    stop() {
        this.isActive = false;
        this.seekStartTime = null;
        this.cancelAnimation();
        this.currentTime = 0;
        this.audio.reset();
    }

    cancelAnimation() {
        if (this.frameId !== null) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
    }

    animate() {
        if (!this.isActive || this.audio.element.paused || this.frameId !== null) return;

        this.currentTime = this.audio.getCurrentTime();

        if (this.currentTime >= this.duration) {
            this.finish();
            return;
        }

        this.renderFrame(this.currentTime);
        this.updateInfo();

        this.frameId = requestAnimationFrame(() => {
            this.frameId = null;
            this.animate();
        });
    }

    renderFrame(time) {
        this.renderer.clear(true, true, true);

        this.camera.position.set(0, 0, 0);
        this.camera.rotation.set(0, 0, 0);
        this.camera.fov = FOV;
        this.camera.near = 1;
        this.camera.far = 1000;
        this.camera.updateProjectionMatrix();

        this.effectManager.update(time, this.renderer, this.camera);
    }

    updateInfo() {
        if (!this.infoElement) return;

        const effectName = this.effectManager.getCurrentEffectNames(this.currentTime);
        const time = this.currentTime.toFixed(1);
        this.infoElement.textContent = `${time}s / ${this.duration}s - ${effectName}`;
    }

    dispose() {
        window.removeEventListener('resize', this.onResize);
        this.audio.element.removeEventListener('play', this.onAudioPlay);
        this.audio.element.removeEventListener('pause', this.onAudioPause);
        this.audio.element.removeEventListener('seeking', this.onAudioSeeking);
        this.audio.element.removeEventListener('seeked', this.onAudioSeeked);
        this.audio.element.removeEventListener('ended', this.onAudioEnded);
        this.stop();
        this.effectManager.dispose();
        this.audio.dispose();
        this.renderer.dispose();

        for (const texture of Object.values(this.assets.textures ?? {})) texture.dispose();
    }
}
