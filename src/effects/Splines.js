import * as THREE from 'three';
import { Effect } from '../core/Effect.js';

const DEG = Math.PI / 180;
const ASPECT = 480 / 640;
const TAIL_LENGTH = 64;

const SPLINES = [
    [[1.2, 2.3, 100], [2.3, 2.13, 100], [1.32, 2.16, 100]],
    [[2.122, 1.3, 80], [3.3, 1.13, 100], [2.43, 1.26, 100]],
    [[1.32, 1.14, 100], [2.35, 2.223, 100], [1.132, 2.416, 100]],
    [[1.52, 2.23, 50], [1.63, 2.613, 100], [1.42, 3.06, 100]],
    [[2.256, 2.23, 100], [1.03, 1.213, 100], [1.532, 2.216, 70]],
    [[2.2, 1.3, 50], [1.73, 2.413, 120], [1.332, 2.916, 100]],
    [[4.2, 1.3, 100], [1.3, 1.13, 100], [2.32, 2.16, 150]],
    [[1.22, 0.93, 80], [0.9, 1.913, 80], [1.32, 2.16, 110]],
    [[1.12, 2.3, 140], [2.3, -2.13, 130], [1.32, -2.16, 150]],
    [[-2.212, 1.3, 160], [3.3, 1.13, -150], [-2.43, 1.26, 140]],
    [[1.23, -1.14, 200], [2.35, -2.223, 150], [1.132, 2.416, -120]],
    [[1.25, 2.23, 100], [1.63, -2.613, 100], [-1.42, -3.06, 160]],
    [[-2.25, 2.23, 200], [1.03, 1.213, -150], [1.532, 2.216, 140]],
    [[2.2, -1.3, 100], [-1.73, 2.413, 190], [-1.332, 2.916, 200]],
    [[3.62, 2.3, 150], [1.3, -1.13, -120], [2.32, -2.16, 150]],
    [[1.22, -0.93, 160], [0.9, -1.913, 120], [-1.32, 2.16, 210]]
];

function makeSphere() {
    const radius = 600;
    const vSegments = 10;
    const hSegments = 10;
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

export class Splines extends Effect {
    constructor() {
        super();
        this.matrix = new THREE.Matrix4();
        this.inverse = new THREE.Matrix4();
        this.temp = new THREE.Matrix4();
        this.right = new THREE.Vector3();
        this.up = new THREE.Vector3();
    }

    init(assets) {
        this.sphereGeometry = makeSphere();
        this.sphereMaterial = this.createAdditiveMaterial({
            map: assets.textures.sphere,
            color: 0xffffff,
            side: THREE.DoubleSide
        });
        this.sphereMesh = new THREE.Mesh(this.sphereGeometry, this.sphereMaterial);
        this.sphereMesh.matrixAutoUpdate = false;
        this.sphereMesh.frustumCulled = false;
        this.sphereScene = new THREE.Scene();
        this.sphereScene.add(this.sphereMesh);

        const quadCount = SPLINES.length * TAIL_LENGTH;
        this.trailPositions = new Float32Array(quadCount * 4 * 3);
        const trailUVs = new Float32Array(quadCount * 4 * 2);
        const trailAlphas = new Float32Array(quadCount * 4);
        const trailIndices = new Uint16Array(quadCount * 6);

        for (let spline = 0; spline < SPLINES.length; spline++) {
            for (let i = 0; i < TAIL_LENGTH; i++) {
                const quad = spline * TAIL_LENGTH + i;
                const vertex = quad * 4;
                const uv = quad * 8;
                const index = quad * 6;
                let alpha = 1 - i / TAIL_LENGTH;
                alpha *= alpha;
                alpha *= alpha;

                trailUVs.set([0, 0, 1, 0, 1, 1, 0, 1], uv);
                trailAlphas.fill(alpha, vertex, vertex + 4);
                trailIndices.set([
                    vertex, vertex + 1, vertex + 2,
                    vertex, vertex + 2, vertex + 3
                ], index);
            }
        }

        this.trailGeometry = new THREE.BufferGeometry();
        this.trailPositionAttribute = new THREE.BufferAttribute(this.trailPositions, 3)
            .setUsage(THREE.DynamicDrawUsage);
        this.trailGeometry.setAttribute('position', this.trailPositionAttribute);
        this.trailGeometry.setAttribute('uv', new THREE.BufferAttribute(trailUVs, 2));
        this.trailGeometry.setAttribute('trailAlpha', new THREE.BufferAttribute(trailAlphas, 1));
        this.trailGeometry.setIndex(new THREE.BufferAttribute(trailIndices, 1));

        this.trailMaterial = new THREE.ShaderMaterial({
            uniforms: { map: { value: assets.textures.flare02 } },
            vertexShader: `
                attribute float trailAlpha;
                varying vec2 vUv;
                varying float vTrailAlpha;

                void main() {
                    vUv = uv;
                    vTrailAlpha = trailAlpha;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D map;
                varying vec2 vUv;
                varying float vTrailAlpha;

                void main() {
                    vec4 texel = texture2D(map, vUv);
                    gl_FragColor = texel * vec4(1.0, 1.0, 0.9, 0.1 * vTrailAlpha);
                }
            `,
            transparent: true,
            blending: THREE.CustomBlending,
            blendEquation: THREE.AddEquation,
            blendSrc: THREE.SrcColorFactor,
            blendDst: THREE.OneFactor,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        this.trailMaterial.forceSinglePass = true;
        this.trailMesh = new THREE.Mesh(this.trailGeometry, this.trailMaterial);
        this.trailMesh.matrixAutoUpdate = false;
        this.trailMesh.frustumCulled = false;
        this.trailScene = new THREE.Scene();
        this.trailScene.add(this.trailMesh);
    }

    render(time, startTime, renderer, camera) {
        const fTime = time - startTime;

        camera.position.set(0, 0, 0);
        camera.quaternion.identity();
        camera.scale.set(1, 1, 1);
        camera.projectionMatrix.makePerspective(
            -3.1, 3.1, 3.1 * ASPECT, -3.1 * ASPECT, 1, 2300
        );
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

        const rotY = fTime * 15 * DEG;
        const rotZ = (90 * Math.sin(fTime / 2) + 90 * Math.sin(fTime * 0.9)) * DEG;

        this.matrix.makeTranslation(0, 0, -500);
        this.matrix.multiply(this.temp.makeRotationY(rotY));
        this.matrix.multiply(this.temp.makeRotationZ(rotZ));
        this.sphereMaterial.opacity = 0.3 + 0.1 * Math.sin(fTime * 2);

        // Source loop transforms accumulate.
        for (let i = 0; i < 8; i++) {
            this.matrix.multiply(this.temp.makeRotationY(6 * fTime * i * DEG));
            this.matrix.multiply(this.temp.makeRotationZ(5 * DEG));
            this.matrix.multiply(this.temp.makeScale(1.1, 1.1, 1.1));
            this.sphereMesh.matrix.copy(this.matrix);
            this.sphereMesh.matrixWorldNeedsUpdate = true;
            renderer.render(this.sphereScene, camera);
        }

        camera.projectionMatrix.makePerspective(
            -0.5, 0.5, 0.5 * ASPECT, -0.5 * ASPECT, 1, 2300
        );
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

        let translation = 0;
        if (fTime > 3) {
            translation = Math.max(0, Math.min(1, (fTime - 3) * 0.3)) * 180;
        }

        this.matrix.makeTranslation(translation, 0, -500);
        this.matrix.multiply(this.temp.makeRotationY(rotY));
        this.matrix.multiply(this.temp.makeRotationZ(rotZ));
        this.trailMesh.matrix.copy(this.matrix);
        this.trailMesh.matrixWorldNeedsUpdate = true;

        this.inverse.copy(this.matrix).invert();
        this.right.setFromMatrixColumn(this.inverse, 0).multiplyScalar(10);
        this.up.setFromMatrixColumn(this.inverse, 1).multiplyScalar(10);

        const rx = this.right.x;
        const ry = this.right.y;
        const rz = this.right.z;
        const ux = this.up.x;
        const uy = this.up.y;
        const uz = this.up.z;
        let p = 0;

        for (const config of SPLINES) {
            let t = fTime;

            for (let i = 0; i < TAIL_LENGTH; i++) {
                const x = config[0];
                const y = config[1];
                const z = config[2];
                const px = Math.sin(t * x[0]) * x[2] + Math.sin(t * x[1] + 1) * x[2];
                const py = Math.sin(t * y[0]) * y[2] + Math.sin(t * y[1] + 1) * y[2];
                const pz = Math.sin(t * z[0]) * z[2] + Math.sin(t * z[1] + 1) * z[2];

                let alpha = 1 - i / TAIL_LENGTH;
                alpha *= alpha;
                alpha *= alpha;
                let k = Math.sin(alpha * 3.14 + 5);

                if (t > 3) {
                    const q = Math.max(0, Math.min(1, t - 3));
                    k = 1 - q + q * k;
                } else {
                    k = 1;
                }

                this.trailPositions[p++] = (px - rx + ux) * k;
                this.trailPositions[p++] = (py - ry + uy) * k;
                this.trailPositions[p++] = (pz - rz + uz) * k;
                this.trailPositions[p++] = (px + rx + ux) * k;
                this.trailPositions[p++] = (py + ry + uy) * k;
                this.trailPositions[p++] = (pz + rz + uz) * k;
                this.trailPositions[p++] = (px + rx - ux) * k;
                this.trailPositions[p++] = (py + ry - uy) * k;
                this.trailPositions[p++] = (pz + rz - uz) * k;
                // Source leaves the fourth corner unscaled.
                this.trailPositions[p++] = px - rx - ux;
                this.trailPositions[p++] = py - ry - uy;
                this.trailPositions[p++] = pz - rz - uz;

                t -= 0.036;
            }
        }

        this.trailPositionAttribute.needsUpdate = true;
        for (let spline = 0; spline < SPLINES.length; spline++) {
            this.trailGeometry.setDrawRange(spline * TAIL_LENGTH * 6, TAIL_LENGTH * 6);
            renderer.render(this.trailScene, camera);
        }
    }

    dispose() {
        this.sphereGeometry?.dispose();
        this.sphereMaterial?.dispose();
        this.trailGeometry?.dispose();
        this.trailMaterial?.dispose();
    }
}
