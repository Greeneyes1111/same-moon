#!/usr/bin/env bash
# Rebuilds the app image and puts it live on the public web service and the
# review studio (they share one image). Keeps each service's settings, secrets
# and the samemoon.world mapping.
# Run from Cloud Shell:  bash infra/redeploy-web.sh
set -euo pipefail
export CLOUDSDK_CORE_DISABLE_PROMPTS=1
cd "$(dirname "$0")/.."
REGION="${REGION:-europe-west1}"
if [ -z "${PROJECT:-}" ]; then
  for p in $(gcloud projects list --format='value(projectId)'); do
    if gcloud run services describe web --region "$REGION" --project "$p" --format='value(metadata.name)' >/dev/null 2>&1 &&
       gcloud artifacts repositories describe samemoon --location "$REGION" --project "$p" >/dev/null 2>&1; then
      PROJECT="$p"; break
    fi
  done
fi
: "${PROJECT:?Could not find the Same Moon project; run again with PROJECT=its-id}"
TAG="$(git rev-parse --short HEAD)"
IMG="$REGION-docker.pkg.dev/$PROJECT/samemoon/app:$TAG"
echo "== Project $PROJECT, building $IMG"
gcloud builds submit --project "$PROJECT" --config infra/cloudbuild-web.yaml --substitutions "_IMAGE_APP=$IMG" .
echo "== Putting it live"
gcloud run services update web --region "$REGION" --project "$PROJECT" --image "$IMG"
gcloud run services update studio --region "$REGION" --project "$PROJECT" --image "$IMG"
echo "== DONE: web and studio are now on $TAG"
