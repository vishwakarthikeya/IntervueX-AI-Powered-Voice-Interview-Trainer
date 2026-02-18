/**
 * Enhanced Dashboard Controller
 * Manages dashboard with detailed interview analysis
 */

import { StorageService } from './storage.js';
import { UIService } from './ui.js';

class DashboardController {
    constructor() {
        this.storage = new StorageService();
        this.ui = new UIService();
        this.charts = {};
        this.currentFilter = 'all';
        
        this.init();
    }

    init() {
        this.storage.initialize();
        
        // Get highlight ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        this.highlightId = urlParams.get('highlight');
        
        this.loadStats();
        this.loadHistory();
        this.initCharts();
        this.setupEventListeners();
        
        window.addEventListener('storage-update', () => {
            this.refreshDashboard();
        });
    }

    setupEventListeners() {
        const clearBtn = document.getElementById('clearHistoryBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.confirmClearHistory());
        }
        
        const exportBtn = document.getElementById('exportDataBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.storage.exportData());
        }
        
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.loadHistory();
            });
        });
        
        // Modal close
        const modal = document.getElementById('interviewModal');
        const closeBtn = modal?.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.remove('active');
            });
        }
        
        // Click outside to close
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    }

    loadStats() {
        const stats = this.storage.getStats();
        
        document.getElementById('totalInterviews').textContent = stats.totalInterviews;
        document.getElementById('avgScore').textContent = stats.averageScore + '%';
        document.getElementById('bestScore').textContent = stats.bestScore + '%';
        
        const improvementEl = document.getElementById('improvement');
        const trend = stats.recentTrend;
        improvementEl.textContent = (trend > 0 ? '+' : '') + trend + '%';
        improvementEl.style.color = trend >= 0 ? '#10b981' : '#ef4444';
    }

    loadHistory() {
        let history = this.storage.getHistory();
        const historyList = document.getElementById('historyList');
        
        if (!historyList) return;
        
        // Apply filter
        if (this.currentFilter !== 'all') {
            history = history.filter(item => item.mode === this.currentFilter);
        }
        
        if (history.length === 0) {
            historyList.innerHTML = `
                <div class="empty-state">
                    <p>No interviews yet. Start your first practice session!</p>
                    <a href="interview.html" class="btn-primary">Start Interview</a>
                </div>
            `;
            return;
        }

        historyList.innerHTML = history.map(item => this.renderHistoryCard(item)).join('');
        
        // Add click listeners
        document.querySelectorAll('.history-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.classList.contains('delete-btn') && !e.target.closest('.delete-btn')) {
                    this.showInterviewDetails(card.dataset.id);
                }
            });
        });
        
        // Add delete listeners
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.confirmDelete(id);
            });
        });
        
        // Highlight if needed
        if (this.highlightId) {
            setTimeout(() => {
                const card = document.querySelector(`.history-card[data-id="${this.highlightId}"]`);
                if (card) {
                    card.classList.add('highlight-card');
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // Remove highlight after animation
                    setTimeout(() => {
                        card.classList.remove('highlight-card');
                    }, 2000);
                    
                    // Auto-show details
                    this.showInterviewDetails(this.highlightId);
                    
                    // Clear from URL
                    window.history.replaceState({}, '', window.location.pathname);
                    this.highlightId = null;
                }
            }, 500);
        }
    }

    renderHistoryCard(item) {
        const date = new Date(item.timestamp || item.date || item.savedAt);
        const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        const role = item.jobTitle || this.formatRole(item.role);
        const score = item.overallScore || item.score || 0;
        const mode = item.mode || 'custom';
        const modeDisplay = item.modeDisplayName || this.getModeDisplayName(mode);
        
        // Determine card class based on mode
        let cardClass = 'history-card';
        if (mode === 'custom') cardClass += ' custom';
        else if (mode === 'practice') cardClass += ' practice';
        else if (mode === 'resume') cardClass += ' resume';
        
        return `
            <div class="${cardClass}" data-id="${item.id}">
                <div class="history-card-header">
                    <span class="history-date">${formattedDate}</span>
                    <span class="mode-badge">${modeDisplay}</span>
                </div>
                <div class="history-card-body">
                    <div class="history-info">
                        <h4>${role}</h4>
                        <p>${item.difficulty || 'medium'} · ${item.duration || 5} min</p>
                    </div>
                    <div class="history-score">${score}%</div>
                </div>
                <button class="delete-btn" data-id="${item.id}">Delete</button>
            </div>
        `;
    }

    getModeDisplayName(mode) {
        const modes = {
            'custom': 'Custom',
            'practice': 'Practice',
            'resume': 'Resume'
        };
        return modes[mode] || mode;
    }

    formatRole(role) {
        const roles = {
            'software-engineer': 'Software Engineer',
            'product-manager': 'Product Manager',
            'data-scientist': 'Data Scientist',
            'ux-designer': 'UX Designer',
            'devops-engineer': 'DevOps Engineer'
        };
        return roles[role] || role || 'Unknown Role';
    }

    initCharts() {
        this.initProgressChart();
        this.initRadarChart();
    }

    initProgressChart() {
        const ctx = document.getElementById('progressChart');
        if (!ctx) return;
        
        const data = this.storage.getProgressData();
        
        this.charts.progress = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Interview Score',
                    data: data.scores,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#6366f1',
                    pointBorderColor: '#fff',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => `Score: ${context.raw}%`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#9aa3af',
                            callback: (value) => value + '%'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#9aa3af',
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                }
            }
        });
    }

    initRadarChart() {
        const ctx = document.getElementById('radarChart');
        if (!ctx) return;
        
        const skills = this.storage.getSkillData();
        
        this.charts.radar = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['Technical', 'Communication', 'Problem Solving', 'Experience', 'Culture Fit'],
                datasets: [{
                    label: 'Skill Level',
                    data: [
                        skills.technical || 0,
                        skills.communication || 0,
                        skills.problemSolving || 0,
                        skills.experience || 0,
                        skills.culture || 0
                    ],
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    borderColor: '#6366f1',
                    pointBackgroundColor: '#6366f1',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#6366f1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        pointLabels: {
                            color: '#9aa3af'
                        },
                        ticks: {
                            color: '#9aa3af',
                            backdropColor: 'transparent',
                            callback: (value) => value + '%'
                        }
                    }
                }
            }
        });
    }

    refreshDashboard() {
        this.loadStats();
        this.loadHistory();
        
        // Update charts
        if (this.charts.progress) {
            const data = this.storage.getProgressData();
            this.charts.progress.data.labels = data.labels;
            this.charts.progress.data.datasets[0].data = data.scores;
            this.charts.progress.update();
        }
        
        if (this.charts.radar) {
            const skills = this.storage.getSkillData();
            this.charts.radar.data.datasets[0].data = [
                skills.technical || 0,
                skills.communication || 0,
                skills.problemSolving || 0,
                skills.experience || 0,
                skills.culture || 0
            ];
            this.charts.radar.update();
        }
    }

    confirmClearHistory() {
        if (confirm('Are you sure you want to clear all interview history? This cannot be undone.')) {
            this.storage.clearHistory();
            this.refreshDashboard();
        }
    }

    confirmDelete(id) {
        if (confirm('Delete this interview from history?')) {
            this.storage.deleteInterview(id);
            this.refreshDashboard();
        }
    }

    showInterviewDetails(id) {
        const interview = this.storage.getInterview(id);
        if (!interview) return;
        
        const modal = document.getElementById('interviewModal');
        const content = document.getElementById('modalContent');
        const title = document.getElementById('modalTitle');
        
        if (!modal || !content) return;
        
        title.textContent = `Interview Details - ${interview.jobTitle || 'Interview'}`;
        
        // Format date
        const date = new Date(interview.timestamp || interview.date || interview.savedAt);
        const formattedDate = date.toLocaleString();
        
        // Get analysis data
        const analysis = interview.analysis || {};
        const qaHistory = interview.conversationHistory || [];
        
        // Build HTML
        let html = `
            <div class="detail-score">
                <div class="score-value">${interview.overallScore || interview.score || 0}%</div>
                <div class="score-breakdown">
                    ${analysis.confidenceScore ? `<div class="score-item"><span class="label">Confidence</span><span class="value">${analysis.confidenceScore}%</span></div>` : ''}
                    ${analysis.communicationScore ? `<div class="score-item"><span class="label">Communication</span><span class="value">${analysis.communicationScore}%</span></div>` : ''}
                    ${analysis.technicalScore ? `<div class="score-item"><span class="label">Technical</span><span class="value">${analysis.technicalScore}%</span></div>` : ''}
                </div>
            </div>
            
            <div class="interview-meta" style="text-align: center; margin-bottom: 1.5rem; color: var(--text-secondary);">
                <span>${formattedDate}</span> · 
                <span>${interview.modeDisplayName || this.getModeDisplayName(interview.mode)}</span> · 
                <span>${interview.difficulty || 'medium'}</span> · 
                <span>${interview.duration || 5} minutes</span>
            </div>
        `;
        
        // Strengths & Weaknesses
        if (analysis.strengths || analysis.areasForImprovement) {
            html += `<div class="strengths-weaknesses">`;
            
            if (analysis.strengths && analysis.strengths.length > 0) {
                html += `
                    <div class="strengths-box">
                        <h4>✅ Strengths</h4>
                        <ul>
                            ${analysis.strengths.map(s => `<li>${s}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }
            
            if (analysis.areasForImprovement && analysis.areasForImprovement.length > 0) {
                html += `
                    <div class="weaknesses-box">
                        <h4>🔧 Areas for Improvement</h4>
                        <ul>
                            ${analysis.areasForImprovement.map(w => `<li>${w}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }
            
            html += `</div>`;
        }
        
        // Overall feedback
        if (analysis.overallFeedback) {
            html += `
                <div class="overall-feedback">
                    <h4>📝 Overall Feedback</h4>
                    <p>${analysis.overallFeedback}</p>
                </div>
            `;
        }
        
        // Question-by-question analysis
        if (analysis.questionAnalysis && analysis.questionAnalysis.length > 0) {
            html += `<div class="conversation-review"><h4>Question-by-Question Analysis</h4>`;
            
            analysis.questionAnalysis.forEach((qa, index) => {
                html += `
                    <div class="qa-item">
                        <div class="qa-question">Q${index + 1}: ${qa.question}</div>
                        <div class="qa-answer"><strong>Your Answer:</strong> ${qa.userAnswer || 'No answer'}</div>
                `;
                
                if (qa.idealAnswer) {
                    html += `<div class="qa-ideal"><strong>Ideal Answer:</strong> ${qa.idealAnswer}</div>`;
                }
                
                if (qa.mistakes && qa.mistakes.length > 0) {
                    html += `<div class="qa-mistakes"><strong>Mistakes:</strong> ${qa.mistakes.join(', ')}</div>`;
                }
                
                if (qa.suggestions && qa.suggestions.length > 0) {
                    html += `<div class="qa-suggestions"><strong>Suggestions:</strong> ${qa.suggestions.join(', ')}</div>`;
                }
                
                html += `<div style="margin-top: 0.5rem;"><strong>Score:</strong> ${qa.score || 0}%</div>`;
                html += `</div>`;
            });
            
            html += `</div>`;
        } 
        // Fallback to raw conversation history
        else if (qaHistory.length > 0) {
            html += `<div class="conversation-review"><h4>Conversation History</h4>`;
            
            qaHistory.forEach((qa, index) => {
                html += `
                    <div class="qa-item">
                        <div class="qa-question">Q${index + 1}: ${qa.question}</div>
                        <div class="qa-answer"><strong>Your Answer:</strong> ${qa.answer}</div>
                    </div>
                `;
            });
            
            html += `</div>`;
        }
        
        // Suggested resources
        if (analysis.suggestedResources && analysis.suggestedResources.length > 0) {
            html += `
                <div style="margin-top: 1.5rem;">
                    <h4>📚 Recommended Resources</h4>
                    <ul>
                        ${analysis.suggestedResources.map(r => `<li>${r}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        content.innerHTML = html;
        modal.classList.add('active');
    }
}

// Initialize dashboard
if (window.location.pathname.includes('dashboard.html')) {
    document.addEventListener('DOMContentLoaded', () => {
        window.dashboard = new DashboardController();
    });
}