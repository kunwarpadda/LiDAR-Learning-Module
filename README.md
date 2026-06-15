# LiDAR Learning Module Static Site

This folder is the deployable standalone site.

Upload or deploy the entire `site/` folder contents:

```text
index.html
assets/
templates/
```

The site does not require WordPress, PHP, a backend, or plugin permissions.

## Local Preview

From the project root:

```bash
python3 -m http.server 8000
```

Open:

```text
http://localhost:8000/site/
```

## Netlify

Drag the `site/` folder into Netlify Drop:

```text
https://app.netlify.com/drop
```

## GitHub Pages

Commit the contents of `site/` to a GitHub repository and enable Pages for the
branch/folder that contains `index.html`.

## Cloudflare Pages

Create a Pages project and use `site` as the output directory. No build command
is required.
