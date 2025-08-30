variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-west-2"
}

variable "environment" {
  description = "Environment name (production, staging, dev)"
  type        = string
  default     = "production"
}

variable "domain_name" {
  description = "Primary domain name for the application"
  type        = string
  default     = "soberlivings.com"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.r6g.xlarge"
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.r6g.large"
}

variable "allowed_ips" {
  description = "IP addresses allowed to access the application"
  type        = list(string)
  default     = []
}

variable "blocked_ips" {
  description = "IP addresses blocked from accessing the application"
  type        = list(string)
  default     = []
}

variable "alert_emails" {
  description = "Email addresses for CloudWatch alerts"
  type        = list(string)
  default     = ["ops@soberlivings.com"]
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for notifications"
  type        = string
  sensitive   = true
}

variable "pagerduty_key" {
  description = "PagerDuty integration key for critical alerts"
  type        = string
  sensitive   = true
}