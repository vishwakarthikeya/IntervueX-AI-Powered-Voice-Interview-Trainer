/**
 * Main Application Entry Point
 * Initializes the application and handles routing
 */

import { StorageService } from './storage.js';
import { UIService } from './ui.js';

class App {
    constructor() {
        this.storage = new StorageService();
        this.ui = new UIService();
        this.currentPage = this.getCurrentPage();
        
        this.init();
    }

    getCurrentPage() {
        const path = window.location.pathname;
        if (path.includes('interview.html')) return 'interview';
        if (path.includes('dashboard.html')) return 'dashboard';
        return 'index';
    }

    init() {
        console.log(`App initialized on ${this.currentPage} page`);
        
        // Initialize based on current page
        switch(this.currentPage) {
            case 'index':
                this.initLandingPage();
                break;
            case 'interview':
                this.initInterviewPage();
                break;
            case 'dashboard':
                this.initDashboardPage();
                break;
        }

        // Global event listeners
        this.initGlobalListeners();
    }

    initLandingPage() {
        const startBtn = document.getElementById('startInterviewBtn');
        const dashboardBtn = document.getElementById('dashboardBtn');

        if (startBtn) {
            startBtn.addEventListener('click', () => {
                window.location.href = 'interview.html';
            });
        }

        if (dashboardBtn) {
            dashboardBtn.addEventListener('click', () => {
                window.location.href = 'dashboard.html';
            });
        }
    }

    initInterviewPage() {
        // Interview page initialization is handled by interviewEngine.js
        // We just need to ensure the storage is ready
        this.storage.initialize();
    }

    initDashboardPage() {
        // Dashboard initialization is handled by dashboard.js
        this.storage.initialize();
    }

    initGlobalListeners() {
        // Handle exit button on interview page
        const exitBtn = document.getElementById('exitInterviewBtn');
        if (exitBtn) {
            exitBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to exit? Your progress will be lost.')) {
                    window.location.href = 'index.html';
                }
            });
        }

        // Handle browser back/forward navigation
        window.addEventListener('popstate', () => {
            location.reload();
        });
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});

// Error handling
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    // Show user-friendly error message
    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-toast';
    errorMessage.textContent = 'Something went wrong. Please refresh the page.';
    document.body.appendChild(errorMessage);
    
    setTimeout(() => {
        errorMessage.remove();
    }, 5000);
});