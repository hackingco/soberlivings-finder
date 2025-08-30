<?php

namespace SLP;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;

class ApiClient
{
    private $client;
    private $apiBase;
    private $apiKey;

    public function __construct()
    {
        $this->apiBase = get_option('slp_api_endpoint', SLP_API_BASE);
        $this->apiKey = get_option('slp_api_key', SLP_API_KEY);
        
        $this->client = new Client([
            'base_uri' => $this->apiBase,
            'timeout' => 30,
            'headers' => [
                'Authorization' => 'Bearer ' . $this->apiKey,
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
            ],
        ]);
    }

    public function getFacilities($params = [])
    {
        try {
            $response = $this->client->get('/v1/facilities', [
                'query' => $params,
            ]);

            return json_decode($response->getBody(), true);
        } catch (GuzzleException $e) {
            error_log('SLP API Error: ' . $e->getMessage());
            return ['error' => $e->getMessage()];
        }
    }

    public function getFacility($id)
    {
        try {
            $response = $this->client->get('/v1/facilities/' . $id);
            return json_decode($response->getBody(), true);
        } catch (GuzzleException $e) {
            error_log('SLP API Error: ' . $e->getMessage());
            return null;
        }
    }

    public function searchFacilities($query, $location = null)
    {
        $params = ['q' => $query];
        
        if ($location) {
            $params['location'] = $location;
        }

        return $this->getFacilities($params);
    }

    public function submitLead($facilityId, $leadData)
    {
        try {
            $response = $this->client->post('/v1/facilities/' . $facilityId . '/leads', [
                'json' => $leadData,
            ]);

            return json_decode($response->getBody(), true);
        } catch (GuzzleException $e) {
            error_log('SLP API Error: ' . $e->getMessage());
            return ['error' => $e->getMessage()];
        }
    }
}