// Set by the 3D view once it runs: a JPEG of what it shows, for the PDF sheet.
let capturer: (() => string | null) | null = null;
export const setCapturer = (fn: (() => string | null) | null) => { capturer = fn; };
export const capture = () => capturer?.() ?? null;
