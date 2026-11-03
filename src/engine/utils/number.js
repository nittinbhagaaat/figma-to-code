export const round = (n, d = 2) => { const f = 10 ** d; return Math.round((Number(n) + Number.EPSILON) * f) / f; };
/** Pixel value without trailing zeros, e.g. 12 -> "12px", 0 -> "0". */
export const px = (n) => { const r = round(n); return r === 0 ? "0" : `${r}px`; };
export const near = (a, b, eps = 1) => Math.abs(a - b) <= eps;
