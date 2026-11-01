// STUB (map pass 1 replaces this file): the six trick-or-treat porches of the v2 map (DESIGN.md 3.3), in the shape
// world.js will export as PORCHES. Until the map pass lands, porches.js reads these and builds a stand-in porch front
// at each one (a wall panel with a doorway, a lamp, a railing post, a doormat); the cottages themselves do not exist.
// When world.js exports PORCHES (with `lamp` / `railing` as glow groups of its merged glow mesh, the cottages built),
// this file becomes `export { PORCHES } from './world.js';` and porches.js drives those glow groups instead of its
// stand-ins (see porches.js).
//
// Fields: id 'P1'..'P6'; x, z the cottage's centre; yaw its rotation about +y (three.js rotation.y, the door on the
// cottage's local +z side, so the door faces (sin yaw, cos yaw)); mat the doormat's centre and size (w along the wall,
// d out from it) and y its top (the deck; here the ground, the stand-ins have no deck); chimney [x, y, z] where a
// resident ghost drops from; haunted (P6: trick only); lamp / railing null here (glow groups in the real map).
import { heightAt } from './world.js';

const MAT_W = 2.2, MAT_D = 1.6;
/** A porch whose doormat lies `out` m in front of the cottage centre (x, z) along its facing yaw. */
function porch(id, x, z, yaw, out, chimney, haunted = false, matAt = null) {
  const s = Math.sin(yaw), c = Math.cos(yaw);
  const mx = matAt ? matAt[0] : x + s * out, mz = matAt ? matAt[1] : z + c * out;
  return {
    id, x, z, yaw, haunted, lamp: null, railing: null,
    mat: { x: +mx.toFixed(2), z: +mz.toFixed(2), w: MAT_W, d: MAT_D, y: heightAt(mx, mz) },
    chimney: [chimney[0], heightAt(chimney[0], chimney[2]) + chimney[1], chimney[2]],
  };
}

// cottages 7 x 6 m (the mat 3.7 m out from the centre: just in front of the front wall); the haunted house 11 x 9 m on
// the knoll with its porch mat at (-18.5, -18.5). The stub turns P1 and P6 (south-east in the design) to face south:
// the stand-in walls collide as axis-aligned boxes, and a 45-degree wall built of box steps trapped the kid. P1's mat
// sits where the design wants it for the first seconds (16 m from the spawn, 21 degrees left of forward), its door
// toward the player.
export const PORCHES = [
  porch('P1', -5.7, -12.6, 0, 3.7, [-4.2, 6.5, -14.6]),               // the gatekeeper's cottage
  porch('P2', -26, 34, Math.PI, 3.7, [-24.5, 6.5, 35.5]),              // Porch Row, doors north
  porch('P3', -4, 34, Math.PI, 3.7, [-2.5, 6.5, 35.5]),
  porch('P4', 18, 34, Math.PI, 3.7, [19.5, 6.5, 35.5]),
  porch('P5', 44, -2, -Math.PI / 2, 3.7, [45.5, 6.5, -3.5]),           // the east cottage, door west
  porch('P6', -24, -24, 0, 0, [-20, 9.5, -22.5], true, [-18.5, -18.5]), // the haunted house (its porch)
];
