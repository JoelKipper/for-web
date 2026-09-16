import {
  For,
  Match,
  Show,
  Suspense,
  Switch,
  createContext,
  createMemo,
  createSignal,
  useContext,
} from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { useQuery } from "@tanstack/solid-query";
import { styled } from "styled-system/jsx";

import {
  CircularProgress,
  IconButton,
  Text,
  TextField,
  typography,
} from "@revolt/ui/components/design";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { CompositionMediaPickerContext } from "./CompositionMediaPicker";

/**
 * Called directly from the browser (see fetchKlipy below) rather than through
 * our own gifbox proxy - Stoat's API never actually exposed a gifbox URL to
 * clients (RevoltFeatures in crates/delta/src/routes/root.rs has no gifbox
 * field), so instance.gifboxUrl was always undefined and every request here
 * hung. This key is necessarily public since it ships in the client bundle -
 * rotate/restrict it from Klipy's own dashboard if that's ever needed.
 */
const KLIPY_API_BASE_URL = "https://api.klipy.com/v2";
const KLIPY_API_KEY = "Hf6kGjOf1rvRIAv5Jab2ehlbxNNnKS5XlbCnrzI3iVs44ucZHbvN44k53JVw5jn8";

function fetchKlipy<T>(path: string, params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams({
    key: KLIPY_API_KEY,
    client_key: "Gifbox",
    contentfilter: "high",
    ...params,
  });

  return fetch(`${KLIPY_API_BASE_URL}${path}?${query}`).then((r) => {
    if (!r.ok) throw new Error(`Klipy request failed: ${r.status}`);
    return r.json();
  });
}

type GifCategory = { title: string; image: string };

type KlipyCategory = { searchterm: string; image: string };

type GifResult = {
  itemurl: string;
  media_formats: Record<"webm" | "tinywebm", { url: string }>;
};

const FilterContext = createContext<(value: string) => void>();

export function GifPicker() {
  const [filter, setFilter] = createSignal("");

  const fliterLowercase = () => filter().toLowerCase();

  return (
    <Stack>
      <SearchArea>
        <Show when={filter()}>
          <span
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
            }}
          >
            <IconButton
              variant="standard"
              aria-label="Back to categories"
              onPress={() => setFilter("")}
            >
              <Symbol>arrow_back</Symbol>
            </IconButton>
          </span>
        </Show>
        <TextField
          autoFocus
          variant="outlined"
          placeholder="Search for GIFs..."
          value={filter()}
          onChange={(e) => setFilter(e.currentTarget.value)}
        />
      </SearchArea>
      <Suspense fallback={<Loader />}>
        <Switch
          fallback={
            <FilterContext.Provider value={setFilter}>
              <Categories />
            </FilterContext.Provider>
          }
        >
          <Match when={fliterLowercase()}>
            <GifSearch query={fliterLowercase()} />
          </Match>
        </Switch>
      </Suspense>
    </Stack>
  );
}

const Stack = styled("div", {
  base: {
    minHeight: 0,
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-md)",
  },
});

const SearchArea = styled("div", {
  base: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-sm)",
    paddingInline: "var(--gap-md)",

    "& > *:last-child": {
      flexGrow: 1,
    },
  },
});

/**
 * Scrollable region that fills the remaining height of the picker
 * Really wish we just had a Modifier.weight(1f) like on Android
 */
const Scroller = styled("div", {
  base: {
    flexGrow: 1,
    minHeight: 0,
    overflowY: "auto",
    paddingInline: "var(--gap-md)",

    scrollbarWidth: "none",
    "&::-webkit-scrollbar": {
      display: "none",
    },
  },
});

function Loader() {
  return (
    <Centered>
      <CircularProgress />
    </Centered>
  );
}

const Centered = styled("div", {
  base: {
    ...typography.raw({ class: "label" }),
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--gap-md)",
    padding: "var(--gap-x)",
    textAlign: "center",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});

/**
 * M3-style interactive media surface w/ state layer
 * See https://m3.material.io/foundations/interaction/states/state-layers
 */
const tileInteractive = {
  position: "relative",
  boxSizing: "border-box",

  borderRadius: "var(--borderRadius-md)",
  overflow: "hidden",
  cursor: "pointer",

  backgroundColor: "var(--md-sys-color-surface-container-highest)",

  transition: "transform 200ms cubic-bezier(0.2, 0, 0, 1)",

  "&::after": {
    content: '""',
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    backgroundColor: "transparent",
    transition: "background-color 150ms cubic-bezier(0.2, 0, 0, 1)",
  },

  "&:hover::after": {
    backgroundColor:
      "color-mix(in srgb, 8% var(--md-sys-color-on-surface), transparent)",
  },

  "&:focus-visible": {
    outline: "2px solid var(--md-sys-color-primary)",
    outlineOffset: "2px",
  },

  "&:active": {
    transform: "scale(0.97)",
  },

  "&:active::after": {
    backgroundColor:
      "color-mix(in srgb, 12% var(--md-sys-color-on-surface), transparent)",
  },
} as const;

type CategoryItem =
  | {
      /**
       * Category entry
       */
      t: 0;
      category: GifCategory;
    }
  | {
      /**
       * Trending entry
       */
      t: 1;
    };

function Categories() {
  const setFilter = useContext(FilterContext);

  const trendingCategories = useQuery<GifCategory[]>(() => ({
    queryKey: ["trendingGifCategories"],
    queryFn: () =>
      fetchKlipy<{ tags: KlipyCategory[] }>("/categories", {
        locale: "en_US",
      }).then((data) =>
        data.tags.map((tag) => ({ title: tag.searchterm, image: tag.image })),
      ),
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  }));

  const items = createMemo(
    () =>
      [
        { t: 1 },
        ...(Array.isArray(trendingCategories.data)
          ? trendingCategories.data.map((category) => ({ t: 0, category }))
          : []),
      ] as CategoryItem[],
  );

  return (
    <Scroller>
      <CategoryGrid role="list">
        <For each={items()}>
          {(item) => (
            <Category
              trending={item.t === 1}
              role="listitem"
              tabIndex={0}
              style={
                item.t === 0
                  ? { "background-image": `url("${item.category.image}")` }
                  : undefined
              }
              onClick={() =>
                setFilter!(item.t === 0 ? item.category.title : "trending")
              }
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
              }}
            >
              <Label>
                <Switch fallback={<Trans>Trending GIFs</Trans>}>
                  <Match when={item.t === 0}>
                    {(item as CategoryItem & { t: 0 }).category.title}
                  </Match>
                </Switch>
              </Label>
            </Category>
          )}
        </For>
      </CategoryGrid>
    </Scroller>
  );
}

const CategoryGrid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "var(--gap-sm)",
    paddingBlock: "var(--gap-sm)",
  },
});

const Category = styled("div", {
  base: {
    ...tileInteractive,

    width: "100%",
    aspectRatio: "16 / 10",

    backgroundSize: "cover",
    backgroundPosition: "center",

    display: "flex",
    alignItems: "end",
    justifyContent: "start",
    padding: "var(--gap-md)",

    // scrim so the label stays legible
    boxShadow: "inset 0 -56px 48px -16px rgba(0, 0, 0, 0.7)",
  },
  variants: {
    trending: {
      true: {
        background:
          "linear-gradient(135deg, var(--md-sys-color-primary), var(--md-sys-color-tertiary))",
      },
      false: {},
    },
  },
});

const Label = styled("span", {
  base: {
    ...typography.raw({ class: "title", size: "small" }),
    position: "relative",
    zIndex: 1,
    color: "white",
  },
});

function GifSearch(props: { query: string }) {
  const { onMessage } = useContext(CompositionMediaPickerContext);

  const search = useQuery<GifResult[]>(() => ({
    queryKey: ["gifs", props.query],
    queryFn: () =>
      fetchKlipy<{ results: GifResult[] }>(
        props.query === "trending" ? "/featured" : "/search",
        {
          locale: "en_US",
          media_filter: "webm,tinywebm",
          limit: "50",
          ...(props.query === "trending" ? {} : { q: props.query }),
        },
      ).then((data) => data.results),
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  }));

  return (
    <Show
      when={search.data?.length}
      fallback={
        <Centered
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
          }}
        >
          <Text class="title" size="small">
            <Trans>No GIFs found</Trans>
          </Text>
        </Centered>
      }
    >
      <Scroller>
        <Masonry role="list">
          <For each={search.data}>
            {(gif) => (
              <GifTile
                role="listitem"
                tabIndex={0}
                onClick={() => onMessage(gif.itemurl)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.stopImmediatePropagation();
                }}
              >
                <video
                  playsinline
                  loop
                  autoplay
                  muted
                  src={gif.media_formats.tinywebm.url}
                />
              </GifTile>
            )}
          </For>
        </Masonry>
      </Scroller>
    </Show>
  );
}

/**
 * CSS column masonry — keeps each GIF's natural aspect ratio
 */
const Masonry = styled("div", {
  base: {
    columnCount: 2,
    columnGap: "var(--gap-sm)",
    paddingBlock: "var(--gap-sm)",
  },
});

const GifTile = styled("div", {
  base: {
    ...tileInteractive,

    width: "100%",
    marginBottom: "var(--gap-sm)",
    breakInside: "avoid",

    "& video": {
      width: "100%",
      height: "auto",
      display: "block",
    },
  },
});
