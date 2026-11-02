// The six trick-or-treat porches porches.js drives: the map's (world.js PORCHES, the cottages and the haunted house built
// by village.js). Fields: id 'P1'..'P6'; x, z the house's centre; yaw its rotation about +y (the door faces (sin yaw,
// cos yaw)); mat the doormat's centre and size (w along the wall, d out from it) and y its top (the porch deck);
// chimney [x, y, z] (world) where a resident ghost drops from; haunted (P6: trick only); lamp / railing the light groups
// of the merged glow mesh (the porch lamp with its glowing mat; the railing's jack-o'-lantern): porches.js scales their
// world.glowLevels, so it builds no stand-in fronts. Each house leaves a HOLE_W x HOLE_H doorway (props.js) centred on
// the mat's axis at its back edge, a vestibule behind it, for porches.js's door (hinged at the mat's back-left edge).
export { PORCHES } from './world.js';
