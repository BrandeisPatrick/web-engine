import{S as a,B as r,M as h,h as n,b7 as c,b6 as l}from"./three.module-B_yomNYV.js";const m=`
varying vec3 vDir;
void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,v=`
uniform float uExposure, uGlowAz, uSeed, uClouds;
varying vec3 vDir;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++) { s += a * n2(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s / 0.875; }
vec3 skyAt(vec3 d) {
  d = normalize(d);
  float phi = atan(d.x, -d.z), el = asin(clamp(d.y, -1.0, 1.0));
  float da = abs(mod(phi - uGlowAz + 3.14159265, 6.2831853) - 3.14159265);   // azimuth from the glow (rad)
  float glowA = exp(-da * da / 0.9);
  float e = max(el, 0.0);
  vec3 hor = mix(vec3(0.24, 0.14, 0.125), vec3(0.42, 0.17, 0.085), glowA);
  vec3 mid = mix(vec3(0.21, 0.15, 0.16), vec3(0.26, 0.17, 0.18), glowA);
  vec3 zen = vec3(0.045, 0.038, 0.045);
  vec3 sky = mix(hor, mid, smoothstep(0.0, 0.16, e));
  sky = mix(sky, zen, smoothstep(0.08, 0.46, e));
  sky += vec3(0.12, 0.04, 0.01) * glowA * exp(-e / 0.03) * exp(-da * da / 0.06);  // where the sun went down
  // cumulus on a layer 1 unit up: q = horizontal position where the view ray meets it
  if (uClouds < 0.5 || el < 0.0) return (el < 0.0 ? mix(hor * 0.6, vec3(0.05, 0.04, 0.045), smoothstep(0.0, 0.08, -el)) : sky) * uExposure;
  vec2 q = d.xz / pow(d.y + 0.05, 0.8) * 0.95 + vec2(uSeed, -uSeed * 0.7);
  float cluster = n2(q * 0.16 + 5.3) * 0.6 + n2(q * 0.4 - 2.1) * 0.4;     // groups of puffs, clear sky between
  float body = fbm(q * 0.85);
  float dens = body * 0.9 + cluster * 0.7 - 0.8;
  float det = n2(q * 3.1 + 4.0) * 0.65 + n2(q * 6.7 - 1.0) * 0.35;
  dens -= (1.0 - det) * 0.1;                                       // cauliflower edges
  float cov = smoothstep(0.0, 0.05, dens) * smoothstep(0.008, 0.04, e);
  float thick = smoothstep(0.02, 0.3, dens);
  vec3 cc = sky * vec3(0.54, 0.5, 0.54) * (0.7 + 0.45 * det) * (1.0 - 0.35 * thick);   // darker than the sky behind
  cc += vec3(0.07, 0.03, 0.01) * glowA * (1.0 - thick) * exp(-e / 0.15);                // warm-lit thin edges near the glow
  vec3 col = cov > 0.0 ? mix(sky, cc, cov) : sky;
  if (el < 0.0) col = mix(hor * 0.6, vec3(0.05, 0.04, 0.045), smoothstep(0.0, 0.08, -el)); // below the horizon: the haze
  return col * uExposure;
}
void main() { gl_FragColor = vec4(skyAt(vDir), 1.0); }`;class f{constructor({scene:e,renderer:t,atmo:o,glowAzimuth:s=0,exposure:i=1}){this.scene=e,this.renderer=t,this.atmo=o,this.glowAzimuth=s,this.exposure=i,this.active=!1,this._ver=-1,this.envRT=null}async load(){this.uniforms={uExposure:{value:this.exposure},uGlowAz:{value:this.glowAzimuth},uSeed:{value:3.7},uClouds:{value:1}};const e=new a({uniforms:this.uniforms,vertexShader:m,fragmentShader:v,side:r,depthWrite:!1,depthTest:!1,fog:!1,name:"duskSky"});return this.mesh=new h(new n(10,64,32),e),this.mesh.name="dusk-sky",this.mesh.renderOrder=-100,this.mesh.frustumCulled=!1,this.mesh.visible=!1,this.scene.add(this.mesh),this}wantActive(){const e=Math.asin(this.atmo.sunDir.y);return e<.09&&e>-.14}_apply(e){if(this.active=e,this.mesh.visible=e,this.atmo.sky&&(this.atmo.sky.visible=!e),!e)return;const t=new c(this.renderer),o=new l,s=this.mesh.clone();s.material=this.mesh.material.clone(),s.material.depthTest=!1,s.position.set(0,0,0),s.visible=!0,o.add(s),this.envRT&&this.envRT.dispose(),this.envRT=t.fromScene(o,.02,.1,100),t.dispose(),this.atmo.cubeCam&&this.renderer&&this.atmo.cubeCam.update(this.renderer,o),s.material.dispose(),this.scene.environment=this.envRT.texture,this.scene.environmentIntensity=1.6;const i=this.atmo.hemi;i&&(i.color.setRGB(.58,.52,.56),i.groundColor.setRGB(.14,.125,.115),i.intensity=.75),this.atmo.fogParams&&(this.atmo.fogParams.haze=Math.max(this.atmo.fogParams.haze,.0022))}update(e){if(!this.mesh)return;const t=this.wantActive();(t!==this.active||t&&this.atmo.version!==this._ver)&&(this._ver=this.atmo.version,this._apply(t)),this.active&&this.mesh.position.copy(e.position)}}export{f as DuskSky};
