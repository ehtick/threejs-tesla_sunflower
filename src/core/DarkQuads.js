import * as THREE from 'three';
import { rand } from './Random.js';

const MAX_BARS = 256;
const WIDTH = 640;
const HEIGHT = 480;
const VERTICES_PER_BAR = 6;

export class DarkQuads {
    constructor() {
        this.geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(MAX_BARS * VERTICES_PER_BAR * 3);
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

        this.material = new THREE.MeshBasicMaterial({
            transparent: true,
            blending: THREE.NormalBlending,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        this.material.forceSinglePass = true;

        // These quads stay in fixed 640×480 screen space.
        this.camera = new THREE.OrthographicCamera(0, WIDTH, HEIGHT, 0, -1, 1);
        this.scene = new THREE.Scene();
        this.scene.add(new THREE.Mesh(this.geometry, this.material));
    }

    render(renderer, numBars, color) {
        const barsToRender = Math.max(0, Math.min(Math.trunc(numBars), MAX_BARS));
        let vertexIndex = 0;

        for (let i = 0; i < barsToRender; i++) {
            const y = rand() % HEIGHT;
            const height = rand() % 8 + 1;

            const y1 = y - height;
            const y2 = y + height;

            this.positions[vertexIndex++] = 0;
            this.positions[vertexIndex++] = y2;
            this.positions[vertexIndex++] = 0;

            this.positions[vertexIndex++] = WIDTH;
            this.positions[vertexIndex++] = y2;
            this.positions[vertexIndex++] = 0;

            this.positions[vertexIndex++] = WIDTH;
            this.positions[vertexIndex++] = y1;
            this.positions[vertexIndex++] = 0;

            this.positions[vertexIndex++] = 0;
            this.positions[vertexIndex++] = y2;
            this.positions[vertexIndex++] = 0;

            this.positions[vertexIndex++] = WIDTH;
            this.positions[vertexIndex++] = y1;
            this.positions[vertexIndex++] = 0;

            this.positions[vertexIndex++] = 0;
            this.positions[vertexIndex++] = y1;
            this.positions[vertexIndex++] = 0;
        }

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.setDrawRange(0, barsToRender * VERTICES_PER_BAR);

        this.material.color.setRGB(color.r, color.g, color.b);
        this.material.opacity = color.a;

        renderer.render(this.scene, this.camera);
    }

    dispose() {
        this.geometry.dispose();
        this.material.dispose();
    }
}
