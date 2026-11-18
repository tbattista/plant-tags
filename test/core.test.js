import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { unzip, assertClosed, inside, maxZ } from './helpers.js';
import { cleanSvg, SAMPLES, sampleSvg, sampleFor } from '../src/art.js';
import { buildButton, buildHolder, holderThickness, epoxyGap, quantize, fitToButton, removeThin, keyCentre, NOTCH_PLAY, TAG } from '../src/geometry.js';
import { threeMf, zip } from '../src/files.js';
import { PALETTE } from '../src/palette.js';

describe('tag drawings', () => {
  it('starter drawings pass the cleaner and are picked by plant kind', () => {
    for (const s of SAMPLES) assert.match(cleanSvg(sampleSvg(s.key)), /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 500 600">/);
    assert.equal(sampleFor({ commonName: 'Golden pothos' }).key, 'pothos');
    assert.equal(sampleFor({ species: 'Dracaena trifasciata', commonName: 'Snake plant' }).key, 'snake-plant');
    assert.equal(sampleFor({ species: 'Monstera deliciosa' }).key, 'monstera');
    assert.equal(sampleFor({ commonName: 'Hoya' }).key, 'hoya');
    assert.equal(sampleFor({ commonName: 'Strange new thing' }).key, 'plant');
    // the longest matching name wins
    assert.equal(sampleFor({ commonName: 'Ponytail palm' }).key, 'ponytail-palm');
    assert.equal(sampleFor({ commonName: 'Parlor palm' }).key, 'parlor-palm');
    assert.equal(sampleFor({ commonName: 'Devil’s ivy' }).key, 'pothos');
    assert.equal(sampleFor({ commonName: 'English ivy' }).key, 'english-ivy');
    assert.equal(sampleFor({ species: 'Ficus lyrata' }).key, 'fiddle-leaf-fig');
    assert.equal(sampleFor({ species: 'Ficus elastica' }).key, 'rubber-plant');
    assert.ok(SAMPLES.length >= 30, 'a library of starter drawings');
    for (const s of SAMPLES) assert.ok(fs.existsSync(path.join(import.meta.dirname, '..', 'thumbs', `${s.key}.png`)), `thumbnail for ${s.key} (npm run art)`);
  });

  it('the cleaner keeps shapes, snaps colours to the four filaments and drops anything active', () => {
    const out = cleanSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)"><title>x</title><g style="fill:red" id="a"><path d="M0 0 L10 0 L10 10 Z" fill="#00ff00" stroke="#000" onclick="x()"/><circle cx="5" cy="5" r="2" fill="url(#g)" transform="rotate(10 5 5)"/><rect x="1" y="1" width="2" height="2" fill="#c0502f"/></g></svg>',
    );
    assert.match(out, /fill="#5a9a52"/); // bright green → leaf green
    assert.match(out, /stroke="#1d3446"/); // black → navy
    assert.match(out, /fill="#b8472b"/);
    assert.match(out, /transform="rotate\(10 5 5\)"/);
    assert.doesNotMatch(out, /onload|onclick|style|url|id=|alert|<title/);
    for (const bad of [
      '<svg><script>alert(1)</script><path d="M0 0"/><path d="M1 1"/><path d="M2 2"/></svg>',
      '<svg><image href="file:///etc/passwd"/></svg>',
      '<svg><foreignObject><p>hi</p></foreignObject></svg>',
      '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg><path d="M0 0"/>&x;</svg>',
      '<svg><path d="M0 0"/><path d="M1 1"/><path d="M1 1"/>hello</svg>',
      '<svg><style>path{}</style></svg>',
      'no drawing here',
      '<svg><g></g></svg>',
    ]) {
      assert.throws(() => cleanSvg(bad), (e) => e.code === 'BAD_ART', bad);
    }
  });
});

describe('frames and backgrounds', () => {
  it('drops a rectangle over most of the canvas (a frame or backdrop), keeping the plant and pot', () => {
    const framed = '<svg viewBox="0 0 500 600"><rect x="40" y="30" width="420" height="540" rx="12" fill="none" stroke="#1d3446" stroke-width="12"></rect><ellipse cx="250" cy="250" rx="120" ry="150" fill="#5a9a52"/><rect x="155" y="405" width="190" height="38" fill="#b8472b"/><path d="M169 439 L331 439 L311 544 L189 544 Z" fill="#b8472b"/></svg>';
    const out = cleanSvg(framed);
    assert.doesNotMatch(out, /width="420"/, 'the frame is gone');
    assert.match(out, /width="190"/, 'the pot rim stays');
    assert.equal((out.match(/<rect /g) || []).length, 2, 'the cleaner’s own background plus the pot rim');
    assert.equal((out.match(/<\/rect>/g) || []).length, 0, 'no stray closing tag left behind');
    // cleaning twice doesn't stack backgrounds
    assert.equal((cleanSvg(out).match(/width="500"/g) || []).length, 1);
  });
});

describe('holder styles', () => {
  const extent = (mesh) => {
    const v = mesh.vertices;
    const mn = [Infinity, Infinity, Infinity];
    const mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < v.length; i += 3) for (let k = 0; k < 3; k++) {
      mn[k] = Math.min(mn[k], v[i + k]);
      mx[k] = Math.max(mx[k], v[i + k]);
    }
    return { mn, mx };
  };
  it('the short stake has about 1.5″ of thinner spike below the cup', async () => {
    const tall = await buildHolder();
    const short = await buildHolder({ style: 'short' });
    const outer = tall.bore + TAG.holder.wall;
    const below = -extent(short.mesh).mn[1] - outer;
    assert.ok(Math.abs(below - 38) < 1, `short spike reaches ${below.toFixed(1)} mm below the cup`);
    assert.ok(short.volume < tall.volume / 2);
    assert.equal(extent(short.mesh).mx[2].toFixed(2), holderThickness().toFixed(2), 'flat print, same thickness as the cup');
  });
  it('the flat holder prints rim-down with its pin pointing up from the centre, cup open to the plate', async () => {
    const flat = await buildHolder({ style: 'flat' });
    const { mn, mx } = extent(flat.mesh);
    assert.equal(+mn[2].toFixed(3), 0);
    assert.ok(Math.abs(mx[2] - (holderThickness() + TAG.holder.pin.length)) < 0.1, 'cup + pin tall');
    const v = flat.mesh.vertices;
    let boreAtPlate = false;
    let tipNearCentre = true;
    for (let i = 0; i < v.length; i += 3) {
      const r = Math.hypot(v[i], v[i + 1]);
      if (Math.abs(v[i + 2]) < 1e-3 && Math.abs(r - flat.bore) < 0.05) boreAtPlate = true; // the button recess opens onto the plate
      if (v[i + 2] > mx[2] - 1 && r > 2) tipNearCentre = false;
    }
    assert.ok(boreAtPlate, 'the cup opening faces the plate');
    assert.ok(tipNearCentre, 'the pin ends in a point on the centre line');
    await assert.rejects(buildHolder({ style: 'nope' }));
  });
  it('the “tap here” icon is its own part: raised on the badge, inlaid flush in the back and the flat holder’s tab', async () => {
    const T = holderThickness();
    const zs = (m) => Array.from({ length: m.vertices.length / 3 }, (_, i) => m.vertices[i * 3 + 2]);
    const plain = await buildHolder();
    assert.equal(plain.iconMesh, null);
    const under = await buildHolder({ icon: 'under' });
    assert.ok(Math.abs(Math.max(...zs(under.mesh)) - T) < 1e-3, 'the holder part stops at the front face');
    assert.ok(Math.abs(Math.min(...zs(under.iconMesh)) - T) < 1e-3 && Math.abs(Math.max(...zs(under.iconMesh)) - (T + TAG.holder.icon.badge.raise)) < 1e-3, 'the icon part sits on top');
    const back = await buildHolder({ icon: 'back' });
    assert.ok(back.iconVolume > 30, 'an icon inlay in the back');
    assert.ok(Math.abs(plain.volume - back.volume - back.iconVolume) < 0.5, 'the inlay exactly fills its pocket (flush)');
    assert.ok(Math.max(...zs(back.iconMesh)) <= TAG.holder.icon.back.depth + 1e-3 && Math.min(...zs(back.iconMesh)) >= -1e-3, 'printed in the first layers, on the plate');
    const tab = await buildHolder({ style: 'flat', icon: 'tab' });
    assert.ok(tab.iconVolume > 20 && Math.min(...zs(tab.iconMesh)) >= -1e-3 && Math.max(...zs(tab.iconMesh)) <= TAG.holder.icon.tab.depth + 1e-3, 'the tab’s inlay is on the plate too');
    await assert.rejects(buildHolder({ style: 'flat', icon: 'back' }), /can't have/);
  });
});

describe('the key and the notch', () => {
  it('the cup has a round bump at the bottom and the button a matching round notch at the bottom of its picture, with play', async () => {
    const button = await buildButton(sampleSvg('pothos'));
    const holder = await buildHolder();
    const T = holderThickness();
    const k = TAG.holder.key;
    const pts = (mesh) => Array.from({ length: mesh.vertices.length / 3 }, (_, i) => [mesh.vertices[i * 3], mesh.vertices[i * 3 + 1], mesh.vertices[i * 3 + 2]]);
    const btn = button.parts.flatMap((p) => pts(p.mesh));
    const R = TAG.button.diameter / 2;
    const kc = keyCentre();
    // no part of the button comes within the bump (plus most of the play)
    assert.ok(!btn.some(([x, y]) => Math.hypot(x, y - kc) < k.radius + NOTCH_PLAY * 0.9), 'the button leaves room for the bump');
    // the notch is round: its edge points sit on a circle around the bump's centre
    const edge = btn.filter(([x, y]) => Math.hypot(x, y - kc) < k.radius + NOTCH_PLAY + 0.01 && y > -R + 0.05);
    assert.ok(edge.length > 8, 'a round notch, not a square one');
    assert.ok(btn.some(([x, y]) => Math.abs(x) < 2 && y > R - 0.05), 'the top edge is whole');
    // the bump stands proud of the cup wall at the bottom, at button height
    const cup = pts(holder.mesh);
    const proud = holder.bore - (-kc - k.radius);
    assert.ok(proud > 0.8 && proud < 1.3, `the bump stands ${proud.toFixed(2)} mm proud`);
    assert.ok(cup.some(([x, y, z]) => Math.abs(x) < 0.05 && Math.abs(y - (kc + k.radius)) < 0.02 && z > T - TAG.button.thickness - 0.01), 'the bump is on the cup wall at the bottom');
    // the notch stays inside the plain margin, clear of the drawing
    assert.ok(R - (-kc - k.radius - NOTCH_PLAY) < TAG.button.margin);
  });
});

describe('tag geometry', () => {
  let button;
  before(async () => {
    button = await buildButton(cleanSvg(sampleSvg('pothos')));
  });

  it('every starter drawing becomes a button of closed, non-overlapping parts in all four colours', async () => {
    for (const s of SAMPLES) {
      const b = s.key === 'pothos' ? button : await buildButton(cleanSvg(sampleSvg(s.key)));
      assert.deepEqual(b.parts.map((p) => p.key), ['beige', 'navy', 'green', 'brick'], s.key);
      for (const p of b.parts) assertClosed(p.mesh, `${s.key} ${p.name}`);
      // colour only in the first two 0.2 mm layers (solid beige from 0.4 mm up); the beige body is the full 1.6 mm
      for (const p of b.parts) assert.ok(Math.abs(maxZ(p.mesh) - (p.key === 'beige' ? TAG.button.thickness : TAG.colorDepth)) < 1e-4, `${s.key} ${p.key} height`);
      // everything inside the button's circle
      for (const p of b.parts) {
        for (let i = 0; i < p.mesh.vertices.length; i += 3) assert.ok(Math.hypot(p.mesh.vertices[i], p.mesh.vertices[i + 1]) <= TAG.button.diameter / 2 + 1e-3);
      }
    }
  });

  it('nothing on the button is thinner than a 0.4 mm nozzle can print cleanly', async () => {
    assert.equal(TAG.button.diameter, 30);
    for (const s of SAMPLES) {
      const q = await quantize(await fitToButton(cleanSvg(sampleSvg(s.key))));
      // another pass of the thin-feature filter finds (almost) nothing left to fix
      const left = removeThin(q.labels, q.w, q.h, (TAG.minFeature / 2) * TAG.pxPerMm);
      assert.ok(left < q.w * q.h * 0.001, `${s.key}: ${left} pixels narrower than ${TAG.minFeature} mm`);
    }
    // a hairline drawn on purpose is widened to a printable line, not dropped
    const hair = cleanSvg('<svg viewBox="0 0 500 600"><path d="M100 300 L400 300" stroke="#1d3446" stroke-width="1" fill="none"/><rect x="200" y="400" width="100" height="60" fill="#b8472b"/><rect x="200" y="150" width="100" height="60" fill="#5a9a52"/></svg>');
    const b = await buildButton(hair);
    const navy = b.parts.find((p) => p.key === 'navy');
    assert.ok(navy && navy.volume / TAG.colorDepth > 0.55 * 10, 'the hairline prints as a line at least ~0.55 mm wide');
  });

  it('the drawing is centred, kept off the edge, and mirrored because the button prints face-down', () => {
    const at = (key, x, y) => inside(button.parts.find((p) => p.key === key).mesh, [x + 0.013, y + 0.017, 0.3]);
    const R = TAG.button.diameter / 2;
    // the margin is plain beige all the way round, except the notch at the bottom (270°)
    for (let a = 0; a < 360; a += 15) {
      const r = R - TAG.button.margin / 2;
      const p = [r * Math.cos((a * Math.PI) / 180), r * Math.sin((a * Math.PI) / 180)];
      if (a === 270) assert.ok(!PALETTE.some((c) => button.parts.find((x) => x.key === c.key) && at(c.key, ...p)), 'the notch is empty');
      else assert.ok(at('beige', ...p), `margin at ${a}°`);
    }
    // the pot is at the bottom of the picture: on the plate (face-down) that is low Y
    assert.ok(at('brick', 0, -9), 'pot near the bottom');
    assert.ok(!at('brick', 0, 9), 'no pot at the top');
  });

  it('a shape on the left of the picture is on the right of the plate (the button is flipped over)', async () => {
    const svg = cleanSvg('<svg viewBox="0 0 500 600"><rect x="60" y="250" width="100" height="100" fill="#b8472b"/><rect x="340" y="250" width="100" height="100" fill="#5a9a52"/><rect x="200" y="400" width="100" height="40" fill="#1d3446"/></svg>');
    const b = await buildButton(svg);
    const centre = (key) => {
      const v = b.parts.find((p) => p.key === key).mesh.vertices;
      let x = 0;
      let y = 0;
      for (let i = 0; i < v.length; i += 3) {
        x += v[i];
        y += v[i + 1];
      }
      return [x / (v.length / 3), y / (v.length / 3)];
    };
    assert.ok(centre('brick')[0] > 5, 'brick (left in the picture) is at +X on the plate');
    assert.ok(centre('green')[0] < -5, 'green (right in the picture) is at −X');
    assert.ok(centre('navy')[1] < -3, 'navy (low in the picture) is at −Y');
    // and no colour turns up where it isn't drawn (blended edge pixels used to leave a green fringe)
    const xs = (key) => b.parts.find((p) => p.key === key).mesh.vertices.filter((_, i) => i % 3 === 0);
    assert.ok(Math.max(...xs('green')) < 0 && Math.min(...xs('brick')) > 0, 'each colour only where drawn');
  });

  it('the holder: a cup 0.4 mm deeper than the button (for epoxy), a sticker pocket under it, nubs to grip, and a spike', async () => {
    const h = await buildHolder({ clearance: 0.3 });
    assertClosed(h.mesh, 'holder');
    const T = holderThickness();
    assert.equal(T, 3.2, 'floor 0.8 + sticker pocket 0.4 + a 2 mm cup');
    assert.equal(TAG.button.thickness, 1.6, 'eight 0.2 mm layers');
    assert.equal(TAG.colorDepth, 0.4, 'two colour layers');
    assert.equal(epoxyGap(), 0.4, 'the button sits 0.4 mm below the rim, room for epoxy');
    assert.ok(Math.abs(maxZ(h.mesh) - T) < 1e-4);
    const R = TAG.button.diameter / 2;
    const off = [0.013, 0.017];
    const p = (x, y, z) => inside(h.mesh, [x + off[0], y + off[1], z]);
    const recessBottom = T - TAG.holder.recess;
    assert.ok(!p(5, 9, recessBottom + 0.5), 'recess for the button');
    assert.ok(!p(5, 9, recessBottom + TAG.button.thickness + 0.2), 'open above the button: the epoxy gap');
    assert.ok(!p(R + 0.1, 0, recessBottom + 0.5), 'recess is wider than the button');
    assert.ok(p(R + 0.5, 0, recessBottom + 0.5), 'and the rim is right outside it');
    assert.ok(!p(0, 0, recessBottom - 0.2), 'sticker pocket in the floor');
    assert.ok(!p(12.6, 0, recessBottom - 0.2), 'pocket fits a 25 mm sticker');
    assert.ok(p(12.9, 0, recessBottom - 0.2), 'snugly: the floor starts right outside it');
    assert.ok(p(0, 0, TAG.holder.floor - 0.3), 'floor under the sticker');
    // a nub reaches in from the wall at the top (first one points along +Y)
    const nubZ = T - TAG.holder.nub.height / 2 - 0.6;
    assert.ok(p(0, h.bore - TAG.holder.nub.protrude / 2, nubZ), 'nub grips the button edge');
    assert.ok(!p(0, h.bore - TAG.holder.nub.protrude / 2, recessBottom + 0.3), 'nub only near the top');
    assert.ok(p(0, -80, 2), 'spike');
    assert.ok(h.length > 150 && h.length < 175, `length ${h.length}`);
  });

  it('the 3MF carries every part with its filament', () => {
    const file = threeMf([{ name: 'Tag & co', parts: button.parts.map((p) => ({ name: p.name, extruder: p.slot, mesh: p.mesh })), at: [10, 20] }]);
    const files = unzip(file);
    for (const n of ['[Content_Types].xml', '_rels/.rels', '3D/3dmodel.model', 'Metadata/model_settings.config']) assert.ok(files.has(n), n);
    const model = files.get('3D/3dmodel.model').toString();
    const config = files.get('Metadata/model_settings.config').toString();
    assert.equal((model.match(/<component objectid=/g) || []).length, 4);
    assert.match(model, /name="Tag &amp; co"/);
    assert.match(model, /<item objectid="5" transform="1 0 0 0 1 0 0 0 1 10 20 0"/);
    for (const [i, c] of PALETTE.entries()) assert.match(config, new RegExp(`<part id="${i + 1}" subtype="normal_part"><metadata key="name" value="${c.name}"/>.*?<metadata key="extruder" value="${c.slot}"/></part>`));
    const verts = (model.match(/<vertex /g) || []).length;
    assert.equal(verts, button.parts.reduce((n, p) => n + p.mesh.vertices.length / 3, 0));
    assert.deepEqual([...unzip(zip([{ name: 'a.txt', data: 'hello' }])).get('a.txt').toString()], [...'hello']);
  });
});
