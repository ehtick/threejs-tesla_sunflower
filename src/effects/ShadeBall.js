import * as THREE from 'three';
import { Effect } from '../core/Effect.js';

const DEG = Math.PI / 180;

const TIMES = [
    [0, 0],
    [1.5, 1],
    [5, 1],
    [7, 0],
    [9, 1],
    [14.5, 1],
    [16, 0],
    [18, 1],
    [20, 1],
    [24, 0]
];

function keyValue(time) {
    for (let i = 0; i < TIMES.length - 1; i++) {
        const a = TIMES[i];
        const b = TIMES[i + 1];
        if (time >= a[0] && time < b[0]) {
            return a[1] + (b[1] - a[1]) * (time - a[0]) / (b[0] - a[0]);
        }
    }
    return 0;
}

function makeSphere() {
    const radius = 20;
    const vSegments = 13;
    const hSegments = 13;
    const positions = new Float32Array(vSegments * hSegments * 3);
    const uvs = new Float32Array(vSegments * hSegments * 2);
    const indices = new Uint16Array((vSegments - 1) * (hSegments - 1) * 6);

    for (let v = 0; v < vSegments; v++) {
        const phi = Math.PI * v / (vSegments - 1);
        for (let h = 0; h < hSegments; h++) {
            const theta = Math.PI * 2 * h / (hSegments - 1);
            const vertex = v * hSegments + h;
            const p = vertex * 3;
            const uv = vertex * 2;
            positions[p] = radius * Math.cos(theta) * Math.sin(phi);
            positions[p + 1] = radius * Math.cos(phi);
            positions[p + 2] = radius * Math.sin(theta) * Math.sin(phi);
            uvs[uv] = h / (hSegments - 1);
            uvs[uv + 1] = v / (vSegments - 1);
        }
    }

    let n = 0;
    for (let v = 0; v < vSegments - 1; v++) {
        for (let h = 0; h < hSegments - 1; h++) {
            const a = v * hSegments + h;
            const b = a + 1;
            const c = (v + 1) * hSegments + h;
            indices[n++] = a;
            indices[n++] = b;
            indices[n++] = c;
            indices[n++] = b;
            indices[n++] = c + 1;
            indices[n++] = c;
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    return geometry;
}

function makeQuad() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
        -300,  300, 0,
         300,  300, 0,
         300, -300, 0,
        -300, -300, 0
    ], 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([
        0, 0,
        1, 0,
        1, 1,
        0, 1
    ], 2));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    return geometry;
}

export class ShadeBall extends Effect {
    constructor() {
        super();
        this.matrix = new THREE.Matrix4();
        this.temp = new THREE.Matrix4();
        this.orthoCamera = new THREE.OrthographicCamera(-300, 300, 300, -300, -1, 1);
    }

    init(assets) {
        this.sphereGeometry = makeSphere();
        this.sphereMaterial = this.createAdditiveMaterial({
            map: assets.textures.gothickiemura02,
            color: 0xffffff,
            side: THREE.BackSide
        });
        this.sphereMesh = new THREE.Mesh(this.sphereGeometry, this.sphereMaterial);
        this.sphereMesh.matrixAutoUpdate = false;
        this.sphereMesh.frustumCulled = false;
        this.scene.add(this.sphereMesh);

        this.overlayGeometry = makeQuad();
        this.overlayMaterial = this.createAlphaMaterial({
            map: assets.textures.kalatus1_01,
            color: 0xffffff,
            side: THREE.DoubleSide
        });
        this.overlayMesh = new THREE.Mesh(this.overlayGeometry, this.overlayMaterial);
        this.overlayMesh.frustumCulled = false;
        this.overlayScene = new THREE.Scene();
        this.overlayScene.add(this.overlayMesh);
    }

    render(time, startTime, renderer, camera) {
        const fTime = time - startTime;

        camera.position.set(0, 0, 0);
        camera.quaternion.identity();
        camera.scale.set(1, 1, 1);
        camera.projectionMatrix.makePerspective(-0.6, 0.6, 0.45, -0.45, 1, 1000);
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

        const effectAlpha = Math.max(0, Math.min(1, keyValue(fTime)));
        let t = fTime;

        for (let i = 0; i < 20; i++) {
            const alpha = 1 - i / 12;
            const scale = alpha * 20 + 0.5;

            this.matrix.makeTranslation(0, 0, -500);
            this.matrix.multiply(this.temp.makeRotationY((t * 40 + 20 * Math.sin(t)) * DEG));
            this.matrix.multiply(this.temp.makeRotationZ((
                t * 60 + 30 * Math.sin(t * 1.2) + 20 * Math.sin(t * 2.1)
            ) * DEG));
            this.matrix.multiply(this.temp.makeRotationX(t * 50 * DEG));
            this.matrix.multiply(this.temp.makeScale(scale, scale, scale));

            this.sphereMesh.matrix.copy(this.matrix);
            this.sphereMesh.matrixWorldNeedsUpdate = true;
            // Fixed-function colors clamp negative tail alpha.
            this.sphereMaterial.opacity = Math.max(0, 0.3 * alpha * effectAlpha);
            renderer.render(this.scene, camera);

            t -= 0.014 * (8 * Math.sin(fTime) + 12);
        }

        this.overlayMaterial.opacity = effectAlpha;
        renderer.render(this.overlayScene, this.orthoCamera);
    }

    dispose() {
        this.sphereGeometry?.dispose();
        this.sphereMaterial?.dispose();
        this.overlayGeometry?.dispose();
        this.overlayMaterial?.dispose();
    }
}
