terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    postgresql = {
      source  = "cyrilgdn/postgresql"
      version = "~> 1.21"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "~> 3.20"
    }
  }
  
  backend "s3" {
    bucket = "soberlivings-terraform-state"
    key    = "production/terraform.tfstate"
    region = "us-west-2"
    encrypt = true
    dynamodb_table = "terraform-state-lock"
  }
}

# Provider configurations
provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Environment = var.environment
      Project     = "SoberLivings"
      ManagedBy   = "Terraform"
      CostCenter  = "Engineering"
    }
  }
}

# VPC Configuration
module "vpc" {
  source = "./modules/vpc"
  
  cidr_block           = "10.0.0.0/16"
  availability_zones   = ["us-west-2a", "us-west-2b", "us-west-2c"]
  private_subnet_cidrs = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnet_cidrs  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
  
  enable_nat_gateway = true
  enable_vpn_gateway = false
  
  tags = {
    Name = "soberlivings-${var.environment}-vpc"
  }
}

# RDS PostgreSQL with Read Replicas
module "rds" {
  source = "./modules/rds"
  
  identifier = "soberlivings-${var.environment}"
  
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.db_instance_class
  
  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_encrypted     = true
  storage_type         = "gp3"
  
  database_name = "soberlivings"
  username      = "soberlivings_admin"
  password      = random_password.db_password.result
  
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnet_ids
  allowed_cidr_blocks = module.vpc.private_subnet_cidrs
  
  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  enabled_cloudwatch_logs_exports = ["postgresql"]
  
  # Read replicas
  read_replica_count = 2
  read_replica_instance_class = "db.t3.large"
  
  performance_insights_enabled = true
  monitoring_interval         = 60
  
  deletion_protection = true
  skip_final_snapshot = false
  
  tags = {
    Name = "soberlivings-${var.environment}-db"
  }
}

# ElastiCache Redis Cluster
module "redis" {
  source = "./modules/elasticache"
  
  cluster_id = "soberlivings-${var.environment}"
  
  engine         = "redis"
  engine_version = "7.0"
  node_type      = var.redis_node_type
  num_cache_nodes = 2
  
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnet_ids
  
  automatic_failover_enabled = true
  multi_az_enabled          = true
  
  snapshot_retention_limit = 5
  snapshot_window         = "03:00-05:00"
  
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                = random_password.redis_auth_token.result
  
  tags = {
    Name = "soberlivings-${var.environment}-redis"
  }
}

# Application Load Balancer
module "alb" {
  source = "./modules/alb"
  
  name = "soberlivings-${var.environment}"
  
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.public_subnet_ids
  
  certificate_arn = aws_acm_certificate.main.arn
  
  enable_deletion_protection = true
  enable_http2              = true
  enable_cross_zone_load_balancing = true
  
  access_logs_enabled = true
  access_logs_bucket  = aws_s3_bucket.alb_logs.id
  
  # Security headers
  security_headers = {
    "Strict-Transport-Security" = "max-age=31536000; includeSubDomains"
    "X-Content-Type-Options"    = "nosniff"
    "X-Frame-Options"          = "DENY"
    "X-XSS-Protection"         = "1; mode=block"
    "Content-Security-Policy"   = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline';"
  }
  
  tags = {
    Name = "soberlivings-${var.environment}-alb"
  }
}

# ECS Fargate Cluster
module "ecs" {
  source = "./modules/ecs"
  
  cluster_name = "soberlivings-${var.environment}"
  
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnet_ids
  
  # Service configuration
  services = {
    app = {
      task_family      = "soberlivings-app"
      task_cpu        = 1024
      task_memory     = 2048
      container_image = "soberlivings/app:latest"
      container_port  = 3000
      desired_count   = 4
      min_capacity    = 2
      max_capacity    = 10
      
      environment = {
        NODE_ENV     = "production"
        DATABASE_URL = "postgresql://${module.rds.endpoint}"
        REDIS_URL    = "redis://${module.redis.endpoint}"
      }
      
      secrets = {
        DATABASE_PASSWORD = aws_secretsmanager_secret.db_password.arn
        REDIS_AUTH_TOKEN  = aws_secretsmanager_secret.redis_auth_token.arn
        API_KEYS         = aws_secretsmanager_secret.api_keys.arn
      }
      
      health_check = {
        path                = "/api/health/live"
        interval            = 30
        timeout             = 5
        healthy_threshold   = 2
        unhealthy_threshold = 3
      }
    }
    
    etl = {
      task_family      = "soberlivings-etl"
      task_cpu        = 2048
      task_memory     = 4096
      container_image = "soberlivings/etl:latest"
      container_port  = 3001
      desired_count   = 1
      
      environment = {
        NODE_ENV     = "production"
        DATABASE_URL = "postgresql://${module.rds.endpoint}"
        REDIS_URL    = "redis://${module.redis.endpoint}"
      }
      
      schedule_expression = "rate(6 hours)"
    }
  }
  
  # Auto-scaling
  auto_scaling = {
    target_cpu_utilization = 70
    target_memory_utilization = 80
    scale_in_cooldown = 300
    scale_out_cooldown = 60
  }
  
  tags = {
    Name = "soberlivings-${var.environment}-ecs"
  }
}

# WAF Configuration
module "waf" {
  source = "./modules/waf"
  
  name = "soberlivings-${var.environment}"
  
  alb_arn = module.alb.arn
  
  # Rate limiting
  rate_limit_requests_per_5min = 2000
  
  # IP allowlist/blocklist
  ip_allowlist = var.allowed_ips
  ip_blocklist = var.blocked_ips
  
  # OWASP Top 10 protection
  enable_sql_injection_protection = true
  enable_xss_protection          = true
  enable_rfi_lfi_protection      = true
  enable_php_injection_protection = true
  enable_session_fixation_protection = true
  
  # Geographic restrictions
  geo_match_constraint = {
    type  = "Country"
    value = ["US", "CA", "GB", "AU"]
  }
  
  tags = {
    Name = "soberlivings-${var.environment}-waf"
  }
}

# CloudWatch Monitoring
module "monitoring" {
  source = "./modules/monitoring"
  
  environment = var.environment
  
  # Application metrics
  app_metrics = {
    namespace = "SoberLivings/Application"
    
    alarms = {
      high_error_rate = {
        metric_name = "ErrorRate"
        threshold   = 2
        comparison  = "GreaterThanThreshold"
        period      = 300
        evaluation_periods = 2
      }
      
      high_latency = {
        metric_name = "Latency"
        statistic   = "p95"
        threshold   = 250
        comparison  = "GreaterThanThreshold"
        period      = 300
        evaluation_periods = 2
      }
      
      low_availability = {
        metric_name = "AvailabilityRate"
        threshold   = 99.5
        comparison  = "LessThanThreshold"
        period      = 300
        evaluation_periods = 2
      }
    }
  }
  
  # Database metrics
  database_metrics = {
    db_instance_identifier = module.rds.db_instance_id
    
    alarms = {
      high_cpu = {
        metric_name = "CPUUtilization"
        threshold   = 80
        period      = 300
      }
      
      high_connections = {
        metric_name = "DatabaseConnections"
        threshold   = 80
        period      = 300
      }
      
      storage_space = {
        metric_name = "FreeStorageSpace"
        threshold   = 10737418240  # 10GB in bytes
        comparison  = "LessThanThreshold"
        period      = 300
      }
    }
  }
  
  # ETL metrics
  etl_metrics = {
    namespace = "SoberLivings/ETL"
    
    alarms = {
      failed_jobs = {
        metric_name = "FailedJobs"
        threshold   = 1
        comparison  = "GreaterThanThreshold"
        period      = 3600
      }
      
      processing_lag = {
        metric_name = "ProcessingLag"
        threshold   = 300  # 5 minutes
        comparison  = "GreaterThanThreshold"
        period      = 300
      }
    }
  }
  
  # SNS notifications
  notification_endpoints = var.alert_emails
  slack_webhook_url     = var.slack_webhook_url
  pagerduty_integration_key = var.pagerduty_key
}

# Secrets Manager
resource "aws_secretsmanager_secret" "db_password" {
  name = "soberlivings-${var.environment}-db-password"
  recovery_window_in_days = 30
  
  rotation_rules {
    automatically_after_days = 90
  }
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db_password.result
}

resource "aws_secretsmanager_secret" "redis_auth_token" {
  name = "soberlivings-${var.environment}-redis-auth"
  recovery_window_in_days = 30
}

resource "aws_secretsmanager_secret_version" "redis_auth_token" {
  secret_id     = aws_secretsmanager_secret.redis_auth_token.id
  secret_string = random_password.redis_auth_token.result
}

resource "aws_secretsmanager_secret" "api_keys" {
  name = "soberlivings-${var.environment}-api-keys"
  recovery_window_in_days = 30
}

# SSL Certificate
resource "aws_acm_certificate" "main" {
  domain_name       = var.domain_name
  validation_method = "DNS"
  
  subject_alternative_names = [
    "*.${var.domain_name}",
    "api.${var.domain_name}",
    "admin.${var.domain_name}"
  ]
  
  lifecycle {
    create_before_destroy = true
  }
  
  tags = {
    Name = "soberlivings-${var.environment}-cert"
  }
}

# S3 Buckets
resource "aws_s3_bucket" "alb_logs" {
  bucket = "soberlivings-${var.environment}-alb-logs"
  
  lifecycle_rule {
    id      = "expire-old-logs"
    enabled = true
    
    expiration {
      days = 90
    }
  }
}

resource "aws_s3_bucket" "backups" {
  bucket = "soberlivings-${var.environment}-backups"
  
  versioning {
    enabled = true
  }
  
  lifecycle_rule {
    id      = "transition-to-glacier"
    enabled = true
    
    transition {
      days          = 30
      storage_class = "GLACIER"
    }
    
    expiration {
      days = 365
    }
  }
  
  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }
}

# Random passwords
resource "random_password" "db_password" {
  length  = 32
  special = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_password" "redis_auth_token" {
  length  = 32
  special = false  # Redis doesn't support special characters in auth tokens
}

# Outputs
output "alb_dns_name" {
  value = module.alb.dns_name
  description = "DNS name of the load balancer"
}

output "database_endpoint" {
  value = module.rds.endpoint
  description = "RDS instance endpoint"
  sensitive = true
}

output "redis_endpoint" {
  value = module.redis.endpoint
  description = "Redis cluster endpoint"
  sensitive = true
}

output "ecs_cluster_name" {
  value = module.ecs.cluster_name
  description = "Name of the ECS cluster"
}