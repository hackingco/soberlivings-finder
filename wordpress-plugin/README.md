# Sober Living Portal WordPress Plugin

WordPress integration plugin for the Sober Living facilities management platform.

## Features

- Facility search and display
- Lead capture and submission
- API integration with main platform
- Customizable shortcodes
- Admin dashboard for management
- Caching for performance
- Webhook support

## Quick Start

### 1. Start the WordPress stack

```bash
cd wordpress-plugin
make up
```

This will start:
- WordPress at http://localhost:8080
- phpMyAdmin at http://localhost:8081
- MailHog at http://localhost:8025

### 2. Initial setup

```bash
make setup
```

This will:
- Install WordPress
- Activate the plugin
- Create admin user (admin/admin)

### 3. Install dependencies

```bash
make install
```

## Development Workflow

### Running tests

```bash
make test          # Run PHPUnit tests
make cs            # Check code standards
make cs-fix        # Auto-fix code standard issues
make stan          # Run static analysis
```

### WP-CLI commands

```bash
make wp CMD="plugin list"        # List plugins
make wp CMD="user create test test@example.com"  # Create user
```

### Access containers

```bash
make shell         # Open bash in WordPress container
make logs          # Follow WordPress logs
```

## Shortcodes

### Display facility search

```
[sober_facility_search city="Los Angeles" state="CA"]
```

### Display facility list

```
[sober_facility_list limit="10" orderby="name"]
```

## API Integration

The plugin integrates with the main Sober Living API. Configure in WordPress admin:

1. Go to **Sober Living → Settings**
2. Set API endpoint (default: http://localhost:3001/api)
3. Enter API key
4. Configure cache duration

## Directory Structure

```
wordpress-plugin/
├── docker-compose.yml       # WordPress stack configuration
├── Makefile                 # Development commands
├── plugins/
│   └── sober-living-portal/
│       ├── sober-living-portal.php  # Main plugin file
│       ├── composer.json    # PHP dependencies
│       ├── includes/        # Core classes
│       ├── admin/          # Admin interface
│       ├── assets/         # CSS/JS files
│       ├── templates/      # Display templates
│       └── tests/          # PHPUnit tests
└── wp-content/             # WordPress content directory
```

## Database

The plugin creates custom tables:
- `wp_slp_facilities_cache` - Facility data cache

And uses custom post type:
- `slp_facility` - Facility posts

## Testing

### Unit Tests

```bash
make test
```

### Integration Tests

Tests against live API:

```bash
docker compose exec wordpress bash -c "cd /var/www/html/wp-content/plugins/sober-living-portal && vendor/bin/phpunit --group integration"
```

## Deployment

### Create distribution ZIP

```bash
make plugin-zip
```

This creates `plugins/sober-living-portal.zip` ready for upload.

### GitHub Actions CI

The plugin includes workflow for:
- PHP 8.1, 8.2 compatibility
- WordPress 6.x testing
- Code standards check
- Static analysis

## Troubleshooting

### Clear cache

```bash
make wp CMD="transient delete --all"
```

### Reset database

```bash
make down
make clean
make up
make setup
```

### Check logs

```bash
make logs
# Or check debug.log in wp-content/
```

## Security

- All inputs sanitized
- Nonces for AJAX calls
- Capability checks for admin actions
- Prepared statements for database queries

## License

GPL v2 or later

## Support

For issues or questions, contact the development team.