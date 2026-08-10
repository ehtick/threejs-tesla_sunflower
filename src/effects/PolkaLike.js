import * as THREE from 'three';
import { Effect } from '../core/Effect.js';
import { clamp } from '../core/MathUtils.js';

const Z_MAX = 300;
const TRACK_ELEMENTS = 128;
const FIXED_STEP = 0.016;
const SOURCE_FPS = 30;
const QUAD_UVS = [0, 0, 1, 0, 1, 1, 0, 1];

function makeQuadBuffers(count) {
    const uvs = new Float32Array(count * 4 * 2);
    const indices = new Uint16Array(count * 6);

    for (let i = 0; i < count; i++) {
        uvs.set(QUAD_UVS, i * 8);
        const vertex = i * 4;
        indices.set([vertex, vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3], i * 6);
    }

    return { uvs, indices };
}

class Track {
    constructor(angleChange, positionChange) {
        this.angleChange = angleChange;
        this.positionChange = positionChange;
        this.initialAngle = 0;
        this.initialPositionPhase = 0;
        this.initialPosition = new THREE.Vector3();
        this.positions = new Float64Array(TRACK_ELEMENTS * 3);
        this.angles = new Float64Array(TRACK_ELEMENTS);

        for (let i = 0; i < TRACK_ELEMENTS; i++) {
            this.initialPosition.x = 10 * Math.cos(this.initialPositionPhase) +
                10 * Math.sin(this.initialPositionPhase * 1.32);
            this.initialPosition.y = 15 * Math.sin(this.initialPositionPhase) +
                5 * Math.sin(this.initialPositionPhase * 0.89);
            this.initialPosition.z = -3 * Z_MAX - (Z_MAX / TRACK_ELEMENTS) * i;

            this.positions[i * 3] = this.initialPosition.x;
            this.positions[i * 3 + 1] = this.initialPosition.y;
            this.positions[i * 3 + 2] = this.initialPosition.z;
            this.angles[i] = this.initialAngle;

            this.initialAngle += this.angleChange * 0.042;
            this.initialPositionPhase += this.positionChange * 0.042;
        }
    }

    step(t, positions, colors, vertexOffset) {
        const write = positions !== null;

        for (let i = 0; i < TRACK_ELEMENTS; i++) {
            const p = i * 3;
            this.positions[p + 2] += 100 * FIXED_STEP;
            this.angles[i] -= 2 * 1.234 * FIXED_STEP;

            const x = this.positions[p];
            const y = this.positions[p + 1];
            const z = this.positions[p + 2];
            if (write) {
                const c = Math.cos(this.angles[i]);
                const s = Math.sin(this.angles[i]);
                const alpha = -z / Z_MAX + 0.2;
                const x0 = x + 5 * c - s;
                const y0 = y + 5 * s + c;
                const x1 = x + 5 * c + s;
                const y1 = y + 5 * s - c;
                const x2 = x - 5 * c + s;
                const y2 = y - 5 * s - c;
                const x3 = x - 5 * c - s;
                const y3 = y - 5 * s + c;

                for (let corner = 0; corner < 4; corner++) {
                    const out = (vertexOffset + corner) * 3;
                    positions[out] = corner === 0 ? x0 : (corner === 1 ? x1 : (corner === 2 ? x2 : x3));
                    positions[out + 1] = corner === 0 ? y0 : (corner === 1 ? y1 : (corner === 2 ? y2 : y3));
                    positions[out + 2] = z;

                    const color = (vertexOffset + corner) * 4;
                    colors[color] = 1;
                    colors[color + 1] = 1;
                    colors[color + 2] = 1;
                    colors[color + 3] = alpha;
                }
            }
            vertexOffset += 4;

            // Recycling after the write keeps crossings visible for this frame.
            if (t < 19 && z > 0) {
                this.positions[p] = this.initialPosition.x;
                this.positions[p + 1] = this.initialPosition.y;
                this.positions[p + 2] = -Z_MAX;
                this.angles[i] = this.initialAngle;
            }
        }

        if (t < 10) {
            this.initialPosition.x = 10 * Math.cos(this.initialPositionPhase) +
                10 * Math.sin(this.initialPositionPhase * 1.32);
            this.initialPosition.y = 15 * Math.sin(this.initialPositionPhase) +
                5 * Math.sin(this.initialPositionPhase * 0.89);
        } else if (t < 20) {
            this.initialPosition.x = 15 * Math.cos(this.initialPositionPhase) +
                15 * Math.sin(this.initialPositionPhase * 2.32);
            this.initialPosition.y = 30 * Math.sin(this.initialPositionPhase) +
                15 * Math.sin(this.initialPositionPhase * 1.89);
        } else {
            this.initialPosition.x = 30 * Math.cos(this.initialPositionPhase) +
                15 * Math.sin(this.initialPositionPhase * 0.72);
            this.initialPosition.y = 25 * Math.sin(this.initialPositionPhase) +
                19 * Math.sin(this.initialPositionPhase * 0.59);
        }
        this.initialPosition.z = -Z_MAX;

        this.initialAngle += this.angleChange * FIXED_STEP;
        this.initialPositionPhase += this.positionChange * FIXED_STEP;
        return vertexOffset;
    }
}

export class PolkaLike extends Effect {
    constructor() {
        super();
        this.backgroundMatrix = new THREE.Matrix4();
        this.backgroundRotationY = new THREE.Matrix4();
        this.backgroundRotationZ = new THREE.Matrix4();
        this.resetSimulation();
    }

    resetSimulation() {
        this.tracks = [
            new Track(Math.PI / 2.13, Math.PI / 3.41),
            new Track(Math.PI / 2.93, Math.PI / 1.72),
            new Track(Math.PI / 3.97, Math.PI),
            new Track(Math.PI * 1.23, Math.PI * 2.17)
        ];
        this.simulatedFrames = 0;
        if (this.particlePositions) this.particlePositions.fill(0);
        if (this.particleColors) this.particleColors.fill(0);
        if (this.particlePositionAttribute) {
            this.particlePositionAttribute.needsUpdate = true;
            this.particleColorAttribute.needsUpdate = true;
        }
    }

    reset() {
        this.resetSimulation();
    }

    init(assets) {
        this.makeBackground(assets.textures.max_t3);
        this.makeParticles(assets.textures.polka);
    }

    makeBackground(texture) {
        const positions = new Float32Array(16 * 4 * 3);
        const { uvs, indices } = makeQuadBuffers(16);

        this.backgroundPositions = positions;
        this.backgroundPositionAttribute = new THREE.BufferAttribute(positions, 3);
        this.backgroundGeometry = new THREE.BufferGeometry();
        this.backgroundGeometry.setAttribute('position', this.backgroundPositionAttribute);
        this.backgroundGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        this.backgroundGeometry.setIndex(new THREE.BufferAttribute(indices, 1));

        this.backgroundMaterial = this.createAdditiveMaterial({ map: texture });
        this.backgroundMesh = new THREE.Mesh(this.backgroundGeometry, this.backgroundMaterial);
        this.backgroundMesh.frustumCulled = false;
        this.backgroundScene = new THREE.Scene();
        this.backgroundScene.add(this.backgroundMesh);
    }

    makeParticles(texture) {
        const quadCount = this.tracks.length * TRACK_ELEMENTS;
        this.particlePositions = new Float32Array(quadCount * 4 * 3);
        this.particleColors = new Float32Array(quadCount * 4 * 4);
        const { uvs, indices } = makeQuadBuffers(quadCount);
        this.particlePositionAttribute = new THREE.BufferAttribute(this.particlePositions, 3);
        this.particleColorAttribute = new THREE.BufferAttribute(this.particleColors, 4);

        this.particleGeometry = new THREE.BufferGeometry();
        this.particleGeometry.setAttribute('position', this.particlePositionAttribute);
        this.particleGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        this.particleGeometry.setAttribute('color', this.particleColorAttribute);
        this.particleGeometry.setIndex(new THREE.BufferAttribute(indices, 1));

        this.particleMaterial = this.createAdditiveMaterial({
            map: texture,
            vertexColors: true
        });
        this.particleMesh = new THREE.Mesh(this.particleGeometry, this.particleMaterial);
        this.particleMesh.frustumCulled = false;
        this.particleScene = new THREE.Scene();
        this.particleScene.add(this.particleMesh);
    }

    updateBackground(t) {
        const matrix = this.backgroundMatrix.identity();
        const rotateY = this.backgroundRotationY.makeRotationY(4 * Math.sin(t) * Math.PI / 180);
        const rotateZ = this.backgroundRotationZ.makeRotationZ(5 * t * Math.PI / 180);

        for (let i = 0; i < 16; i++) {
            matrix.multiply(rotateY);
            matrix.multiply(rotateZ);
            const e = matrix.elements;
            const z = -1.4 - i;

            for (let corner = 0; corner < 4; corner++) {
                const x = corner === 0 || corner === 3 ? -1 : 1;
                const y = corner < 2 ? 1 : -1;
                const out = (i * 4 + corner) * 3;
                this.backgroundPositions[out] = e[0] * x + e[4] * y + e[8] * z;
                this.backgroundPositions[out + 1] = e[1] * x + e[5] * y + e[9] * z;
                this.backgroundPositions[out + 2] = e[2] * x + e[6] * y + e[10] * z;
            }
        }

        this.backgroundPositionAttribute.needsUpdate = true;
    }

    render(time, startTime, renderer, camera) {
        const t = time - startTime;

        camera.fov = 2 * Math.atan(0.45) * 180 / Math.PI;
        camera.aspect = 4 / 3;
        camera.near = 1;
        camera.far = Z_MAX;
        camera.position.set(0, 0, 0);
        camera.rotation.set(0, 0, 0);
        camera.updateProjectionMatrix();

        this.updateBackground(t);
        this.backgroundMaterial.opacity = (0.25 * Math.sin(t) + 0.5) * clamp(t * 0.5);
        renderer.render(this.backgroundScene, camera);

        const targetFrame = Math.max(0, Math.floor(t * SOURCE_FPS));
        const rewound = targetFrame < this.simulatedFrames;
        if (rewound) this.resetSimulation();

        let changed = rewound;
        while (this.simulatedFrames < targetFrame) {
            const frame = this.simulatedFrames + 1;
            const write = frame === targetFrame;
            let vertex = 0;
            for (const track of this.tracks) {
                vertex = track.step(
                    frame / SOURCE_FPS,
                    write ? this.particlePositions : null,
                    write ? this.particleColors : null,
                    vertex
                );
            }
            this.simulatedFrames = frame;
            changed = write;
        }

        if (changed) {
            this.particlePositionAttribute.needsUpdate = true;
            this.particleColorAttribute.needsUpdate = true;
        }
        renderer.render(this.particleScene, camera);
    }

    dispose() {
        super.dispose();
        if (this.backgroundGeometry) this.backgroundGeometry.dispose();
        if (this.backgroundMaterial) this.backgroundMaterial.dispose();
        if (this.particleGeometry) this.particleGeometry.dispose();
        if (this.particleMaterial) this.particleMaterial.dispose();
    }
}
