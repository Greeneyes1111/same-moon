#!/usr/bin/env bash
# Sets up Google Cloud and deploys Same Moon. Safe to run again: every step
# checks before it creates.
#
#   PROJECT=my-project REVIEWERS=me@example.com infra/deploy.sh
#
# What it builds:
#   web         public Cloud Run service (the app)               runs as sm-web
#   studio      review studio, password protected                runs as sm-studio
#   transcoder  private service, triggered by Eventarc            runs as sm-media
#   publish     Cloud Run job: narration + publishing             runs as sm-media
#   buckets     public (approved only), state (private), uploads (private, auto-deleted)
set -euo pipefail

: "${PROJECT:?Set PROJECT to the Google Cloud project id}"
: "${REVIEWERS:?Set REVIEWERS to a comma-separated list of reviewer emails}"
REGION="${REGION:-europe-west1}"
TAG="${TAG:-$(git rev-parse --short HEAD 2>/dev/null || date +%s)}"
REPO="$REGION-docker.pkg.dev/$PROJECT/samemoon"
PUBLIC="samemoon-public-$PROJECT"
STATE="samemoon-state-$PROJECT"
UPLOADS="samemoon-uploads-$PROJECT"

g() { gcloud --project "$PROJECT" --quiet "$@"; }
say() { printf '\n== %s\n' "$*"; }
sa() { echo "$1@$PROJECT.iam.gserviceaccount.com"; }

NUM=$(g projects describe "$PROJECT" --format='value(projectNumber)')

say "Turning on the Google Cloud APIs"
g services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  texttospeech.googleapis.com eventarc.googleapis.com pubsub.googleapis.com storage.googleapis.com \
  iamcredentials.googleapis.com secretmanager.googleapis.com logging.googleapis.com

say "Image repository"
g artifacts repositories describe samemoon --location "$REGION" >/dev/null 2>&1 ||
  g artifacts repositories create samemoon --repository-format docker --location "$REGION"

say "Buckets"
for b in "$PUBLIC" "$STATE" "$UPLOADS"; do
  if ! g storage buckets describe "gs://$b" >/dev/null 2>&1; then
    extra=()
    [ "$b" != "$PUBLIC" ] && extra=(--public-access-prevention)
    g storage buckets create "gs://$b" --location "$REGION" --uniform-bucket-level-access "${extra[@]}"
  fi
done
tmp=$(mktemp -d)
echo '{"rule":[{"action":{"type":"Delete"},"condition":{"age":2}}]}' >"$tmp/lifecycle.json"
g storage buckets update "gs://$UPLOADS" --lifecycle-file "$tmp/lifecycle.json"

say "Service accounts (one per job, least privilege)"
for name in sm-web sm-studio sm-media sm-events; do
  g iam service-accounts describe "$(sa $name)" >/dev/null 2>&1 ||
    g iam service-accounts create "$name" --display-name "Same Moon $name"
done
sleep 5

bucket_role() { g storage buckets add-iam-policy-binding "gs://$1" --member "serviceAccount:$(sa "$2")" --role "$3" >/dev/null; }
bucket_role "$PUBLIC" sm-web roles/storage.objectViewer
bucket_role "$PUBLIC" sm-media roles/storage.objectAdmin
bucket_role "$STATE" sm-web roles/storage.objectCreator
bucket_role "$STATE" sm-studio roles/storage.objectAdmin
bucket_role "$STATE" sm-media roles/storage.objectAdmin
bucket_role "$UPLOADS" sm-web roles/storage.objectCreator
bucket_role "$UPLOADS" sm-media roles/storage.objectAdmin
# The web service signs short-lived upload links with its own identity.
g iam service-accounts add-iam-policy-binding "$(sa sm-web)" \
  --member "serviceAccount:$(sa sm-web)" --role roles/iam.serviceAccountTokenCreator >/dev/null
g projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$(sa sm-media)" \
  --role roles/serviceusage.serviceUsageConsumer --condition None >/dev/null
g projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$(sa sm-events)" \
  --role roles/eventarc.eventReceiver --condition None >/dev/null
GCS_AGENT=$(g storage service-agent)
g projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$GCS_AGENT" \
  --role roles/pubsub.publisher --condition None >/dev/null

say "Studio password (kept in Secret Manager)"
if ! g secrets describe studio-password >/dev/null 2>&1; then
  python3 -c "import secrets,string;w=[secrets.choice(['moon','star','cedar','river','lantern','olive','harbour','meadow','sparrow','amber','willow','pebble']) for _ in range(4)];print('-'.join(w)+'-'+str(secrets.randbelow(900)+100),end='')" |
    g secrets create studio-password --data-file=-
fi
g secrets add-iam-policy-binding studio-password --member "serviceAccount:$(sa sm-studio)" \
  --role roles/secretmanager.secretAccessor >/dev/null

say "Building images ($TAG)"
g builds submit --config infra/cloudbuild.yaml \
  --substitutions "_IMAGE_APP=$REPO/app:$TAG,_IMAGE_MEDIA=$REPO/media:$TAG" .

ENVS="STORE=gcs,BUCKET_PUBLIC=$PUBLIC,BUCKET_STATE=$STATE,BUCKET_UPLOADS=$UPLOADS,GOOGLE_CLOUD_PROJECT=$PROJECT,REGION=$REGION"

say "Publish job"
g run jobs deploy publish --region "$REGION" --image "$REPO/media:$TAG" \
  --service-account "$(sa sm-media)" --command node --args "jobs/publish/run.js,--tts=google" \
  --set-env-vars "$ENVS" --cpu 1 --memory 1Gi --task-timeout 30m --max-retries 1
g run jobs add-iam-policy-binding publish --region "$REGION" \
  --member "serviceAccount:$(sa sm-studio)" --role roles/run.invoker >/dev/null

say "Transcoder (private)"
g run deploy transcoder --region "$REGION" --image "$REPO/media:$TAG" \
  --service-account "$(sa sm-media)" --no-allow-unauthenticated \
  --set-env-vars "$ENVS" --cpu 1 --memory 1Gi --concurrency 2 --timeout 300 --max-instances 3
g run services add-iam-policy-binding transcoder --region "$REGION" \
  --member "serviceAccount:$(sa sm-events)" --role roles/run.invoker >/dev/null

say "Web (public)"
g run deploy web --region "$REGION" --image "$REPO/app:$TAG" \
  --service-account "$(sa sm-web)" --allow-unauthenticated \
  --set-env-vars "$ENVS" --cpu 1 --memory 512Mi --concurrency 80 --max-instances 5 --cpu-boost
WEB_URL=$(g run services describe web --region "$REGION" --format 'value(status.url)')

say "Studio (password protected)"
g run deploy studio --region "$REGION" --image "$REPO/app:$TAG" \
  --service-account "$(sa sm-studio)" --allow-unauthenticated \
  --command node --args services/studio/server.js \
  --set-env-vars "$ENVS,PUBLISH_JOB=publish,STUDIO_AUTH=password,REVIEWERS=$REVIEWERS" \
  --set-secrets STUDIO_PASSWORD=studio-password:latest \
  --cpu 1 --memory 512Mi --max-instances 2
STUDIO_URL=$(g run services describe studio --region "$REGION" --format 'value(status.url)')

say "Eventarc: new uploads go to the transcoder"
g eventarc triggers describe voice-uploads --location "$REGION" >/dev/null 2>&1 ||
  g eventarc triggers create voice-uploads --location "$REGION" \
    --destination-run-service transcoder --destination-run-region "$REGION" \
    --event-filters type=google.cloud.storage.object.v1.finalized \
    --event-filters "bucket=$UPLOADS" \
    --service-account "$(sa sm-events)"

say "Browser uploads allowed only from the app"
ORIGINS="\"$WEB_URL\""
[ -n "${CUSTOM_DOMAIN:-}" ] && ORIGINS="$ORIGINS,\"https://$CUSTOM_DOMAIN\""
echo "[{\"origin\":[$ORIGINS],\"method\":[\"PUT\"],\"responseHeader\":[\"content-type\"],\"maxAgeSeconds\":3600}]" >"$tmp/cors.json"
g storage buckets update "gs://$UPLOADS" --cors-file "$tmp/cors.json"

say "First publish (narrates every draft privately)"
g run jobs execute publish --region "$REGION" --wait

say "Done"
echo "App:    $WEB_URL"
echo "Studio: $STUDIO_URL"
echo "Studio password: gcloud secrets versions access latest --secret studio-password --project $PROJECT"
