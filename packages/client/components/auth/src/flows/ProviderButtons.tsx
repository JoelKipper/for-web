import { For } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import {
  BiLogosApple,
  BiLogosDiscordAlt,
  BiLogosGithub,
  BiLogosGoogle,
} from "solid-icons/bi";
import { styled } from "styled-system/jsx";

import { Column, Row, Tooltip } from "@revolt/ui";

import SpecularButton from "../SpecularButton";

/**
 * Third-party sign-in options shown above the email/password form on both
 * FlowLogin and FlowCreate. Backend OAuth isn't wired up yet (this fork's
 * auth is hand-rolled in crates/delta, rocket_authifier is an unused
 * dependency) - these are disabled placeholders so the design can be
 * reviewed before that work happens.
 */
const PROVIDERS = [
  { id: "github", label: "GitHub", icon: BiLogosGithub },
  { id: "discord", label: "Discord", icon: BiLogosDiscordAlt },
  // Google's brand guidelines call for their official multi-color "G"
  // mark on a live "Sign in with Google" button rather than a generic
  // icon-font glyph - fine as a placeholder here, swap when this is
  // actually wired up.
  { id: "google", label: "Google", icon: BiLogosGoogle },
  { id: "apple", label: "Apple", icon: BiLogosApple },
] as const;

export function ProviderButtons() {
  const { t } = useLingui();

  return (
    <Column gap="sm" align="stretch">
      <For each={PROVIDERS}>
        {(provider) => (
          <Tooltip content={t`Coming soon`} placement="top">
            <SpecularButton
              size="md"
              radius={999}
              disabled
              fullWidth
              tint="var(--md-sys-color-on-surface)"
              tintOpacity={0.08}
              blur={20}
              textColor="var(--md-sys-color-on-surface)"
            >
              <Row align justify gap="sm">
                <provider.icon size={20} />
                {t`Continue with ${provider.label}`}
              </Row>
            </SpecularButton>
          </Tooltip>
        )}
      </For>
      <OrDivider>{t`or continue with email`}</OrDivider>
    </Column>
  );
}

const OrDivider = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-md)",
    color: "var(--md-sys-color-on-surface-variant)",
    fontSize: "0.85em",
    margin: "var(--gap-sm) 0",

    "&::before, &::after": {
      content: '""',
      flexGrow: 1,
      height: "1px",
      background: "var(--md-sys-color-outline-variant)",
    },
  },
});
