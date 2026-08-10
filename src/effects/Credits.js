import * as THREE from 'three';
import { Effect } from '../core/Effect.js';
import { clamp } from '../core/MathUtils.js';

const CHANGE_TIME = 8;
const SECOND_CHANGE_TIME = 16;
const FADE_TIME = 26.5;

function legacyQuad(size) {
    const geometry = new THREE.PlaneGeometry(size, size);
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    return geometry;
}

export class Credits extends Effect {
    init(assets) {
        this.tunnelGeometry = legacyQuad(600);
        this.tunnelMaterial = this.createAdditiveMaterial({
            map: assets.textures.y2,
            opacity: 0.2
        });
        this.tunnelMesh = new THREE.Mesh(this.tunnelGeometry, this.tunnelMaterial);

        this.overlayGeometry = legacyQuad(600);

        this.creditMaterial1 = this.createAlphaMaterial({
            map: assets.textures.cred_saffron01,
            opacity: 1
        });
        this.creditMaterial2 = this.createAlphaMaterial({
            map: assets.textures.cred_yoghurt01,
            opacity: 1
        });
        this.creditMaterial3 = this.createAlphaMaterial({
            map: assets.textures.cred_radixlluvia01,
            opacity: 1
        });

        this.overlayMesh = new THREE.Mesh(this.overlayGeometry, this.creditMaterial1);

        this.flashGeometry = new THREE.PlaneGeometry(600, 600);
        this.flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1,
            blending: THREE.CustomBlending,
            blendSrc: THREE.SrcAlphaFactor,
            blendDst: THREE.OneFactor,
            blendEquation: THREE.AddEquation,
            depthTest: false,
            depthWrite: false
        });
        this.flashMesh = new THREE.Mesh(this.flashGeometry, this.flashMaterial);

        this.tunnelScene = new THREE.Scene();
        this.tunnelScene.add(this.tunnelMesh);

        this.overlayScene = new THREE.Scene();
        this.overlayScene.add(this.overlayMesh);

        this.flashScene = new THREE.Scene();
        this.flashScene.add(this.flashMesh);
        this.overlayCamera = new THREE.OrthographicCamera(-300, 300, 300, -300, -1, 1);
    }

    render(time, startTime, renderer, camera) {
        const t = time - startTime;

        camera.fov = 2 * Math.atan(0.45) * 180 / Math.PI;
        camera.near = 1;
        camera.far = 1000;
        camera.position.set(0, 0, 0);
        camera.rotation.set(0, 0, 0);
        camera.updateProjectionMatrix();

        const alpha = t > FADE_TIME
            ? clamp(1 + FADE_TIME - t)
            : 1;

        const baseOpacity = 0.2 + 0.1 * Math.sin(t * 2);
        this.tunnelMaterial.opacity = baseOpacity * alpha;

        // Source rotations accumulate across the eight quads.
        let cumulativeRotZ = 0;
        this.tunnelMesh.position.set(0, 80, -250);
        for (let i = 0; i < 8; i++) {
            const uvOffsetU = -(0.4 * Math.sin(t + i * 6) + 0.4 * Math.cos(t * 2 + i * 4)) * 0.1;
            const uvOffsetV = (0.3 * Math.sin(t + i * 12) + 0.4 * Math.sin(t + i * 5)) * 0.05;

            if (this.tunnelMaterial.map) {
                this.tunnelMaterial.map.offset.set(uvOffsetU, uvOffsetV);
            }

            cumulativeRotZ += (5 + Math.sin(t + i * 10) * 10) * Math.PI / 180;

            this.tunnelMesh.rotation.set(
                -60 * Math.PI / 180,
                0,
                t * 10 * Math.PI / 180 + cumulativeRotZ
            );

            renderer.render(this.tunnelScene, camera);
        }

        let creditMaterial;
        let creditAlpha;
        if (t < CHANGE_TIME) {
            creditMaterial = this.creditMaterial1;
            creditAlpha = clamp((CHANGE_TIME - t) * 0.3);
        } else {
            creditMaterial = this.creditMaterial2;
            creditAlpha = clamp((t - SECOND_CHANGE_TIME) * 0.3);
        }

        this.overlayMesh.material = creditMaterial;
        creditMaterial.opacity = creditAlpha * alpha;
        renderer.render(this.overlayScene, this.overlayCamera);

        this.overlayMesh.material = this.creditMaterial3;
        this.creditMaterial3.opacity = (1 - creditAlpha) * alpha;
        renderer.render(this.overlayScene, this.overlayCamera);

        const flashAlpha = clamp(1 - t * 0.5);
        if (flashAlpha > 0) {
            this.flashMaterial.opacity = flashAlpha;
            renderer.render(this.flashScene, this.overlayCamera);
        }
    }

    dispose() {
        super.dispose();
        if (this.tunnelGeometry) this.tunnelGeometry.dispose();
        if (this.tunnelMaterial) this.tunnelMaterial.dispose();
        if (this.overlayGeometry) this.overlayGeometry.dispose();
        if (this.creditMaterial1) this.creditMaterial1.dispose();
        if (this.creditMaterial2) this.creditMaterial2.dispose();
        if (this.creditMaterial3) this.creditMaterial3.dispose();
        if (this.flashGeometry) this.flashGeometry.dispose();
        if (this.flashMaterial) this.flashMaterial.dispose();
    }
}
