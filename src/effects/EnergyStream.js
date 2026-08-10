import * as THREE from 'three';
import { Effect } from '../core/Effect.js';
import { clamp } from '../core/MathUtils.js';
import { frand } from '../core/Random.js';

const CHANGE_TIME = 15;
const CHANGE_TIME1 = 25;
const CHANGE_TIME2 = 38;
const CHANGE_TIME3 = 58;
const FLARES_PER_STREAM = 150;

const STREAMS = [
    [0, 50, 0, 300], [0, 0, 0, 150], [0, 90, 60, 250], [0, -100, 30, 160],
    [0, 50, -100, 340], [0, -50, 50, 270], [0, 100, 50, 180], [0, -30, 90, 130],
    [0, 150, 10, 200], [0, 100, -100, 210], [0, 190, 160, 220], [0, -200, 130, 230],
    [0, 150, -200, 240], [0, -150, 250, 160], [0, 200, 150, 230], [0, -130, 190, 250]
];

export class EnergyStream extends Effect {
    constructor() {
        super();
        this.streams = [];

        for (const [baseX, baseY, baseZ, speed] of STREAMS) {
            const particles = new Float32Array(FLARES_PER_STREAM * 3);
            for (let i = 0; i < FLARES_PER_STREAM; i++) {
                particles[i * 3] = -800 * frand() - 1150 + baseX;
                particles[i * 3 + 1] = 10 * frand() - 20 + baseY;
                particles[i * 3 + 2] = 10 * frand() - 20 + baseZ;
            }
            this.streams.push({ particles, speed });
        }
    }

    init(assets) {
        this.backgroundGeometry = new THREE.BufferGeometry();
        this.backgroundGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
            -300, 300, 0, 300, 300, 0, 300, -300, 0, -300, -300, 0
        ], 3));
        this.backgroundUV = new THREE.BufferAttribute(new Float32Array(8), 2).setUsage(THREE.DynamicDrawUsage);
        this.backgroundGeometry.setAttribute('uv', this.backgroundUV);
        this.backgroundGeometry.setIndex([0, 1, 2, 0, 2, 3]);

        const materialOptions = {
            color: 0xffffff,
            transparent: true,
            blending: THREE.CustomBlending,
            blendSrc: THREE.SrcAlphaFactor,
            blendDst: THREE.OneFactor,
            blendEquation: THREE.AddEquation,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide,
            fog: true,
            toneMapped: false
        };
        this.backgroundMaterial1 = new THREE.MeshBasicMaterial({
            ...materialOptions,
            map: assets.textures.y7
        });
        this.backgroundMaterial2 = new THREE.MeshBasicMaterial({
            ...materialOptions,
            map: assets.textures.y6
        });
        this.backgroundMaterial1.forceSinglePass = true;
        this.backgroundMaterial2.forceSinglePass = true;
        this.backgroundMesh = new THREE.Mesh(this.backgroundGeometry, this.backgroundMaterial1);
        this.backgroundMesh.matrixAutoUpdate = false;
        this.backgroundMesh.frustumCulled = false;
        this.backgroundScene = new THREE.Scene();
        this.backgroundScene.fog = new THREE.Fog(0x000000, 200, 500);
        this.backgroundScene.add(this.backgroundMesh);

        const flareCount = STREAMS.length * FLARES_PER_STREAM;
        this.flarePositions = new Float32Array(flareCount * 12);
        const flareUVs = new Float32Array(flareCount * 8);
        const flareIndices = new Uint16Array(flareCount * 6);
        for (let i = 0; i < flareCount; i++) {
            flareUVs.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8);
            const vertex = i * 4, index = i * 6;
            flareIndices[index] = vertex;
            flareIndices[index + 1] = vertex + 1;
            flareIndices[index + 2] = vertex + 2;
            flareIndices[index + 3] = vertex;
            flareIndices[index + 4] = vertex + 2;
            flareIndices[index + 5] = vertex + 3;
        }

        this.flareGeometry = new THREE.BufferGeometry();
        this.flareGeometry.setIndex(new THREE.BufferAttribute(flareIndices, 1));
        this.flarePositionAttribute = new THREE.BufferAttribute(this.flarePositions, 3)
            .setUsage(THREE.DynamicDrawUsage);
        this.flareGeometry.setAttribute('position', this.flarePositionAttribute);
        this.flareGeometry.setAttribute('uv', new THREE.BufferAttribute(flareUVs, 2));
        this.flareMaterial = new THREE.MeshBasicMaterial({
            ...materialOptions,
            map: assets.textures.flare02
        });
        this.flareMaterial.forceSinglePass = true;
        this.flareMesh = new THREE.Mesh(this.flareGeometry, this.flareMaterial);
        this.flareMesh.frustumCulled = false;
        this.flareScene = new THREE.Scene();
        this.flareScene.fog = new THREE.Fog(0x000000, 200, 500);
        this.flareScene.add(this.flareMesh);

        this.sceneMatrix = new THREE.Matrix4();
        this.backgroundMatrix = new THREE.Matrix4();
        this.rotation = new THREE.Matrix4();
    }

    render(time, startTime, renderer, camera) {
        const timeLocal = time - startTime;
        const afterChange = timeLocal > CHANGE_TIME;
        const afterChange1 = timeLocal > CHANGE_TIME1;
        const afterChange2 = timeLocal > CHANGE_TIME2;
        const afterChange3 = timeLocal > CHANGE_TIME3;

        camera.fov = 2 * Math.atan(0.45) * 180 / Math.PI;
        camera.aspect = 4 / 3;
        camera.near = 1;
        camera.far = 1000;
        camera.position.set(0, 0, 0);
        camera.quaternion.identity();
        camera.updateProjectionMatrix();

        this.sceneMatrix.makeTranslation(0, 0, -300);
        this.sceneMatrix.multiply(this.rotation.makeRotationX(timeLocal * 30 * Math.PI / 180));
        this.sceneMatrix.multiply(this.rotation.makeRotationZ(
            (30 * Math.sin(timeLocal / 3) + 10) * Math.PI / 180
        ));
        if (afterChange1) {
            this.sceneMatrix.multiply(this.rotation.makeRotationY(
                afterChange2 ? Math.PI / 2 : Math.PI
            ));
        }

        let alpha;
        let backgroundAlpha;
        if (afterChange) {
            alpha = clamp(timeLocal - CHANGE_TIME);
            if (afterChange1) {
                alpha = clamp(alpha * (timeLocal - CHANGE_TIME1));
                if (afterChange2) {
                    alpha = clamp(alpha * (timeLocal - CHANGE_TIME2));
                    if (afterChange3) {
                        alpha = clamp(alpha * (1 + CHANGE_TIME3 - timeLocal));
                    }
                } else {
                    alpha = clamp(alpha * (CHANGE_TIME2 - timeLocal));
                }
            } else {
                alpha = clamp(alpha * (CHANGE_TIME1 - timeLocal));
            }
            backgroundAlpha = alpha;
        } else {
            alpha = clamp((CHANGE_TIME - timeLocal) * 0.5);
            backgroundAlpha = (Math.sin(timeLocal * 2) * 0.25 + 0.75) * alpha;
        }

        const u = afterChange ? 0.1 * Math.sin(timeLocal) : 0;
        const v = afterChange ? timeLocal / 5 : 0;
        this.backgroundUV.array.set([u, v, 1 + u, v, 1 + u, 1 + v, u, 1 + v]);
        this.backgroundUV.needsUpdate = true;
        this.backgroundMesh.material = afterChange ?
            this.backgroundMaterial2 : this.backgroundMaterial1;
        this.backgroundMesh.material.opacity = backgroundAlpha;

        this.backgroundMatrix.copy(this.sceneMatrix);
        const quads = afterChange ? 8 : 16;
        const step = (afterChange ? 180 / 7 : 180 / 15) * Math.PI / 180;
        if (afterChange1) {
            this.backgroundMatrix.multiply(this.rotation.makeRotationY(Math.PI / 2));
        }

        for (let i = 0; i < quads; i++) {
            this.backgroundMesh.matrix.copy(this.backgroundMatrix);
            this.backgroundMesh.matrixWorldNeedsUpdate = true;
            renderer.render(this.backgroundScene, camera);
            this.backgroundMatrix.multiply(this.rotation.makeRotationX(step));
        }

        if (timeLocal >= CHANGE_TIME) {
            this.updateFlares(timeLocal, alpha);
            renderer.render(this.flareScene, camera);
        }
    }

    updateFlares(timeLocal, alpha) {
        const streamTime = timeLocal - CHANGE_TIME;
        const multiplier = timeLocal > CHANGE_TIME1 ?
            (timeLocal > CHANGE_TIME2 ? 2.5 : 2) : 1;
        const matrix = this.sceneMatrix.elements;
        let output = 0;

        for (const stream of this.streams) {
            for (let i = 0; i < FLARES_PER_STREAM; i++) {
                const p = i * 3;
                const rawX = stream.particles[p] + streamTime * stream.speed * multiplier;
                const x = rawX % 800 - 400;
                const y = stream.particles[p + 1] + 2 * Math.sin(streamTime * 7 + stream.particles[p]);
                const z = stream.particles[p + 2] + 2 * Math.cos(streamTime * 7 + i * 3.14);
                const viewX = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
                const viewY = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
                const viewZ = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];

                this.flarePositions[output++] = viewX - 10;
                this.flarePositions[output++] = viewY + 10;
                this.flarePositions[output++] = viewZ;
                this.flarePositions[output++] = viewX + 10;
                this.flarePositions[output++] = viewY + 10;
                this.flarePositions[output++] = viewZ;
                this.flarePositions[output++] = viewX + 10;
                this.flarePositions[output++] = viewY - 10;
                this.flarePositions[output++] = viewZ;
                this.flarePositions[output++] = viewX - 10;
                this.flarePositions[output++] = viewY - 10;
                this.flarePositions[output++] = viewZ;
            }
        }

        this.flarePositionAttribute.needsUpdate = true;
        this.flareMaterial.opacity = alpha;
    }

    dispose() {
        this.backgroundGeometry?.dispose();
        this.backgroundMaterial1?.dispose();
        this.backgroundMaterial2?.dispose();
        this.flareGeometry?.dispose();
        this.flareMaterial?.dispose();
    }
}
