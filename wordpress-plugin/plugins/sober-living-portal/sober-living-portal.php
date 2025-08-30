<?php
/**
 * Plugin Name: Sober Living Portal
 * Plugin URI: https://soberlivings.com
 * Description: WordPress integration for Sober Living facilities management platform
 * Version: 1.0.0
 * Author: Sober Living Team
 * Author URI: https://soberlivings.com
 * License: GPL v2 or later
 * Text Domain: sober-living-portal
 * Domain Path: /languages
 * Requires at least: 6.0
 * Requires PHP: 8.0
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('SLP_VERSION', '1.0.0');
define('SLP_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('SLP_PLUGIN_URL', plugin_dir_url(__FILE__));
define('SLP_PLUGIN_BASENAME', plugin_basename(__FILE__));

// API Configuration
define('SLP_API_BASE', getenv('SOBER_API_BASE') ?: 'http://localhost:3001/api');
define('SLP_API_KEY', getenv('SOBER_API_KEY') ?: 'development_key');

// Autoloader
require_once SLP_PLUGIN_DIR . 'vendor/autoload.php';

// Main plugin class
class SoberLivingPortal
{
    private static $instance = null;

    public static function getInstance()
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct()
    {
        $this->initHooks();
        $this->loadDependencies();
    }

    private function initHooks()
    {
        // Activation/Deactivation hooks
        register_activation_hook(__FILE__, [$this, 'activate']);
        register_deactivation_hook(__FILE__, [$this, 'deactivate']);

        // Init hooks
        add_action('init', [$this, 'init']);
        add_action('admin_menu', [$this, 'addAdminMenu']);
        add_action('wp_enqueue_scripts', [$this, 'enqueueScripts']);
        add_action('admin_enqueue_scripts', [$this, 'enqueueAdminScripts']);

        // API hooks
        add_action('rest_api_init', [$this, 'registerRestRoutes']);

        // Shortcodes
        add_shortcode('sober_facility_search', [$this, 'renderFacilitySearch']);
        add_shortcode('sober_facility_list', [$this, 'renderFacilityList']);
    }

    private function loadDependencies()
    {
        // Load includes
        require_once SLP_PLUGIN_DIR . 'includes/class-api-client.php';
        require_once SLP_PLUGIN_DIR . 'includes/class-facility-manager.php';
        require_once SLP_PLUGIN_DIR . 'includes/class-shortcodes.php';
        require_once SLP_PLUGIN_DIR . 'includes/class-admin.php';
    }

    public function activate()
    {
        // Create database tables
        $this->createTables();
        
        // Set default options
        $this->setDefaultOptions();
        
        // Flush rewrite rules
        flush_rewrite_rules();
    }

    public function deactivate()
    {
        // Clean up scheduled events
        wp_clear_scheduled_hook('slp_sync_facilities');
        
        // Flush rewrite rules
        flush_rewrite_rules();
    }

    public function init()
    {
        // Load plugin textdomain
        load_plugin_textdomain('sober-living-portal', false, dirname(SLP_PLUGIN_BASENAME) . '/languages');

        // Register custom post types
        $this->registerPostTypes();

        // Schedule cron events
        if (!wp_next_scheduled('slp_sync_facilities')) {
            wp_schedule_event(time(), 'hourly', 'slp_sync_facilities');
        }
    }

    private function registerPostTypes()
    {
        register_post_type('slp_facility', [
            'labels' => [
                'name' => __('Facilities', 'sober-living-portal'),
                'singular_name' => __('Facility', 'sober-living-portal'),
            ],
            'public' => true,
            'has_archive' => true,
            'supports' => ['title', 'editor', 'thumbnail', 'custom-fields'],
            'menu_icon' => 'dashicons-building',
            'show_in_rest' => true,
        ]);
    }

    public function addAdminMenu()
    {
        add_menu_page(
            __('Sober Living Portal', 'sober-living-portal'),
            __('Sober Living', 'sober-living-portal'),
            'manage_options',
            'sober-living-portal',
            [$this, 'renderAdminPage'],
            'dashicons-heart',
            30
        );

        add_submenu_page(
            'sober-living-portal',
            __('Settings', 'sober-living-portal'),
            __('Settings', 'sober-living-portal'),
            'manage_options',
            'slp-settings',
            [$this, 'renderSettingsPage']
        );
    }

    public function renderAdminPage()
    {
        include SLP_PLUGIN_DIR . 'admin/views/dashboard.php';
    }

    public function renderSettingsPage()
    {
        include SLP_PLUGIN_DIR . 'admin/views/settings.php';
    }

    public function enqueueScripts()
    {
        wp_enqueue_style('slp-frontend', SLP_PLUGIN_URL . 'assets/css/frontend.css', [], SLP_VERSION);
        wp_enqueue_script('slp-frontend', SLP_PLUGIN_URL . 'assets/js/frontend.js', ['jquery'], SLP_VERSION, true);

        // Localize script
        wp_localize_script('slp-frontend', 'slp_ajax', [
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('slp_nonce'),
            'api_base' => SLP_API_BASE,
        ]);
    }

    public function enqueueAdminScripts($hook)
    {
        if (strpos($hook, 'sober-living') === false) {
            return;
        }

        wp_enqueue_style('slp-admin', SLP_PLUGIN_URL . 'assets/css/admin.css', [], SLP_VERSION);
        wp_enqueue_script('slp-admin', SLP_PLUGIN_URL . 'assets/js/admin.js', ['jquery'], SLP_VERSION, true);
    }

    public function registerRestRoutes()
    {
        register_rest_route('slp/v1', '/facilities', [
            'methods' => 'GET',
            'callback' => [$this, 'getFacilities'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route('slp/v1', '/sync', [
            'methods' => 'POST',
            'callback' => [$this, 'syncFacilities'],
            'permission_callback' => function() {
                return current_user_can('manage_options');
            },
        ]);
    }

    public function getFacilities($request)
    {
        $client = new \SLP\ApiClient();
        return $client->getFacilities($request->get_params());
    }

    public function syncFacilities()
    {
        $manager = new \SLP\FacilityManager();
        return $manager->syncWithAPI();
    }

    public function renderFacilitySearch($atts)
    {
        $shortcodes = new \SLP\Shortcodes();
        return $shortcodes->facilitySearch($atts);
    }

    public function renderFacilityList($atts)
    {
        $shortcodes = new \SLP\Shortcodes();
        return $shortcodes->facilityList($atts);
    }

    private function createTables()
    {
        global $wpdb;
        $charset_collate = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}slp_facilities_cache (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            facility_id varchar(100) NOT NULL,
            data longtext NOT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY facility_id (facility_id)
        ) $charset_collate;";

        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
    }

    private function setDefaultOptions()
    {
        add_option('slp_api_endpoint', SLP_API_BASE);
        add_option('slp_api_key', SLP_API_KEY);
        add_option('slp_cache_duration', 3600);
        add_option('slp_display_limit', 10);
    }
}

// Initialize plugin
SoberLivingPortal::getInstance();