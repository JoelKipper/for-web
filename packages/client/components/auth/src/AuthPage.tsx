import { JSX } from "solid-js";

import { styled } from "styled-system/jsx";

import { Titlebar } from "@revolt/app/interface/desktop/Titlebar";

import DarkVeil from "./DarkVeil";
import { FlowBase } from "./flows/Flow";

/**
 * Authentication page layout
 */
const Base = styled("div", {
  base: {
    width: "100%",
    height: "100%",
    padding: "40px 35px",

    userSelect: "none",
    overflowY: "scroll",

    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",

    // sits above the fixed DarkVeil layer (z-index 0) below
    position: "relative",
    zIndex: 1,

    mdDown: {
      padding: "30px 20px",
    },
  },
});

/**
 * Fills Root behind everything else - stays put while Base scrolls, so
 * it never scrolls the actual shader canvas. Positioned absolute against
 * Root (not fixed against the viewport): fixed's containing block breaks
 * to the nearest transformed/filtered ancestor, which is easy to end up
 * inside of unintentionally (theme providers, animation wrappers, etc)
 * and then the "fullscreen" background only covers whatever that
 * ancestor's box happens to be instead.
 */
const VeilLayer = styled("div", {
  base: {
    position: "absolute",
    inset: 0,
    zIndex: 0,
  },
});

const Root = styled("div", {
  base: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    width: "100vw",
    height: "100dvh",
    paddingBottom: "env(keyboard-inset-height)",

    color: "var(--md-sys-color-on-surface)",
    background: "var(--md-sys-color-surface)",
  },
});

/**
 * Empty top/bottom strips - kept (rather than removed) so Base's
 * justify-content: space-between still centers FlowBase vertically.
 */
const Nav = styled("div", {
  base: {
    height: "32px",
  },
});

/**
 * Authentication page
 */
export function AuthPage(props: { children: JSX.Element }) {
  return (
    <Root>
      <VeilLayer>
        <DarkVeil hueShift={265} warpAmount={0.15} resolutionScale={0.75} />
      </VeilLayer>
      <Titlebar />
      <Base css={{ scrollbar: "hidden" }}>
        <Nav />
        <FlowBase>{props.children}</FlowBase>
        <Nav />
      </Base>
    </Root>
  );
}
