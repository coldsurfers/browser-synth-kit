/**
 * WebGL2 visual stage — the *artistic* renderer. Same color-blind contract as the 2D
 * `createVisualStage` (returns `VisualStageHandle`, so `createVisualSync` drives it
 * unchanged), but paints a shoegaze "wall of light": a ping-pong feedback buffer that
 * smears and warps the previous frame (the dreamy Loveless-y melt), an audio-driven haze
 * field, and discrete hit blooms — then a present pass adds chromatic aberration, a soft
 * bloom rolloff, vignette and film grain.
 *
 * Zero dependencies (raw WebGL2, no three.js). Throws if WebGL2 is unavailable — the caller
 * should fall back to `createVisualStage` (2D). Time comes from `frame(now)` (ctx.currentTime).
 */
import type { HitKind, StagePreset, VisualStageHandle } from './stage'

const VERT = `#version 300 es
void main(){
  // full-screen triangle, no attributes
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

// Sim pass — feedback smear + haze field + hits → accumulation buffer.
const SIM = `#version 300 es
precision highp float;
out vec4 frag;
uniform sampler2D u_prev;
uniform vec2 u_res;
uniform float u_time, u_lo, u_hi, u_level, u_bloom, u_feedback, u_warp;
uniform vec3 u_bg, u_ink0, u_ink1, u_ink2;
uniform float u_kick, u_chord, u_snare, u_accent;
uniform int u_mark;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1,0)), c = hash(i + vec2(0,1)), d = hash(i + vec2(1,1));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.02; a*=0.5; } return s; }

void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / u_res.y;
  vec2 c = uv - 0.5; c.x *= aspect;

  // feedback advection — rotate + zoom the previous frame, then warp its sample coords
  float ang = (0.012 + u_lo * 0.02) * u_warp;
  float zoom = 1.0 - (0.004 + u_kick * 0.025);
  mat2 R = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
  vec2 wc = R * (c * zoom);
  float t = u_time * 0.05;
  vec2 warp = vec2(fbm(c * 3.0 + t), fbm(c * 3.0 - t + 7.3)) - 0.5;
  wc += warp * (0.004 + 0.02 * u_hi) * u_warp;
  vec2 puv = wc; puv.x /= aspect; puv += 0.5;
  vec3 prev = texture(u_prev, puv).rgb * u_feedback;

  // generative haze field — the wall
  float n = fbm(c * 2.4 + vec2(t * 0.6, -t * 0.4));
  float band = mix(u_lo, u_hi, uv.y);
  float e = clamp(u_level * 0.5 + band * 0.7 + (n - 0.5) * 0.6, 0.0, 1.0);
  if (u_mark == 1) e *= 0.5 + 0.5 * step(0.5, fract(uv.x * 24.0));        // bars
  else if (u_mark == 2) e *= 0.6 + 0.4 * sin(uv.y * u_res.y * 0.35);      // scanline
  else if (u_mark == 3) e *= 0.5 + 0.5 * sin(length(c) * 40.0 - u_time * 2.0); // rings
  vec3 col = mix(u_ink0, u_ink1, smoothstep(0.2, 0.9, n));
  col = mix(col, u_ink2, u_hi * 0.8);
  col = mix(col, u_ink1, u_chord * 0.5);                                  // chord tint push
  vec3 add = col * e * (0.05 + u_bloom * 0.12);

  // discrete hits
  float d = length(c);
  add += u_ink0 * u_kick * smoothstep(0.7, 0.0, d) * (0.6 + u_bloom * 0.6);      // kick bloom
  add += u_ink2 * u_snare * smoothstep(0.03, 0.0, abs(c.y)) * 0.8;               // snare bar
  add += u_ink1 * u_accent * smoothstep(0.025, 0.0, abs(d - 0.35)) * 0.9;        // accent ring

  vec3 outc = mix(prev + add, u_bg, 0.006);   // gentle pull to bg so it never fully rails/dies
  frag = vec4(outc, 1.0);
}`

// Present pass — accumulation buffer → screen, with the film look.
const PRESENT = `#version 300 es
precision highp float;
out vec4 frag;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_time, u_grain, u_ca;
void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 cc = uv - 0.5;
  float d = dot(cc, cc);
  vec2 off = cc * (0.003 + u_ca * 0.01);               // chromatic aberration, wider on peaks
  vec3 col = vec3(texture(u_tex, uv - off).r, texture(u_tex, uv).g, texture(u_tex, uv + off).b);
  col = col / (col + 0.6);                              // soft tonemap → glow rolloff (fake bloom)
  col *= 1.0 - d * 0.9;                                 // vignette
  float grain = fract(sin(dot(gl_FragCoord.xy + u_time, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  frag = vec4(col + grain * u_grain, 1.0);
}`

const MARK_INT: Record<StagePreset['mark'], number> = { field: 0, bars: 1, scanline: 2, rings: 3 }

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '')
  const v =
    h.length === 3
      ? h
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : h
  const int = Number.parseInt(v, 16)
  return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255]
}

const compile = (gl: WebGL2RenderingContext, type: number, src: string): WebGLShader => {
  const sh = gl.createShader(type)
  if (!sh) throw new Error('createGlStage: shader alloc failed')
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh)
    gl.deleteShader(sh)
    throw new Error(`createGlStage: shader compile failed — ${log}`)
  }
  return sh
}

const link = (gl: WebGL2RenderingContext, fragSrc: string): WebGLProgram => {
  const prog = gl.createProgram()
  if (!prog) throw new Error('createGlStage: program alloc failed')
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT))
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fragSrc))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`createGlStage: link failed — ${gl.getProgramInfoLog(prog)}`)
  }
  return prog
}

interface Target {
  tex: WebGLTexture
  fbo: WebGLFramebuffer
}

/** WebGL2 stage. Same handle as `createVisualStage`; throws if WebGL2 is unavailable. */
export function createGlStage(
  canvas: HTMLCanvasElement,
  analyser: AnalyserNode,
  initialPreset: StagePreset,
): VisualStageHandle {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false })
  if (!gl) throw new Error('createGlStage: WebGL2 unavailable')

  let preset = initialPreset
  const spectrum = new Uint8Array(analyser.frequencyBinCount)
  // decaying hit intensities, driven by hit() and eased down each frame
  const fx = { kick: 0, chord: 0, snare: 0, accent: 0 }

  const simProg = link(gl, SIM)
  const presentProg = link(gl, PRESENT)
  const vao = gl.createVertexArray() // WebGL2 requires a bound VAO to draw
  const uniform = (p: WebGLProgram, n: string) => gl.getUniformLocation(p, n)

  const makeTarget = (w: number, h: number): Target => {
    const tex = gl.createTexture()
    if (!tex) throw new Error('createGlStage: texture alloc failed')
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const fbo = gl.createFramebuffer()
    if (!fbo) throw new Error('createGlStage: framebuffer alloc failed')
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    const [br, bgc, bb] = hexToRgb(preset.bg)
    gl.clearColor(br, bgc, bb, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    return { tex, fbo }
  }

  let targets: [Target, Target] | null = null
  let src = 0

  const dprCap = Math.min(window.devicePixelRatio || 1, 1.5)
  const sizeOf = () => {
    const w = Math.max(1, Math.round(canvas.clientWidth * dprCap))
    const h = Math.max(1, Math.round(canvas.clientHeight * dprCap))
    return [w, h] as const
  }
  const allocTargets = () => {
    const [w, h] = sizeOf()
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
    if (targets)
      for (const t of targets) {
        gl.deleteTexture(t.tex)
        gl.deleteFramebuffer(t.fbo)
      }
    targets = [makeTarget(w, h), makeTarget(w, h)]
    src = 0
  }
  allocTargets()
  const ro = new ResizeObserver(() => {
    const [w, h] = sizeOf()
    if (w !== canvas.width || h !== canvas.height) allocTargets()
  })
  ro.observe(canvas)

  const bandEnergy = (loFrac: number, hiFrac: number) => {
    const n = spectrum.length
    const lo = Math.floor(loFrac * n)
    const hi = Math.min(n, Math.floor(hiFrac * n))
    let sum = 0
    for (let i = lo; i < hi; i++) sum += spectrum[i]
    return hi > lo ? sum / (hi - lo) / 255 : 0
  }

  const setF = (p: WebGLProgram, n: string, v: number) => gl.uniform1f(uniform(p, n), v)
  const set3 = (p: WebGLProgram, n: string, c: [number, number, number]) =>
    gl.uniform3f(uniform(p, n), c[0], c[1], c[2])

  return {
    frame(now) {
      if (!targets) return
      const w = canvas.width
      const h = canvas.height
      analyser.getByteFrequencyData(spectrum)
      const lo = bandEnergy(0, preset.bandSplit[0])
      const hi = bandEnergy(preset.bandSplit[0], preset.bandSplit[1])
      const level = bandEnergy(0, preset.bandSplit[1])

      const feedback = preset.feedback ?? 0.9 + 0.085 * preset.decay // derive lush trail from decay
      const dst = 1 - src
      const read = targets[src]
      const write = targets[dst]

      gl.bindVertexArray(vao)

      // --- sim: read prev tex → write accumulation ---
      gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo)
      gl.viewport(0, 0, w, h)
      gl.useProgram(simProg)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, read.tex)
      gl.uniform1i(uniform(simProg, 'u_prev'), 0)
      gl.uniform2f(uniform(simProg, 'u_res'), w, h)
      gl.uniform1i(uniform(simProg, 'u_mark'), MARK_INT[preset.mark])
      setF(simProg, 'u_time', now)
      setF(simProg, 'u_lo', lo)
      setF(simProg, 'u_hi', hi)
      setF(simProg, 'u_level', level)
      setF(simProg, 'u_bloom', preset.bloom)
      setF(simProg, 'u_feedback', feedback)
      setF(simProg, 'u_warp', preset.warp ?? 1)
      setF(simProg, 'u_kick', fx.kick)
      setF(simProg, 'u_chord', fx.chord)
      setF(simProg, 'u_snare', fx.snare)
      setF(simProg, 'u_accent', fx.accent)
      set3(simProg, 'u_bg', hexToRgb(preset.bg))
      set3(simProg, 'u_ink0', hexToRgb(preset.ink[0] ?? '#ffffff'))
      set3(simProg, 'u_ink1', hexToRgb(preset.ink[1] ?? preset.ink[0] ?? '#ffffff'))
      set3(simProg, 'u_ink2', hexToRgb(preset.ink[2] ?? preset.ink[0] ?? '#ffffff'))
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      // --- present: accumulation → screen with film look ---
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, w, h)
      gl.useProgram(presentProg)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, write.tex)
      gl.uniform1i(uniform(presentProg, 'u_tex'), 0)
      gl.uniform2f(uniform(presentProg, 'u_res'), w, h)
      setF(presentProg, 'u_time', now)
      setF(presentProg, 'u_grain', preset.grain ?? 0.06)
      setF(presentProg, 'u_ca', level)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      src = dst

      // ease hit intensities down (independent of the feedback trail)
      fx.kick *= 0.9
      fx.chord *= 0.94
      fx.snare *= 0.85
      fx.accent *= 0.9
    },
    hit(kind: HitKind, strength) {
      const s = Math.max(0, Math.min(1, strength))
      fx[kind] = Math.max(fx[kind], s)
    },
    setPreset(next) {
      preset = next
    },
    dispose() {
      ro.disconnect()
      if (targets)
        for (const t of targets) {
          gl.deleteTexture(t.tex)
          gl.deleteFramebuffer(t.fbo)
        }
      gl.deleteProgram(simProg)
      gl.deleteProgram(presentProg)
      gl.deleteVertexArray(vao)
    },
  }
}
