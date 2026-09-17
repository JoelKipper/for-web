import { Color, Mesh, Program, Renderer, Triangle } from "ogl";
import { JSX, onCleanup, onMount } from "solid-js";

import { styled } from "styled-system/jsx";

// Ported from React Bits' SpecularButton (https://reactbits.dev) to
// SolidJS - onMount/onCleanup instead of useEffect, and the animation
// loop reads props.* directly each frame (Solid's props are a live
// proxy) instead of the React version's propsRef.current shadow-copy
// trick for getting fresh values inside a stale closure.
//
// lineColor/baseColor are resolved by ogl's own Color class in JS, not
// by the browser's CSS engine, so unlike textColor/tint they can't be a
// var(--...) reference - only literal colors (hex, rgb(), named).

const PAD = 20;

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform vec2 uCenter;
uniform vec2 uHalfSize;
uniform float uRadius;
uniform float uAngle;
uniform float uPx;
uniform vec3 uLineColor;
uniform vec3 uBaseColor;
uniform float uIntensity;
uniform float uShineSize;
uniform float uShineFade;
uniform float uThickness;
uniform float uBaseWidth;

out vec4 fragColor;

float sdRoundedRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float shapeSDF(vec2 p) { return sdRoundedRect(p, uHalfSize, uRadius); }

float gaussianLine(float d, float sigma) {
  float x = d / (sigma + 1e-6);
  float k = mix(1.0, 1.6, smoothstep(0.0, 1.5, x));
  return exp(-k * x * x);
}

void main() {
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = shapeSDF(p);
  vec2 L = vec2(cos(uAngle), sin(uAngle));

  float base = (1.0 - smoothstep(0.0, uBaseWidth, abs(d))) * 0.45;

  vec2 nEll = normalize(p / (uHalfSize * uHalfSize) + 1e-6);
  float phi = acos(clamp(abs(dot(nEll, L)), 0.0, 1.0));
  float rim = 1.0 - smoothstep(uShineSize - uShineFade, uShineSize + uShineFade + 1e-4, phi);
  float line = gaussianLine(d, uThickness);
  float edgeClamp = 1.0 - smoothstep(0.5 * uPx, 3.0 * uPx, abs(d));
  float hi = line * rim * edgeClamp * uIntensity;

  vec3 col = uBaseColor * base + uLineColor * hi;
  float a = clamp(base + hi, 0.0, 1.0);
  fragColor = vec4(col, a);
}
`;

export interface SpecularButtonProps {
  children: JSX.Element;
  size?: "sm" | "md" | "lg";
  radius?: number;
  tint?: string;
  tintOpacity?: number;
  blur?: number;
  textColor?: string;
  lineColor?: string;
  baseColor?: string;
  intensity?: number;
  shineSize?: number;
  shineFade?: number;
  thickness?: number;
  speed?: number;
  followMouse?: boolean;
  proximity?: number;
  autoAnimate?: boolean;
  disabled?: boolean;
  onClick?: (e: MouseEvent) => void;
  type?: "button" | "submit" | "reset";
  /**
   * The original component is inline-flex (content-sized) by default -
   * this opts into filling the parent's width instead, for stacked
   * full-width buttons like the provider list.
   */
  fullWidth?: boolean;
}

export default function SpecularButton(props: SpecularButtonProps) {
  let btnRef: HTMLButtonElement | undefined;
  let fxRef: HTMLSpanElement | undefined;

  onMount(() => {
    const btn = btnRef!;
    const fx = fxRef!;

    const dpr = window.devicePixelRatio || 1;
    const renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: true, dpr });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const geometry = new Triangle(gl);
    if (geometry.attributes.uv) delete geometry.attributes.uv;

    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uCenter: { value: [0, 0] },
        uHalfSize: { value: [1, 1] },
        uRadius: { value: 0 },
        uAngle: { value: 2.4 },
        uPx: { value: dpr },
        uLineColor: { value: [1, 1, 1] },
        uBaseColor: { value: [0.32, 0.32, 0.32] },
        uIntensity: { value: 1 },
        uShineSize: { value: 0.17 },
        uShineFade: { value: 0.7 },
        uThickness: { value: 1 },
        uBaseWidth: { value: dpr },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });
    fx.appendChild(gl.canvas);

    const sizeRef = { w: 1, h: 1 };
    const resize = () => {
      const rect = btn.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      sizeRef.w = w;
      sizeRef.h = h;
      renderer.setSize(w + PAD * 2, h + PAD * 2);
      program.uniforms.uCenter.value = [(PAD + w / 2) * dpr, (PAD + h / 2) * dpr];
      program.uniforms.uHalfSize.value = [(w / 2) * dpr, (h / 2) * dpr];
    };
    const ro = new ResizeObserver(resize);
    ro.observe(btn);
    resize();

    let pointerAngle: number | null = null;
    let proximityT = 0;
    const onPointerMove = (e: PointerEvent) => {
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = Math.max(rect.left - e.clientX, 0, e.clientX - rect.right);
      const dy = Math.max(rect.top - e.clientY, 0, e.clientY - rect.bottom);
      const dist = Math.hypot(dx, dy);
      if (dist === 0) {
        const nx = (e.clientX - cx) / (rect.width / 2);
        const ny = (cy - e.clientY) / (rect.height / 2);
        pointerAngle = Math.atan2(2 / rect.height, -2 / rect.width) + nx * 0.3 + ny * 0.15;
      } else {
        pointerAngle = Math.atan2(cy - e.clientY, e.clientX - cx);
      }
      const t = Math.max(0, 1 - dist / Math.max(props.proximity ?? 250, 1));
      proximityT = t * t * (3 - 2 * t);
    };
    window.addEventListener("pointermove", onPointerMove);

    let angle = 2.4;
    let idleAngle = 2.4;
    let bright = 0;
    let last = performance.now();
    let raf = 0;

    const lineC = new Color();
    const baseC = new Color();

    const update = (now: number) => {
      raf = requestAnimationFrame(update);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const speed = props.speed ?? 0.35;
      const followMouse = props.followMouse ?? true;
      const autoAnimate = props.autoAnimate ?? false;
      const radius = props.radius ?? 18;
      const lineColor = props.lineColor ?? "#ffffff";
      const baseColor = props.baseColor ?? "#525252";
      const intensity = props.intensity ?? 1;
      const shineSize = props.shineSize ?? 10;
      const shineFade = props.shineFade ?? 40;
      const thickness = props.thickness ?? 1;

      idleAngle += speed * dt;
      const steer = followMouse && pointerAngle != null && (!autoAnimate || proximityT > 0);
      const target = steer ? pointerAngle : idleAngle;
      const diff = ((target - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      angle += diff * (1 - Math.exp(-dt * 7));

      const brightTarget = autoAnimate ? 1 : proximityT;
      bright += (brightTarget - bright) * (1 - Math.exp(-dt * 8));

      lineC.set(lineColor);
      baseC.set(baseColor);
      program.uniforms.uAngle.value = angle;
      program.uniforms.uRadius.value = Math.min(radius, Math.min(sizeRef.w, sizeRef.h) / 2) * dpr;
      program.uniforms.uLineColor.value = [lineC.r, lineC.g, lineC.b];
      program.uniforms.uBaseColor.value = [baseC.r, baseC.g, baseC.b];
      program.uniforms.uIntensity.value = intensity * bright;
      program.uniforms.uShineSize.value = (shineSize * Math.PI) / 180;
      program.uniforms.uShineFade.value = (shineFade * Math.PI) / 180;
      program.uniforms.uThickness.value = thickness * dpr;
      renderer.render({ scene: mesh });
    };
    raf = requestAnimationFrame(update);

    onCleanup(() => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      if (gl.canvas.parentNode === fx) fx.removeChild(gl.canvas);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    });
  });

  return (
    <Btn
      ref={btnRef}
      type={props.type ?? "button"}
      disabled={props.disabled}
      onClick={(e) => props.onClick?.(e)}
      data-size={props.size ?? "lg"}
      style={{
        "--sb-radius": `${props.radius ?? 18}px`,
        "--sb-tint": props.tint ?? "#ffffff",
        "--sb-tint-opacity": String(props.tintOpacity ?? 0),
        "--sb-blur": `${props.blur ?? 0}px`,
        "--sb-text-color": props.textColor ?? "#f5f5f5",
        width: props.fullWidth ? "100%" : undefined,
      }}
    >
      <Fx ref={fxRef} aria-hidden="true" />
      <Label>{props.children}</Label>
    </Btn>
  );
}

const Btn = styled("button", {
  base: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    margin: 0,
    fontFamily: "inherit",
    fontWeight: 500,
    letterSpacing: "0.01em",
    lineHeight: 1,
    color: "var(--sb-text-color)",
    background:
      "color-mix(in srgb, var(--sb-tint) calc(var(--sb-tint-opacity) * 100%), transparent)",
    borderRadius: "var(--sb-radius)",
    backdropFilter: "blur(var(--sb-blur))",
    boxShadow:
      "inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 8px 24px rgba(0, 0, 0, 0.25)",
    cursor: "pointer",
    outline: "none",
    transition: "transform 0.15s ease",

    "&:active": { transform: "scale(0.97)" },
    "&:focus-visible": {
      outline: "2px solid color-mix(in srgb, var(--sb-text-color) 60%, transparent)",
      outlineOffset: "3px",
    },
    "&:disabled": { opacity: 0.55, cursor: "default" },
    "&:disabled:active": { transform: "none" },

    '&[data-size="sm"]': { fontSize: "0.85rem", padding: "10px 22px" },
    '&[data-size="md"]': { fontSize: "1rem", padding: "14px 30px" },
    '&[data-size="lg"]': { fontSize: "1.15rem", padding: "18px 40px" },
  },
});

// Extends past the button so the rim glow can bleed outside the edge
const Fx = styled("span", {
  base: {
    position: "absolute",
    inset: "-20px",
    pointerEvents: "none",
    zIndex: 1,

    "& canvas": { display: "block", width: "100%", height: "100%" },
  },
});

const Label = styled("span", {
  base: {
    position: "relative",
    zIndex: 2,
  },
});
