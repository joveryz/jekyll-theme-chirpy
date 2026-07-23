# Jekyll Theme Chirpy — Fork Upgrade Guide

How to upgrade this fork to a newer upstream [Chirpy](https://github.com/cotes2020/jekyll-theme-chirpy)
release while preserving our custom commits.

## How this fork is structured

- `master` mirrors upstream Chirpy (do not put customizations here).
- `dev` = the upstream release commit + our custom commits on top. This is the
  branch the site data/deployment repos actually consume.
- `dev_vX.Y.Z` = a snapshot of `dev` pinned to upstream version `X.Y.Z`, kept for
  history so the next upgrade can diff/replay against it.
- The first custom commit (`chore: initialize the environment`) is **not written
  by hand** — it is produced by running upstream's `tools/init.sh`, which strips
  the theme-development scaffolding and commits the built assets (`assets/js/dist`,
  `_sass/vendors`).

## Prerequisites

Do **everything inside WSL / Linux**, not Windows PowerShell. On Windows,
`core.autocrlf` rewrites `.husky/*` hook scripts to CRLF, which makes the
`commit-msg` hook pass `.git/COMMIT_EDITMSG\r` to commitlint and every commit
fails. Working in WSL keeps line endings LF.

- Node.js + npm in WSL: `sudo apt update && sudo apt install -y nodejs npm`
- git

## One-time setup

```bash
# Add the upstream remote (only once)
git remote add upstream https://github.com/cotes2020/jekyll-theme-chirpy.git

# Keep this working copy on LF endings so husky hooks work
git config core.autocrlf input
```

## Upgrade workflow

### 1. Fetch the latest upstream release

```bash
git fetch upstream --tags
git tag -l "v7.*" --sort=-v:refname | head    # find the latest version
```

### 2. Create the snapshot branch from the new tag

```bash
git checkout vX.Y.Z -B dev_vX.Y.Z
```

### 3. Regenerate the init commit with `tools/init.sh`

Do **not** cherry-pick the old `chore: initialize the environment` commit — its
`assets/js/dist/*` are stale (built from the previous version). Instead run the
upstream script so the dist is rebuilt from the new source:

```bash
bash tools/init.sh
```

If the commit-msg hook fails with `COMMIT_EDITMSG\r`, the husky scripts are CRLF.
Fix them and re-commit the already-staged changes:

```bash
find .husky -type f -exec sed -i 's/\r$//' {} +
git commit --no-verify -m "chore: initialize the environment"
```

### 4. Replay our custom commits

Cherry-pick every custom commit that sat on top of the *previous* init commit.
Use `-n` so you can rewrite the message, and re-commit with a
[Conventional Commits](https://www.conventionalcommits.org) message:

```bash
git cherry-pick -n <hash>
# resolve conflicts (see below)
git commit -m "feat: <description>"
```

Conflicts you should expect:

- **`modify/delete` on `pages-deploy.yml`** — our `Add pipeline` commit replaces
  the upstream deploy workflow with `action-trigger.yml`. Honor the deletion:

  ```bash
  git rm -f .github/workflows/pages-deploy.yml
  ```

- **content conflicts in `assets/js/dist/*.min.js`** — never merge minified
  output by hand. Resolve the *source* conflict (if any), then rebuild:

  ```bash
  npm run build:js
  git add -A
  ```

- **`_javascript/modules/components.js`** — upstream renamed the misspelled
  `loadTooptip` export to `loadTooltip`. Keep the corrected upstream spelling and
  add our new `initTableEnhance` export.

### 5. Verify

A fresh build must produce zero drift (committed dist matches source):

```bash
npm run build:js
git status -s          # expect empty
```

### 6. Publish

```bash
git push origin dev_vX.Y.Z                 # push the snapshot
git push origin dev_vX.Y.Z:dev --force     # point the live `dev` at it
```

The site data and deployment repos always pull `dev`, so no change is needed
there — the next build picks up the new framework automatically.
