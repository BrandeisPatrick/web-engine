// Street surface + street kit of the Night NYC walk (one call from main.js): streetsurface.js patches the road and
// sidewalk materials (after wet.js) and wears the tactile pads; streetkit.js lays the kerb stones, everything set into
// the road and sidewalk, and the photoscanned street furniture with contact shadows. window.__nycStreet for the console
// (surface.uniforms.uStK 0..1 = the surface layer, kit.mesh / kit.shadows .visible = the kit).
import { makeStreetSurface, wearTactile } from './streetsurface.js';
import { buildStreetKit } from './streetkit.js';

/** o: { world, scene, base (samples/public/nyc/ url), desk, center {x,z} } */
export async function buildStreet(o) {
  const surface = makeStreetSurface(o.world);
  const tactile = wearTactile(o.world);
  const kit = await buildStreetKit({ ...o, radius: o.desk ? 900 : 600 });
  const street = { surface, tactile, kit };
  window.__nycStreet = street;
  return street;
}
