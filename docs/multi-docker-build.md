# Multi-Arch Docker Release

This document describes how to publish `presenton` as a multi-architecture
image to GitHub Container Registry (`ghcr.io`).

The flow is:

1. Build the image with an explicit platform on each native machine.
2. Verify the local image architecture before pushing it.
3. Push an architecture-specific tag from each machine.
4. Create a multi-arch manifest that points to both images.
5. Promote that manifest to `latest`.

Do not infer an image's architecture from the host machine or tag name.
`docker-compose.yml` defaults to `linux/amd64`, including on Apple Silicon, and
`docker tag` does not change an image's architecture.

## Release Configuration

Set the same release version on both build machines. This example uses
`v0.9.3-beta`:

```bash
export IMAGE=ghcr.io/presenton/presenton
export VERSION=v0.9.3-beta
```

The release creates these tags:

```text
ghcr.io/presenton/presenton:v0.9.3-beta-arm64
ghcr.io/presenton/presenton:v0.9.3-beta-amd64
ghcr.io/presenton/presenton:v0.9.3-beta
ghcr.io/presenton/presenton:latest
```

Log in before pushing:

```bash
docker login ghcr.io
```

## 1. Build and Push the ARM64 Image From macOS

Run this from the repository root on an Apple Silicon Mac:

```bash
test "$(uname -m)" = "arm64"

docker buildx build \
  --platform linux/arm64 \
  --load \
  --tag "${IMAGE}:${VERSION}-arm64" \
  .

test "$(docker image inspect "${IMAGE}:${VERSION}-arm64" \
  --format '{{.Os}}/{{.Architecture}}')" = "linux/arm64"

docker push "${IMAGE}:${VERSION}-arm64"
docker buildx imagetools inspect "${IMAGE}:${VERSION}-arm64"
```

The final inspection must report `Platform: linux/arm64`. Stop the release if
it reports `linux/amd64`.

## 2. Build and Push the AMD64 Image From Linux

Run this from the same commit on a native AMD64 Linux machine:

```bash
test "$(uname -m)" = "x86_64"

docker buildx build \
  --platform linux/amd64 \
  --load \
  --tag "${IMAGE}:${VERSION}-amd64" \
  .

test "$(docker image inspect "${IMAGE}:${VERSION}-amd64" \
  --format '{{.Os}}/{{.Architecture}}')" = "linux/amd64"

docker push "${IMAGE}:${VERSION}-amd64"
docker buildx imagetools inspect "${IMAGE}:${VERSION}-amd64"
```

The final inspection must report `Platform: linux/amd64`.

## 3. Create the Multi-Arch Manifest

After both architecture-specific images are pushed, run this on either
machine:

```bash
docker buildx imagetools create \
  --tag "${IMAGE}:${VERSION}" \
  "${IMAGE}:${VERSION}-amd64" \
  "${IMAGE}:${VERSION}-arm64"
```

## 4. Promote the Release to `latest`

```bash
docker buildx imagetools create \
  --tag "${IMAGE}:latest" \
  "${IMAGE}:${VERSION}"
```

## 5. Verify the Published Manifests

```bash
docker buildx imagetools inspect "${IMAGE}:${VERSION}"
docker buildx imagetools inspect "${IMAGE}:latest"
```

Both manifests must include:

```text
linux/amd64
linux/arm64
```

## Result

After the release completes, these tags should exist:

- `${VERSION}-arm64`: native ARM64 image
- `${VERSION}-amd64`: native AMD64 image
- `${VERSION}`: multi-arch manifest
- `latest`: multi-arch manifest pointing at the same release
