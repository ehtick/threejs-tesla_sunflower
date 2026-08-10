// MSVC-compatible shared rand() stream.
let state = 1;

export function rand() {
    state = (Math.imul(state, 214013) + 2531011) >>> 0;
    return (state >>> 16) & 0x7fff;
}

export function frand() {
    return rand() / 0x7fff;
}

export function getRandomState() {
    return state;
}

export function setRandomState(value) {
    state = value >>> 0;
}
