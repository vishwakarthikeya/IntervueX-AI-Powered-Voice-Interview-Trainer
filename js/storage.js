/**
 * Enhanced Storage Service
 * Handles localStorage operations with interview history and evaluations
 */

export class StorageService {
    constructor() {
        this.storageKey = 'interview_trainer_history_v2';
        this.maxHistoryItems = 50;
    }

    initialize() {
        if (!localStorage.getItem(this.storageKey)) {
            localStorage.setItem(this.storageKey, JSON.stringify([]));
        }
        this.migrateOldData();
    }

    migrateOldData() {
        try {
            const oldData = localStorage.getItem('interview_trainer_history');
            if (oldData) {
                const oldHistory = JSON.parse(oldData);
                if (oldHistory.length > 0) {
                    const newHistory = oldHistory.map(item => ({
                        id: item.id || this.generateId(),
                        timestamp: item.savedAt || item.date || Date.now(),
                        mode: item.mode || 'custom',
                        modeDisplayName: item.modeDisplayName || 'Interview',
                        jobTitle: item.jobTitle || item.role || 'Unknown',
                        difficulty: item.difficulty || 'medium',
                        duration: item.duration || 5,
                        conversationHistory: item.conversationHistory || [],
                        evaluations: item.evaluations || [],
                        analysis: item.analysis || {
                            overallScore: item.score || 0,
                            strengths: item.strengths || [],
                            areasForImprovement: item.weaknesses || []
                        },
                        overallScore: item.overallScore || item.score || 0,
                        technicalAverage: item.technicalAverage || 0,
                        communicationAverage: item.communicationAverage || 0,
                        confidenceAverage: item.confidenceAverage || 0
                    }));
                    
                    const current = this.getHistory();
                    const merged = [...newHistory, ...current].slice(0, this.maxHistoryItems);
                    localStorage.setItem(this.storageKey, JSON.stringify(merged));
                }
            }
        } catch (error) {
            console.error('Migration failed:', error);
        }
    }

    saveInterview(interviewData) {
        try {
            let history = this.getHistory();
            
            const newInterview = {
                ...interviewData,
                id: interviewData.id || this.generateId(),
                savedAt: new Date().toISOString()
            };
            
            history = history.filter(item => item.id !== newInterview.id);
            history.unshift(newInterview);
            
            if (history.length > this.maxHistoryItems) {
                history = history.slice(0, this.maxHistoryItems);
            }
            
            localStorage.setItem(this.storageKey, JSON.stringify(history));
            this.dispatchStorageEvent();
            
            return newInterview;
        } catch (error) {
            console.error('Failed to save interview:', error);
            return null;
        }
    }

    getHistory() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Failed to load history:', error);
            return [];
        }
    }

    getInterview(id) {
        const history = this.getHistory();
        return history.find(item => item.id === id) || null;
    }

    deleteInterview(id) {
        try {
            const history = this.getHistory();
            const filtered = history.filter(item => item.id !== id);
            localStorage.setItem(this.storageKey, JSON.stringify(filtered));
            this.dispatchStorageEvent();
            return true;
        } catch (error) {
            console.error('Failed to delete interview:', error);
            return false;
        }
    }

    clearHistory() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify([]));
            this.dispatchStorageEvent();
            return true;
        } catch (error) {
            console.error('Failed to clear history:', error);
            return false;
        }
    }

    getStats() {
        const history = this.getHistory();
        
        if (history.length === 0) {
            return {
                totalInterviews: 0,
                averageScore: 0,
                bestScore: 0,
                recentTrend: 0
            };
        }

        const scores = history.map(i => i.overallScore || 0);
        const totalInterviews = history.length;
        const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / totalInterviews);
        const bestScore = Math.max(...scores);
        
        const recentScores = scores.slice(0, 5);
        const previousScores = scores.slice(5, 10);
        
        let recentTrend = 0;
        if (previousScores.length > 0) {
            const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
            const previousAvg = previousScores.reduce((a, b) => a + b, 0) / previousScores.length;
            recentTrend = previousAvg > 0 ? Math.round(((recentAvg - previousAvg) / previousAvg) * 100) : 0;
        }

        return {
            totalInterviews,
            averageScore,
            bestScore,
            recentTrend
        };
    }

    getProgressData() {
        const history = this.getHistory();
        const recent = history.slice(0, 10).reverse();
        
        return {
            labels: recent.map((item) => {
                const date = new Date(item.timestamp || item.savedAt);
                return `${date.toLocaleDateString()}`;
            }),
            scores: recent.map(item => item.overallScore || 0)
        };
    }

    getSkillData() {
        const history = this.getHistory();
        
        if (history.length === 0) {
            return {
                technical: 0,
                communication: 0,
                problemSolving: 0,
                experience: 0,
                culture: 0
            };
        }

        const recent = history.slice(0, 5);
        const skills = recent.reduce((acc, curr) => {
            acc.technical += curr.technicalAverage || curr.overallScore || 0;
            acc.communication += curr.communicationAverage || curr.overallScore || 0;
            acc.problemSolving += curr.confidenceAverage || curr.overallScore || 0;
            acc.experience += curr.overallScore || 0;
            acc.culture += curr.overallScore || 0;
            return acc;
        }, { technical: 0, communication: 0, problemSolving: 0, experience: 0, culture: 0 });

        const count = recent.length || 1;
        Object.keys(skills).forEach(key => {
            skills[key] = Math.round(skills[key] / count);
        });

        return skills;
    }

    exportData() {
        const data = {
            history: this.getHistory(),
            exportDate: new Date().toISOString(),
            version: '2.0'
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `interview_history_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            if (data.history && Array.isArray(data.history)) {
                localStorage.setItem(this.storageKey, JSON.stringify(data.history));
                this.dispatchStorageEvent();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to import data:', error);
            return false;
        }
    }

    generateId() {
        return 'int_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    dispatchStorageEvent() {
        window.dispatchEvent(new CustomEvent('storage-update', {
            detail: { storageKey: this.storageKey }
        }));
    }
}