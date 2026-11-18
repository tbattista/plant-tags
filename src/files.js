/**
 * tags/files.js — print files without dependencies: binary STL, a 3MF whose
 * parts carry their filament (the layout Creality Print / OrcaSlicer /
 * Bambu Studio read from Metadata/model_settings.config), and a plain ZIP.
 */
import zlib from 'node:zlib';

const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Binary STL of one mesh ({ vertices: Float32Array xyz…, triangles: Uint32Array }). */
export function stl(mesh, name = 'plants') {
  const n = mesh.triangles.length / 3;
  const buf = Buffer.alloc(84 + n * 50);
  buf.write(name.slice(0, 79), 0, 'ascii');
  buf.writeUInt32LE(n, 80);
  const v = mesh.vertices;
  let o = 84;
  for (let t = 0; t < n; t++) {
    const a = mesh.triangles[t * 3] * 3;
    const b = mesh.triangles[t * 3 + 1] * 3;
    const c = mesh.triangles[t * 3 + 2] * 3;
    const ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2];
    const wx = v[c] - v[a], wy = v[c + 1] - v[a + 1], wz = v[c + 2] - v[a + 2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    for (const f of [nx, ny, nz, v[a], v[a + 1], v[a + 2], v[b], v[b + 1], v[b + 2], v[c], v[c + 1], v[c + 2]]) {
      buf.writeFloatLE(f, o);
      o += 4;
    }
    buf.writeUInt16LE(0, o);
    o += 2;
  }
  return buf;
}

function meshXml(mesh) {
  const v = mesh.vertices;
  const out = ['<mesh><vertices>'];
  for (let i = 0; i < v.length; i += 3) out.push(`<vertex x="${+v[i].toFixed(4)}" y="${+v[i + 1].toFixed(4)}" z="${+v[i + 2].toFixed(4)}"/>`);
  out.push('</vertices><triangles>');
  const t = mesh.triangles;
  for (let i = 0; i < t.length; i += 3) out.push(`<triangle v1="${t[i]}" v2="${t[i + 1]}" v3="${t[i + 2]}"/>`);
  out.push('</triangles></mesh>');
  return out.join('');
}

/**
 * One 3MF holding objects laid out on the plate. Each object is
 * { name, parts: [{ name, extruder, mesh }], at: [x, y] }; parts become
 * components of one object so they stay aligned, each assigned to its slot.
 */
export function threeMf(objects) {
  let id = 0;
  const resources = [];
  const items = [];
  const settings = [];
  for (const obj of objects) {
    const partIds = obj.parts.map((p) => {
      const pid = ++id;
      resources.push(`<object id="${pid}" type="model" name="${xmlEsc(p.name)}">${meshXml(p.mesh)}</object>`);
      return pid;
    });
    const oid = ++id;
    resources.push(`<object id="${oid}" type="model" name="${xmlEsc(obj.name)}"><components>${partIds.map((pid) => `<component objectid="${pid}"/>`).join('')}</components></object>`);
    const [x, y] = obj.at || [0, 0];
    items.push(`<item objectid="${oid}" transform="1 0 0 0 1 0 0 0 1 ${x} ${y} 0" printable="1"/>`);
    settings.push(
      `<object id="${oid}"><metadata key="name" value="${xmlEsc(obj.name)}"/><metadata key="extruder" value="${obj.parts[0].extruder}"/>` +
        obj.parts
          .map(
            (p, i) =>
              `<part id="${partIds[i]}" subtype="normal_part"><metadata key="name" value="${xmlEsc(p.name)}"/><metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/><metadata key="extruder" value="${p.extruder}"/></part>`,
          )
          .join('') +
        '</object>',
    );
  }
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<metadata name="Application">Plants (Tom’s in the Lab)</metadata>
<resources>${resources.join('\n')}</resources>
<build>${items.join('')}</build>
</model>`;
  return zip([
    {
      name: '[Content_Types].xml',
      data: `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="config" ContentType="text/xml"/></Types>`,
    },
    {
      name: '_rels/.rels',
      data: `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`,
    },
    { name: '3D/3dmodel.model', data: model },
    { name: 'Metadata/model_settings.config', data: `<?xml version="1.0" encoding="UTF-8"?>\n<config>${settings.join('')}</config>` },
  ]);
}

/** A ZIP archive (deflate) of [{ name, data: Buffer|string }]. */
export function zip(files) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8');
    const raw = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    const packed = zlib.deflateRawSync(raw, { level: 9 });
    const crc = zlib.crc32(raw) >>> 0;
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(0x0800, 6); // UTF-8 names
    head.writeUInt16LE(8, 8); // deflate
    head.writeUInt16LE(0, 10); // fixed time/date (1980-01-01) keeps output reproducible
    head.writeUInt16LE(33, 12);
    head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(packed.length, 18);
    head.writeUInt32LE(raw.length, 22);
    head.writeUInt16LE(name.length, 26);
    head.writeUInt16LE(0, 28);
    locals.push(head, name, packed);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(8, 10);
    c.writeUInt16LE(0, 12);
    c.writeUInt16LE(33, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(packed.length, 20);
    c.writeUInt32LE(raw.length, 24);
    c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, name);
    offset += 30 + name.length + packed.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}
