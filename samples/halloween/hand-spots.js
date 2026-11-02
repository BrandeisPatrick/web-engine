// Where the grave hands wait and where the candy thief lives: the map's (world.js, DESIGN.md 2.4 / 3.3).
//   HAND_SPOTS [[x, z]] the graveyard aisle (16, -14) .. (16, -38), two among the graves, and one at the north end of
//              each of the creek's three bridges (BRIDGES; world.js nudges a spot clear of colliders as it builds, in
//              place, before the hands read them)
//   THIEF_DEN  [x, z] the opening of the thief's den, a hay bale at the patch's north edge (world.js THIEF_DEN.door:
//              it comes out there, not inside the bale's collider)
// The thief needs no creek rule: down in the creek's bed (CREEK) its probe meets the bank as a wall and it hops out.
import { THIEF_DEN as DEN } from './world.js';

export { HAND_SPOTS } from './world.js';
export const THIEF_DEN = DEN.door;
