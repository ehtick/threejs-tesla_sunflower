import * as THREE from 'three';
import { Effect } from '../core/Effect.js';
import { clamp } from '../core/MathUtils.js';
import { DarkQuads } from '../core/DarkQuads.js';

const TARGETS = 6;
const CHANGE_TIME3 = 18.3;

// Match load3ds: swap Y/Z and average unit face normals without renormalizing.
function loadTarget(mesh, index) {
    const source = mesh.geometry.getAttribute('position');
    const positions = new Float32Array(source.count * 3);
    const normals = new Float32Array(source.count * 3);
    const count = new Uint16Array(source.count);

    for (let i = 0; i < source.count; i++) {
        positions[i * 3] = source.getX(i);
        positions[i * 3 + 1] = source.getZ(i);
        positions[i * 3 + 2] = source.getY(i);
    }

    for (let i = 0; i < index.count; i += 3) {
        const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
        const a3 = a * 3, b3 = b * 3, c3 = c * 3;
        const abx = positions[b3] - positions[a3];
        const aby = positions[b3 + 1] - positions[a3 + 1];
        const abz = positions[b3 + 2] - positions[a3 + 2];
        const acx = positions[c3] - positions[a3];
        const acy = positions[c3 + 1] - positions[a3 + 1];
        const acz = positions[c3 + 2] - positions[a3 + 2];
        let nx = aby * acz - abz * acy;
        let ny = abz * acx - abx * acz;
        let nz = abx * acy - aby * acx;
        const invLength = 1 / Math.hypot(nx, ny, nz);
        nx *= invLength;
        ny *= invLength;
        nz *= invLength;

        for (const vertex of [a, b, c]) {
            const v = vertex * 3;
            normals[v] += nx;
            normals[v + 1] += ny;
            normals[v + 2] += nz;
            count[vertex]++;
        }
    }

    for (let i = 0; i < source.count; i++) {
        const n = i * 3;
        normals[n] /= count[i];
        normals[n + 1] /= count[i];
        normals[n + 2] /= count[i];
    }

    return { positions, normals };
}

export class FFDEnv extends Effect {
    constructor() {
        super();
        this.targets = [];
    }

    init(assets) {
        const meshes = [];
        assets.models.meta.traverse(object => {
            if (object.isMesh) meshes.push(object);
        });

        if (meshes.length !== TARGETS) {
            throw new Error(`META.3DS: expected ${TARGETS} morph objects, got ${meshes.length}`);
        }

        const sourceGeometry = meshes[0].geometry;
        const sourceIndex = sourceGeometry.index;
        const sourcePosition = sourceGeometry.getAttribute('position');
        if (!sourceIndex) throw new Error('META.3DS: indexed geometry required');

        for (const mesh of meshes) {
            const geometry = mesh.geometry;
            if (!geometry.index || geometry.index.count !== sourceIndex.count ||
                geometry.getAttribute('position').count !== sourcePosition.count) {
                throw new Error('META.3DS: morph topology mismatch');
            }
            for (let i = 0; i < sourceIndex.count; i++) {
                if (geometry.index.getX(i) !== sourceIndex.getX(i)) {
                    throw new Error('META.3DS: morph index mismatch');
                }
            }
            this.targets.push(loadTarget(mesh, sourceIndex));
        }

        const vertexCount = this.targets[0].positions.length / 3;
        this.positions = new Float32Array(this.targets[0].positions);
        this.normals = new Float32Array(this.targets[0].normals);
        this.baseUVs = new Float32Array(vertexCount * 2);
        this.envUVs = new Float32Array(vertexCount * 2);
        for (let i = 0; i < vertexCount; i++) {
            this.baseUVs[i * 2] = this.targets[0].normals[i * 3] * 0.5 + 0.5;
            this.baseUVs[i * 2 + 1] = this.targets[0].normals[i * 3 + 1] * 0.5 + 0.5;
        }

        this.geometry = new THREE.BufferGeometry();
        this.geometry.setIndex(sourceIndex.clone());
        this.positionAttribute = new THREE.BufferAttribute(this.positions, 3)
            .setUsage(THREE.DynamicDrawUsage);
        this.uvAttribute = new THREE.BufferAttribute(new Float32Array(this.baseUVs), 2)
            .setUsage(THREE.DynamicDrawUsage);
        this.geometry.setAttribute('position', this.positionAttribute);
        this.geometry.setAttribute('uv', this.uvAttribute);

        this.baseMaterial = new THREE.MeshBasicMaterial({
            map: assets.textures.gothickiemura02,
            transparent: true,
            blending: THREE.NormalBlending,
            depthTest: true,
            depthWrite: true,
            depthFunc: THREE.LessEqualDepth,
            side: THREE.BackSide,
            toneMapped: false
        });
        this.envMaterial = new THREE.MeshBasicMaterial({
            map: assets.textures.max_t3,
            transparent: true,
            blending: THREE.CustomBlending,
            blendSrc: THREE.SrcAlphaFactor,
            blendDst: THREE.OneFactor,
            blendEquation: THREE.AddEquation,
            depthTest: true,
            depthWrite: true,
            depthFunc: THREE.LessEqualDepth,
            side: THREE.BackSide,
            toneMapped: false
        });

        this.mesh = new THREE.Mesh(this.geometry, this.baseMaterial);
        this.mesh.frustumCulled = false;
        this.mesh.rotation.order = 'YZX';
        this.scene.add(this.mesh);

        this.overlayGeometry = new THREE.BufferGeometry();
        this.overlayGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
            0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0
        ], 3));
        this.overlayGeometry.setAttribute('uv', new THREE.Float32BufferAttribute([
            0, 0, 1, 0, 1, 1, 0, 1
        ], 2));
        this.overlayGeometry.setIndex([0, 1, 2, 0, 2, 3]);
        this.overlayMaterial = new THREE.MeshBasicMaterial({
            map: assets.textures.blend,
            transparent: true,
            blending: THREE.NormalBlending,
            depthTest: true,
            depthWrite: true,
            depthFunc: THREE.LessEqualDepth,
            side: THREE.DoubleSide,
            toneMapped: false
        });
        this.overlayMaterial.forceSinglePass = true;
        this.overlayMesh = new THREE.Mesh(this.overlayGeometry, this.overlayMaterial);
        this.overlayMesh.frustumCulled = false;
        this.overlayScene = new THREE.Scene();
        this.overlayScene.add(this.overlayMesh);
        this.overlayCamera = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
        this.darkQuads = new DarkQuads();
    }

    render(time, startTime, renderer, camera) {
        const timeLocal = time - startTime;

        camera.fov = 2 * Math.atan(0.45) * 180 / Math.PI;
        camera.aspect = 4 / 3;
        camera.near = 1;
        camera.far = 1000;
        camera.position.set(0, 0, 0);
        camera.quaternion.identity();
        camera.updateProjectionMatrix();

        const alpha = clamp(1 - timeLocal + CHANGE_TIME3);
        const phase = (timeLocal * 0.5) % 1;
        const morph = Math.cos((1 - phase) * 3.14159) * 0.5 + 0.5;
        const first = Math.floor((timeLocal * 0.5) % TARGETS);
        const second = (first + 1) % TARGETS;
        const p0 = this.targets[first].positions;
        const p1 = this.targets[second].positions;
        const n0 = this.targets[first].normals;
        const n1 = this.targets[second].normals;

        for (let i = 0; i < this.positions.length; i++) {
            this.positions[i] = p0[i] + (p1[i] - p0[i]) * morph;
            this.normals[i] = n0[i] + (n1[i] - n0[i]) * morph;
        }
        this.positionAttribute.needsUpdate = true;

        this.mesh.position.set(0, 0, -30);
        this.mesh.rotation.set(
            Math.PI / 2,
            15 * Math.sin(timeLocal) * Math.PI / 180,
            timeLocal * 45 * Math.PI / 180
        );
        this.mesh.updateMatrix();

        const matrix = this.mesh.matrix.elements;
        for (let n = 0, uv = 0; n < this.normals.length; n += 3, uv += 2) {
            const x = this.normals[n], y = this.normals[n + 1], z = this.normals[n + 2];
            this.envUVs[uv] = (matrix[0] * x + matrix[4] * y + matrix[8] * z) * 0.5 + 0.5;
            this.envUVs[uv + 1] = (matrix[1] * x + matrix[5] * y + matrix[9] * z) * 0.5 + 0.5;
        }

        this.uvAttribute.array.set(this.baseUVs);
        this.uvAttribute.needsUpdate = true;
        this.baseMaterial.opacity = alpha;
        this.mesh.material = this.baseMaterial;
        renderer.render(this.scene, camera);

        this.uvAttribute.array.set(this.envUVs);
        this.uvAttribute.needsUpdate = true;
        this.envMaterial.opacity = alpha;
        this.mesh.material = this.envMaterial;
        renderer.render(this.scene, camera);

        this.overlayMaterial.opacity = alpha;
        renderer.render(this.overlayScene, this.overlayCamera);

        const sine = Math.sin(timeLocal);
        this.darkQuads.render(renderer, Math.trunc(sine * 40 + 50), {
            r: 0, g: 0, b: 0, a: Math.max(0, sine * 0.3)
        });
    }

    dispose() {
        this.geometry?.dispose();
        this.baseMaterial?.dispose();
        this.envMaterial?.dispose();
        this.overlayGeometry?.dispose();
        this.overlayMaterial?.dispose();
        this.darkQuads?.dispose();
    }
}
