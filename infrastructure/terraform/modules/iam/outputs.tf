output "service_account_emails" {
  description = "サービスアカウントのメールアドレスマップ"
  value = {
    for key, sa in google_service_account.services : key => sa.email
  }
}

output "service_account_ids" {
  description = "サービスアカウントのID（完全修飾名）マップ"
  value = {
    for key, sa in google_service_account.services : key => sa.id
  }
}
