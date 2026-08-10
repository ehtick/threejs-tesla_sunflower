export function catmullRom(a, b, c, d, t) {
    const fa = 0.5 * (3 * b + d - a - 3 * c);
    const fb = a + 2 * c - 0.5 * (5 * b + d);
    const fc = 0.5 * (c - a);
    return t * t * t * fa + t * t * fb + t * fc + b;
}

export function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, value));
}
