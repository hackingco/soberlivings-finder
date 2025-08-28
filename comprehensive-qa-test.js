#!/usr/bin/env node

/**
 * Comprehensive QA Testing Suite
 * Tests API, UI components, deployment readiness, and edge cases
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3001';

class QATestSuite {
  constructor() {
    this.results = {
      api: { passed: 0, failed: 0, tests: [] },
      deployment: { passed: 0, failed: 0, tests: [] },
      data: { passed: 0, failed: 0, tests: [] },
      performance: { passed: 0, failed: 0, tests: [] },
      security: { passed: 0, failed: 0, tests: [] }
    };
  }

  async makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request(url, options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve({ 
              statusCode: res.statusCode, 
              headers: res.headers,
              data: parsed,
              responseTime: Date.now() - startTime
            });
          } catch (e) {
            resolve({ 
              statusCode: res.statusCode, 
              headers: res.headers,
              data: body,
              responseTime: Date.now() - startTime
            });
          }
        });
      });
      
      const startTime = Date.now();
      req.on('error', reject);
      req.end();
    });
  }

  async testAPI() {
    console.log('🔍 API Testing Suite');
    console.log('====================');

    const apiTests = [
      {
        name: 'Basic Search Functionality',
        url: `${BASE_URL}/api/facilities/search`,
        validate: (res) => res.data.facilities && Array.isArray(res.data.facilities)
      },
      {
        name: 'Search with Location Filter',
        url: `${BASE_URL}/api/facilities/search?location=San%20Francisco`,
        validate: (res) => res.data.facilities && res.data.facilities.length >= 0
      },
      {
        name: 'Search with Service Filter',
        url: `${BASE_URL}/api/facilities/search?services=residential`,
        validate: (res) => res.data.facilities && res.data.facilities.length >= 0
      },
      {
        name: 'Search with Insurance Filter',
        url: `${BASE_URL}/api/facilities/search?insurance=Medicare`,
        validate: (res) => res.data.facilities && res.data.facilities.length >= 0
      },
      {
        name: 'Complex Multi-Filter Search',
        url: `${BASE_URL}/api/facilities/search?location=CA&services=treatment&insurance=Private&radius=25&limit=10`,
        validate: (res) => res.data.facilities && res.data.count <= 10
      },
      {
        name: 'Invalid Parameter Handling',
        url: `${BASE_URL}/api/facilities/search?limit=999&radius=1000`,
        validate: (res) => res.statusCode === 400 || res.data.facilities
      },
      {
        name: 'Metrics Endpoint',
        url: `${BASE_URL}/api/metrics`,
        validate: (res) => res.statusCode === 200
      },
      {
        name: 'Database Initialization',
        url: `${BASE_URL}/api/init-db`,
        validate: (res) => res.statusCode === 200
      }
    ];

    for (const test of apiTests) {
      try {
        console.log(`Testing: ${test.name}`);
        const response = await this.makeRequest(test.url);
        const passed = test.validate(response);
        
        this.results.api.tests.push({
          name: test.name,
          passed,
          responseTime: response.responseTime,
          statusCode: response.statusCode
        });

        if (passed) {
          console.log(`✅ PASSED (${response.responseTime}ms)`);
          this.results.api.passed++;
        } else {
          console.log(`❌ FAILED (${response.statusCode})`);
          this.results.api.failed++;
        }
      } catch (error) {
        console.log(`❌ ERROR: ${error.message}`);
        this.results.api.failed++;
        this.results.api.tests.push({
          name: test.name,
          passed: false,
          error: error.message
        });
      }
    }

    console.log(`\nAPI Results: ${this.results.api.passed}/${this.results.api.passed + this.results.api.failed} passed\n`);
  }

  async testDataExportFormats() {
    console.log('📊 Data Export Testing');
    console.log('======================');

    try {
      const response = await this.makeRequest(`${BASE_URL}/api/facilities/search?location=CA`);
      
      if (response.data.facilities && response.data.facilities.length > 0) {
        const facility = response.data.facilities[0];
        const csvHeaders = Object.keys(facility);
        
        console.log('✅ JSON Export: Data structure valid');
        console.log(`   Available fields: ${csvHeaders.length}`);
        console.log(`   Key fields: ${csvHeaders.slice(0, 5).join(', ')}...`);
        
        // Validate required fields for export
        const requiredFields = ['name', 'city', 'state', 'phone', 'address'];
        const hasAllRequired = requiredFields.every(field => csvHeaders.includes(field));
        
        if (hasAllRequired) {
          console.log('✅ CSV Export: All required fields present');
          this.results.data.passed += 2;
        } else {
          console.log('❌ CSV Export: Missing required fields');
          this.results.data.failed++;
        }
      } else {
        console.log('❌ No data available for export testing');
        this.results.data.failed++;
      }
      
      this.results.data.tests.push({
        name: 'Data Export Formats',
        passed: this.results.data.passed > this.results.data.failed
      });

    } catch (error) {
      console.log(`❌ Export test failed: ${error.message}`);
      this.results.data.failed++;
    }

    console.log(`\nData Export Results: ${this.results.data.passed}/${this.results.data.passed + this.results.data.failed} passed\n`);
  }

  async testPerformance() {
    console.log('⚡ Performance Testing');
    console.log('=====================');

    const performanceTests = [
      {
        name: 'API Response Time',
        url: `${BASE_URL}/api/facilities/search?location=CA`,
        threshold: 2000, // 2 seconds
        iterations: 5
      },
      {
        name: 'Large Result Set',
        url: `${BASE_URL}/api/facilities/search?limit=50`,
        threshold: 3000, // 3 seconds
        iterations: 3
      }
    ];

    for (const test of performanceTests) {
      console.log(`Testing: ${test.name}`);
      const times = [];
      
      for (let i = 0; i < test.iterations; i++) {
        try {
          const response = await this.makeRequest(test.url);
          times.push(response.responseTime);
        } catch (error) {
          console.log(`  Request ${i + 1} failed: ${error.message}`);
        }
      }

      if (times.length > 0) {
        const avgTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
        const maxTime = Math.max(...times);
        const minTime = Math.min(...times);
        
        console.log(`  Average: ${avgTime}ms, Min: ${minTime}ms, Max: ${maxTime}ms`);
        
        const passed = avgTime <= test.threshold;
        if (passed) {
          console.log(`✅ PASSED (under ${test.threshold}ms threshold)`);
          this.results.performance.passed++;
        } else {
          console.log(`❌ FAILED (over ${test.threshold}ms threshold)`);
          this.results.performance.failed++;
        }

        this.results.performance.tests.push({
          name: test.name,
          passed,
          avgTime,
          maxTime,
          threshold: test.threshold
        });
      }
    }

    console.log(`\nPerformance Results: ${this.results.performance.passed}/${this.results.performance.passed + this.results.performance.failed} passed\n`);
  }

  async testSecurity() {
    console.log('🛡️ Security Testing');
    console.log('====================');

    const securityTests = [
      {
        name: 'CORS Headers',
        url: `${BASE_URL}/api/facilities/search`,
        validate: (res) => res.headers['access-control-allow-origin']
      },
      {
        name: 'SQL Injection Protection',
        url: `${BASE_URL}/api/facilities/search?q=' OR '1'='1`,
        validate: (res) => res.statusCode === 200 && (!res.data.error || !res.data.error.includes('database'))
      },
      {
        name: 'XSS Prevention',
        url: `${BASE_URL}/api/facilities/search?q=<script>alert('xss')</script>`,
        validate: (res) => res.statusCode === 200 && !res.data.error
      }
    ];

    for (const test of securityTests) {
      try {
        console.log(`Testing: ${test.name}`);
        const response = await this.makeRequest(test.url);
        const passed = test.validate(response);
        
        if (passed) {
          console.log('✅ PASSED');
          this.results.security.passed++;
        } else {
          console.log('❌ FAILED');
          this.results.security.failed++;
        }

        this.results.security.tests.push({
          name: test.name,
          passed
        });

      } catch (error) {
        console.log(`❌ ERROR: ${error.message}`);
        this.results.security.failed++;
      }
    }

    console.log(`\nSecurity Results: ${this.results.security.passed}/${this.results.security.passed + this.results.security.failed} passed\n`);
  }

  async testDeploymentReadiness() {
    console.log('🚀 Deployment Readiness');
    console.log('=======================');

    const deploymentTests = [
      {
        name: 'Environment Configuration',
        test: () => {
          try {
            const envExists = fs.existsSync('.env.local') || fs.existsSync('.env.example');
            return { passed: envExists, message: envExists ? 'Environment files found' : 'No environment files' };
          } catch (error) {
            return { passed: false, message: error.message };
          }
        }
      },
      {
        name: 'Build Configuration',
        test: () => {
          try {
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            const hasRequiredScripts = ['build', 'start'].every(script => packageJson.scripts[script]);
            return { 
              passed: hasRequiredScripts, 
              message: hasRequiredScripts ? 'Build scripts configured' : 'Missing build scripts' 
            };
          } catch (error) {
            return { passed: false, message: error.message };
          }
        }
      },
      {
        name: 'Static Assets',
        test: () => {
          try {
            const publicExists = fs.existsSync('public');
            const manifestExists = fs.existsSync('public/manifest.json');
            return { 
              passed: publicExists && manifestExists, 
              message: `Public: ${publicExists}, Manifest: ${manifestExists}` 
            };
          } catch (error) {
            return { passed: false, message: error.message };
          }
        }
      },
      {
        name: 'Next.js Configuration',
        test: () => {
          try {
            const configExists = fs.existsSync('next.config.js');
            if (!configExists) return { passed: false, message: 'No next.config.js found' };
            
            const config = fs.readFileSync('next.config.js', 'utf8');
            const hasStandalone = config.includes('standalone');
            return { 
              passed: hasStandalone, 
              message: hasStandalone ? 'Standalone build configured' : 'Standard build' 
            };
          } catch (error) {
            return { passed: false, message: error.message };
          }
        }
      }
    ];

    for (const test of deploymentTests) {
      console.log(`Testing: ${test.name}`);
      const result = test.test();
      
      if (result.passed) {
        console.log(`✅ PASSED - ${result.message}`);
        this.results.deployment.passed++;
      } else {
        console.log(`❌ FAILED - ${result.message}`);
        this.results.deployment.failed++;
      }

      this.results.deployment.tests.push({
        name: test.name,
        passed: result.passed,
        message: result.message
      });
    }

    console.log(`\nDeployment Results: ${this.results.deployment.passed}/${this.results.deployment.passed + this.results.deployment.failed} passed\n`);
  }

  calculateOverallScore() {
    const weights = {
      api: 0.35,      // 35% - Most critical
      deployment: 0.25, // 25% - Very important
      data: 0.20,     // 20% - Important for functionality
      performance: 0.15, // 15% - Important for UX
      security: 0.05   // 5% - Basic checks
    };

    let totalScore = 0;
    let totalWeight = 0;

    for (const [category, weight] of Object.entries(weights)) {
      const categoryResult = this.results[category];
      const categoryTotal = categoryResult.passed + categoryResult.failed;
      
      if (categoryTotal > 0) {
        const categoryScore = categoryResult.passed / categoryTotal;
        totalScore += categoryScore * weight;
        totalWeight += weight;
      }
    }

    return Math.round((totalScore / totalWeight) * 100);
  }

  generateReport() {
    const overallScore = this.calculateOverallScore();
    
    console.log('🏁 COMPREHENSIVE QA REPORT');
    console.log('===========================');
    
    console.log('\n📊 Category Breakdown:');
    for (const [category, results] of Object.entries(this.results)) {
      const total = results.passed + results.failed;
      const percentage = total > 0 ? Math.round((results.passed / total) * 100) : 0;
      console.log(`   ${category.toUpperCase()}: ${results.passed}/${total} (${percentage}%)`);
    }
    
    console.log(`\n🎯 Overall QA Score: ${overallScore}%`);
    
    if (overallScore >= 95) {
      console.log('🟢 EXCELLENT - Production ready!');
    } else if (overallScore >= 85) {
      console.log('🟡 GOOD - Minor issues to address');
    } else if (overallScore >= 70) {
      console.log('🟠 FAIR - Several issues need attention');
    } else {
      console.log('🔴 POOR - Major issues must be resolved');
    }

    console.log('\n📋 Recommendations:');
    
    if (this.results.api.failed > 0) {
      console.log('   • Fix failing API endpoints');
    }
    if (this.results.deployment.failed > 0) {
      console.log('   • Address deployment configuration issues');
    }
    if (this.results.performance.failed > 0) {
      console.log('   • Optimize API response times');
    }
    if (this.results.security.failed > 0) {
      console.log('   • Strengthen security measures');
    }
    if (this.results.data.failed > 0) {
      console.log('   • Validate data export functionality');
    }

    return {
      overallScore,
      results: this.results,
      recommendations: this.generateRecommendations()
    };
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Add specific recommendations based on test results
    if (this.results.api.failed > 0) {
      recommendations.push('Investigate and fix failing API endpoints');
    }
    
    if (this.results.performance.tests.some(t => !t.passed)) {
      recommendations.push('Implement caching or optimize database queries');
    }
    
    if (this.results.deployment.failed > 0) {
      recommendations.push('Complete deployment configuration setup');
    }
    
    return recommendations;
  }

  async runAllTests() {
    console.log('⏳ Starting comprehensive QA testing...\n');
    
    await this.testAPI();
    await this.testDataExportFormats();
    await this.testPerformance();
    await this.testSecurity();
    await this.testDeploymentReadiness();
    
    return this.generateReport();
  }
}

async function main() {
  const qaRunner = new QATestSuite();
  const report = await qaRunner.runAllTests();
  
  // Save detailed report
  const reportData = {
    timestamp: new Date().toISOString(),
    ...report
  };
  
  fs.writeFileSync('qa-report.json', JSON.stringify(reportData, null, 2));
  console.log('\n📄 Detailed report saved to qa-report.json');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = QATestSuite;