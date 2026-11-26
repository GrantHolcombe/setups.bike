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

## Still in AWS after the move (cleaned up 2026-11-26)

Deleted: both Setups.Bike pipelines (`setups.bike_bucket` and the old `https.setups.bike`), the
`https.setups.bike` and `hiregrant-serverless` buckets (old copies of repos uploaded by S3 deploy
actions), `recipe-app-imgs`, the old pipeline folders in the artifact bucket, the
`Setups.Bike_GitHub` CodeConnections connection, the CodeBuild project `SetupsDotBike_builder`,
its role `SetupsDotBikeCodeBuildSR`, the pipeline role `Setups.Bike_CD_Role`, and both roles'
policies. Going back to CodePipeline means recreating those from the backups above, plus a new
GitHub connection.

Left:
- Artifact bucket `codepipeline-us-west-1-708924771225`: **keep**. It only holds the Lambda
  deploy zips in `lambda-deploys/` now (`lambdas/README.md`).

`www.setups.bike` redirects with a Cloudflare Redirect Rule ("www to setups.bike": 301 to
`https://setups.bike/${1}`, query string kept), not an S3 bucket. Its DNS record is a proxied
`AAAA 100::` placeholder, so nothing points at S3. The old `www.setups.bike` redirect bucket was
deleted 2026-11-26 (hiregrant.today got the same change).
