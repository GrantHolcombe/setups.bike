# infra

AWS settings kept in the repo, so they can be checked or recreated.

| File | What it is |
|---|---|
| `github-deploy-trust-policy.json` | Trust policy of the IAM role `setupsbike-github-deploy`: only GitHub Actions runs on this repo's `main` can use it (the account's GitHub OIDC provider, shared with hiregrant.today). |
| `github-deploy-permissions.json` | Its inline policy `setupsbike-site-upload`: upload to the `setups.bike` bucket, nothing else. |
| `codepipeline-setups.bike_bucket.json` | Backup of the old CodePipeline deploy, saved 2026-11-26 before it was deleted. |
| `codebuild-SetupsDotBike_builder.json` | Backup of the CodeBuild project that pipeline ran. |
| `buildspec.yaml` | The build steps it ran (was at the repo root). |

## Going back to CodePipeline

If GitHub Actions ever has to be dropped:

1. If the CodeBuild project `SetupsDotBike_builder` is gone, recreate it from
   `codebuild-SetupsDotBike_builder.json` (CreateProject), with its role `SetupsDotBikeCodeBuildSR`.
2. Copy `infra/buildspec.yaml` back to the repo root (CodeBuild looks for it there).
3. Recreate the pipeline from the `pipeline` object in `codepipeline-setups.bike_bucket.json`
   (CreatePipeline; it needs the role `Setups.Bike_CD_Role`, the GitHub CodeConnections
   connection and the artifact bucket it names).
4. Remove the `push:` trigger from `.github/workflows/deploy.yml`, so nothing deploys twice.

## Still in AWS after the move (2026-11-26)

- CodeBuild project `SetupsDotBike_builder`, its role `SetupsDotBikeCodeBuildSR`, the pipeline
  role `Setups.Bike_CD_Role` and the GitHub CodeConnections connection: nothing uses them now
  that both setups.bike and hiregrant.today deploy with GitHub Actions. They can be deleted
  (backups above).
- Artifact bucket `codepipeline-us-west-1-708924771225`: **keep**. The Lambda deploys upload
  their zips to `lambda-deploys/` in it (`lambdas/README.md`).
- Pipeline `https.setups.bike`: an old pipeline that has never run. It's the risky kind: an S3
  deploy of the *source* artifact (Extract on) to the `https.setups.bike` bucket, so if it ever
  ran it would publish the whole repo there. It only triggers on changes under `/build`, which
  is never committed. Back it up and delete it.
