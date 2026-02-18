/**
 * UI Service
 * Handles common UI interactions and animations
 */

export class UIService {
    constructor() {
        this.toastTimeout = null;
    }

    switchPhase(fromPhase, toPhase) {
        const phases = ['setup', 'interview', 'evaluation'];
        
        phases.forEach(phase => {
            const element = document.getElementById(phase + 'Phase');
            if (element) {
                element.classList.remove('active');
            }
        });
        
        const newPhase = document.getElementById(toPhase + 'Phase');
        if (newPhase) {
            newPhase.classList.add('active');
        }
    }

    typeText(element, text, speed = 30) {
        if (!element) return;
        
        element.textContent = '';
        element.classList.add('typing-animation');
        
        let i = 0;
        const type = () => {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
                setTimeout(type, speed);
            } else {
                element.classList.remove('typing-animation');
            }
        };
        
        type();
    }

    showToast(message, type = 'info', duration = 3000) {
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#6366f1',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '50px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: '9999',
            fontSize: '14px',
            fontWeight: '500',
            animation: 'slideUp 0.3s ease'
        });
        
        document.body.appendChild(toast);
        
        if (this.toastTimeout) {
            clearTimeout(this.toastTimeout);
        }
        
        this.toastTimeout = setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    showLoading(container) {
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        spinner.innerHTML = `
            <div class="spinner"></div>
            <p>Loading...</p>
        `;
        
        container.innerHTML = '';
        container.appendChild(spinner);
    }

    hideLoading(container) {
        const spinner = container.querySelector('.loading-spinner');
        if (spinner) {
            spinner.remove();
        }
    }

    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    updateProgressBar(percent) {
        const progressFill = document.getElementById('progressFill');
        const progressPercent = document.getElementById('progressPercentage');
        
        if (progressFill) {
            progressFill.style.width = `${percent}%`;
        }
        
        if (progressPercent) {
            progressPercent.textContent = `${Math.round(percent)}%`;
        }
    }

    scrollToElement(element, offset = 0) {
        if (!element) return;
        
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;
        
        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    }

    async confirm(message) {
        return window.confirm(message);
    }

    static addAnimationStyles() {
        if (document.getElementById('ui-animation-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'ui-animation-styles';
        style.textContent = `
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translate(-50%, 20px);
                }
                to {
                    opacity: 1;
                    transform: translate(-50%, 0);
                }
            }
            
            @keyframes fadeOut {
                from {
                    opacity: 1;
                }
                to {
                    opacity: 0;
                }
            }
            
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
            
            .toast {
                animation: slideUp 0.3s ease;
            }
            
            .fade-out {
                animation: fadeOut 0.3s ease forwards;
            }
            
            .pulse {
                animation: pulse 2s infinite;
            }
        `;
        document.head.appendChild(style);
    }
}

UIService.addAnimationStyles();