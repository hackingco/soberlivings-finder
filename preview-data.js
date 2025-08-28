#!/usr/bin/env node

/**
 * Data Preview Script - Shows extracted facility data without database
 * Run with: node preview-data.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 SoberLivings Data Preview (No Database Required)');
console.log('=====================================================\n');

// Check data files
const csvPath = path.join('..', 'data', 'residential_facilities.csv');
const jsonPath = path.join('..', 'data', 'residential_facilities.json');

let totalRecords = 0;
let csvRecords = 0;
let jsonRecords = 0;

// Check CSV file
if (fs.existsSync(csvPath)) {
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  csvRecords = csvContent.split('\n').length - 1; // Subtract header
  console.log(`📄 CSV File: ${csvRecords} records found`);
} else {
  console.log('❌ CSV file not found');
}

// Check JSON file
if (fs.existsSync(jsonPath)) {
  try {
    const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
    const jsonData = JSON.parse(jsonContent);
    jsonRecords = jsonData.length;
    console.log(`📄 JSON File: ${jsonRecords} records found`);
    
    // Show sample data
    if (jsonData.length > 0) {
      console.log('\n📋 Sample Facility Data:');
      console.log('========================');
      
      const sample = jsonData[0];
      console.log(`Name: ${sample.name}`);
      console.log(`City: ${sample.city}, ${sample.state}`);
      console.log(`Phone: ${sample.phone || 'N/A'}`);
      console.log(`Website: ${sample.website || 'N/A'}`);
      
      if (sample.residential_services) {
        console.log(`Services: ${sample.residential_services.substring(0, 100)}...`);
      }
      
      if (sample.latitude && sample.longitude) {
        console.log(`Location: ${sample.latitude}, ${sample.longitude}`);
      }
    }
    
    // Show statistics
    console.log('\n📊 Data Statistics:');
    console.log('==================');
    
    const withPhone = jsonData.filter(f => f.phone).length;
    const withWebsite = jsonData.filter(f => f.website).length;
    const withCoordinates = jsonData.filter(f => f.latitude && f.longitude).length;
    const withServices = jsonData.filter(f => f.residential_services || f.all_services).length;
    
    console.log(`Records with phone: ${withPhone} (${Math.round(withPhone/jsonRecords*100)}%)`);
    console.log(`Records with website: ${withWebsite} (${Math.round(withWebsite/jsonRecords*100)}%)`);
    console.log(`Records with coordinates: ${withCoordinates} (${Math.round(withCoordinates/jsonRecords*100)}%)`);
    console.log(`Records with services: ${withServices} (${Math.round(withServices/jsonRecords*100)}%)`);
    
    // State distribution
    const stateCount = {};
    jsonData.forEach(f => {
      stateCount[f.state] = (stateCount[f.state] || 0) + 1;
    });
    
    console.log('\n🗺️ Top States by Facility Count:');
    console.log('=================================');
    Object.entries(stateCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([state, count]) => {
        console.log(`${state}: ${count} facilities`);
      });
      
  } catch (error) {
    console.log(`❌ Error reading JSON file: ${error.message}`);
  }
} else {
  console.log('❌ JSON file not found');
}

totalRecords = Math.max(csvRecords, jsonRecords);

console.log(`\n✅ Total Records Available: ${totalRecords}`);
console.log('\n💡 To load this data into your database:');
console.log('1. Set up Supabase database (see DEPLOYMENT_GUIDE.md)');
console.log('2. Update .env.local with database credentials');
console.log('3. Run: npm run seed data-files');

console.log('\n🚀 Your Vercel deployment: https://soberlivings-finder-5xjz2g3ms-hackingco.vercel.app');
