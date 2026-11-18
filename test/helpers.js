import assert from 'node:assert/strict';
import zlib from 'node:zlib';

/** Read a ZIP built by files.js (or any deflate/stored zip without data descriptors). */
export function unzip(buf) {
  const out = new Map();
  let o = 0;
  while (buf.readUInt32LE(o) === 0x04034b50) {
    const method = buf.readUInt16LE(o + 8);
    const crc = buf.readUInt32LE(o + 14);
    const size = buf.readUInt32LE(o + 18);
    const nameLen = buf.readUInt16LE(o + 26);
    const extra = buf.readUInt16LE(o + 28);
    const name = buf.toString('utf8', o + 30, o + 30 + nameLen);
    const raw = buf.subarray(o + 30 + nameLen + extra, o + 30 + nameLen + extra + size);
    const data = method === 8 ? zlib.inflateRawSync(raw) : raw;
    assert.equal(zlib.crc32(data) >>> 0, crc, `crc of ${name}`);
    out.set(name, data);
    o += 30 + nameLen + extra + size;
  }
  assert.equal(buf.readUInt32LE(o), 0x02014b50, 'central directory follows the entries');
  return out;
}

/** Every edge, with vertices matched by position (as an STL reader would), is shared by exactly two triangles in opposite directions. */
export function assertClosed(mesh, what) {
  const key = (i) => `${mesh.vertices[i * 3].toFixed(4)},${mesh.vertices[i * 3 + 1].toFixed(4)},${mesh.vertices[i * 3 + 2].toFixed(4)}`;
  const ids = new Map();
  const id = (i) => {
    const k = key(i);
    if (!ids.has(k)) ids.set(k, ids.size);
    return ids.get(k);
  };
  const edges = new Map();
  const t = mesh.triangles;
  for (let i = 0; i < t.length; i += 3) {
    const v = [id(t[i]), id(t[i + 1]), id(t[i + 2])];
    for (let e = 0; e < 3; e++) {
      const k = `${v[e]}>${v[(e + 1) % 3]}`;
      edges.set(k, (edges.get(k) || 0) + 1);
    }
  }
  for (const [k, n] of edges) {
    const [a, b] = k.split('>');
    assert.equal(n, 1, `${what}: edge ${k} used ${n} times`);
    assert.equal(edges.get(`${b}>${a}`), 1, `${what}: edge ${k} has no partner`);
  }
}

/** Point-in-solid by casting a ray straight up and counting crossings. */
export function inside(mesh, [px, py, pz]) {
  const v = mesh.vertices;
  const t = mesh.triangles;
  let hits = 0;
  for (let i = 0; i < t.length; i += 3) {
    const [a, b, c] = [t[i] * 3, t[i + 1] * 3, t[i + 2] * 3];
    const d = (v[b] - v[a]) * (v[c + 1] - v[a + 1]) - (v[c] - v[a]) * (v[b + 1] - v[a + 1]);
    if (Math.abs(d) < 1e-12) continue;
    const l1 = ((v[b] - px) * (v[c + 1] - py) - (v[c] - px) * (v[b + 1] - py)) / d;
    const l2 = ((v[c] - px) * (v[a + 1] - py) - (v[a] - px) * (v[c + 1] - py)) / d;
    const l3 = 1 - l1 - l2;
    if (l1 < 0 || l2 < 0 || l3 < 0) continue;
    const z = l1 * v[a + 2] + l2 * v[b + 2] + l3 * v[c + 2];
    if (z > pz) hits++;
  }
  return hits % 2 === 1;
}

export const maxZ = (mesh) => mesh.vertices.reduce((m, x, i) => (i % 3 === 2 ? Math.max(m, x) : m), -Infinity);
