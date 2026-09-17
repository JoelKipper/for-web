import { Match, Show, Switch, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";

import { useApi, useClientLifecycle } from "@revolt/client";
import { State, TransitionType } from "@revolt/client/Controller";
import { useInstance } from "@revolt/instance";
import { useModals } from "@revolt/modal";
import { Navigate, useNavigate, useParams } from "@revolt/routing";
import {
  Button,
  CircularProgress,
  Column,
  Row,
  Text,
  iconSize,
} from "@revolt/ui";

import MdArrowBack from "@material-design-icons/svg/filled/arrow_back.svg?component-solid";

import { useState } from "@revolt/state";
import { FlowTitle } from "./Flow";
import { setFlowCheckEmail } from "./FlowCheck";
import { Fields, Form } from "./Form";
import { ProviderButtons } from "./ProviderButtons";
import SpecularButton from "../SpecularButton";

type Step =
  | { name: "email" }
  | { name: "password"; email: string; exists: boolean };

/**
 * stoat-api's published types don't declare /auth/account/exists - that's
 * a route this fork's backend added (crates/delta/src/routes/account/
 * account_exists.rs) that the published package hasn't been regenerated
 * against. Narrowly widens just this one call site rather than the whole
 * api client, mirroring SpotifyActivity.tsx's editWithActivity.
 */
function checkAccountExists(
  api: { post: (path: string, body: unknown) => Promise<unknown> },
  email: string,
): Promise<{ exists: boolean }> {
  return api.post("/auth/account/exists", { email }) as Promise<{
    exists: boolean;
  }>;
}

/**
 * Unified flow for logging in or creating an account - a single email
 * field decides which one this turns into, rather than making the user
 * pick up front.
 */
export default function FlowLogin() {
  const state = useState();
  const modals = useModals();
  const api = useApi();
  const navigate = useNavigate();
  const { code } = useParams();
  const { config } = useInstance();
  const { lifecycle, isLoggedIn, login, selectUsername } = useClientLifecycle();

  const [step, setStep] = createSignal<Step>({ name: "email" });

  /**
   * Narrowed accessor for the password step, for <Match>'s keyed
   * render-prop form below - avoids re-checking/re-casting step().name
   * at every use site.
   */
  const passwordStep = () => {
    const current = step();
    return current.name === "password" ? current : undefined;
  };

  /**
   * Check whether an account exists for the given email, then advance
   * @param data Form Data
   */
  async function checkEmail(data: FormData) {
    const email = data.get("email") as string;
    if (!email) return;

    const { exists } = await checkAccountExists(api, email);
    setStep({ name: "password", email, exists });
  }

  /**
   * Log into the existing account for this email
   * @param data Form Data
   */
  async function performLogin(data: FormData) {
    const current = step();
    if (current.name !== "password") return;
    const password = data.get("password") as string;
    if (!password) return;

    await login({ email: current.email, password }, modals);
  }

  /**
   * Create a new account for this email
   * @param data Form Data
   */
  async function performCreate(data: FormData) {
    const current = step();
    if (current.name !== "password") return;
    const password = data.get("password") as string;
    const captcha = data.get("captcha") as string;
    if (!password) return;

    await api.post("/auth/account/create", {
      email: current.email,
      password,
      captcha,
      ...(code ? { invite: code } : {}),
    });

    if (!config.features.email) {
      await login({ email: current.email, password }, modals);
      navigate("/login/auth", { replace: true });
    } else {
      setFlowCheckEmail(current.email);
      navigate("/login/check", { replace: true });
    }
  }

  return (
    <>
      <Switch
        fallback={
          <Switch>
            <Match when={step().name === "email"}>
              <FlowTitle subtitle={<Trans>Sign into Stoat</Trans>} emoji="wave">
                <Trans>Welcome!</Trans>
              </FlowTitle>
              <Form onSubmit={checkEmail}>
                <Fields fields={["email"]} />
                <ProviderButtons />
                <Row align justify>
                  <a href="..">
                    <Button variant="text">
                      <MdArrowBack {...iconSize("1.2em")} /> <Trans>Back</Trans>
                    </Button>
                  </a>
                  <SpecularButton
                    type="submit"
                    size="lg"
                    radius={999}
                    tint="var(--md-sys-color-on-surface)"
                    tintOpacity={0.08}
                    blur={20}
                    textColor="var(--md-sys-color-on-surface)"
                  >
                    <Trans>Continue</Trans>
                  </SpecularButton>
                </Row>
              </Form>
            </Match>
            <Match when={passwordStep()}>
              {(current) => (
                <>
                  <FlowTitle
                    subtitle={
                      current().exists ? (
                        <Trans>Enter your password</Trans>
                      ) : (
                        <Trans>Create a password</Trans>
                      )
                    }
                    emoji="wave"
                  >
                    <Trans>Welcome!</Trans>
                  </FlowTitle>
                  <Form
                    onSubmit={current().exists ? performLogin : performCreate}
                    captcha={
                      current().exists ? undefined : config.features.captcha.key
                    }
                  >
                    <Fields
                      fields={[
                        { field: "email", value: current().email, disabled: true },
                        current().exists ? "password" : "new-password",
                      ]}
                    />
                    <Show when={!current().exists && config.features.invite_only}>
                      <Fields fields={[{ field: "invite", value: code }]} />
                    </Show>
                    <Row align justify>
                      <Button
                        variant="text"
                        onPress={() => setStep({ name: "email" })}
                      >
                        <MdArrowBack {...iconSize("1.2em")} />{" "}
                        <Trans>Change email</Trans>
                      </Button>
                      <SpecularButton
                        type="submit"
                        size="lg"
                        radius={999}
                        tint="var(--md-sys-color-on-surface)"
                        tintOpacity={0.08}
                        blur={20}
                        textColor="var(--md-sys-color-on-surface)"
                      >
                        {current().exists ? (
                          <Trans>Log In</Trans>
                        ) : (
                          <Trans>Create Account</Trans>
                        )}
                      </SpecularButton>
                    </Row>
                  </Form>
                </>
              )}
            </Match>
          </Switch>
        }
      >
        <Match when={isLoggedIn()}>
          <Navigate href={state.layout.popNextPath() ?? "/app"} />
        </Match>
        <Match when={lifecycle.state() === State.LoggingIn}>
          <CircularProgress />
        </Match>
        <Match when={lifecycle.state() === State.Onboarding}>
          <FlowTitle>
            <Trans>Choose a username</Trans>
          </FlowTitle>

          <Text>
            <Trans>
              Pick a username that you want people to be able to find you by.
              This can be changed later in your user settings.
            </Trans>
          </Text>

          <Form
            onSubmit={async (data) => {
              const username = data.get("username") as string;
              await selectUsername(username);
            }}
          >
            <Fields fields={["username"]} />
            <Row align justify>
              <Button
                variant="text"
                onPress={() =>
                  lifecycle.transition({
                    type: TransitionType.Cancel,
                  })
                }
              >
                <MdArrowBack {...iconSize("1.2em")} /> <Trans>Cancel</Trans>
              </Button>
              <SpecularButton
                type="submit"
                size="lg"
                radius={999}
                tint="var(--md-sys-color-on-surface)"
                tintOpacity={0.08}
                blur={20}
                textColor="var(--md-sys-color-on-surface)"
              >
                <Trans>Confirm</Trans>
              </SpecularButton>
            </Row>
          </Form>
        </Match>
      </Switch>
    </>
  );
}
