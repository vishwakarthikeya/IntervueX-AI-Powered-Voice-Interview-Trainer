/**
 * Voice Service - PRODUCTION READY WITH STRICT SESSION ISOLATION
 * Complete isolation between questions - NO transcript leakage
 */

export class VoiceService {
    constructor() {
        // Core recognition instance
        this.recognition = null;
        
        // Session management - CRITICAL for isolation
        this.currentSessionId = 0;           // Increments on every new recording session
        this.activeSessionId = null;          // Currently active session
        this.isListening = false;
        
        // Transcript buffers - isolated per session
        this.finalTranscript = '';
        this.interimTranscript = '';
        
        // Callbacks
        this.onTranscriptCallback = null;
        this.onErrorCallback = null;
        
        // Auto-restart control
        this.shouldContinue = false;
        
        // Question tracking
        this.currentQuestionId = null;
        
        // Debug mode (disable in production)
        this.debug = false;
    }

    /**
     * Log debug messages
     */
    log(message, ...args) {
        if (this.debug) {
            console.log(`[VoiceService] ${message}`, ...args);
        }
    }

    /**
     * Create a fresh recognition instance with clean event handlers
     */
    createFreshRecognition() {
        // Check browser support
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Speech recognition not supported');
            return null;
        }

        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();

            // Configure for optimal continuous recording
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';
            recognition.maxAlternatives = 1;

            return recognition;
        } catch (error) {
            console.error('Failed to create recognition:', error);
            return null;
        }
    }

    /**
     * COMPLETELY DESTROY existing recognition instance
     * No lingering callbacks or state
     */
    destroyRecognition() {
        if (this.recognition) {
            try {
                // Remove all event listeners first
                this.recognition.onstart = null;
                this.recognition.onend = null;
                this.recognition.onresult = null;
                this.recognition.onerror = null;
                
                // Stop any active recognition
                if (this.isListening) {
                    this.recognition.abort(); // abort is more aggressive than stop
                }
            } catch (error) {
                // Ignore cleanup errors
            }
            this.recognition = null;
        }
        
        this.isListening = false;
    }

    /**
     * Start listening for a specific question with COMPLETE SESSION ISOLATION
     */
    startListeningForQuestion(questionId, onTranscript, onError) {
        this.log(`startListeningForQuestion: ${questionId}, current session: ${this.currentSessionId}`);
        
        // If question changed, force complete reset
        if (this.currentQuestionId !== questionId) {
            this.log(`Question changed from ${this.currentQuestionId} to ${questionId} - forcing hard reset`);
            this.hardReset();
            this.currentQuestionId = questionId;
        }

        // Generate new session ID (increment to invalidate all old sessions)
        this.currentSessionId++;
        const sessionId = this.currentSessionId;
        this.activeSessionId = sessionId;
        
        this.log(`Starting new session ${sessionId} for question ${questionId}`);

        // COMPLETELY DESTROY old recognition - no traces
        this.destroyRecognition();

        // Create FRESH recognition instance
        this.recognition = this.createFreshRecognition();
        if (!this.recognition) {
            if (onError) onError('Speech recognition not supported');
            return false;
        }

        // Clear all transcripts for fresh start
        this.finalTranscript = '';
        this.interimTranscript = '';

        // Store callbacks
        this.onTranscriptCallback = onTranscript;
        this.onErrorCallback = onError;
        this.shouldContinue = true;

        // Set up event handlers WITH SESSION CAPTURE
        this.recognition.onstart = () => {
            this.log(`Session ${sessionId}: recognition started`);
            this.isListening = true;
        };

        this.recognition.onend = () => {
            this.log(`Session ${sessionId}: recognition ended, shouldContinue: ${this.shouldContinue}, activeSession: ${this.activeSessionId}, currentSession: ${this.currentSessionId}`);
            
            // CRITICAL: Only restart if:
            // 1. We should continue (not stopped by user)
            // 2. This session is STILL the active session (no question change)
            // 3. We're supposed to be listening
            if (this.shouldContinue && sessionId === this.currentSessionId && this.isListening) {
                this.log(`Session ${sessionId}: restarting recognition`);
                try {
                    this.recognition.start();
                } catch (error) {
                    console.error(`Session ${sessionId}: failed to restart:`, error);
                    this.isListening = false;
                }
            } else {
                this.log(`Session ${sessionId}: NOT restarting - shouldContinue:${this.shouldContinue}, sessionMatch:${sessionId === this.currentSessionId}, isListening:${this.isListening}`);
                this.isListening = false;
            }
        };

        this.recognition.onresult = (event) => {
            // CRITICAL: IGNORE if this session is no longer active
            if (sessionId !== this.currentSessionId) {
                this.log(`Session ${sessionId}: ignoring stale result (current session: ${this.currentSessionId})`);
                return;
            }

            let newFinalTranscript = '';
            let newInterimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                
                if (event.results[i].isFinal) {
                    newFinalTranscript += transcript + ' ';
                } else {
                    newInterimTranscript += transcript;
                }
            }

            // Update transcripts (safe because we already verified session)
            if (newFinalTranscript) {
                this.finalTranscript += newFinalTranscript;
            }
            
            const currentTranscript = (this.finalTranscript + ' ' + newInterimTranscript).trim();
            
            if (this.onTranscriptCallback) {
                this.onTranscriptCallback(currentTranscript);
            }
        };

        this.recognition.onerror = (event) => {
            // Ignore if session changed
            if (sessionId !== this.currentSessionId) {
                return;
            }

            this.log(`Session ${sessionId}: error - ${event.error}`);

            // Don't show error for normal events
            if (event.error === 'no-speech' || event.error === 'aborted') {
                return;
            }
            
            let errorMessage = 'Voice input error';
            switch(event.error) {
                case 'audio-capture':
                    errorMessage = 'No microphone found';
                    break;
                case 'not-allowed':
                    errorMessage = 'Microphone access denied';
                    break;
                default:
                    errorMessage = `Error: ${event.error}`;
            }
            
            if (this.onErrorCallback) {
                this.onErrorCallback(errorMessage);
            }
            
            this.isListening = false;
        };

        // Start recognition
        try {
            this.recognition.start();
            this.log(`Session ${sessionId}: recognition start called`);
            return true;
        } catch (error) {
            console.error(`Session ${sessionId}: failed to start:`, error);
            
            // Handle already started error
            if (error.name === 'InvalidStateError') {
                try {
                    this.recognition.stop();
                    setTimeout(() => {
                        try {
                            if (sessionId === this.currentSessionId) {
                                this.recognition.start();
                            }
                        } catch (e) {
                            if (onError) onError('Failed to start voice input');
                        }
                    }, 100);
                } catch (e) {
                    if (onError) onError('Failed to start voice input');
                }
            } else {
                if (onError) onError('Failed to start voice input');
            }
            return false;
        }
    }

    /**
     * HARD RESET - Complete destruction of all state
     * Use when question changes
     */
    hardReset() {
        this.log(`HARD RESET - old session: ${this.currentSessionId}`);
        
        // Increment session ID to invalidate all old callbacks
        this.currentSessionId++;
        
        // Disable auto-restart
        this.shouldContinue = false;
        
        // Stop any active recognition
        if (this.isListening && this.recognition) {
            try {
                this.recognition.abort(); // Use abort for immediate stop
            } catch (error) {
                // Ignore
            }
        }
        
        // Clear all transcripts
        this.finalTranscript = '';
        this.interimTranscript = '';
        
        // Reset state
        this.isListening = false;
        this.activeSessionId = null;
        this.onTranscriptCallback = null;
        this.onErrorCallback = null;
        
        // Completely destroy recognition instance
        this.destroyRecognition();
        
        this.log(`HARD RESET complete - new session: ${this.currentSessionId}`);
    }

    /**
     * Stop listening but keep transcript (pause within same question)
     */
    stopListening() {
        this.log(`stopListening - session: ${this.currentSessionId}`);
        this.shouldContinue = false;
        if (this.recognition && this.isListening) {
            try {
                this.recognition.stop(); // Use stop for graceful pause
            } catch (error) {
                console.error('Error stopping recognition:', error);
            }
        }
        this.isListening = false;
    }

    /**
     * Submit answer - completely stop and clean up
     */
    submitAndStop() {
        this.log(`submitAndStop - session: ${this.currentSessionId}`);
        
        // Disable auto-restart
        this.shouldContinue = false;
        
        // Stop recognition
        if (this.recognition && this.isListening) {
            try {
                this.recognition.stop();
            } catch (error) {
                console.error('Error stopping recognition:', error);
            }
        }
        
        this.isListening = false;
        
        // Increment session to prevent any further callbacks
        this.currentSessionId++;
        this.activeSessionId = null;
    }

    /**
     * Get current transcript
     */
    getCurrentTranscript() {
        return (this.finalTranscript + ' ' + this.interimTranscript).trim();
    }

    /**
     * Check if currently listening
     */
    isActive() {
        return this.isListening;
    }

    /**
     * Get current session ID
     */
    getSessionId() {
        return this.currentSessionId;
    }

    /**
     * Legacy support - start listening without question tracking
     */
    startListening(onTranscript, onError) {
        return this.startListeningForQuestion('legacy_' + Date.now(), onTranscript, onError);
    }

    static isSupported() {
        return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    }

    static async requestMicrophonePermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (error) {
            console.error('Microphone permission denied:', error);
            return false;
        }
    }
}