/**
 * Intelligent Interview Engine
 * Manages dynamic interview flow with LLM-powered question generation and real-time evaluation
 */

import { VoiceService } from './voice.js';
import { AIService } from './aiService.js';
import { StorageService } from './storage.js';
import { UIService } from './ui.js';

export class InterviewEngine {
    constructor() {
        this.voice = new VoiceService();
        this.ai = new AIService();
        this.storage = new StorageService();
        this.ui = new UIService();
        
        this.synth = window.speechSynthesis;
        this.voiceEnabled = true;
        
        this.state = {
            mode: null,
            jobTitle: '',
            jobDescription: '',
            difficulty: 'medium',
            duration: 5,
            startTime: null,
            endTime: null,
            timeElapsed: 0,
            timerInterval: null,
            
            conversationHistory: [],
            evaluations: [],
            currentQuestion: null,
            currentAnswer: '',
            askedQuestions: new Set(),
            questionHashes: new Set(),
            
            resumeData: null,
            focusArea: '',
            
            status: 'setup',
            isRecording: false,
            followUpCount: 0,
            waitingForFollowUp: false,
            
            sessionId: null,
            modeDisplayName: '',
            
            pendingEvaluation: null
        };
        
        this.elements = {};
        
        this.init();
    }

    init() {
        this.cacheElements();
        this.setupEventListeners();
        this.initVoiceToggle();
        
        if (this.elements.interviewSession) {
            this.elements.interviewSession.style.display = 'none';
        }
    }

    cacheElements() {
        this.elements = {
            modeSelector: document.querySelector('.interview-mode-selector'),
            customForm: document.getElementById('custom-form'),
            practiceForm: document.getElementById('practice-form'),
            resumeForm: document.getElementById('resume-form'),
            
            interviewSession: document.getElementById('interview-session'),
            interviewType: document.getElementById('interview-type'),
            interviewRole: document.getElementById('interview-role'),
            timeRemaining: document.getElementById('time-remaining'),
            progressFill: document.querySelector('.interview-session .progress-fill'),
            aiState: document.getElementById('ai-state'),
            currentQuestion: document.getElementById('current-question'),
            questionNumber: document.getElementById('q-number'),
            answerInput: document.getElementById('answer-input'),
            submitAnswerBtn: document.getElementById('submit-answer-btn'),
            voiceAnswerBtn: document.getElementById('voice-answer-btn'),
            
            resumeDropZone: document.getElementById('resume-drop-zone'),
            resumeFile: document.getElementById('resume-file'),
            filePreview: document.querySelector('.file-preview'),
            fileName: document.querySelector('.file-name'),
            removeFileBtn: document.querySelector('.remove-file'),
            continueBtn: document.querySelector('.resume-card .continue-btn'),
            
            durationBtns: document.querySelectorAll('.duration-btn'),
            
            toggleHistory: document.querySelector('.toggle-history'),
            historyList: document.querySelector('.history-list'),
            
            evaluationFeedback: document.getElementById('evaluation-feedback'),
            feedbackContainer: document.querySelector('.feedback-container')
        };
    }

    setupEventListeners() {
        if (this.elements.customForm) {
            this.elements.customForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.startCustomInterview();
            });
        }
        
        if (this.elements.practiceForm) {
            this.elements.practiceForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.startPracticeInterview();
            });
        }
        
        if (this.elements.resumeForm) {
            this.elements.resumeForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.startResumeInterview();
            });
        }
        
        this.elements.durationBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const parent = e.target.closest('.duration-selector');
                parent.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
        
        if (this.elements.resumeDropZone) {
            this.elements.resumeDropZone.addEventListener('click', () => {
                this.elements.resumeFile.click();
            });
            
            this.elements.resumeDropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                this.elements.resumeDropZone.style.borderColor = '#6366f1';
            });
            
            this.elements.resumeDropZone.addEventListener('dragleave', () => {
                this.elements.resumeDropZone.style.borderColor = '';
            });
            
            this.elements.resumeDropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                this.elements.resumeDropZone.style.borderColor = '';
                
                const file = e.dataTransfer.files[0];
                if (file && (file.type === 'application/pdf' || file.type.includes('word'))) {
                    this.handleResumeFile(file);
                }
            });
            
            this.elements.resumeFile.addEventListener('change', (e) => {
                if (e.target.files[0]) {
                    this.handleResumeFile(e.target.files[0]);
                }
            });
        }
        
        if (this.elements.removeFileBtn) {
            this.elements.removeFileBtn.addEventListener('click', () => {
                this.resetResumeUpload();
            });
        }
        
        if (this.elements.submitAnswerBtn) {
            this.elements.submitAnswerBtn.addEventListener('click', () => this.submitAnswer());
        }
        
        if (this.elements.voiceAnswerBtn) {
            this.elements.voiceAnswerBtn.addEventListener('click', () => this.toggleVoiceRecording());
        }
        
        if (this.elements.toggleHistory) {
            this.elements.toggleHistory.addEventListener('click', () => {
                const isHidden = this.elements.historyList.style.display === 'none';
                this.elements.historyList.style.display = isHidden ? 'block' : 'none';
                this.elements.toggleHistory.textContent = isHidden ? 'Hide Previous Questions' : 'View Previous Questions';
            });
        }
        
        const voiceToggle = document.getElementById('voice-toggle');
        if (voiceToggle) {
            voiceToggle.addEventListener('click', () => this.toggleVoiceOutput());
        }
    }

    initVoiceToggle() {
        if (!document.getElementById('voice-toggle') && this.elements.voiceAnswerBtn) {
            const toggle = document.createElement('button');
            toggle.id = 'voice-toggle';
            toggle.className = 'btn-secondary voice-toggle';
            toggle.innerHTML = '🔊 Voice On';
            toggle.style.marginLeft = '10px';
            this.elements.voiceAnswerBtn.parentNode.insertBefore(toggle, this.elements.voiceAnswerBtn.nextSibling);
        }
    }

    toggleVoiceOutput() {
        this.voiceEnabled = !this.voiceEnabled;
        const toggle = document.getElementById('voice-toggle');
        if (toggle) {
            toggle.innerHTML = this.voiceEnabled ? '🔊 Voice On' : '🔈 Voice Off';
        }
        if (this.synth) {
            this.synth.cancel();
        }
    }

    speakText(text) {
        if (!this.voiceEnabled || !this.synth) return;
        
        this.synth.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;
        
        const voices = this.synth.getVoices();
        const preferredVoice = voices.find(v => v.name.includes('Google UK') || v.name.includes('Samantha'));
        if (preferredVoice) utterance.voice = preferredVoice;
        
        this.synth.speak(utterance);
    }

    async startCustomInterview() {
        const jobTitle = document.getElementById('job-title')?.value;
        const jobDescription = document.getElementById('job-description')?.value;
        const difficulty = document.getElementById('difficulty')?.value;
        const duration = document.querySelector('.custom-card .duration-btn.active')?.dataset.duration || 5;
        
        if (!jobTitle) {
            this.ui.showToast('Please enter a job title', 'error');
            return;
        }
        
        this.state.mode = 'custom';
        this.state.jobTitle = jobTitle;
        this.state.jobDescription = jobDescription;
        this.state.difficulty = difficulty;
        this.state.duration = parseInt(duration);
        this.state.modeDisplayName = 'Custom Interview';
        
        await this.initializeInterview();
    }

    async startPracticeInterview() {
        const role = document.getElementById('practice-role')?.value;
        const experience = document.getElementById('experience-level')?.value;
        const difficulty = document.getElementById('practice-difficulty')?.value;
        const duration = document.getElementById('practice-duration')?.value;
        
        if (!role) {
            this.ui.showToast('Please enter a role', 'error');
            return;
        }
        
        const difficultyMap = { '1': 'easy', '2': 'medium', '3': 'hard', '4': 'critical' };
        
        this.state.mode = 'practice';
        this.state.jobTitle = role;
        this.state.jobDescription = `Practice interview for ${role} with ${experience} level experience`;
        this.state.difficulty = difficultyMap[difficulty] || 'medium';
        this.state.duration = parseInt(duration);
        this.state.modeDisplayName = 'Practice Interview';
        
        await this.initializeInterview();
    }

    async startResumeInterview() {
        if (!this.state.resumeData) {
            this.ui.showToast('Please upload a resume first', 'error');
            return;
        }
        
        const focusArea = document.getElementById('focus-area')?.value;
        const duration = document.querySelector('.resume-card .duration-btn.active')?.dataset.duration || 10;
        
        this.state.mode = 'resume';
        this.state.jobTitle = this.state.resumeData.suggestedJobTitles?.[0] || 'Professional';
        this.state.focusArea = focusArea;
        this.state.duration = parseInt(duration);
        this.state.modeDisplayName = 'Resume-Based Interview';
        
        await this.initializeInterview();
    }

    async initializeInterview() {
        this.ui.showToast(`Starting ${this.state.modeDisplayName}...`, 'info');
        
        if (this.elements.modeSelector) {
            this.elements.modeSelector.style.display = 'none';
        }
        if (this.elements.interviewSession) {
            this.elements.interviewSession.style.display = 'block';
        }
        
        if (this.elements.interviewType) {
            this.elements.interviewType.textContent = this.state.modeDisplayName;
        }
        if (this.elements.interviewRole) {
            this.elements.interviewRole.textContent = this.state.jobTitle;
        }
        
        this.state.status = 'active';
        this.state.sessionId = this.generateSessionId();
        this.state.startTime = Date.now();
        this.state.endTime = this.state.startTime + (this.state.duration * 60 * 1000);
        this.state.conversationHistory = [];
        this.state.evaluations = [];
        this.state.askedQuestions.clear();
        this.state.questionHashes.clear();
        
        this.startTimer();
        
        await this.generateNextQuestion();
    }

    startTimer() {
        this.updateTimerDisplay();
        
        this.state.timerInterval = setInterval(() => {
            const now = Date.now();
            const remaining = Math.max(0, this.state.endTime - now);
            
            if (remaining <= 0) {
                this.endInterviewDueToTimeout();
                return;
            }
            
            this.state.timeElapsed = (this.state.duration * 60 * 1000 - remaining) / 1000;
            this.updateTimerDisplay();
        }, 100);
    }

    updateTimerDisplay() {
        const remaining = Math.max(0, this.state.endTime - Date.now());
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        
        if (this.elements.timeRemaining) {
            this.elements.timeRemaining.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            if (remaining < 30000 && remaining > 10000) {
                this.elements.timeRemaining.style.color = '#f59e0b';
            } else if (remaining <= 10000) {
                this.elements.timeRemaining.style.color = '#ef4444';
                this.elements.timeRemaining.style.animation = 'pulse 1s infinite';
            } else {
                this.elements.timeRemaining.style.color = '';
                this.elements.timeRemaining.style.animation = '';
            }
        }
        
        const total = this.state.duration * 60 * 1000;
        const elapsed = total - remaining;
        const percent = (elapsed / total) * 100;
        
        if (this.elements.progressFill) {
            this.elements.progressFill.style.width = `${percent}%`;
        }
    }

    async generateNextQuestion(isFollowUp = false) {
        this.updateAIState('thinking', 'AI is thinking...');
        
        const context = {
            jobTitle: this.state.jobTitle,
            jobDescription: this.state.jobDescription,
            difficulty: this.state.difficulty,
            duration: this.state.duration,
            elapsedMinutes: this.state.timeElapsed / 60,
            conversationHistory: this.state.conversationHistory,
            askedQuestions: Array.from(this.state.askedQuestions),
            mode: this.state.mode,
            resumeData: this.state.resumeData,
            lastAnswer: this.state.currentAnswer,
            lastQuestion: this.state.currentQuestion
        };
        
        try {
            let question;
            
            if (this.state.mode === 'resume' && this.state.resumeData && !isFollowUp) {
                const questions = await this.ai.generateResumeQuestions(
                    this.state.resumeData,
                    this.state.focusArea,
                    this.state.duration,
                    1,
                    Array.from(this.state.askedQuestions)
                );
                question = questions[0];
            } else {
                question = await this.ai.generateNextQuestion(context);
            }
            
            if (!question) {
                throw new Error('No question generated');
            }
            
            const questionHash = this.hashQuestion(question);
            if (this.state.questionHashes.has(questionHash)) {
                console.log('Duplicate hash detected, regenerating...');
                return this.generateNextQuestion(isFollowUp);
            }
            
            this.state.currentQuestion = question;
            this.state.askedQuestions.add(question.substring(0, 100));
            this.state.questionHashes.add(questionHash);
            this.state.waitingForFollowUp = false;
            
            this.displayQuestion(question);
            this.speakText(question);
            this.enableAnswerInput();
            
            if (this.elements.questionNumber) {
                const qNum = this.state.conversationHistory.length + 1;
                this.elements.questionNumber.textContent = qNum;
            }
            
        } catch (error) {
            console.error('Question generation failed:', error);
            const fallback = this.generateRoleSpecificFallback(this.state.jobTitle, this.state.difficulty);
            this.state.currentQuestion = fallback;
            this.displayQuestion(fallback);
            this.speakText(fallback);
            this.enableAnswerInput();
        }
    }

    generateRoleSpecificFallback(jobTitle, difficulty) {
        const roleLower = jobTitle.toLowerCase();
        
        if (roleLower.includes('python')) {
            const questions = [
                "Explain the difference between a list and a tuple in Python.",
                "How does Python's garbage collection work?",
                "What are decorators in Python and when would you use them?",
                "Explain Python's Global Interpreter Lock (GIL).",
                "What is the difference between deep and shallow copy in Python?"
            ];
            return questions[Math.floor(Math.random() * questions.length)];
        } else if (roleLower.includes('web')) {
            const questions = [
                "Explain the CSS box model and how it affects layout.",
                "What's the difference between localStorage and sessionStorage?",
                "How does the JavaScript event loop work?",
                "Explain responsive design and how you implement it.",
                "What are closures in JavaScript? Give an example."
            ];
            return questions[Math.floor(Math.random() * questions.length)];
        } else {
            return `Tell me about your experience with ${jobTitle}.`;
        }
    }

    hashQuestion(question) {
        return question.split(' ').slice(0, 10).join(' ').toLowerCase().replace(/[^a-z]/g, '');
    }

    displayQuestion(question) {
        if (!this.elements.currentQuestion) return;
        
        this.elements.currentQuestion.textContent = '';
        this.elements.currentQuestion.classList.add('typing-animation');
        
        let i = 0;
        const speed = 30;
        const type = () => {
            if (i < question.length) {
                this.elements.currentQuestion.textContent += question.charAt(i);
                i++;
                setTimeout(type, speed);
            } else {
                this.elements.currentQuestion.classList.remove('typing-animation');
                this.updateAIState('listening', 'Listening for your answer...');
            }
        };
        
        type();
    }

    enableAnswerInput() {
        if (this.elements.answerInput) {
            this.elements.answerInput.disabled = false;
            this.elements.answerInput.value = '';
            this.elements.answerInput.focus();
        }
        if (this.elements.submitAnswerBtn) {
            this.elements.submitAnswerBtn.disabled = false;
        }
        if (this.elements.voiceAnswerBtn) {
            this.elements.voiceAnswerBtn.disabled = false;
        }
        
        this.state.status = 'active';
        this.state.currentAnswer = '';
    }

    disableAnswerInput() {
        if (this.elements.answerInput) {
            this.elements.answerInput.disabled = true;
        }
        if (this.elements.submitAnswerBtn) {
            this.elements.submitAnswerBtn.disabled = true;
        }
        if (this.elements.voiceAnswerBtn) {
            this.elements.voiceAnswerBtn.disabled = true;
        }
    }

    updateAIState(state, message) {
        if (!this.elements.aiState) return;
        this.elements.aiState.textContent = message;
        
        const avatar = document.querySelector('.ai-avatar-container canvas');
        if (avatar) {
            avatar.dataset.state = state;
        }
    }

    async submitAnswer() {
        const answer = this.elements.answerInput?.value.trim();
        
        if (!answer) {
            this.ui.showToast('Please enter an answer', 'warning');
            return;
        }
        
        await this.processAnswer(answer);
    }

    toggleVoiceRecording() {
        if (this.state.isRecording) {
            this.voice.stopListening();
            this.state.isRecording = false;
            this.elements.voiceAnswerBtn.innerHTML = '<span class="mic-icon">🎤</span> Voice Answer';
            
            const transcript = this.voice.getCurrentTranscript();
            if (transcript && this.elements.answerInput) {
                this.elements.answerInput.value = transcript;
            }
        } else {
            this.voice.startListeningForQuestion(
                this.state.currentQuestion,
                (transcript) => {
                    if (this.elements.answerInput) {
                        this.elements.answerInput.value = transcript;
                    }
                },
                (error) => {
                    this.ui.showToast(`Voice error: ${error}`, 'error');
                }
            );
            
            this.state.isRecording = true;
            this.elements.voiceAnswerBtn.innerHTML = '<span class="mic-icon">⏹️</span> Stop Recording';
        }
    }

    async processAnswer(answer) {
        this.disableAnswerInput();
        this.updateAIState('processing', 'Analyzing your answer...');
        
        if (this.state.isRecording) {
            this.voice.stopListening();
            this.state.isRecording = false;
            if (this.elements.voiceAnswerBtn) {
                this.elements.voiceAnswerBtn.innerHTML = '<span class="mic-icon">🎤</span> Voice Answer';
            }
        }
        
        this.state.currentAnswer = answer;
        
        const qa = {
            question: this.state.currentQuestion,
            answer: answer,
            timestamp: Date.now(),
            followUp: this.state.followUpCount > 0
        };
        
        this.state.conversationHistory.push(qa);
        this.updateConversationHistory();
        
        this.showFeedbackContainer('Evaluating your answer...');
        
        try {
            const evaluation = await this.ai.evaluateAnswer(
                this.state.currentQuestion,
                answer,
                {
                    jobTitle: this.state.jobTitle,
                    difficulty: this.state.difficulty
                }
            );
            
            this.state.evaluations.push(evaluation);
            this.state.pendingEvaluation = evaluation;
            
            this.displayEvaluationFeedback(evaluation);
            
            if (this.state.followUpCount < 2 && evaluation.shouldFollowUp) {
                this.state.followUpCount++;
                this.state.waitingForFollowUp = true;
                
                setTimeout(() => {
                    this.hideFeedbackContainer();
                    
                    const followUpQuestion = evaluation.followUpTopic 
                        ? `Regarding ${evaluation.followUpTopic}: ${this.state.currentQuestion}`
                        : `Can you elaborate more on that?`;
                    
                    this.state.currentQuestion = followUpQuestion;
                    this.displayQuestion(followUpQuestion);
                    this.speakText(followUpQuestion);
                    this.enableAnswerInput();
                }, 4000);
                
                return;
            }
            
            this.state.followUpCount = 0;
            this.state.waitingForFollowUp = false;
            
            const now = Date.now();
            const timeRemaining = this.state.endTime - now;
            const questionCount = this.state.conversationHistory.length;
            
            if (timeRemaining <= 2000 || questionCount >= 15) {
                setTimeout(() => this.hideFeedbackContainer(), 3000);
                setTimeout(() => this.endInterview(), 4000);
            } else {
                setTimeout(() => {
                    this.hideFeedbackContainer();
                    this.generateNextQuestion();
                }, 4000);
            }
            
        } catch (error) {
            console.error('Answer evaluation failed:', error);
            
            const mockEvaluation = this.ai.generateMockEvaluation(this.state.currentQuestion, answer);
            this.state.evaluations.push(mockEvaluation);
            this.displayEvaluationFeedback(mockEvaluation);
            
            setTimeout(() => {
                this.hideFeedbackContainer();
                this.generateNextQuestion();
            }, 3000);
        }
    }

    showFeedbackContainer(message) {
        if (!this.elements.feedbackContainer) {
            const container = document.createElement('div');
            container.className = 'feedback-container glass-card';
            container.style.cssText = `
                margin: 1rem 0;
                padding: 1.5rem;
                border-radius: 1rem;
                background: rgba(20, 24, 28, 0.9);
                backdrop-filter: blur(10px);
                animation: slideInUp 0.3s ease;
            `;
            container.id = 'feedback-container';
            
            const questionContainer = this.elements.currentQuestion?.parentNode;
            if (questionContainer) {
                questionContainer.appendChild(container);
                this.elements.feedbackContainer = container;
            }
        }
        
        if (this.elements.feedbackContainer) {
            this.elements.feedbackContainer.innerHTML = `
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div class="spinner" style="width: 24px; height: 24px;"></div>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    hideFeedbackContainer() {
        if (this.elements.feedbackContainer) {
            this.elements.feedbackContainer.remove();
            this.elements.feedbackContainer = null;
        }
    }

    displayEvaluationFeedback(evaluation) {
        if (!this.elements.feedbackContainer) return;
        
        const techPercent = Math.round(evaluation.technicalScore * 10);
        const commPercent = Math.round(evaluation.communicationScore * 10);
        const confPercent = Math.round(evaluation.confidenceScore * 10);
        
        this.elements.feedbackContainer.innerHTML = `
            <h4 style="margin: 0 0 1rem 0; color: #6366f1;">Answer Analysis</h4>
            
            <div style="margin-bottom: 1rem;">
                <p style="margin: 0 0 0.5rem 0;"><strong>✅ Strengths:</strong> ${evaluation.strengths}</p>
                <p style="margin: 0 0 0.5rem 0;"><strong>🔧 Areas to Improve:</strong> ${evaluation.weaknesses}</p>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem;">
                <div style="text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: bold; color: ${this.getScoreColor(techPercent)}">${techPercent}%</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">Technical</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: bold; color: ${this.getScoreColor(commPercent)}">${commPercent}%</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">Communication</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 1.5rem; font-weight: bold; color: ${this.getScoreColor(confPercent)}">${confPercent}%</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">Confidence</div>
                </div>
            </div>
            
            <p style="margin: 0.5rem 0 0 0; padding: 0.75rem; background: rgba(99, 102, 241, 0.1); border-radius: 0.5rem;">
                <strong>📝 Feedback:</strong> ${evaluation.feedback}
            </p>
            
            ${evaluation.shouldFollowUp ? `
                <p style="margin: 0.5rem 0 0 0; color: #f59e0b; font-style: italic;">
                    ⚡ Following up for more detail...
                </p>
            ` : ''}
        `;
    }

    getScoreColor(score) {
        if (score >= 80) return '#10b981';
        if (score >= 60) return '#f59e0b';
        return '#ef4444';
    }

    updateConversationHistory() {
        if (!this.elements.historyList) return;
        
        const history = this.state.conversationHistory.slice(-5);
        
        this.elements.historyList.innerHTML = history.map((qa, i) => `
            <div class="history-item">
                <div class="history-question">Q: ${qa.question.substring(0, 60)}${qa.question.length > 60 ? '...' : ''}</div>
                <div class="history-answer">A: ${qa.answer.substring(0, 40)}${qa.answer.length > 40 ? '...' : ''}</div>
            </div>
        `).join('');
    }

    async endInterviewDueToTimeout() {
        clearInterval(this.state.timerInterval);
        this.updateAIState('complete', 'Time is up! Generating final analysis...');
        await this.endInterview();
    }

    async endInterview() {
        clearInterval(this.state.timerInterval);
        this.state.status = 'evaluating';
        
        this.updateAIState('analyzing', 'Generating your comprehensive analysis...');
        
        this.showFeedbackContainer('Analyzing your entire interview...');
        
        try {
            const analysis = await this.ai.generateAnalysis(
                this.state.conversationHistory,
                this.state.evaluations,
                {
                    jobTitle: this.state.jobTitle,
                    difficulty: this.state.difficulty,
                    duration: this.state.duration,
                    mode: this.state.mode
                }
            );
            
            this.saveInterviewResult(analysis);
            
            this.hideFeedbackContainer();
            
            setTimeout(() => {
                window.location.href = `dashboard.html?highlight=${this.state.sessionId}`;
            }, 2000);
            
        } catch (error) {
            console.error('Analysis failed:', error);
            
            const fallbackAnalysis = this.ai.generateMockAnalysis(
                this.state.conversationHistory,
                this.state.evaluations,
                {
                    jobTitle: this.state.jobTitle,
                    difficulty: this.state.difficulty
                }
            );
            
            this.saveInterviewResult(fallbackAnalysis);
            
            this.hideFeedbackContainer();
            
            setTimeout(() => {
                window.location.href = `dashboard.html?highlight=${this.state.sessionId}`;
            }, 2000);
        }
    }

    saveInterviewResult(analysis) {
        const technicalScores = this.state.evaluations.map(e => (e.technicalScore || 0) * 10);
        const communicationScores = this.state.evaluations.map(e => (e.communicationScore || 0) * 10);
        const confidenceScores = this.state.evaluations.map(e => (e.confidenceScore || 0) * 10);
        
        const avgTechnical = technicalScores.length 
            ? Math.round(technicalScores.reduce((a, b) => a + b, 0) / technicalScores.length) 
            : 0;
        const avgCommunication = communicationScores.length 
            ? Math.round(communicationScores.reduce((a, b) => a + b, 0) / communicationScores.length) 
            : 0;
        const avgConfidence = confidenceScores.length 
            ? Math.round(confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length) 
            : 0;
        
        const overallScore = Math.round((avgTechnical + avgCommunication + avgConfidence) / 3);
        
        const interviewData = {
            id: this.state.sessionId,
            timestamp: Date.now(),
            mode: this.state.mode,
            modeDisplayName: this.state.modeDisplayName,
            jobTitle: this.state.jobTitle,
            difficulty: this.state.difficulty,
            duration: this.state.duration,
            conversationHistory: this.state.conversationHistory,
            evaluations: this.state.evaluations,
            analysis: analysis,
            overallScore: analysis.overallScore || overallScore,
            technicalAverage: avgTechnical,
            communicationAverage: avgCommunication,
            confidenceAverage: avgConfidence
        };
        
        this.storage.saveInterview(interviewData);
    }

    async handleResumeFile(file) {
        this.ui.showToast('Processing resume...', 'info');
        
        if (this.elements.filePreview) {
            this.elements.filePreview.style.display = 'flex';
        }
        if (this.elements.fileName) {
            this.elements.fileName.textContent = file.name;
        }
        if (this.elements.continueBtn) {
            this.elements.continueBtn.disabled = true;
            this.elements.continueBtn.textContent = 'Processing...';
        }
        
        try {
            const resumeData = await this.ai.processResume(file);
            this.state.resumeData = resumeData;
            
            this.ui.showToast('Resume processed successfully!', 'success');
            
            if (this.elements.continueBtn) {
                this.elements.continueBtn.disabled = false;
                this.elements.continueBtn.textContent = 'Continue Interview →';
            }
            
            if (resumeData.suggestedJobTitles && resumeData.suggestedJobTitles.length > 0) {
                const focusInput = document.getElementById('focus-area');
                if (focusInput && !focusInput.value) {
                    focusInput.placeholder = `e.g., ${resumeData.suggestedJobTitles[0]}`;
                }
            }
            
        } catch (error) {
            console.error('Resume processing failed:', error);
            this.ui.showToast('Failed to process resume. Using default mode.', 'error');
            
            if (this.elements.continueBtn) {
                this.elements.continueBtn.disabled = false;
                this.elements.continueBtn.textContent = 'Continue Interview →';
            }
        }
    }

    resetResumeUpload() {
        this.state.resumeData = null;
        
        if (this.elements.filePreview) {
            this.elements.filePreview.style.display = 'none';
        }
        if (this.elements.resumeFile) {
            this.elements.resumeFile.value = '';
        }
        if (this.elements.continueBtn) {
            this.elements.continueBtn.disabled = true;
        }
    }

    generateSessionId() {
        return 'int_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}

if (window.location.pathname.includes('interview.html')) {
    document.addEventListener('DOMContentLoaded', () => {
        window.interviewEngine = new InterviewEngine();
    });
}