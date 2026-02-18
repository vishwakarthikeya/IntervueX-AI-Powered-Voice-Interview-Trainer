/**
 * AI Service for Intelligent Interview Engine
 * Integrates with Anthropic Claude API for dynamic question generation and analysis
 * 
 * IMPORTANT: You must add your own API key
 * Get one at: https://console.anthropic.com/
 */

export class AIService {
    constructor() {
        // Instructions: Replace with your API key or use environment variable
        this.apiKey = localStorage.getItem('anthropic_api_key') || null;
        this.apiEndpoint = 'https://api.anthropic.com/v1/messages';
        
        this.useMockData = !this.apiKey;
        
        // Conversation tracking
        this.conversationHistory = [];
        this.askedQuestions = new Set();
        
        // Model configuration
        this.model = 'claude-3-sonnet-20241022';
        this.maxTokens = 1024;
        this.temperature = 0.7;
    }

    loadApiKey() {
        try {
            const savedKey = localStorage.getItem('anthropic_api_key');
            if (savedKey && savedKey.length > 20) {
                this.apiKey = savedKey;
                this.useMockData = false;
                console.log('API key loaded from storage');
            }
        } catch (error) {
            console.error('Failed to load API key:', error);
        }
    }

    /**
     * Generate next interview question based on context
     */
    async generateNextQuestion(context) {
        const {
            jobTitle,
            jobDescription,
            difficulty,
            duration,
            elapsedMinutes,
            conversationHistory,
            askedQuestions = [],
            mode = 'custom',
            resumeData = null,
            lastAnswer = null,
            lastQuestion = null
        } = context;

        if (this.useMockData) {
            return this.generateMockQuestion(jobTitle, difficulty, mode);
        }

        try {
            const prompt = this.buildIntelligentQuestionPrompt({
                jobTitle,
                jobDescription,
                difficulty,
                duration,
                elapsedMinutes,
                conversationHistory,
                askedQuestions,
                mode,
                resumeData,
                lastAnswer,
                lastQuestion
            });

            const response = await this.callClaudeAPI(prompt);
            const question = this.sanitizeText(response);
            
            // Check for duplicate
            if (askedQuestions.includes(question) || askedQuestions.some(q => this.isSimilarQuestion(q, question))) {
                console.log('Duplicate detected, regenerating...');
                return this.generateNextQuestion(context);
            }
            
            return question;
        } catch (error) {
            console.error('Question generation error:', error);
            return this.generateMockQuestion(jobTitle, difficulty, mode);
        }
    }

    isSimilarQuestion(q1, q2) {
        if (!q1 || !q2) return false;
        const words1 = new Set(q1.toLowerCase().split(' ').slice(0, 5));
        const words2 = new Set(q2.toLowerCase().split(' ').slice(0, 5));
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        return intersection.size >= 3;
    }

    buildIntelligentQuestionPrompt(context) {
        const {
            jobTitle,
            jobDescription,
            difficulty,
            duration,
            elapsedMinutes,
            conversationHistory,
            askedQuestions,
            mode,
            resumeData,
            lastAnswer,
            lastQuestion
        } = context;

        // Role-based system prompt engineering
        let roleContext = '';
        if (jobTitle.toLowerCase().includes('python')) {
            roleContext = `This is a Python Developer interview. Focus on:
- Python language specifics (syntax, features, best practices)
- Object-Oriented Programming in Python
- Django/Flask/FastAPI frameworks
- REST API development
- Database integration (SQLAlchemy, Django ORM)
- Data structures and algorithms in Python
- Testing (pytest, unittest)
- Python performance optimization
- Async programming (asyncio)
- Package management and virtual environments`;
        } else if (jobTitle.toLowerCase().includes('web')) {
            roleContext = `This is a Web Developer interview. Focus on:
- HTML5 semantic markup and best practices
- CSS3 (Flexbox, Grid, animations, responsive design)
- JavaScript (ES6+, closures, promises, async/await)
- Frontend frameworks (React/Vue/Angular)
- DOM manipulation and events
- Browser APIs and performance
- Web accessibility (a11y)
- Cross-browser compatibility
- Build tools and module bundlers
- Progressive Web Apps`;
        } else if (jobTitle.toLowerCase().includes('full stack')) {
            roleContext = `This is a Full Stack Developer interview. Focus on:
- Frontend technologies (HTML, CSS, JavaScript, React/Vue)
- Backend technologies (Node.js/Python/Java, APIs)
- Database design (SQL and NoSQL)
- Server-side rendering vs client-side
- Authentication and authorization
- State management
- API design and integration
- Deployment and DevOps basics
- Testing across the stack
- Performance optimization`;
        } else if (jobTitle.toLowerCase().includes('data')) {
            roleContext = `This is a Data Scientist interview. Focus on:
- Statistics and probability
- Machine learning algorithms
- Python data stack (pandas, numpy, scikit-learn)
- Data visualization
- Feature engineering
- Model evaluation and validation
- Big data technologies
- SQL and data manipulation
- A/B testing
- Experimental design`;
        } else {
            roleContext = `This is a ${jobTitle} interview. Focus on industry-standard topics for this role.`;
        }

        const difficultyMap = {
            'easy': 'Basic concepts, definitions, fundamental understanding. Ask straightforward questions suitable for beginners.',
            'medium': 'Practical application, scenario-based questions, moderate complexity. Expect candidates to demonstrate working knowledge.',
            'hard': 'System design, trade-offs, complex problem-solving. Challenge the candidate with realistic scenarios.',
            'critical': 'Deep architecture, stress scenarios, expert-level discussion. Push boundaries of knowledge.'
        };

        const difficultyDesc = difficultyMap[difficulty] || difficultyMap.medium;

        let resumeContext = '';
        if (mode === 'resume' && resumeData) {
            resumeContext = `
The candidate's resume shows:
- Skills: ${resumeData.skills?.slice(0, 5).join(', ') || 'Not specified'}
- Projects: ${resumeData.projects?.map(p => p.name).slice(0, 3).join(', ') || 'Not specified'}
- Experience: ${resumeData.experience?.map(e => `${e.role} at ${e.company}`).join('; ') || 'Not specified'}

Generate questions that reference these specific resume items.`;
        }

        let conversationContext = '';
        if (conversationHistory.length > 0) {
            conversationContext = `Previous conversation:
${conversationHistory.slice(-3).map((qa, i) => `Q${conversationHistory.length - 3 + i + 1}: ${qa.question}\nA: ${qa.answer}`).join('\n\n')}`;
        }

        let answerAnalysisContext = '';
        if (lastAnswer && lastQuestion) {
            answerAnalysisContext = `
The candidate just answered: "${lastQuestion}"
With: "${lastAnswer}"

Based on this answer, generate a follow-up question that:
- If the answer was weak (< 50 words or superficial), ask for clarification on the same topic
- If the answer was strong, move to a more advanced aspect
- If the answer mentioned specific technologies, dig deeper into those
- Do NOT repeat the same question`;
        }

        const askedList = askedQuestions.length > 0 
            ? `\nAlready asked questions (DO NOT repeat): ${askedQuestions.slice(-5).join('; ')}`
            : '';

        const timeRemaining = Math.max(0, duration - elapsedMinutes);
        const timeGuidance = timeRemaining < 2 
            ? 'Time is almost up. Ask a quick, focused question.'
            : timeRemaining < 5 
                ? 'Medium time remaining. Ask a moderate-depth question.'
                : 'Plenty of time. Ask a comprehensive question.';

        return {
            system: `You are an expert technical interviewer conducting a ${difficulty} level interview for a ${jobTitle} position. ${roleContext}`,
            messages: [{
                role: 'user',
                content: `Interview Context:
- Role: ${jobTitle}
- Difficulty: ${difficulty} - ${difficultyDesc}
- Time remaining: ~${timeRemaining} minutes
- ${timeGuidance}
${resumeContext}

${conversationContext}
${answerAnalysisContext}
${askedList}

Your Task:
Generate ONE unique, contextual interview question that:
1. Matches the ${difficulty} difficulty level
2. Is specific to ${jobTitle} role${mode === 'resume' ? ' and references the candidate\'s resume' : ''}
3. Builds on previous answers if available
4. Is completely new (not in asked questions list)
5. Tests practical knowledge, not just definitions

Return ONLY the question text. No explanations, no prefixes, no JSON.`
            }]
        };
    }

    /**
     * Evaluate answer in real-time with structured feedback
     */
    async evaluateAnswer(question, answer, context) {
        if (this.useMockData) {
            return this.generateMockEvaluation(question, answer);
        }

        try {
            const prompt = {
                system: 'You are an expert interview evaluator providing structured feedback.',
                messages: [{
                    role: 'user',
                    content: `Evaluate this interview answer:

Question: "${question}"
Answer: "${answer}"
Role: ${context.jobTitle}
Difficulty: ${context.difficulty}

Provide a structured evaluation in this exact JSON format:

{
    "strengths": "What the candidate did well (2-3 sentences)",
    "weaknesses": "Areas that need improvement (2-3 sentences)",
    "technicalScore": number between 0-10 (technical accuracy and depth),
    "communicationScore": number between 0-10 (clarity and structure),
    "confidenceScore": number between 0-10 (certainty and conviction),
    "feedback": "Brief actionable feedback (1-2 sentences)",
    "shouldFollowUp": boolean (true if answer needs clarification),
    "followUpTopic": "If shouldFollowUp is true, what aspect to probe further",
    "keyConcepts": ["concept1", "concept2"] (concepts mentioned or missing)
}

Be critical but fair. Scores should reflect actual quality.`
                }]
            };

            const response = await this.callClaudeAPI(prompt);
            const evaluation = JSON.parse(response);
            
            // Validate and normalize scores
            evaluation.technicalScore = Math.min(10, Math.max(0, evaluation.technicalScore));
            evaluation.communicationScore = Math.min(10, Math.max(0, evaluation.communicationScore));
            evaluation.confidenceScore = Math.min(10, Math.max(0, evaluation.confidenceScore));
            
            return evaluation;
        } catch (error) {
            console.error('Answer evaluation error:', error);
            return this.generateMockEvaluation(question, answer);
        }
    }

    /**
     * Generate comprehensive post-interview analysis
     */
    async generateAnalysis(conversationHistory, evaluations, context) {
        if (this.useMockData) {
            return this.generateMockAnalysis(conversationHistory, evaluations, context);
        }

        try {
            const prompt = {
                system: `You are an expert interview evaluator. Analyze this complete ${context.difficulty} level interview for a ${context.jobTitle} position.`,
                messages: [{
                    role: 'user',
                    content: `Interview Details:
- Job Title: ${context.jobTitle}
- Difficulty: ${context.difficulty}
- Mode: ${context.mode || 'custom'}
- Duration: ${context.duration} minutes
- Total Questions: ${conversationHistory.length}

Full Interview Transcript with Evaluations:
${conversationHistory.map((qa, i) => {
    const e = evaluations[i] || {};
    return `Q${i+1}: ${qa.question}
A: ${qa.answer}
Scores: Technical ${eval.technicalScore}/10, Communication ${eval.communicationScore}/10, Confidence ${eval.confidenceScore}/10
Feedback: ${eval.feedback || 'N/A'}`;
}).join('\n\n')}

Provide comprehensive analysis in this JSON format:

{
    "overallScore": 0-100,
    "technicalAverage": 0-100,
    "communicationAverage": 0-100,
    "confidenceAverage": 0-100,
    "questionAnalysis": [
        {
            "question": "original question",
            "userAnswer": "user's response",
            "idealAnswer": "what a strong candidate would say",
            "strengths": "what was good",
            "weaknesses": "what was missing",
            "suggestions": ["improvement 1", "improvement 2"],
            "score": 0-100,
            "technicalScore": 0-10,
            "communicationScore": 0-10,
            "confidenceScore": 0-10
        }
    ],
    "overallFeedback": "comprehensive summary of performance",
    "strengths": ["strength 1", "strength 2", "strength 3"],
    "areasForImprovement": ["area 1", "area 2", "area 3"],
    "keyConcepts": ["concept1", "concept2"],
    "suggestedResources": ["resource1", "resource2"],
    "roleReadiness": "Strong/Moderate/Needs Work"
}`
                }]
            };

            const response = await this.callClaudeAPI(prompt);
            return JSON.parse(response);
        } catch (error) {
            console.error('Analysis generation error:', error);
            return this.generateMockAnalysis(conversationHistory, evaluations, context);
        }
    }

    /**
     * Process resume for resume-based interview mode
     */
    async processResume(file) {
        if (this.useMockData) {
            return this.generateMockResumeData();
        }

        try {
            let resumeText = '';
            
            if (file.type === 'application/pdf') {
                resumeText = await this.extractPDFText(file);
            } else if (file.type.includes('word')) {
                resumeText = await this.extractDocxText(file);
            } else {
                resumeText = await file.text();
            }

            const prompt = {
                system: 'You are a resume parser and job market expert.',
                messages: [{
                    role: 'user',
                    content: `Analyze this resume and extract structured information:

${resumeText.substring(0, 10000)}

Return JSON:
{
    "skills": ["skill1", "skill2", ...],
    "technologies": ["tech1", "tech2", ...],
    "projects": [
        {"name": "project name", "description": "brief desc", "technologies": ["tech1"], "role": "your role"}
    ],
    "experience": [
        {"role": "title", "company": "name", "duration": "years", "highlights": ["achievement1"]}
    ],
    "education": [
        {"degree": "degree name", "institution": "school", "year": "year"}
    ],
    "experienceLevel": "entry/mid/senior",
    "suggestedJobTitles": ["title1", "title2", "title3"],
    "keyStrengths": ["strength1", "strength2"],
    "yearsOfExperience": 0,
    "summary": "brief professional summary"
}`
                }]
            };

            const response = await this.callClaudeAPI(prompt);
            return JSON.parse(response);
        } catch (error) {
            console.error('Resume processing error:', error);
            return this.generateMockResumeData();
        }
    }

    /**
     * Generate questions based on resume data
     */
    async generateResumeQuestions(resumeData, focusArea, duration, count = 1, existingQuestions = []) {
        if (this.useMockData) {
            return this.generateMockResumeQuestions(resumeData, focusArea);
        }

        try {
            const skills = resumeData.skills || [];
            const projects = resumeData.projects || [];
            const experience = resumeData.experience || [];
            
            const context = `
Resume Summary:
- Skills: ${skills.slice(0, 5).join(', ')}${skills.length > 5 ? '...' : ''}
- Key Projects: ${projects.map(p => p.name).slice(0, 3).join(', ')}
- Experience: ${experience.map(e => `${e.role} at ${e.company}`).join('; ')}
- Level: ${resumeData.experienceLevel || 'mid'}
${focusArea ? `- Focus Area: ${focusArea}` : ''}`;

            const prompt = {
                system: 'You are an expert interviewer creating personalized questions based on a candidate\'s resume.',
                messages: [{
                    role: 'user',
                    content: `${context}

Generate ${count} interview question(s) that:
1. Reference SPECIFIC projects, skills, or experiences from the resume
2. Ask about implementation details
3. Probe depth of knowledge in claimed areas
4. AVOID generic questions
5. Focus on ${focusArea || 'the most impressive aspects'}

Return as JSON array:
[
    "question 1",
    "question 2"
]`
                }]
            };

            const response = await this.callClaudeAPI(prompt);
            const questions = JSON.parse(response);
            
            // Filter out duplicates
            return questions.filter(q => !existingQuestions.includes(q));
        } catch (error) {
            console.error('Resume question generation error:', error);
            return this.generateMockResumeQuestions(resumeData, focusArea);
        }
    }

    /**
     * Claude API call wrapper
     */
    async callClaudeAPI(prompt) {
        if (!this.apiKey) {
            throw new Error('No API key configured');
        }

        const response = await fetch(this.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: this.model,
                max_tokens: this.maxTokens,
                temperature: this.temperature,
                system: prompt.system || '',
                messages: prompt.messages || [{
                    role: 'user',
                    content: prompt
                }]
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API call failed: ${response.status} - ${error}`);
        }

        const data = await response.json();
        return data.content[0].text;
    }

    /**
     * Mock evaluation generator
     */
    generateMockEvaluation(question, answer) {
        const wordCount = answer.split(' ').length;
        const hasTechnical = answer.toLowerCase().includes('api') || 
                            answer.toLowerCase().includes('database') ||
                            answer.toLowerCase().includes('function') ||
                            answer.toLowerCase().includes('class');
        
        const technicalScore = Math.min(10, Math.max(3, hasTechnical ? 7 : 4 + (wordCount / 50)));
        const communicationScore = Math.min(10, Math.max(3, wordCount > 30 ? 7 : 4));
        const confidenceScore = Math.min(10, Math.max(3, 5 + (wordCount / 40)));
        
        return {
            strengths: wordCount > 50 
                ? 'Good length and coverage of the topic.' 
                : 'Attempted to address the question.',
            weaknesses: wordCount < 30 
                ? 'Answer is too brief. Need more detail and examples.' 
                : 'Could include more specific technical examples.',
            technicalScore: Math.round(technicalScore * 10) / 10,
            communicationScore: Math.round(communicationScore * 10) / 10,
            confidenceScore: Math.round(confidenceScore * 10) / 10,
            feedback: wordCount < 30 
                ? 'Elaborate more with specific examples.' 
                : 'Good answer. Consider adding real-world scenarios.',
            shouldFollowUp: wordCount < 30 || technicalScore < 5,
            followUpTopic: wordCount < 30 ? 'clarification' : 'deeper technical details',
            keyConcepts: hasTechnical ? ['technical concepts'] : ['basic concepts']
        };
    }

    generateMockQuestion(jobTitle, difficulty, mode) {
        const roleLower = jobTitle.toLowerCase();
        
        if (roleLower.includes('python')) {
            const questions = [
                "Explain the difference between a list and a tuple in Python. When would you use each?",
                "How does Python's garbage collection work? What are the different memory management strategies?",
                "Describe the Global Interpreter Lock (GIL) in Python. How does it affect multithreading?",
                "What are decorators in Python? Give an example of when you would use one.",
                "Explain the difference between deep copy and shallow copy in Python.",
                "How do you handle exceptions in Python? What's the difference between try/except and try/finally?",
                "What are Python generators? How do they differ from regular functions?",
                "Explain the use of __init__.py in Python packages.",
                "What is the difference between @staticmethod and @classmethod?",
                "How does Python's inheritance work? Explain method resolution order (MRO)."
            ];
            return questions[Math.floor(Math.random() * questions.length)];
        } 
        else if (roleLower.includes('web')) {
            const questions = [
                "Explain the CSS box model. How does it affect layout?",
                "What's the difference between display: none and visibility: hidden?",
                "How does the event loop work in JavaScript? Explain microtasks vs macrotasks.",
                "Describe the difference between localStorage, sessionStorage, and cookies.",
                "What are closures in JavaScript? Give a practical example.",
                "Explain the concept of responsive design. How do media queries work?",
                "What's the difference between position: relative, absolute, and fixed?",
                "How do you optimize website performance? List key techniques.",
                "Explain CSS specificity. How do you calculate it?",
                "What are Web Components? How do they differ from framework components?"
            ];
            return questions[Math.floor(Math.random() * questions.length)];
        }
        else {
            const questions = [
                `What interests you most about ${jobTitle}?`,
                `Describe your experience with technologies relevant to ${jobTitle}.`,
                `What challenges have you faced in ${jobTitle} roles and how did you overcome them?`
            ];
            return questions[Math.floor(Math.random() * questions.length)];
        }
    }

    generateMockResumeQuestions(resumeData, focusArea) {
        const baseQuestions = [
            `I see you worked with ${resumeData.skills?.[0] || 'React'} on ${resumeData.projects?.[0]?.name || 'a recent project'}. Can you walk me through your implementation and any challenges you faced?`,
            `Your resume mentions ${resumeData.experience?.[0]?.role || 'a role'} at ${resumeData.experience?.[0]?.company || 'a company'}. What was your biggest achievement there?`,
            `You list ${resumeData.skills?.[1] || 'TypeScript'} among your skills. How have you applied it in production?`
        ];
        
        if (focusArea) {
            baseQuestions.unshift(`Regarding ${focusArea}, can you elaborate on your experience from your resume?`);
        }
        
        return baseQuestions;
    }

    generateMockAnalysis(conversationHistory, evaluations, context) {
        const scores = evaluations.map(e => (e.technicalScore + e.communicationScore + e.confidenceScore) / 3 * 10);
        const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        
        return {
            overallScore: avgScore,
            technicalAverage: Math.round(evaluations.reduce((a, e) => a + (e.technicalScore || 0), 0) / evaluations.length * 10),
            communicationAverage: Math.round(evaluations.reduce((a, e) => a + (e.communicationScore || 0), 0) / evaluations.length * 10),
            confidenceAverage: Math.round(evaluations.reduce((a, e) => a + (e.confidenceScore || 0), 0) / evaluations.length * 10),
            questionAnalysis: conversationHistory.map((qa, i) => ({
                question: qa.question,
                userAnswer: qa.answer,
                idealAnswer: 'A strong answer would include specific examples, demonstrate depth, and address the core concepts.',
                strengths: evaluations[i]?.strengths || 'Addressed the question',
                weaknesses: evaluations[i]?.weaknesses || 'Could be more detailed',
                suggestions: ['Add concrete examples', 'Structure your answer', 'Connect to related concepts'],
                score: Math.round((evaluations[i]?.technicalScore || 7) * 10),
                technicalScore: evaluations[i]?.technicalScore || 7,
                communicationScore: evaluations[i]?.communicationScore || 7,
                confidenceScore: evaluations[i]?.confidenceScore || 7
            })),
            overallFeedback: `You demonstrated ${avgScore > 70 ? 'strong' : avgScore > 50 ? 'moderate' : 'developing'} understanding of ${context.jobTitle} concepts.`,
            strengths: ['Communicates clearly', 'Shows technical awareness', 'Structured responses'],
            areasForImprovement: ['Add more specific examples', 'Deepen technical explanations', 'Practice more complex scenarios'],
            keyConcepts: ['Core technologies', 'Best practices', 'Problem-solving'],
            suggestedResources: ['Official documentation', 'Online courses', 'Practice projects'],
            roleReadiness: avgScore > 70 ? 'Strong' : avgScore > 50 ? 'Moderate' : 'Needs Work'
        };
    }

    generateMockResumeData() {
        return {
            skills: ['JavaScript', 'React', 'Node.js', 'Python', 'SQL'],
            technologies: ['React', 'Express', 'PostgreSQL', 'Docker'],
            projects: [
                { name: 'E-commerce Platform', description: 'Full-stack e-commerce site', technologies: ['React', 'Node.js'], role: 'Lead Developer' }
            ],
            experience: [
                { role: 'Developer', company: 'Tech Corp', duration: '2 years', highlights: ['Built features', 'Improved performance'] }
            ],
            education: [{ degree: 'B.S. Computer Science', institution: 'University', year: '2020' }],
            experienceLevel: 'mid',
            suggestedJobTitles: ['Full Stack Developer', 'Frontend Developer'],
            keyStrengths: ['React', 'Problem-solving'],
            yearsOfExperience: 3,
            summary: 'Experienced developer'
        };
    }

    async extractPDFText(file) {
        return "PDF text extraction would happen here. In production, include PDF.js library.";
    }

    async extractDocxText(file) {
        return "DOCX text extraction would happen here. In production, include mammoth.js library.";
    }

    sanitizeText(text) {
        if (!text) return '';
        return String(text)
            .replace(/<[^>]*>/g, '')
            .replace(/[^\x20-\x7E\n\r\t]/g, '')
            .trim();
    }
}

export const aiService = new AIService();