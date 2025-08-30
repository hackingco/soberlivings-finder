<?php

namespace SLP;

class Admin
{
    public function __construct()
    {
        add_action('admin_init', [$this, 'registerSettings']);
    }

    public function registerSettings()
    {
        // API Settings
        register_setting('slp_settings', 'slp_api_endpoint');
        register_setting('slp_settings', 'slp_api_key');
        register_setting('slp_settings', 'slp_cache_duration');
        register_setting('slp_settings', 'slp_display_limit');

        // API Section
        add_settings_section(
            'slp_api_settings',
            __('API Configuration', 'sober-living-portal'),
            [$this, 'apiSectionCallback'],
            'slp-settings'
        );

        add_settings_field(
            'slp_api_endpoint',
            __('API Endpoint', 'sober-living-portal'),
            [$this, 'apiEndpointField'],
            'slp-settings',
            'slp_api_settings'
        );

        add_settings_field(
            'slp_api_key',
            __('API Key', 'sober-living-portal'),
            [$this, 'apiKeyField'],
            'slp-settings',
            'slp_api_settings'
        );

        // Display Settings
        add_settings_section(
            'slp_display_settings',
            __('Display Settings', 'sober-living-portal'),
            [$this, 'displaySectionCallback'],
            'slp-settings'
        );

        add_settings_field(
            'slp_cache_duration',
            __('Cache Duration (seconds)', 'sober-living-portal'),
            [$this, 'cacheDurationField'],
            'slp-settings',
            'slp_display_settings'
        );

        add_settings_field(
            'slp_display_limit',
            __('Default Display Limit', 'sober-living-portal'),
            [$this, 'displayLimitField'],
            'slp-settings',
            'slp_display_settings'
        );
    }

    public function apiSectionCallback()
    {
        echo '<p>' . __('Configure your Sober Living API connection.', 'sober-living-portal') . '</p>';
    }

    public function displaySectionCallback()
    {
        echo '<p>' . __('Configure display options for facilities.', 'sober-living-portal') . '</p>';
    }

    public function apiEndpointField()
    {
        $value = get_option('slp_api_endpoint', SLP_API_BASE);
        echo '<input type="url" name="slp_api_endpoint" value="' . esc_attr($value) . '" class="regular-text" />';
        echo '<p class="description">' . __('The base URL for the Sober Living API.', 'sober-living-portal') . '</p>';
    }

    public function apiKeyField()
    {
        $value = get_option('slp_api_key', '');
        echo '<input type="password" name="slp_api_key" value="' . esc_attr($value) . '" class="regular-text" />';
        echo '<p class="description">' . __('Your API authentication key.', 'sober-living-portal') . '</p>';
    }

    public function cacheDurationField()
    {
        $value = get_option('slp_cache_duration', 3600);
        echo '<input type="number" name="slp_cache_duration" value="' . esc_attr($value) . '" min="0" />';
        echo '<p class="description">' . __('How long to cache facility data (in seconds).', 'sober-living-portal') . '</p>';
    }

    public function displayLimitField()
    {
        $value = get_option('slp_display_limit', 10);
        echo '<input type="number" name="slp_display_limit" value="' . esc_attr($value) . '" min="1" max="100" />';
        echo '<p class="description">' . __('Default number of facilities to display.', 'sober-living-portal') . '</p>';
    }
}