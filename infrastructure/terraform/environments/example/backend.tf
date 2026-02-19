terraform {
  backend "gcs" {
    # bootstrap で作成した GCS バケット
    # terraform init -backend-config="bucket=YOUR_PROJECT_ID-tfstate" で指定
    prefix = "env"
  }
}
