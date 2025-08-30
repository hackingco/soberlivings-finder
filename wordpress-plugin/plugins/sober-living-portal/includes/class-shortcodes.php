<?php

namespace SLP;

class Shortcodes
{
    public function facilitySearch($atts)
    {
        $atts = shortcode_atts([
            'city' => '',
            'state' => '',
            'limit' => 10,
            'class' => 'slp-facility-search',
        ], $atts);

        ob_start();
        ?>
        <div class="<?php echo esc_attr($atts['class']); ?>">
            <form method="get" action="" class="slp-search-form">
                <div class="slp-search-row">
                    <input type="text" name="slp_city" placeholder="City" value="<?php echo esc_attr($atts['city']); ?>" />
                    <input type="text" name="slp_state" placeholder="State" value="<?php echo esc_attr($atts['state']); ?>" />
                    <button type="submit"><?php _e('Search Facilities', 'sober-living-portal'); ?></button>
                </div>
            </form>
            
            <div class="slp-results" data-limit="<?php echo esc_attr($atts['limit']); ?>">
                <?php $this->displayResults($atts); ?>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    public function facilityList($atts)
    {
        $atts = shortcode_atts([
            'limit' => 10,
            'orderby' => 'name',
            'order' => 'ASC',
            'featured' => false,
            'class' => 'slp-facility-list',
        ], $atts);

        $args = [
            'post_type' => 'slp_facility',
            'posts_per_page' => $atts['limit'],
            'orderby' => $atts['orderby'] === 'name' ? 'title' : 'meta_value',
            'order' => $atts['order'],
        ];

        if ($atts['featured']) {
            $args['meta_key'] = 'featured';
            $args['meta_value'] = '1';
        }

        $query = new \WP_Query($args);

        ob_start();
        ?>
        <div class="<?php echo esc_attr($atts['class']); ?>">
            <?php if ($query->have_posts()) : ?>
                <div class="slp-facilities-grid">
                    <?php while ($query->have_posts()) : $query->the_post(); ?>
                        <?php $this->renderFacilityCard(get_the_ID()); ?>
                    <?php endwhile; ?>
                </div>
            <?php else : ?>
                <p><?php _e('No facilities found.', 'sober-living-portal'); ?></p>
            <?php endif; ?>
            <?php wp_reset_postdata(); ?>
        </div>
        <?php
        return ob_get_clean();
    }

    private function displayResults($atts)
    {
        // Check for search parameters
        $city = $_GET['slp_city'] ?? $atts['city'];
        $state = $_GET['slp_state'] ?? $atts['state'];

        if (empty($city) && empty($state)) {
            return;
        }

        $apiClient = new ApiClient();
        $results = $apiClient->searchFacilities('', $city . ', ' . $state);

        if (!empty($results['data'])) {
            echo '<div class="slp-facilities-grid">';
            foreach (array_slice($results['data'], 0, $atts['limit']) as $facility) {
                $this->renderApiCard($facility);
            }
            echo '</div>';
        } else {
            echo '<p>' . __('No facilities found matching your search.', 'sober-living-portal') . '</p>';
        }
    }

    private function renderFacilityCard($postId)
    {
        $title = get_the_title($postId);
        $city = get_post_meta($postId, 'city', true);
        $state = get_post_meta($postId, 'state', true);
        $phone = get_post_meta($postId, 'phone', true);
        $beds = get_post_meta($postId, 'beds_available', true);
        ?>
        <div class="slp-facility-card">
            <h3><?php echo esc_html($title); ?></h3>
            <p class="slp-location"><?php echo esc_html($city . ', ' . $state); ?></p>
            <?php if ($phone) : ?>
                <p class="slp-phone">
                    <a href="tel:<?php echo esc_attr($phone); ?>"><?php echo esc_html($phone); ?></a>
                </p>
            <?php endif; ?>
            <?php if ($beds) : ?>
                <p class="slp-beds"><?php echo sprintf(__('%d beds available', 'sober-living-portal'), $beds); ?></p>
            <?php endif; ?>
            <a href="<?php the_permalink(); ?>" class="slp-btn">
                <?php _e('View Details', 'sober-living-portal'); ?>
            </a>
        </div>
        <?php
    }

    private function renderApiCard($facility)
    {
        ?>
        <div class="slp-facility-card">
            <h3><?php echo esc_html($facility['name']); ?></h3>
            <p class="slp-location">
                <?php echo esc_html($facility['city'] . ', ' . $facility['state']); ?>
            </p>
            <?php if (!empty($facility['phone'])) : ?>
                <p class="slp-phone">
                    <a href="tel:<?php echo esc_attr($facility['phone']); ?>">
                        <?php echo esc_html($facility['phone']); ?>
                    </a>
                </p>
            <?php endif; ?>
            <button class="slp-btn slp-contact" data-facility-id="<?php echo esc_attr($facility['id']); ?>">
                <?php _e('Contact Facility', 'sober-living-portal'); ?>
            </button>
        </div>
        <?php
    }
}