import * as THREE from 'three';
import { Effect } from '../core/Effect.js';
import { catmullRom, clamp } from '../core/MathUtils.js';

const CHANGE_TIME_1 = 6.666666666666667;
const CHANGE_TIME_2 = 13.333333333333334;
const CHANGE_TIME_3 = 19;
const CONTROL_U = 6;
const CONTROL_V = 8;
const CONTROL_COUNT = CONTROL_U * CONTROL_V;
const SEED_U = 4;
const SEED_V = 6;
const FIELDS = 7; // xyz, uv, environment uv
const SURFACE_VERTEX_COUNT = CONTROL_U * (CONTROL_V - 1) *
    (SEED_U - 1) * (SEED_V - 1) * 6;

export class Tubes extends Effect {
    constructor() {
        super();

        this.controls = new Float64Array(CONTROL_COUNT * 3);
        this.controlUVs = new Float64Array(CONTROL_COUNT * 2);
        this.environmentUVs = new Float64Array(CONTROL_COUNT * 2);
        this.faceNormal0 = new Float64Array(CONTROL_COUNT * 3);
        this.faceNormal1 = new Float64Array(CONTROL_COUNT * 3);
        this.edges = new Float64Array(4 * SEED_V * FIELDS);
        this.line0 = new Float64Array(SEED_U * FIELDS);
        this.line1 = new Float64Array(SEED_U * FIELDS);

        this.baseMatrix = new THREE.Matrix4();
        this.workMatrix = new THREE.Matrix4();
        this.rotationMatrix = new THREE.Matrix4();
        this.workScale = new THREE.Vector3();
    }

    init(assets) {
        this.makeFace(assets.textures.face);
        this.makeCylinders(assets.textures.t1b);
        this.makeSplineSurface(assets.textures.t1b);
    }

    makeFace(texture) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([
            -10, 10, -30,
            10, 10, -30,
            10, -10, -30,
            -10, -10, -30
        ], 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute([
            0, 0, 1, 0, 1, 1, 0, 1
        ], 2));
        geometry.setIndex([0, 1, 2, 0, 2, 3]);

        this.faceGeometry = geometry;
        this.faceMaterial = this.createAdditiveMaterial({ map: texture });
        this.faceMesh = new THREE.Mesh(geometry, this.faceMaterial);
        this.faceMesh.frustumCulled = false;
        this.faceScene = new THREE.Scene();
        this.faceScene.add(this.faceMesh);
    }

    makeCylinders(texture) {
        const positions = [];
        const uvs = [];
        const indices = [];
        const verticalSegments = 8;
        const horizontalSegments = 8;

        for (let v = 0; v < verticalSegments; v++) {
            for (let h = 0; h < horizontalSegments; h++) {
                const angle = Math.PI * h * 2 / (horizontalSegments - 1);
                positions.push(
                    90 * Math.cos(angle),
                    v * 70 - (verticalSegments - 1) * 35,
                    90 * Math.sin(angle)
                );
                uvs.push(h / (horizontalSegments - 1), v / (verticalSegments - 1));
            }
        }

        for (let v = 0; v < verticalSegments - 1; v++) {
            for (let h = 0; h < horizontalSegments - 1; h++) {
                const a = v * horizontalSegments + h;
                const b = a + 1;
                const c = (v + 1) * horizontalSegments + h;
                const d = c + 1;
                indices.push(a, b, c, b, d, c);
            }
        }

        this.cylinderGeometry = new THREE.BufferGeometry();
        this.cylinderGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        this.cylinderGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        this.cylinderGeometry.setIndex(indices);
        this.cylinderMaterial = this.createAdditiveMaterial({ map: texture });
        this.cylinderScene = new THREE.Scene();
        this.cylinders = [];

        for (let i = 0; i < 8; i++) {
            const mesh = new THREE.Mesh(this.cylinderGeometry, this.cylinderMaterial);
            mesh.matrixAutoUpdate = false;
            mesh.frustumCulled = false;
            this.cylinders.push(mesh);
            this.cylinderScene.add(mesh);
        }
    }

    makeSplineSurface(texture) {
        this.surfacePositions = new Float32Array(SURFACE_VERTEX_COUNT * 3);
        this.surfaceUVs = new Float32Array(SURFACE_VERTEX_COUNT * 2);
        this.surfaceEnvironmentUVs = new Float32Array(SURFACE_VERTEX_COUNT * 2);
        this.surfacePositionAttribute = new THREE.BufferAttribute(this.surfacePositions, 3);
        this.surfaceUVAttribute = new THREE.BufferAttribute(this.surfaceUVs, 2);
        this.environmentUVAttribute = new THREE.BufferAttribute(this.surfaceEnvironmentUVs, 2);

        this.surfaceGeometry = new THREE.BufferGeometry();
        this.surfaceGeometry.setAttribute('position', this.surfacePositionAttribute);
        this.surfaceGeometry.setAttribute('uv', this.surfaceUVAttribute);

        this.environmentGeometry = new THREE.BufferGeometry();
        this.environmentGeometry.setAttribute('position', this.surfacePositionAttribute);
        this.environmentGeometry.setAttribute('uv', this.environmentUVAttribute);

        this.surfaceMaterial = this.createAdditiveMaterial({ map: texture });
        this.environmentMaterial = this.createAdditiveMaterial({ map: texture });
        this.surfaceMesh = new THREE.Mesh(this.surfaceGeometry, this.surfaceMaterial);
        this.environmentMesh = new THREE.Mesh(this.environmentGeometry, this.environmentMaterial);
        this.surfaceMesh.matrixAutoUpdate = false;
        this.environmentMesh.matrixAutoUpdate = false;
        this.surfaceMesh.frustumCulled = false;
        this.environmentMesh.frustumCulled = false;
        this.surfaceMesh.renderOrder = 0;
        this.environmentMesh.renderOrder = 1;

        this.surfaceScene = new THREE.Scene();
        this.surfaceScene.add(this.surfaceMesh, this.environmentMesh);
    }

    calculateAlpha(t) {
        let alpha;

        if (t > CHANGE_TIME_1) {
            alpha = clamp(t - CHANGE_TIME_1);
            if (t > CHANGE_TIME_2) {
                alpha = clamp(t - CHANGE_TIME_2);
                if (t > CHANGE_TIME_3) alpha = clamp(alpha * (1 + CHANGE_TIME_3 - t));
            } else {
                alpha = clamp(alpha * (CHANGE_TIME_2 - t));
            }
        } else {
            alpha = clamp(CHANGE_TIME_1 - t);
        }

        return alpha;
    }

    updateBaseMatrix(t) {
        this.baseMatrix.makeTranslation(0, 0, -420);
        this.baseMatrix.multiply(
            this.rotationMatrix.makeRotationX(40 * Math.sin(t / 2) * Math.PI / 180)
        );
        this.baseMatrix.multiply(
            this.rotationMatrix.makeRotationZ((30 + 20 * Math.sin(t / 2)) * Math.PI / 180)
        );

        if (t > CHANGE_TIME_1) {
            this.baseMatrix.multiply(this.rotationMatrix.makeRotationZ(Math.PI / 2));
            if (t > CHANGE_TIME_2) {
                this.baseMatrix.multiply(this.rotationMatrix.makeRotationX(Math.PI));
            }
        }
    }

    updateControls(t) {
        for (let v = 0; v < CONTROL_V; v++) {
            let radius = 50 + 10 * Math.sin(2.14 * t * v * 0.55);

            for (let u = 0; u < CONTROL_U; u++) {
                const pulseTime = t * v * 2 * Math.PI * u / CONTROL_U * 0.4;
                radius += 5 + 15 * Math.sin(0.9 * pulseTime);

                const i = u + v * CONTROL_U;
                const angle = u * 2 * Math.PI / CONTROL_U;
                this.controls[i * 3] = radius * Math.cos(angle);
                this.controls[i * 3 + 1] = v * 140 - (CONTROL_V - 1) * 70;
                this.controls[i * 3 + 2] = radius * Math.sin(angle);
                this.controlUVs[i * 2] = u / CONTROL_U + t * 0.1;
                this.controlUVs[i * 2 + 1] = v / CONTROL_V * 1.5 - t * 0.3;
            }
        }
    }

    nodeIndex(u, v) {
        u = (u % CONTROL_U + CONTROL_U) % CONTROL_U;
        v = Math.max(0, Math.min(CONTROL_V - 1, v));
        return u + v * CONTROL_U;
    }

    weirdCross(ax, ay, az, bx, by, bz, destination, offset) {
        destination[offset] = ay * bz + az * by;
        destination[offset + 1] = az * bx + ax * bz;
        destination[offset + 2] = ax * by + ay * bx;
    }

    updateControlNormals() {
        const p = this.controls;

        for (let v = 0; v < CONTROL_V; v++) {
            for (let u = 0; u < CONTROL_U; u++) {
                const i = this.nodeIndex(u, v);
                const right = this.nodeIndex(u + 1, v);
                const down = this.nodeIndex(u, v + 1);
                const rightDown = this.nodeIndex(u + 1, v + 1);
                const ix = p[i * 3];
                const iy = p[i * 3 + 1];
                const iz = p[i * 3 + 2];
                const rx = p[right * 3] - ix;
                const ry = p[right * 3 + 1] - iy;
                const rz = p[right * 3 + 2] - iz;
                const dx = p[down * 3] - ix;
                const dy = p[down * 3 + 1] - iy;
                const dz = p[down * 3 + 2] - iz;
                const rdx = p[rightDown * 3] - ix;
                const rdy = p[rightDown * 3 + 1] - iy;
                const rdz = p[rightDown * 3 + 2] - iz;

                this.weirdCross(rdx, rdy, rdz, rx, ry, rz, this.faceNormal1, i * 3);
                this.weirdCross(rdx, rdy, rdz, dx, dy, dz, this.faceNormal0, i * 3);
                this.faceNormal0[i * 3] *= -1;
                this.faceNormal0[i * 3 + 1] *= -1;
                this.faceNormal1[i * 3] *= -1;
                this.faceNormal1[i * 3 + 1] *= -1;
            }
        }

        const matrix = this.baseMatrix.elements;
        for (let v = 0; v < CONTROL_V; v++) {
            for (let u = 0; u < CONTROL_U; u++) {
                const i = this.nodeIndex(u, v);
                const up = this.nodeIndex(u, v - 1);
                const down = this.nodeIndex(u, v + 1);
                const leftUp = this.nodeIndex(u - 1, v - 1);
                let nx = this.faceNormal0[i * 3] + this.faceNormal1[i * 3] +
                    this.faceNormal0[up * 3] + this.faceNormal1[down * 3] +
                    this.faceNormal0[leftUp * 3] + this.faceNormal1[leftUp * 3];
                let ny = this.faceNormal0[i * 3 + 1] + this.faceNormal1[i * 3 + 1] +
                    this.faceNormal0[up * 3 + 1] + this.faceNormal1[down * 3 + 1] +
                    this.faceNormal0[leftUp * 3 + 1] + this.faceNormal1[leftUp * 3 + 1];
                const nz = this.faceNormal0[i * 3 + 2] + this.faceNormal1[i * 3 + 2] +
                    this.faceNormal0[up * 3 + 2] + this.faceNormal1[down * 3 + 2] +
                    this.faceNormal0[leftUp * 3 + 2] + this.faceNormal1[leftUp * 3 + 2];

                const tx = matrix[0] * nx + matrix[4] * ny + matrix[8] * nz;
                const ty = matrix[1] * nx + matrix[5] * ny + matrix[9] * nz;
                const tz = matrix[2] * nx + matrix[6] * ny + matrix[10] * nz;
                const inverseLength = 1 / Math.sqrt(tx * tx + ty * ty + tz * tz);
                nx = tx * inverseLength;
                ny = ty * inverseLength;

                // GenerateNormals writes each result to the previous table slot.
                const destination = (i + CONTROL_COUNT - 1) % CONTROL_COUNT;
                this.environmentUVs[destination * 2] = nx * 0.5 + 0.5;
                this.environmentUVs[destination * 2 + 1] = ny * 0.5 + 0.5;
            }
        }
    }

    nodeField(u, v, field) {
        const i = this.nodeIndex(u, v);
        if (field < 3) return this.controls[i * 3 + field];
        if (field < 5) return this.controlUVs[i * 2 + field - 3];
        return this.environmentUVs[i * 2 + field - 5];
    }

    fillEdges(patchU, patchV) {
        for (let edge = 0; edge < 4; edge++) {
            const u = patchU + edge - 1;
            for (let seed = 0; seed < SEED_V; seed++) {
                const offset = (edge * SEED_V + seed) * FIELDS;

                for (let field = 0; field < FIELDS; field++) {
                    if (seed === 0) {
                        this.edges[offset + field] = this.nodeField(u, patchV, field);
                    } else if (seed === SEED_V - 1) {
                        this.edges[offset + field] = this.nodeField(u, patchV + 1, field);
                    } else {
                        const f = seed / (SEED_V - 1);
                        this.edges[offset + field] = catmullRom(
                            this.nodeField(u, patchV - 1, field),
                            this.nodeField(u, patchV, field),
                            this.nodeField(u, patchV + 1, field),
                            this.nodeField(u, patchV + 2, field),
                            f
                        );
                    }
                }
            }
        }
    }

    fillLine(seedV, wrap, destination) {
        for (let seedU = 0; seedU < SEED_U; seedU++) {
            const f = seedU / (SEED_U - 1);
            const out = seedU * FIELDS;

            for (let field = 0; field < FIELDS; field++) {
                let a = this.edges[seedV * FIELDS + field];
                const b = this.edges[(SEED_V + seedV) * FIELDS + field];
                let c = this.edges[(2 * SEED_V + seedV) * FIELDS + field];
                let d = this.edges[(3 * SEED_V + seedV) * FIELDS + field];

                if (field === 3) {
                    if (wrap > 0) {
                        c += 1;
                        d += 1;
                    } else if (wrap < 0) {
                        a -= 1;
                    }
                }
                destination[out + field] = catmullRom(a, b, c, d, f);
            }
        }
    }

    emitVertex(line, seedU, vertex) {
        const source = seedU * FIELDS;
        const p = vertex * 3;
        const uv = vertex * 2;
        this.surfacePositions[p] = line[source];
        this.surfacePositions[p + 1] = line[source + 1];
        this.surfacePositions[p + 2] = line[source + 2];
        this.surfaceUVs[uv] = line[source + 3];
        this.surfaceUVs[uv + 1] = line[source + 4];
        this.surfaceEnvironmentUVs[uv] = line[source + 5];
        this.surfaceEnvironmentUVs[uv + 1] = line[source + 6];
        return vertex + 1;
    }

    tessellateSurface() {
        let vertex = 0;

        for (let v = 0; v < CONTROL_V - 1; v++) {
            for (let u = 0; u < CONTROL_U; u++) {
                this.fillEdges(u, v);
                const wrap = u === CONTROL_U - 1 ? 1 : (u === 0 ? -1 : 0);
                let previous = this.line0;
                let current = this.line1;
                this.fillLine(0, wrap, previous);

                for (let seedV = 1; seedV < SEED_V; seedV++) {
                    this.fillLine(seedV, wrap, current);
                    for (let seedU = 0; seedU < SEED_U - 1; seedU++) {
                        vertex = this.emitVertex(previous, seedU, vertex);
                        vertex = this.emitVertex(previous, seedU + 1, vertex);
                        vertex = this.emitVertex(current, seedU, vertex);
                        vertex = this.emitVertex(previous, seedU + 1, vertex);
                        vertex = this.emitVertex(current, seedU + 1, vertex);
                        vertex = this.emitVertex(current, seedU, vertex);
                    }
                    const swap = previous;
                    previous = current;
                    current = swap;
                }
            }
        }

        this.surfacePositionAttribute.needsUpdate = true;
        this.surfaceUVAttribute.needsUpdate = true;
        this.environmentUVAttribute.needsUpdate = true;
    }

    updateObjectMatrices(t) {
        for (let i = 0; i < this.cylinders.length; i++) {
            this.workMatrix.copy(this.baseMatrix);
            this.workMatrix.multiply(
                this.rotationMatrix.makeRotationY(10 * t * i * Math.PI / 180)
            );
            this.workScale.setScalar(1 + i * 0.4);
            this.workMatrix.scale(this.workScale);
            this.cylinders[i].matrix.copy(this.workMatrix);
            this.cylinders[i].matrixWorldNeedsUpdate = true;
        }

        this.surfaceMesh.matrix.copy(this.baseMatrix);
        this.environmentMesh.matrix.copy(this.baseMatrix);
        this.surfaceMesh.matrixWorldNeedsUpdate = true;
        this.environmentMesh.matrixWorldNeedsUpdate = true;
    }

    render(time, startTime, renderer, camera) {
        const t = time - startTime;
        const alpha = this.calculateAlpha(t);

        camera.fov = 2 * Math.atan(0.5 * 480 / 640) * 180 / Math.PI;
        camera.aspect = 4 / 3;
        camera.near = 1;
        camera.far = 1000;
        camera.position.set(0, 0, 0);
        camera.rotation.set(0, 0, 0);
        camera.updateProjectionMatrix();

        this.faceMaterial.opacity = 0.15 * alpha;
        renderer.render(this.faceScene, camera);

        this.updateBaseMatrix(t);
        this.updateControls(t);
        this.updateControlNormals();
        this.tessellateSurface();
        this.updateObjectMatrices(t);

        this.cylinderMaterial.opacity = (Math.sin(t * 5) * 0.05 + 0.15) * alpha;
        renderer.render(this.cylinderScene, camera);

        this.surfaceMaterial.opacity = 0.6 * alpha;
        this.environmentMaterial.opacity = 0.6 * alpha;
        renderer.render(this.surfaceScene, camera);
    }

    dispose() {
        super.dispose();
        if (this.faceGeometry) this.faceGeometry.dispose();
        if (this.faceMaterial) this.faceMaterial.dispose();
        if (this.cylinderGeometry) this.cylinderGeometry.dispose();
        if (this.cylinderMaterial) this.cylinderMaterial.dispose();
        if (this.surfaceGeometry) this.surfaceGeometry.dispose();
        if (this.environmentGeometry) this.environmentGeometry.dispose();
        if (this.surfaceMaterial) this.surfaceMaterial.dispose();
        if (this.environmentMaterial) this.environmentMaterial.dispose();
    }
}
