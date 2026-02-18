# V-Interview AI - Production-Ready Interview Simulator

A professional, AI-powered mock interview platform that helps candidates practice and improve their interview skills through realistic conversations with AI.

## ✨ Features

- **Real AI Integration**: Powered by OpenAI GPT-4 for intelligent question generation and evaluation
- **Multi-Domain Support**: Web Development, AI/ML, DSA, HR & Behavioral interviews
- **Voice-Enabled**: Natural conversation flow with speech recognition and synthesis
- **Real-Time Feedback**: Instant multi-dimensional scoring and improvement suggestions
- **Secure Architecture**: API keys protected on backend, no exposure in frontend
- **Mobile Responsive**: Works seamlessly on all devices
- **Session Persistence**: Interview progress saved in browser storage
- **Performance Analytics**: Detailed dashboard with charts and insights

## 🏗️ Architecture

The application follows a secure client-server architecture:

- **Frontend**: Pure HTML/CSS/JavaScript (no frameworks)
- **Backend**: Node.js/Express proxy server
- **AI Integration**: OpenAI API with rate limiting and error handling
- **Storage**: Browser localStorage + optional Redis for production

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- OpenAI API key
- Modern browser (Chrome recommended for voice features)
- Microphone access

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd v-interview-ai

   cd backend
npm install


cp .env.example .env
# Edit .env and add your OpenAI API key

npm start
# Server runs on http://localhost:3001

# In a new terminal
cd ../frontend
# Using Python
python3 -m http.server 3000
# Or using Node.js
npx live-server --port=3000