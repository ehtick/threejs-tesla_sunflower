import * as THREE from 'three';
import { Effect } from '../core/Effect.js';
import { catmullRom, clamp } from '../core/MathUtils.js';

const FFD_SIZE = 5;

export class Tree extends Effect {
    constructor() {
        super();

        this.geometry = null;
        this.basePositions = null;
        this.controlPoints = new Float64Array(FFD_SIZE * FFD_SIZE * FFD_SIZE * 3);
        this.interpolationY = new Float64Array(4);
        this.interpolationZ = new Float64Array(4);
        this.bboxMin = new THREE.Vector3();
        this.bboxMax = new THREE.Vector3();
    }

    init(assets) {
        const model = assets.models.tree;
        let sourceMesh = null;

        if (model) {
            model.traverse((child) => {
                if (sourceMesh === null && child.isMesh && child.geometry) sourceMesh = child;
            });
        }

        if (sourceMesh === null) {
            throw new Error('Tree: KBUU2.3DS object 0 is required');
        }

        this.geometry = sourceMesh.geometry.clone();
        this.positionAttribute = this.geometry.getAttribute('position');

        if (!this.positionAttribute || !this.geometry.index) {
            throw new Error('Tree: KBUU2.3DS must retain its indexed vertex table');
        }

        // The legacy loader swaps y/z; this model's local matrix is identity.
        for (let i = 0; i < this.positionAttribute.count; i++) {
            const y = this.positionAttribute.getY(i);
            this.positionAttribute.setY(i, this.positionAttribute.getZ(i));
            this.positionAttribute.setZ(i, y);
        }

        this.basePositions = new Float32Array(this.positionAttribute.array);
        this.makeOriginalNormalUVs();
        this.calculateBBox();

        // The live source pass uses normal x/y as UVs with additive max_t3.
        this.texture = assets.textures.max_t3.clone();
        this.texture.needsUpdate = true;
        this.material = this.createAdditiveMaterial({
            map: this.texture,
            opacity: 0.2
        });

        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.frustumCulled = false;
        this.mesh.rotation.order = 'ZYX';
        this.scene.add(this.mesh);
    }

    makeOriginalNormalUVs() {
        const index = this.geometry.index.array;
        const p = this.basePositions;
        const sums = new Float64Array(p.length);
        const counts = new Uint32Array(p.length / 3);

        for (let i = 0; i < index.length; i += 3) {
            const ia = index[i];
            const ib = index[i + 1];
            const ic = index[i + 2];

            const abx = p[ib * 3] - p[ia * 3];
            const aby = p[ib * 3 + 1] - p[ia * 3 + 1];
            const abz = p[ib * 3 + 2] - p[ia * 3 + 2];
            const acx = p[ic * 3] - p[ia * 3];
            const acy = p[ic * 3 + 1] - p[ia * 3 + 1];
            const acz = p[ic * 3 + 2] - p[ia * 3 + 2];

            let nx = aby * acz - abz * acy;
            let ny = abz * acx - abx * acz;
            let nz = abx * acy - aby * acx;
            const invLength = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
            nx *= invLength;
            ny *= invLength;
            nz *= invLength;

            sums[ia * 3] += nx;
            sums[ia * 3 + 1] += ny;
            sums[ia * 3 + 2] += nz;
            counts[ia]++;
            sums[ib * 3] += nx;
            sums[ib * 3 + 1] += ny;
            sums[ib * 3 + 2] += nz;
            counts[ib]++;
            sums[ic * 3] += nx;
            sums[ic * 3 + 1] += ny;
            sums[ic * 3 + 2] += nz;
            counts[ic]++;
        }

        const uv = new Float32Array(counts.length * 2);
        for (let i = 0; i < counts.length; i++) {
            uv[i * 2] = sums[i * 3] / counts[i];
            uv[i * 2 + 1] = sums[i * 3 + 1] / counts[i];
        }
        this.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    }

    calculateBBox() {
        const p = this.basePositions;
        this.bboxMin.set(Infinity, Infinity, Infinity);
        this.bboxMax.set(-Infinity, -Infinity, -Infinity);

        for (let i = 0; i < p.length; i += 3) {
            this.bboxMin.x = Math.min(this.bboxMin.x, p[i]);
            this.bboxMin.y = Math.min(this.bboxMin.y, p[i + 1]);
            this.bboxMin.z = Math.min(this.bboxMin.z, p[i + 2]);
            this.bboxMax.x = Math.max(this.bboxMax.x, p[i]);
            this.bboxMax.y = Math.max(this.bboxMax.y, p[i + 1]);
            this.bboxMax.z = Math.max(this.bboxMax.z, p[i + 2]);
        }

        this.bboxMin.addScalar(-0.0001);
        this.bboxMax.addScalar(0.0001);
    }

    updateControlPoints(t) {
        const d = this.controlPoints;

        for (let z = 0; z < FFD_SIZE; z++) {
            for (let y = 0; y < FFD_SIZE; y++) {
                for (let x = 0; x < FFD_SIZE; x++) {
                    const i = (x + (y + z * FFD_SIZE) * FFD_SIZE) * 3;
                    d[i] = (x * 4 - 8) * (Math.sin(t * 1.33 + y * 4) * 0.2 + 0.8);
                    d[i + 1] = (y * 4 - 8) * (Math.cos(t * 2 + x * 10) * 0.2 + 0.8);
                    d[i + 2] = (z * 4 - 8) * (Math.cos(t * 2.33 + y * 10) * 0.2 + 0.8);
                }
            }
        }
    }

    getControl(x, y, z, component) {
        x = Math.max(0, Math.min(FFD_SIZE - 1, x));
        y = Math.max(0, Math.min(FFD_SIZE - 1, y));
        z = Math.max(0, Math.min(FFD_SIZE - 1, z));
        return this.controlPoints[(x + (y + z * FFD_SIZE) * FFD_SIZE) * 3 + component];
    }

    interpolateControl(nx, ny, nz, fx, fy, fz, component) {
        const yValues = this.interpolationY;
        const zValues = this.interpolationZ;

        for (let q = 0; q < 4; q++) {
            for (let i = 0; i < 4; i++) {
                yValues[i] = catmullRom(
                    this.getControl(nx - 1, ny - 1 + i, nz - 1 + q, component),
                    this.getControl(nx, ny - 1 + i, nz - 1 + q, component),
                    this.getControl(nx + 1, ny - 1 + i, nz - 1 + q, component),
                    this.getControl(nx + 2, ny - 1 + i, nz - 1 + q, component),
                    fx
                );
            }
            zValues[q] = catmullRom(yValues[0], yValues[1], yValues[2], yValues[3], fy);
        }

        return catmullRom(zValues[0], zValues[1], zValues[2], zValues[3], fz);
    }

    applyFFD() {
        const source = this.basePositions;
        const destination = this.positionAttribute;
        const rangeX = this.bboxMax.x - this.bboxMin.x;
        const rangeY = this.bboxMax.y - this.bboxMin.y;
        const rangeZ = this.bboxMax.z - this.bboxMin.z;

        for (let i = 0; i < destination.count; i++) {
            const tx = (source[i * 3] - this.bboxMin.x) * (FFD_SIZE - 1) / rangeX;
            const ty = (source[i * 3 + 1] - this.bboxMin.y) * (FFD_SIZE - 1) / rangeY;
            const tz = (source[i * 3 + 2] - this.bboxMin.z) * (FFD_SIZE - 1) / rangeZ;
            const nx = Math.floor(tx);
            const ny = Math.floor(ty);
            const nz = Math.floor(tz);
            const fx = tx - nx;
            const fy = ty - ny;
            const fz = tz - nz;

            destination.setXYZ(
                i,
                this.interpolateControl(nx, ny, nz, fx, fy, fz, 0),
                this.interpolateControl(nx, ny, nz, fx, fy, fz, 1),
                this.interpolateControl(nx, ny, nz, fx, fy, fz, 2)
            );
        }

        destination.needsUpdate = true;
    }

    render(time, startTime, renderer, camera) {
        const t = time - startTime;

        camera.fov = 2 * Math.atan(0.45) * 180 / Math.PI;
        camera.aspect = 4 / 3;
        camera.near = 1;
        camera.far = 1000;
        camera.position.set(0, 0, 0);
        camera.rotation.set(0, 0, 0);
        camera.updateProjectionMatrix();

        const alpha = t > 14 ? 1 + 14 - t : clamp(t * 0.5);
        this.updateControlPoints(t);
        this.applyFFD();

        this.mesh.position.set(0, 0, -12);
        this.mesh.rotation.set(
            0,
            t * 10 * Math.PI / 180,
            5 * Math.sin(t / 3) * Math.PI / 180
        );

        this.material.opacity = 0.2 * alpha;
        this.texture.offset.set(t * 0.1, t * 0.5);
        renderer.render(this.scene, camera);
    }

    dispose() {
        super.dispose();
        if (this.texture) this.texture.dispose();
    }
}
