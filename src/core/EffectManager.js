export class EffectManager {
    constructor() {
        this.effects = [];
    }

    addEffect(effect, startTime, endTime) {
        this.effects.push({ effect, startTime, endTime });
    }

    initAll(assets) {
        for (const { effect } of this.effects) {
            effect.init(assets);
        }
    }

    update(time, renderer, camera) {
        // Strict bounds leave exact cut times blank.
        for (const { effect, startTime, endTime } of this.effects) {
            if (time > startTime && time < endTime) {
                effect.render(time, startTime, renderer, camera);
            }
        }
    }

    getCurrentEffectNames(time) {
        const names = [];
        for (const { effect, startTime, endTime } of this.effects) {
            if (time > startTime && time < endTime) {
                names.push(effect.constructor.name);
            }
        }
        return names.join(' + ') || 'None';
    }

    reset() {
        for (const { effect } of this.effects) {
            effect.reset?.();
        }
    }

    dispose() {
        for (const { effect } of this.effects) {
            effect.dispose();
        }
        this.effects = [];
    }
}
