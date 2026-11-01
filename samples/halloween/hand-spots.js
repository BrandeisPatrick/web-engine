// STUB (map pass 1 replaces this file): where the grave hands wait and where the candy thief lives (DESIGN.md 2.4,
// 3.3), in the shape world.js will export them (HAND_SPOTS [[x, z]], THIEF_DEN [x, z]). When world.js exports them,
// this file becomes `export { HAND_SPOTS, THIEF_DEN } from './world.js';` (THIEF_DEN stays here if the map does not
// export it).
//
// The design's ten spots: the graveyard aisle (16, -14) .. (16, -38), two among the graves (28, -20) (38, -30), and
// one at each of the creek's three bridges (-36, 17) (0, 17) (40, 17). Today's map has no creek, so the three bridge
// spots stand on today's open lanes instead, where the design's bridges would be on a runner's way: the patch path at
// (-31, 17), the south path at (1.8, 17) and the cauldron path at (18.5, 21.5). (38, -30) moves 0.8 m south, clear of
// a gravestone. None is on the village green (centre (0, 2), r 11).
export const HAND_SPOTS = [
  [16, -14], [16, -20], [16, -26], [16, -32], [16, -38], // the graveyard aisle
  [28, -20], [38, -30.8],                                // among the graves
  [-31, 17], [1.8, 17], [18.5, 21.5],                    // stand-ins for the bridges W, C, E (on today's lanes)
];
// the thief's den, under a bale at the pumpkin patch's north edge
export const THIEF_DEN = [-42, -3];
