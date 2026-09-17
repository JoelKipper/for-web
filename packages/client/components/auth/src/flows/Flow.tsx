import { JSX, Show } from "solid-js";

import { defineKeyframes } from "@pandacss/dev";
import { styled } from "styled-system/jsx";

import { Column, Row, Text } from "@revolt/ui";

import envelope from "./envelope.svg";
import wave from "./wave.svg";

/**
 * Container for authentication page flows
 */
export const FlowBase = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-lg)",
    flexGrow: 0,
    // Glass-over-shader: the auth page shows an animated DarkVeil canvas
    // behind this card (see AuthPage.tsx), so a fully opaque surface
    // colour no longer fits - let it show through instead.
    background:
      "color-mix(in srgb, var(--md-sys-color-surface-container) 82%, transparent)",
    backdropFilter: "blur(32px)",
    border:
      "1px solid color-mix(in srgb, var(--md-sys-color-outline-variant) 55%, transparent)",
    // outer drop shadow + a thin top-edge highlight line, the usual
    // "glass catching light" trick
    boxShadow:
      "0 24px 60px -12px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.18)",
    color: "var(--md-sys-color-on-surface)",
    maxWidth: "360px",
    maxHeight: "600px",
    padding: "45px 40px",
    borderRadius: "32px",
    marginTop: "20px",
    marginBottom: "20px",
    justifySelf: "center",
    marginInline: "auto",

    _phone: {
      background: "none",
      backdropFilter: "none",
      border: "none",
      boxShadow: "none",
      padding: 0,
    },
  },
});

/**
 * Liquid-glass wrapper for auth-page buttons. Button itself (@revolt/ui)
 * doesn't expose a class/style prop to restyle per call site, so this
 * wraps it instead: render the Button with variant="text" (no background/
 * border of its own, see Button.tsx's variant styles) inside this, and
 * the wrapper supplies the entire glass surface.
 */
export const GlassButton = styled("div", {
  base: {
    borderRadius: "999px",
    overflow: "hidden",
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--md-sys-color-on-surface) 16%, transparent) 0%, color-mix(in srgb, var(--md-sys-color-on-surface) 5%, transparent) 100%)",
    backdropFilter: "blur(20px) saturate(180%)",
    border:
      "1px solid color-mix(in srgb, var(--md-sys-color-on-surface) 20%, transparent)",
    boxShadow:
      "inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 4px 16px -6px rgba(0, 0, 0, 0.35)",
    transition: "var(--transitions-medium) background",

    "&:hover": {
      background:
        "linear-gradient(135deg, color-mix(in srgb, var(--md-sys-color-on-surface) 22%, transparent) 0%, color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent) 100%)",
    },

    "& button": {
      width: "100%",
    },
  },
});

/**
 * Wave animation
 * TODO: I don't think this is how you use it
 */
const WaveAnimation = defineKeyframes({
  fadeIn: {
    "0%": { transform: "rotate(0)" },
    "10%": { transform: "rotate(14deg)" },
    "20%": { transform: "rotate(-8deg)" },
    "30%": { transform: "rotate(14deg)" },
    "40%": { transform: "rotate(-4deg)" },
    "50%": { transform: "rotate(10deg)" },
    "60%": { transform: "rotate(0)" },
    "100%": { transform: "rotate(0)" },
  },
});

/**
 * Envelope animation
 * TODO: I don't think this is how you use it
 */
const EnvelopeAnimation = defineKeyframes({
  fadeIn: {
    "0%": {
      opacity: 0,
      transform: "translateY(-24px)",
    },
    "100%": {
      opacity: 1,
      transform: "translateY(-4px)",
    },
  },
});

/**
 * Wave emoji
 */
const Wave = styled("img", {
  base: {
    height: "1.8em",
    animationDuration: "2.5s",
    animationIterationCount: 1,
    animationName: WaveAnimation,
  },
});

/**
 * Mail emoji
 */
const Mail = styled("img", {
  base: {
    height: "1.8em",
    transform: "translateY(-4px)",
    animationDuration: "0.5s",
    animationIterationCount: 1,
    animationTimingFunction: "ease",
    animationName: EnvelopeAnimation,
  },
});

/**
 * Common flow title component
 */
export function FlowTitle(props: {
  children: JSX.Element;
  subtitle?: JSX.Element;
  emoji?: "wave" | "mail";
}) {
  return (
    <Column>
      <Row align gap="sm">
        <Show when={props.emoji === "wave"}>
          <Wave src={wave} />
        </Show>
        <Show when={props.emoji === "mail"}>
          <Mail src={envelope} />
        </Show>
        <Text class="title" size="large">
          {props.children}
        </Text>
      </Row>
      <Show when={props.subtitle}>
        <Text class="title">{props.subtitle}</Text>
      </Show>
    </Column>
  );
}
