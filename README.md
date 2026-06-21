# LiDAR Learning Module Static Site

This folder is the deployable standalone site.

Upload or deploy the entire `site/` folder contents:

```text
index.html
assets/
templates/
```

The site does not require WordPress, PHP, a backend, or plugin permissions.

Current learning-design revision:

- Prediction prompts before simulations
- Variable-based experimentation for point-cloud quality
- Error propagation challenge with GPS/GNSS, IMU, and laser uncertainty sliders
- Required vs optional tool guidance
- Visible accessibility descriptions for visual activities
- Final assessment mapped to the module learning outcomes

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
