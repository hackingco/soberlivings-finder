<?php

namespace SLP;

class FacilityManager
{
    private $apiClient;

    public function __construct()
    {
        $this->apiClient = new ApiClient();
    }

    public function syncWithAPI()
    {
        $facilities = $this->apiClient->getFacilities(['limit' => 100]);
        
        if (isset($facilities['error'])) {
            return new \WP_Error('sync_failed', $facilities['error']);
        }

        $synced = 0;
        foreach ($facilities['data'] ?? [] as $facility) {
            if ($this->syncFacility($facility)) {
                $synced++;
            }
        }

        return [
            'success' => true,
            'synced' => $synced,
            'message' => sprintf(__('%d facilities synced successfully', 'sober-living-portal'), $synced),
        ];
    }

    private function syncFacility($facilityData)
    {
        global $wpdb;
        
        // Check if facility exists as post
        $existingPost = get_posts([
            'post_type' => 'slp_facility',
            'meta_key' => 'facility_id',
            'meta_value' => $facilityData['id'],
            'posts_per_page' => 1,
        ]);

        $postData = [
            'post_title' => $facilityData['name'],
            'post_content' => $facilityData['description'] ?? '',
            'post_type' => 'slp_facility',
            'post_status' => 'publish',
        ];

        if (!empty($existingPost)) {
            $postData['ID'] = $existingPost[0]->ID;
            $postId = wp_update_post($postData);
        } else {
            $postId = wp_insert_post($postData);
        }

        if ($postId) {
            // Update meta fields
            update_post_meta($postId, 'facility_id', $facilityData['id']);
            update_post_meta($postId, 'city', $facilityData['city'] ?? '');
            update_post_meta($postId, 'state', $facilityData['state'] ?? '');
            update_post_meta($postId, 'zip', $facilityData['zip'] ?? '');
            update_post_meta($postId, 'phone', $facilityData['phone'] ?? '');
            update_post_meta($postId, 'email', $facilityData['email'] ?? '');
            update_post_meta($postId, 'website', $facilityData['website'] ?? '');
            update_post_meta($postId, 'beds_available', $facilityData['beds_available'] ?? 0);
            update_post_meta($postId, 'pricing', $facilityData['pricing'] ?? '');
            
            // Cache the full data
            $this->cacheData($facilityData['id'], $facilityData);
            
            return true;
        }

        return false;
    }

    private function cacheData($facilityId, $data)
    {
        global $wpdb;
        
        $table = $wpdb->prefix . 'slp_facilities_cache';
        
        $wpdb->replace(
            $table,
            [
                'facility_id' => $facilityId,
                'data' => json_encode($data),
            ],
            ['%s', '%s']
        );
    }

    public function getCachedData($facilityId)
    {
        global $wpdb;
        
        $table = $wpdb->prefix . 'slp_facilities_cache';
        $cacheDuration = get_option('slp_cache_duration', 3600);
        
        $result = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table 
             WHERE facility_id = %s 
             AND updated_at > DATE_SUB(NOW(), INTERVAL %d SECOND)",
            $facilityId,
            $cacheDuration
        ));

        if ($result) {
            return json_decode($result->data, true);
        }

        return null;
    }
}