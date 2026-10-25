# br34d

Personal site and blog of Anikait Panigrahi (br34d): hardware security, reverse
engineering and CTF writeups. Live at
[br34dcrumb.github.io](https://br34dcrumb.github.io).

The site has a phosphor-on-black terminal look: an ASCII boot sequence, a live
ASCII hero, a terminal you can type into, and an ASCII globe on the travel page.

## Stack

- [Astro 5](https://astro.build) with MDX content collections
- React islands for the interactive parts, animated with
  [framer-motion](https://motion.dev)
- Tailwind CSS v4
- Expressive Code and KaTeX for code blocks and maths in posts
- Deployed to GitHub Pages by GitHub Actions

## Run it locally

Requires Node 20 or newer.

```bash
npm install
npm run dev        # http://localhost:1234
npm run build      # type-check, then build to dist/
npm run preview    # serve the built site
```

## Project layout

```text
src/
  components/
    fx/          boot loader, ASCII hero, cursor, ASCII portrait, easter eggs
    home/        hero, terminal, GitHub contribution graph
    travel/      ASCII globe, traceroute and passport stamps
  content/
    blog/        posts (a folder per post; extra .mdx files are subposts)
    projects/    one .md file per project
    authors/
  assets/covers/ generated cover art (see "Images")
  layouts/       the single site layout
  lib/           data helpers, ASCII helpers, land mask for the globe
  pages/         routes
  styles/        theme tokens (global.css) and post typography
scripts/
  make-images.mjs   generates covers and social cards
public/og/          generated social cards
```

## Adding content

**A post:** create `src/content/blog/<slug>/index.mdx` with `title`,
`description`, `date`, and optionally `tags`, `image` and `draft`. Other `.mdx`
files in the same folder become subposts, ordered by `date` then `order`.

**A project:** create `src/content/projects/<slug>.md` with `name`,
`description`, `tags`, `image`, `link`, and optionally `startDate` and
`endDate`.

**A country:** add an entry to `PLACES` in `src/consts.ts`. The `name` must
match the country's name in `src/lib/world.json` for it to light up on the
globe.

Site title, nav links and social links also live in `src/consts.ts`.

## Images

Cover art and social cards are drawn by a script, so they all share the site's
style:

```bash
npm run images
```

- Covers go to `src/assets/covers/<art>.png`. Point a post or project's `image`
  at one.
- A social card is written to `public/og/blog/<post-id>.png` for every post.
  A post without one falls back to `public/og/default.png`.
- To give a new post its own art, add a motif to `ART` in
  `scripts/make-images.mjs` and map the post to it in `ART_FOR_POST`.

Re-run the script after adding or renaming a post, and commit the output; the
deploy build doesn't generate images.

## Deploying

Every push to `main` runs `.github/workflows/deploy.yml`, which builds the
site with `withastro/action` and publishes it to GitHub Pages.

## Credits

Started from [Astro Erudite](https://github.com/jktrn/astro-erudite) by
Trevor Lee and since rebuilt. Released under the MIT License; see
[LICENSE](LICENSE).
