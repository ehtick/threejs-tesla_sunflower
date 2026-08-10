import * as THREE from 'three';
import { Effect } from '../core/Effect.js';
import { clamp } from '../core/MathUtils.js';

const DEG = Math.PI / 180;
const MORPH_ORDER = [1, 0, 3, 0];

function projection(camera, left, right, bottom, top, near = 1, far = 1000) {
    camera.projectionMatrix.makePerspective(left, right, top, bottom, near, far);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}

function legacyPositions(mesh) {
    const source = mesh.geometry.attributes.position.array;
    const result = new Float32Array(source.length);
    const point = new THREE.Vector3();
    mesh.updateMatrix();
    for (let i = 0; i < source.length; i += 3) {
        point.fromArray(source, i).applyMatrix4(mesh.matrix);
        result[i] = point.x;
        result[i + 1] = point.z;
        result[i + 2] = point.y;
    }
    return result;
}

// Legacy normals use the inverse transform directly, without renormalizing.
function legacyNormals(mesh, position, index) {
    const normal = new Float32Array(position.length);
    const count = new Uint16Array(position.length / 3);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const ab = new THREE.Vector3();
    const ac = new THREE.Vector3();

    for (let f = 0; f < index.length; f += 3) {
        const ia = index[f], ib = index[f + 1], ic = index[f + 2];
        a.fromArray(position, ia * 3);
        b.fromArray(position, ib * 3);
        c.fromArray(position, ic * 3);
        ab.subVectors(b, a);
        ac.subVectors(c, a);
        ab.cross(ac).normalize();
        for (const i of [ia, ib, ic]) {
            normal[i * 3] += ab.x;
            normal[i * 3 + 1] += ab.y;
            normal[i * 3 + 2] += ab.z;
            count[i]++;
        }
    }

    for (let i = 0; i < count.length; i++) {
        normal[i * 3] /= count[i];
        normal[i * 3 + 1] /= count[i];
        normal[i * 3 + 2] /= count[i];
    }

    mesh.updateMatrix();
    const e = mesh.matrix.clone().invert().elements;
    for (let i = 0; i < normal.length; i += 3) {
        const x = normal[i], y = normal[i + 1], z = normal[i + 2];
        normal[i] = e[0] * x + e[4] * y + e[8] * z;
        normal[i + 1] = e[1] * x + e[5] * y + e[9] * z;
        normal[i + 2] = e[2] * x + e[6] * y + e[10] * z;
    }
    return normal;
}

function alphaMaterial(map, opacity = 1) {
    return new THREE.MeshBasicMaterial({
        map,
        opacity,
        transparent: true,
        blending: THREE.CustomBlending,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        depthTest: true,
        depthWrite: true,
        depthFunc: THREE.LessEqualDepth,
        side: THREE.BackSide
    });
}

function additiveMaterial(map, opacity = 1, side = THREE.BackSide) {
    return new THREE.MeshBasicMaterial({
        map,
        opacity,
        transparent: true,
        blending: THREE.CustomBlending,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneFactor,
        depthTest: true,
        depthWrite: true,
        depthFunc: THREE.LessEqualDepth,
        side
    });
}

export class FaceMorph extends Effect {
    init(assets) {
        const meshes = assets.models.faces.children.filter((child) => child.isMesh);
        if (meshes.length < 4) throw new Error('faces.3ds is missing morph objects');

        const sourceGeometry = meshes[2].geometry;
        const index = Uint32Array.from(sourceGeometry.index.array);
        this.targets = meshes.map(legacyPositions);
        this.targetNormals = this.targets.map((positions, i) => (
            legacyNormals(meshes[i], positions, index)
        ));

        this.positions = new Float32Array(this.targets[0].length);
        this.normals = new Float32Array(this.targets[0].length);
        this.uv = new Float32Array(sourceGeometry.attributes.uv.array.length);
        this.baseUV = new Float32Array(this.uv.length);
        const sourceUV = sourceGeometry.attributes.uv.array;
        for (let i = 0; i < sourceUV.length; i += 2) {
            this.baseUV[i] = sourceUV[i];
            this.baseUV[i + 1] = 1 - sourceUV[i + 1];
        }

        this.geometry = new THREE.BufferGeometry();
        this.positionAttribute = new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage);
        this.normalAttribute = new THREE.BufferAttribute(this.normals, 3).setUsage(THREE.DynamicDrawUsage);
        this.uvAttribute = new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage);
        this.geometry.setAttribute('position', this.positionAttribute);
        this.geometry.setAttribute('normal', this.normalAttribute);
        this.geometry.setAttribute('uv', this.uvAttribute);
        this.geometry.setIndex(new THREE.BufferAttribute(index, 1));

        this.materials = [
            alphaMaterial(assets.textures.y6),
            alphaMaterial(assets.textures.t1a, 0.5),
            additiveMaterial(assets.textures.max_t1)
        ];
        this.face = new THREE.Mesh(this.geometry, this.materials[0]);
        this.face.matrixAutoUpdate = false;
        this.scene.add(this.face);

        this.tubeGeometry = this.makeTube();
        this.tubeMaterial = additiveMaterial(assets.textures.y7, 0.4, THREE.DoubleSide);
        this.tubeMaterial.forceSinglePass = true;
        this.tubeMaterial.depthTest = false;
        this.tubeMaterial.depthWrite = false;
        this.tube = new THREE.Mesh(this.tubeGeometry, this.tubeMaterial);
        this.tube.matrixAutoUpdate = false;
        this.tubeScene = new THREE.Scene();
        this.tubeScene.add(this.tube);

        this.overlayMaterial = alphaMaterial(assets.textures.blend2);
        this.overlayMaterial.side = THREE.DoubleSide;
        this.overlayMaterial.forceSinglePass = true;
        this.overlay = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.overlayMaterial);
        this.overlayScene = new THREE.Scene();
        this.overlayScene.add(this.overlay);
        this.overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

        this.faceMatrix = new THREE.Matrix4();
        this.rotation = new THREE.Matrix4();
        this.normalMatrix = new THREE.Matrix3();
        this.tubeScale = new THREE.Vector3();
    }

    makeTube() {
        const position = new Float32Array(8 * 8 * 3);
        const uv = new Float32Array(8 * 8 * 2);
        const index = [];
        for (let v = 0; v < 8; v++) {
            for (let h = 0; h < 8; h++) {
                const i = v * 8 + h;
                const angle = Math.PI * 2 * h / 7;
                position[i * 3] = 90 * Math.cos(angle);
                position[i * 3 + 1] = v * 70 - 245;
                position[i * 3 + 2] = 90 * Math.sin(angle);
                uv[i * 2] = h / 7;
                uv[i * 2 + 1] = v / 7;
            }
        }
        for (let v = 0; v < 7; v++) {
            for (let h = 0; h < 7; h++) {
                const a = v * 8 + h;
                index.push(a, a + 1, a + 8, a + 1, a + 9, a + 8);
            }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        geometry.setIndex(index);
        return geometry;
    }

    setTextureUV(tx, ty, angle) {
        const c = Math.cos(angle), s = Math.sin(angle);
        for (let i = 0; i < this.baseUV.length; i += 2) {
            const u = this.baseUV[i], v = this.baseUV[i + 1];
            this.uv[i] = c * u - s * v + tx;
            this.uv[i + 1] = s * u + c * v + ty;
        }
        this.uvAttribute.needsUpdate = true;
    }

    render(time, startTime, renderer, camera) {
        const t = time - startTime;
        const alpha = clamp(19.5 - t, 0, 1);

        this.faceMatrix.makeTranslation(2, 0, -13)
            .multiply(this.rotation.makeRotationX(20 * Math.sin(t) * DEG))
            .multiply(this.rotation.makeRotationY((10 * Math.sin(t * 0.9) - 15) * DEG))
            .multiply(this.rotation.makeRotationY(Math.PI));
        this.face.matrix.copy(this.faceMatrix);
        this.face.matrixWorldNeedsUpdate = true;

        projection(camera, -12.6, 12.6, -12.45, 12.45);
        this.tubeMaterial.opacity = 0.4 * alpha;
        for (let u = 0; u < 4; u++) {
            this.tube.matrix.copy(this.faceMatrix)
                .multiply(this.rotation.makeRotationY((1 + t * 10 * u) * DEG))
                .scale(this.tubeScale.setScalar(1 + u));
            this.tube.matrixWorldNeedsUpdate = true;
            renderer.render(this.tubeScene, camera);
        }

        const phase = t * 0.5;
        const mix = Math.cos((1 - phase % 1) * 3.14159) * 0.5 + 0.5;
        const morph = Math.floor(phase % MORPH_ORDER.length);
        const first = MORPH_ORDER[morph];
        const second = MORPH_ORDER[(morph + 1) % MORPH_ORDER.length];
        const p1 = this.targets[first], p2 = this.targets[second];
        const n1 = this.targetNormals[first], n2 = this.targetNormals[second];
        for (let i = 0; i < this.positions.length; i++) {
            this.positions[i] = p1[i] + (p2[i] - p1[i]) * mix;
            this.normals[i] = n1[i] + (n2[i] - n1[i]) * mix;
        }
        this.positionAttribute.needsUpdate = true;
        this.normalAttribute.needsUpdate = true;

        projection(camera, -0.6, 0.6, -0.45, 0.45);
        this.materials[0].opacity = alpha;
        this.setTextureUV(t * 0.05, t * 0.1, t * 30 * DEG);
        this.face.material = this.materials[0];
        renderer.render(this.scene, camera);

        this.materials[1].opacity = 0.5 * alpha;
        this.setTextureUV(t * 0.05, -t * 0.05, -t * 20 * DEG);
        this.face.material = this.materials[1];
        renderer.render(this.scene, camera);

        this.normalMatrix.setFromMatrix4(this.faceMatrix);
        const e = this.normalMatrix.elements;
        for (let i = 0, v = 0; i < this.normals.length; i += 3, v += 2) {
            const x = this.normals[i], y = this.normals[i + 1], z = this.normals[i + 2];
            this.uv[v] = (e[0] * x + e[3] * y + e[6] * z) * 0.5 + 0.5;
            this.uv[v + 1] = (e[1] * x + e[4] * y + e[7] * z) * 0.5 + 0.5;
        }
        this.uvAttribute.needsUpdate = true;
        this.materials[2].opacity = alpha;
        this.face.material = this.materials[2];
        renderer.render(this.scene, camera);

        this.overlayMaterial.opacity = alpha;
        renderer.render(this.overlayScene, this.overlayCamera);
    }

    dispose() {
        this.geometry?.dispose();
        this.materials?.forEach((material) => material.dispose());
        this.tubeGeometry?.dispose();
        this.tubeMaterial?.dispose();
        this.overlay?.geometry.dispose();
        this.overlayMaterial?.dispose();
    }
}
