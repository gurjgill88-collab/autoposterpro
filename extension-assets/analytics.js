// ============================================
// AUTOPOSTERPRO ANALYTICS MODULE
// Add this to your Chrome extension
// ============================================

const Analytics = {
  API_URL: 'https://autoposterpro.com/api/analytics',
  licenseKey: null,
  sessionStartTime: null,
  heartbeatInterval: null,
  
  // Initialize analytics with license key
  init(licenseKey) {
    this.licenseKey = licenseKey;
    this.startSession();
    
    // Send heartbeat every minute while extension is active
    this.heartbeatInterval = setInterval(() => {
      this.track('heartbeat');
    }, 60000); // Every 60 seconds
    
    // Track session end when extension closes
    window.addEventListener('beforeunload', () => {
      this.endSession();
    });
    
    console.log('📊 Analytics initialized');
  },
  
  // Start a new session
  startSession() {
    this.sessionStartTime = Date.now();
    this.track('session_start');
  },
  
  // End session and report duration
  endSession() {
    if (this.sessionStartTime) {
      const durationSeconds = Math.round((Date.now() - this.sessionStartTime) / 1000);
      this.track('session_end', { durationSeconds });
      this.sessionStartTime = null;
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  },
  
  // Track an event
  async track(event, data = {}) {
    if (!this.licenseKey) {
      console.warn('Analytics: No license key set');
      return;
    }
    
    try {
      await fetch(this.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey: this.licenseKey,
          event,
          data
        })
      });
    } catch (error) {
      // Silently fail - don't disrupt user experience
      console.warn('Analytics track error:', error);
    }
  },
  
  // Track a vehicle post
  trackPost(vehicleData, timeToPostSeconds) {
    this.track('post_created', {
      vin: vehicleData.vin,
      year: vehicleData.year,
      make: vehicleData.make,
      model: vehicleData.model,
      price: vehicleData.price,
      timeToPost: timeToPostSeconds
    });
  },
  
  // Track a scrape
  trackScrape(vehicleData) {
    this.track('scrape_completed', {
      vin: vehicleData?.vin,
      source: vehicleData?.source || window.location.hostname
    });
  },
  
  // Track AI description generation
  trackAiDescription() {
    this.track('ai_description_generated');
  },
  
  // Get user's analytics
  async getStats() {
    if (!this.licenseKey) return null;
    
    try {
      const response = await fetch(`${this.API_URL}?licenseKey=${this.licenseKey}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      return null;
    }
  }
};

// Export for use in extension
if (typeof module !== 'undefined') {
  module.exports = Analytics;
}


// ============================================
// USAGE EXAMPLES - Integrate into your extension
// ============================================

/*
// In your popup.js or background.js, after license validation:

// Initialize when license is activated
Analytics.init(licenseKey);

// When user scrapes a vehicle:
Analytics.trackScrape({
  vin: vehicleData.vin,
  source: 'dealersite.com'
});

// When AI generates a description:
Analytics.trackAiDescription();

// When user posts to Marketplace:
const startTime = Date.now();
// ... posting logic ...
const timeToPost = Math.round((Date.now() - startTime) / 1000);
Analytics.trackPost(vehicleData, timeToPost);

// To display stats in the popup:
const stats = await Analytics.getStats();
console.log('Posts today:', stats.today?.posts || 0);
console.log('Posts this week:', stats.thisWeek.posts);
console.log('Posts this month:', stats.thisMonth.posts);
*/
