output "secret_ids" {
  description = "作成されたシークレットの ID マップ"
  value = {
    for key, secret in google_secret_manager_secret.secrets : key => secret.secret_id
  }
}

output "secret_names" {
  description = "作成されたシークレットの完全修飾名マップ"
  value = {
    for key, secret in google_secret_manager_secret.secrets : key => secret.name
  }
}
