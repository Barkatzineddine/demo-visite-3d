/** Download text or bytes as a file through a blob URL (no network). */
export function download(filename: string, content: string | Uint8Array, type = 'text/plain'): void {
  const url = URL.createObjectURL(new Blob([content as BlobPart], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}
