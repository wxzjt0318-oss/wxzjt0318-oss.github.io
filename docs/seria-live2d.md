# Seria blog character

The Pio integration now accepts either a legacy model JSON or the protected Seria
binary configured in `src/config/pioConfig.ts`. Only the selected renderer loads.
With Pio disabled, its island, stylesheet, SDK and model requests are absent.
Mobile hiding also prevents loading the renderer and binary at widths <= 1280px.

## Assets and deployment

`public/pio/seria/seria-*.bin` contains gzip-compressed runtime files encrypted with
AES-256-GCM. It includes the `.moc3`, textures, physics, expressions, natural-pose
motions, voice and interaction metadata. It contains no `.cmo3`, PSD or private
key. Hand waving and V-sign actions are removed. The web model also bakes their
controls to neutral to reduce download and runtime memory use.

The local `.env.local` and the repository's GitHub Actions secret
`PUBLIC_SERIA_ASSET_KEY` supply the same Base64-encoded 32-byte key. The Pages
deployment workflow passes this variable only to the site build. Do not commit
the local key or private source folder. CI/forks without this secret can build
the blog but cannot initialize the encrypted model.

To replace the assets, run:

```sh
node scripts/live2d/pack-seria.mjs /private/runtime-directory /private/key.base64
```

Update the configured binary URL from `public/pio/seria/asset.json`, and remove old
unreferenced binary revisions from the delivery directory. `pack-seria.mjs`
expects a source `Seria_Voice.model3.json` and rejects hand-gesture motion entries.
The local editable projects and plain runtime archives remain outside this repo.

## Protection limits

This prevents direct reuse of a repository checkout without its deployment key,
and the player checks the intended host before downloading/decrypting the model.
It is not DRM: public deployed JavaScript necessarily contains the decryption
material, and a visitor can recover model data from their browser. Domain checks
can also be removed by someone modifying the player. Server-side authorization
would require infrastructure beyond GitHub Pages and still cannot prevent a
permitted browser from recording or extracting rendered resources.

The package records the integration account and source site for provenance.
These marks do not transfer ownership of the underlying character or original
artwork. Model/art assets are not licensed under this theme's MIT license.
The original model/character rights remain with their respective rights holders.

## Playback and lifecycle

The official Live2D-hosted Core script loads on demand; it is not copied into this
repository. PixiJS 6.5.10 and pixi-live2d-display 0.4.0 are pinned for their compatible
Cubism renderer. Their respective MIT notices and Live2D SDK terms continue to
apply: <https://www.live2d.com/en/sdk/download/web/>.

The model is part of the persistent shell outside `#swup-container`. Navigation
does not replace or recreate it. Actual disposal cancels listeners, pauses audio,
destroys WebGL resources and revokes Blob URLs. Hidden tabs/hidden character pause
rendering; reduced motion neutralizes pointer-driven head/body movement. The
runtime clamps frame deltas and renders at 30 FPS to limit background work.

Audio starts only after clicking a real model part or the keyboard-accessible
introduction button. No autoplay is attempted. Hit tests require nontransparent
rendered pixels and a triangle within a configured major body part. Transparent
canvas margins do not trigger text. The original Japanese recording and mouth
curves are preserved; the introduction bubble is 我的名字叫瑟莉亚·库列尔.

The encrypted binary uses a 30-second transfer budget and a 64 MiB envelope limit,
an explicit exception to the ordinary small-JSON API limits: these are binary
character graphics, loaded lazily and not needed to render the article.

## Verification

Run `npx astro check`, `pnpm build`, `pnpm check:package-manifest`, and the focused
`tests/site/seria.spec.ts` browser tests. Tests can use `SERIA_TEST_CORE` pointing at
an authentic cached official Core file for deterministic network-independent
playback, and the local `.env.local` for the private key. These files stay outside
the repository. Run the existing homepage light/dark accessibility fragment too.

Set `PLAYWRIGHT_SITE_PREVIEW=true` to run the same repository Playwright setup
against a completed production build instead of the dev watcher. This is also
useful on Windows when the large source tree hits file-handle limits. Local
validation can use the existing `GAMES_FETCH_OFFLINE=1` cache-only option when
Bangumi is unavailable; that is not enabled in the deployment workflow.
