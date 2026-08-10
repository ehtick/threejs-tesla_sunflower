import * as THREE from 'three';
import { Effect } from '../core/Effect.js';
import { frand } from '../core/Random.js';

const BAND_SEGMENTS = 32;
const BAND_COUNT = 40;
const BAND_NEAR_PLANE = -1;
const BAND_FAR_PLANE = -50;

class Band {
    constructor(width, speed) {
        this.width = width;
        this.speed = speed;
        this.points = new Float32Array((BAND_SEGMENTS + 1) * 6);
        this.angles = new Float32Array(BAND_SEGMENTS + 1);
        this.draw = new Uint8Array(BAND_SEGMENTS + 1);

        this.reset();
    }

    reset() {
        this.points.fill(0);
        this.angles.fill(0);
        this.draw.fill(0);

        for (let i = 0; i <= BAND_SEGMENTS; i++) {
            const z = BAND_NEAR_PLANE +
                (BAND_FAR_PLANE - BAND_NEAR_PLANE) * i / (BAND_SEGMENTS + 1);
            this.points[i * 6 + 2] = z;
            this.points[i * 6 + 5] = z;
        }
    }

    move(distance) {
        distance *= this.speed;
        for (let i = 0; i < BAND_SEGMENTS; i++) {
            this.points[i * 6 + 2] += distance;
            this.points[i * 6 + 5] += distance;
        }

        while (this.points[8] > BAND_NEAR_PLANE) {
            this.points.copyWithin(0, 6);
            this.angles.copyWithin(0, 1);
            this.draw.copyWithin(0, 1);

            const x = frand() - 0.5;
            const y = frand() - 0.5;
            const angleChange = (frand() - 0.5) * 2;
            const radius = 1 + 0.3 * frand();
            const end = BAND_SEGMENTS;
            const p = end * 6;

            this.draw[end] = 1;
            this.angles[end] = (this.angles[end - 1] + angleChange) % (2 * 355 / 113);
            this.points[p] = x + Math.sin(this.angles[end]) * radius;
            this.points[p + 1] = y + Math.cos(this.angles[end]) * radius;
            this.points[p + 2] = BAND_FAR_PLANE;
            this.points[p + 3] = x + Math.sin(this.angles[end] + this.width) * radius;
            this.points[p + 4] = y + Math.cos(this.angles[end] + this.width) * radius;
            this.points[p + 5] = BAND_FAR_PLANE;
        }
    }
}

export class Bands extends Effect {
    constructor() {
        super();
        this.bands = [];
        this.lastTime = -1;

        for (let i = 0; i < BAND_COUNT; i++) {
            this.bands.push(new Band(0.1 + 0.2 * frand(), 1 + frand()));
        }
    }

    reset() {
        this.lastTime = -1;
        for (const band of this.bands) band.reset();
        if (this.geometry) this.geometry.setDrawRange(0, 0);
    }

    init(assets) {
        const maxQuads = BAND_COUNT * BAND_SEGMENTS;
        this.positions = new Float32Array(maxQuads * 12);
        const uvs = new Float32Array(maxQuads * 8);
        this.colors = new Float32Array(maxQuads * 16);
        const indices = new Uint16Array(maxQuads * 6);

        for (let i = 0; i < maxQuads; i++) {
            const vertex = i * 4, index = i * 6;
            const uv = i * 8, color = i * 16;
            indices[index] = vertex;
            indices[index + 1] = vertex + 1;
            indices[index + 2] = vertex + 2;
            indices[index + 3] = vertex;
            indices[index + 4] = vertex + 2;
            indices[index + 5] = vertex + 3;
            uvs.set([0, 0, 1, 0, 1, 1, 0, 1], uv);
            for (let j = 0; j < 4; j++) {
                this.colors[color + j * 4] = 1;
                this.colors[color + j * 4 + 1] = 1;
                this.colors[color + j * 4 + 2] = 1;
            }
        }

        assets.textures.polka.generateMipmaps = true;
        assets.textures.polka.minFilter = THREE.LinearMipmapLinearFilter;
        assets.textures.polka.needsUpdate = true;

        this.geometry = new THREE.BufferGeometry();
        this.geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        this.positionAttribute = new THREE.BufferAttribute(this.positions, 3)
            .setUsage(THREE.DynamicDrawUsage);
        this.colorAttribute = new THREE.BufferAttribute(this.colors, 4)
            .setUsage(THREE.DynamicDrawUsage);
        this.geometry.setAttribute('position', this.positionAttribute);
        this.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        this.geometry.setAttribute('color', this.colorAttribute);

        this.material = new THREE.MeshBasicMaterial({
            map: assets.textures.polka,
            color: 0xffffff,
            vertexColors: true,
            transparent: true,
            blending: THREE.CustomBlending,
            blendSrc: THREE.SrcAlphaFactor,
            blendDst: THREE.OneFactor,
            blendEquation: THREE.AddEquation,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide,
            toneMapped: false
        });
        this.material.forceSinglePass = true;
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.frustumCulled = false;
        this.mesh.rotation.order = 'ZXY';
        this.scene.add(this.mesh);
    }

    render(time, _startTime, renderer, camera) {
        const delta = this.lastTime < 0 ? 0 : time - this.lastTime;
        this.lastTime = time;

        camera.fov = 2 * Math.atan(0.375) * 180 / Math.PI;
        camera.aspect = 4 / 3;
        camera.near = -BAND_NEAR_PLANE;
        camera.far = -BAND_FAR_PLANE;
        camera.position.set(0, 0, 0);
        camera.quaternion.identity();
        camera.updateProjectionMatrix();

        this.mesh.rotation.set(
            20 * Math.sin(time) * Math.PI / 180,
            20 * Math.sin(time * 2) * Math.PI / 180,
            time * 50 * Math.PI / 180
        );

        for (const band of this.bands) band.move(delta * 10);

        let alpha = 1;
        if (time >= 69 && time < 70) alpha = time - 69;
        else if (time >= 84 && time < 85) alpha = 1 - (time - 84);

        let quad = 0;
        for (const band of this.bands) {
            for (let segment = 0; segment < BAND_SEGMENTS; segment++) {
                if (!band.draw[segment]) continue;

                const source = segment * 6;
                const next = source + 6;
                const position = quad * 12;
                this.positions[position] = band.points[source];
                this.positions[position + 1] = band.points[source + 1];
                this.positions[position + 2] = band.points[source + 2];
                this.positions[position + 3] = band.points[source + 3];
                this.positions[position + 4] = band.points[source + 4];
                this.positions[position + 5] = band.points[source + 5];
                this.positions[position + 6] = band.points[next + 3];
                this.positions[position + 7] = band.points[next + 4];
                this.positions[position + 8] = band.points[next + 5];
                this.positions[position + 9] = band.points[next];
                this.positions[position + 10] = band.points[next + 1];
                this.positions[position + 11] = band.points[next + 2];

                const color = quad * 16;
                const segmentAlpha = alpha * (1 - segment / BAND_SEGMENTS);
                for (let vertex = 0; vertex < 4; vertex++) {
                    const c = color + vertex * 4;
                    this.colors[c + 3] = segmentAlpha;
                }
                quad++;
            }
        }

        this.positionAttribute.needsUpdate = true;
        this.colorAttribute.needsUpdate = true;
        this.geometry.setDrawRange(0, quad * 6);
        renderer.render(this.scene, camera);
    }

    dispose() {
        this.geometry?.dispose();
        this.material?.dispose();
    }
}
