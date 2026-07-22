# Getting Started

A plain-language reference for editing this site. You don't need to know how
to code to use most of this — it's mostly editing text files.

## Running the site locally

From this folder, run:

```
hugo server --buildDrafts
```

Then open http://localhost:1313 in your browser. Leave that command running —
it watches your files and reloads the page automatically whenever you save a
change. Press Ctrl+C in the terminal to stop it.

## Writing a new blog post

1. Create a new file in `content/posts/`, e.g. `content/posts/my-new-post.md`.
2. Give it this shape:

   ```
   +++
   date = '2026-07-18T10:00:00-07:00'
   draft = false
   title = 'My New Post'
   +++

   Your post text goes here, written in Markdown.
   ```

3. Save it. It'll show up on the home page and at `/posts/` automatically,
   newest first.

`draft = true` hides a post from the real site build but still shows it
while `hugo server --buildDrafts` is running, so you can write drafts safely.

## Editing your bio, tagline, and the "currently recommending" widget

Open `hugo.toml`. Near the top is a `[params]` block:

```
[params]
  author = "Your Name"
  tagline = "A tagline goes here"
  bioIntro = "..."
  bioBody = "..."
  bioNote = "..."
  songTitle = "..."
  songArtist = "..."
  accentColor = "#c98a2c"
```

Edit any of these strings and save — the header updates immediately.

## Changing the site's accent color

The `accentColor` line in `hugo.toml` controls the site's highlight color
(link underlines, icons, calendar/song widget icons). Change that one line
and save — every page picks it up immediately. Under the hood, this works
because `layouts/_default/baseof.html` injects a tiny `<style>` block into
every page's `<head>` that sets the CSS variable `--accent` from that config
value.

## Adding a project

Copy `content/projects/sample-project-one.md` to a new file, e.g.
`content/projects/my-thing.md`, and edit the `title`, `tldr`, and body text.
It'll appear as a card on the home page and in the full list at `/projects/`.

## Adding a blogroll link

Open `content/blogroll.md` and add a new Markdown list item:

```
- [Site Name](https://example.com) — why you like it.
```

## Adding a photo

1. Put the image file in `static/images/` (create that folder if it doesn't
   exist yet).
2. Open `content/photography/_index.md` and add an entry to the list at the
   top:

   ```
   [[params.photos]]
   src = "/images/your-file.jpg"
   caption = "A caption for it"
   ```

## A few Hugo words you'll see in this project

- **Front matter** — the `+++ ... +++` block at the top of a content file.
  It's metadata (title, date, etc.), separate from the actual text below it.
- **Content file** — a Markdown (`.md`) file in `content/`. This is where you
  write words. Hugo turns each one into a page.
- **Template / layout** — a file in `layouts/` that defines *how* a page
  looks (the HTML structure around your content). You mostly won't need to
  touch these unless you want to change the site's structure, not just its
  words.
- **Partial** — a reusable chunk of a template, kept in
  `layouts/partials/` (e.g. the header and footer, shared across every page).
- **`.Site.Params`** — how a template reads a value you set in `hugo.toml`'s
  `[params]` block (e.g. `{{ .Site.Params.author }}`).
- **Static file** — anything in `static/` (fonts, icons, CSS, JS, images).
  These are copied to the final site as-is, untouched by Hugo.

## Where things live, at a glance

```
content/           the words — posts, about page, projects, etc.
layouts/           the HTML templates that arrange content on the page
static/css/        the stylesheet (colors, spacing, fonts)
static/js/         the two small scripts (search box, rotating tagline)
static/fonts/      font files
static/icons/      the icon sprite used in the header/footer
hugo.toml          site-wide settings: title, bio, nav links, accent color
```
