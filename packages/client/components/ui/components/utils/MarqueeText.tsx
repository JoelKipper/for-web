import { styled } from "styled-system/jsx";

/**
 * Continuously auto-scrolling single line of text, right to left on a loop.
 * The content is duplicated internally so the loop has no visible seam -
 * don't pass children that depend on being rendered exactly once (e.g.
 * anything with side effects), plain text/inline content only.
 */
export function MarqueeText(props: { children: string; speedPxPerSec?: number }) {
  // Duration scales with text length so long and short titles both move at
  // roughly the same visual speed, rather than a fixed duration making
  // short text crawl and long text fly by.
  const duration = () =>
    Math.max(4, props.children.length / (props.speedPxPerSec ?? 6));

  return (
    <Wrapper>
      <Track style={{ "animation-duration": `${duration()}s` }}>
        <Segment>{props.children}</Segment>
        <Segment aria-hidden="true">{props.children}</Segment>
      </Track>
    </Wrapper>
  );
}

const Wrapper = styled("div", {
  base: {
    overflow: "hidden",
    whiteSpace: "nowrap",
    minWidth: 0,
  },
});

const Track = styled("div", {
  base: {
    display: "inline-flex",
    animationName: "marqueeRightToLeft",
    animationTimingFunction: "linear",
    animationIterationCount: "infinite",
  },
});

const Segment = styled("span", {
  base: {
    paddingInlineEnd: "2.5em",
  },
});
