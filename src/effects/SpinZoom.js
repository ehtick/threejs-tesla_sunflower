import * as THREE from 'three';
import { Effect } from '../core/Effect.js';
import { DarkQuads } from '../core/DarkQuads.js';
import { frand } from '../core/Random.js';

const DEG = Math.PI / 180;

const KEYFRAMES = [
    [0, 0], [3.3, 0],
    [6.5, 1], [8, 1],
    [9, 0], [10, 0],
    [13, 1], [15, 0],
    [16, 1], [20, 0],
    [22, 1], [24, 0],
    [99, 0]
];

function keySegment(time) {
    for (let i = 0; i < KEYFRAMES.length - 1; i++) {
        if (time >= KEYFRAMES[i][0] && time < KEYFRAMES[i + 1][0]) return i;
    }
    return time < 0 ? 0 : KEYFRAMES.length - 2;
}

export class SpinZoom extends Effect {
    constructor() {
        super();

        // Preserve the source's shared RNG order.
        for (let i = 0; i < 3; i++) frand();

        this.darkQuads = new DarkQuads();
        this.axisA = new THREE.Vector3(1, -0.2, 0.3).normalize();
        this.axisB = new THREE.Vector3(0, 0.5, 1).normalize();
        this.axisC = new THREE.Vector3(1, -0.2, -0.3).normalize();
        this.matrix = new THREE.Matrix4();
        this.step = new THREE.Matrix4();
        this.temp = new THREE.Matrix4();
    }

    init(assets) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([
            -1,  1, 0,
             1,  1, 0,
             1, -1, 0,
            -1, -1, 0
        ], 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute([
            0, 0,
            1, 0,
            1, 1,
            0, 1
        ], 2));
        geometry.setIndex([0, 1, 2, 0, 2, 3]);

        const material = this.createAdditiveMaterial({
            map: assets.textures.sphere,
            color: 0xffffff,
            opacity: 0.23,
            side: THREE.DoubleSide
        });
        this.geometry = geometry;
        this.material = material;
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.matrixAutoUpdate = false;
        this.mesh.frustumCulled = false;
        this.scene.add(this.mesh);
    }

    render(time, startTime, renderer, camera) {
        const t = time - startTime - 0.1;

        camera.position.set(0, 0, 0);
        camera.quaternion.identity();
        camera.scale.set(1, 1, 1);
        camera.projectionMatrix.makePerspective(-0.6, 0.6, 0.45, -0.45, 1, 300);
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

        const u = keySegment(t);
        const t0 = KEYFRAMES[u][0];
        const v0 = KEYFRAMES[u][1];
        const t1 = KEYFRAMES[u + 1][0];
        const v1 = KEYFRAMES[u + 1][1];
        const bTime = (t - t0) / (t1 - t0);
        const unrMult = v0 + (v1 - v0) * bTime;

        this.matrix.makeTranslation(0, 0, -2);
        this.matrix.multiply(this.temp.makeRotationY(t * DEG));
        this.matrix.multiply(this.temp.makeRotationX(t * 0.5123 * DEG));

        let opacity = unrMult * 0.23;

        for (let i = 0; i < 18; i++) {
            switch (u) {
                case 5:
                case 6: {
                    this.step.makeRotationAxis(this.axisC, (t * 3 + 5) * DEG);
                    const uM = Math.sin(bTime * 3.14159 / 2);
                    const sx = v1 >= v0 ? 1.02 * uM : 1.02;
                    this.step.multiply(this.temp.makeScale(sx, 1.02, 1));
                    opacity = unrMult * 0.33;
                    break;
                }

                case 7:
                case 8:
                    this.step.makeRotationX((t * 22 + 5) * DEG);
                    this.step.multiply(this.temp.makeRotationZ((t * 2 + 5) * DEG));
                    opacity = unrMult * 0.33;
                    break;

                case 9:
                case 10: {
                    this.step.makeRotationAxis(this.axisA, (10 * Math.sin(t) + 5) * DEG);
                    this.step.multiply(this.temp.makeRotationAxis(
                        this.axisB,
                        (5 * Math.cos(t) + 10 * Math.cos(t / 2)) * DEG
                    ));
                    const sx = v1 < v0 ? 1.02 * unrMult : 1.02;
                    this.step.multiply(this.temp.makeScale(sx, 1.02, 1));
                    break;
                }

                default: {
                    this.step.makeRotationAxis(this.axisA, (10 * Math.sin(t * 0.9) + 5) * DEG);
                    const sx = v1 > v0 ? 1.02 * unrMult * unrMult : 1.02;
                    this.step.multiply(this.temp.makeScale(sx, 1.02, 1));
                    break;
                }
            }

            this.matrix.multiply(this.step);
            this.mesh.matrix.copy(this.matrix);
            this.mesh.matrixWorldNeedsUpdate = true;
            this.material.opacity = opacity;
            renderer.render(this.scene, camera);
        }

        if (u === 5 || u === 6) {
            this.darkQuads.render(renderer, 20, { r: 0, g: 0, b: 0.1, a: 0.12 });
        } else if (u === 7 || u === 8) {
            this.darkQuads.render(renderer, 220, { r: 0, g: 0, b: 0.041, a: 0.1 });
        } else {
            this.darkQuads.render(renderer, 80, { r: 0, g: 0, b: 0, a: 0.2 });
        }
    }

    dispose() {
        this.geometry?.dispose();
        this.material?.dispose();
        this.darkQuads.dispose();
    }
}
