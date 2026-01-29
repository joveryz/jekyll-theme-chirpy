# Jekyll Theme Chirpy Upgrade Guide

This guide describes how to upgrade the Jekyll theme and cherry-pick specific changes from other branches.

## Prerequisites

- Git installed
- Linux version nodejs and npm installed, especially for WSL (`sudo apt update && sudo apt install nodejs npm`)

## Upgrade Workflow

### 1. Add Upstream Remote

First, add the original Chirpy repository as an upstream remote to fetch the latest releases:

```bash
# Add upstream remote (only need to do this once)
git remote add upstream https://github.com/cotes2020/jekyll-theme-chirpy.git

# Verify remotes
git remote -v
# Should show:
# origin    https://github.com/<your-username>/jekyll-theme-chirpy.git (fetch)
# origin    https://github.com/<your-username>/jekyll-theme-chirpy.git (push)
# upstream  https://github.com/cotes2020/jekyll-theme-chirpy.git (fetch)
# upstream  https://github.com/cotes2020/jekyll-theme-chirpy.git (push)
```

### 2. Fetch Latest Tags and Branches

```bash
# Fetch all tags and branches from upstream
git fetch upstream --tags

# List available tags
git tag -l

# View latest releases
git tag -l "v7.*" --sort=-v:refname | head -10
```

### 3. Create a Development Branch

```bash
# Create a new branch based on the target version
git checkout -b dev_v7.4.1 v7.4.1
```

### 4. Cherry-pick Changes from Another Branch

Cherry-pick specific commits from another branch (e.g., `dev_v7.2.4`):

```bash
# Cherry-pick a single commit
git cherry-pick <commit-hash>

# Cherry-pick a range of commits (exclusive of first commit)
git cherry-pick <start-commit>..<end-commit>
```

### 5. Resolving Conflicts

When conflicts occur, git will pause and show:

```
CONFLICT (content): Merge conflict in <file>
```

1. **For commit `Show timezone info in tooltip of datetime`**
   
    Modify `_javascript/modules/components/locale-datetime.js`
    Then run `/usr/bin/npm run build:js` to rebuild JS assets.
    Following errors show that you are using the Windows version of Node.js in WSL
    ```bash
    '\\wsl.localhost\Ubuntu\home\ztb5129\repos\jekyll-theme-chirpy'
    CMD.EXE was started with the above path as the current directory.
    UNC paths are not supported.  Defaulting to Windows directory.
    'rollup' is not recognized as an internal or external command,
    operable program or batch file.
    ```

2. **Skip commit message hooks if needed:**

    ```bash
    git cherry-pick --continue --no-verify
    # Or for regular commits:
    git commit -m "message" --no-verify
    ```

### 6. Push Changes

```bash
# Push to your development branch
git push origin dev_v7.4.1

# Update another branch (e.g., dev) to point to your changes
git push origin dev_v7.4.1:dev --force
```
