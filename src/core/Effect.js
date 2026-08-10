import * as THREE from 'three';

export class Effect {
    constructor() {
        this.scene = new THREE.Scene();
    }

    dispose() {
        this.scene.traverse(object => {
            object.geometry?.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(m => m.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });
    }

    createAdditiveMaterial(options) {
        const material = new THREE.MeshBasicMaterial({
            transparent: true,
            blending: THREE.CustomBlending,
            blendSrc: THREE.SrcAlphaFactor,
            blendDst: THREE.OneFactor,
            blendEquation: THREE.AddEquation,
            depthWrite: false,
            depthTest: false,
            side: THREE.DoubleSide,
            ...options
        });
        material.forceSinglePass = true;
        return material;
    }

    createAlphaMaterial(options) {
        const material = new THREE.MeshBasicMaterial({
            transparent: true,
            blending: THREE.NormalBlending,
            depthWrite: false,
            depthTest: false,
            side: THREE.DoubleSide,
            ...options
        });
        material.forceSinglePass = true;
        return material;
    }
}
