# Cloud Load Balancer + CDN + Cloud Armor + SSL

# --- 外部 IP アドレス ---
resource "google_compute_global_address" "main" {
  name    = "${var.prefix}-lb-ip-${var.environment}"
  project = var.project_id
}

# --- SSL 証明書（Google マネージド） ---
resource "google_compute_managed_ssl_certificate" "app" {
  name    = "${var.prefix}-app-cert-${var.environment}"
  project = var.project_id

  managed {
    domains = var.app_domains
  }
}

resource "google_compute_managed_ssl_certificate" "admin" {
  name    = "${var.prefix}-admin-cert-${var.environment}"
  project = var.project_id

  managed {
    domains = var.admin_domains
  }
}

# --- Serverless NEGs（Cloud Run バックエンド） ---
resource "google_compute_region_network_endpoint_group" "services" {
  for_each = var.cloud_run_services

  name                  = "${var.prefix}-neg-${each.key}-${var.environment}"
  project               = var.project_id
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = each.value.service_name
  }
}

# --- バックエンドサービス ---
resource "google_compute_backend_service" "services" {
  for_each = var.cloud_run_services

  name    = "${var.prefix}-backend-${each.key}-${var.environment}"
  project = var.project_id

  protocol              = "HTTPS"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  timeout_sec           = each.value.timeout_sec

  # CDN 設定
  enable_cdn = each.value.enable_cdn
  dynamic "cdn_policy" {
    for_each = each.value.enable_cdn ? [1] : []

    content {
      cache_mode                   = "CACHE_ALL_STATIC"
      default_ttl                  = 3600
      max_ttl                      = 86400
      signed_url_cache_max_age_sec = 0
    }
  }

  # Cloud Armor ポリシー（API/MCP バックエンドに自動適用）
  security_policy = contains(["api", "mcp"], each.key) ? google_compute_security_policy.main.self_link : null

  backend {
    group = google_compute_region_network_endpoint_group.services[each.key].id
  }

  log_config {
    enable      = true
    sample_rate = var.log_sample_rate
  }
}

# --- URL Map（ホストベースルーティング） ---
resource "google_compute_url_map" "main" {
  name    = "${var.prefix}-urlmap-${var.environment}"
  project = var.project_id

  default_service = google_compute_backend_service.services["web"].id

  host_rule {
    hosts        = var.app_domains
    path_matcher = "app"
  }

  host_rule {
    hosts        = var.admin_domains
    path_matcher = "admin"
  }

  path_matcher {
    name            = "app"
    default_service = google_compute_backend_service.services["web"].id

    path_rule {
      paths   = ["/api/*", "/auth/*"]
      service = google_compute_backend_service.services["api"].id
    }

    path_rule {
      paths   = ["/ws", "/ws/*"]
      service = google_compute_backend_service.services["ws"].id
    }

    path_rule {
      paths   = ["/mcp", "/mcp/*"]
      service = google_compute_backend_service.services["mcp"].id
    }
  }

  path_matcher {
    name            = "admin"
    default_service = google_compute_backend_service.services["admin"].id

    path_rule {
      paths   = ["/admin/auth/*", "/api/admin/*"]
      service = google_compute_backend_service.services["api"].id
    }
  }
}

# --- HTTPS Proxy ---
resource "google_compute_target_https_proxy" "main" {
  name    = "${var.prefix}-https-proxy-${var.environment}"
  project = var.project_id
  url_map = google_compute_url_map.main.id

  ssl_certificates = [
    google_compute_managed_ssl_certificate.app.id,
    google_compute_managed_ssl_certificate.admin.id,
  ]
}

# --- HTTPS Forwarding Rule ---
resource "google_compute_global_forwarding_rule" "https" {
  name    = "${var.prefix}-https-rule-${var.environment}"
  project = var.project_id

  target     = google_compute_target_https_proxy.main.id
  port_range = "443"
  ip_address = google_compute_global_address.main.address

  load_balancing_scheme = "EXTERNAL_MANAGED"
}

# --- HTTP → HTTPS リダイレクト ---
resource "google_compute_url_map" "http_redirect" {
  name    = "${var.prefix}-http-redirect-${var.environment}"
  project = var.project_id

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "http_redirect" {
  name    = "${var.prefix}-http-proxy-${var.environment}"
  project = var.project_id
  url_map = google_compute_url_map.http_redirect.id
}

resource "google_compute_global_forwarding_rule" "http_redirect" {
  name    = "${var.prefix}-http-rule-${var.environment}"
  project = var.project_id

  target     = google_compute_target_http_proxy.http_redirect.id
  port_range = "80"
  ip_address = google_compute_global_address.main.address

  load_balancing_scheme = "EXTERNAL_MANAGED"
}

# --- Cloud Armor セキュリティポリシー ---
resource "google_compute_security_policy" "main" {
  name    = "${var.prefix}-armor-${var.environment}"
  project = var.project_id

  # デフォルト: 許可
  rule {
    action   = "allow"
    priority = 2147483647

    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }

    description = "デフォルト許可"
  }

  # 認証エンドポイントのレートリミット: 10 req/min/IP
  rule {
    action   = "throttle"
    priority = 1000

    match {
      expr {
        expression = "request.path.matches('/api/auth/.*') || request.path.matches('/admin/auth/.*') || request.path.matches('/oauth/.*')"
      }
    }

    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"

      rate_limit_threshold {
        count        = 10
        interval_sec = 60
      }

      ban_duration_sec = 600
      ban_threshold {
        count        = 20
        interval_sec = 60
      }
    }

    description = "認証エンドポイントのレートリミット（10 req/min/IP、超過時10分BAN）"
  }

  # 一般 API のレートリミット: 100 req/min/IP
  rule {
    action   = "throttle"
    priority = 2000

    match {
      expr {
        expression = "request.path.matches('/api/.*')"
      }
    }

    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"

      rate_limit_threshold {
        count        = 100
        interval_sec = 60
      }
    }

    description = "一般 API のレートリミット（100 req/min/IP）"
  }
}
