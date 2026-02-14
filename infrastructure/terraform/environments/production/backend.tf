terraform {
  backend "gcs" {
    # bootstrap で作成した GCS バケット
    # bucket = "${var.project_id}-tfstate" は補間不可のため tfvars で指定
    prefix = "production"
  }
}
