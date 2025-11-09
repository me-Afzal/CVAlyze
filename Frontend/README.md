# CVAlyze - AI-Powered CV/Resume Analysis Platform 🚀

![CVAlyze Banner](https://img.shields.io/badge/CVAlyze-HR%20Analytics-blue?style=for-the-badge)
![React](https://img.shields.io/badge/React-18.x-61DAFB?style=flat-square&logo=react)
![Plotly](https://img.shields.io/badge/Plotly-Interactive%20Charts-3F4F75?style=flat-square&logo=plotly)
![Status](https://img.shields.io/badge/Status-Production-success?style=flat-square)

## 📋 Overview

**CVAlyze** is a modern, intelligent HR analytics platform that transforms the hiring process through AI-powered resume analysis. Upload multiple CVs simultaneously and get instant insights through interactive visualizations, comprehensive analytics, and an AI assistant to help identify the best candidates.

### ✨ Key Highlights

- 🎯 **Bulk CV Processing** - Analyze up to 40 resumes simultaneously
- 🤖 **AI Chat Assistant** - Get intelligent candidate recommendations
- 📊 **Interactive Dashboards** - Visual analytics with geographic distribution
- 🔍 **Smart File Detection** - Automatically identifies and rejects non-CV files
- 🌍 **Geographic Mapping** - See candidate distribution on interactive maps
- 📈 **Skill Analysis** - Comprehensive skill matching and coverage heatmaps
- 🔐 **Secure Authentication** - User account management with JWT tokens
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile devices

---

## 🎯 Features

### 1. **Intelligent CV Upload System**

- **Multi-file Support**: Upload up to 40 CV files at once (PDF, DOCX, TXT)
- **Drag-and-Drop Interface**: Intuitive file selection with visual feedback
- **Smart Validation**: Automatically detects and rejects non-CV files
- **Progress Tracking**: Real-time upload progress with file-by-file status
- **Error Handling**: Clear error messages with actionable suggestions

**Invalid File Detection:**
```
 Detects non-resume files automatically
 Provides clear error messages
 Suggests what a valid CV should contain:
  - Candidate name and contact information
  - Professional experience or education details
  - Standard CV/Resume format
```

**Processing Stages:**
1. **Extraction** - Parsing CV content (70% progress)
2. **Feature Engineering** - Analyzing skills and experience (85% progress)
3. **Data Cleaning** - Finalizing analytics (100% progress)

---

### 2. **Comprehensive Analytics Dashboard**

#### **Geographic Distribution Map**
- Interactive world map showing candidate locations
- Clustered markers with candidate count
- Hover tooltips with candidate names and locations
- Filter by country and profession

#### **Visual Charts**
- **Gender Distribution** - Pie chart breakdown
- **Country Distribution** - Treemap visualization
- **Skills Analysis** - Interactive treemap of all skills
- **Skill Coverage Heatmap** - Matrix view of candidate skills

#### **Candidate Matrix Table**
- Sortable and filterable table view
- Filter by gender, profession, and location
- Key information at a glance:
  - Name, Profession, Contact Details
  - Location, Gender, Country

#### **Candidate Profile Cards**
- Visual card-based candidate overview
- Quick access to GitHub, LinkedIn profiles
- Top skills display
- Project count
- Click for detailed view

---

### 3. **AI Chat Assistant** 🤖

Powered by Google Gemini 2.0 Flash, the chat assistant provides intelligent insights about your candidate pool.

**Features:**
- **Context-Aware Responses** - Understands candidate data and provides relevant insights
- **Smart Recommendations** - Get top candidate suggestions based on multiple criteria
- **Natural Conversations** - Handles both professional queries and casual chat
- **Markdown Formatting** - Responses formatted for readability
- **Chat History** - Maintains conversation context
- **Quick Prompts** - One-click common queries

**Example Queries:**
```
✓ "Top 5 candidates based on skill, experience, education"
✓ "Who has React and Node.js experience?"
✓ "Compare candidates from India and USA"
✓ "Which candidates have the most projects?"
✓ "Show me candidates with AI/ML skills"
```

**Assistant Behavior:**
- Professional and concise responses
- Only uses provided candidate data (no fabrication)
- Highlights relevant skills, experience, and qualifications
- Provides rankings when requested
- Maintains context across conversation

---

### 4. **Detailed Candidate Profiles**

Click any candidate card to view comprehensive details in a modal:

**Information Displayed:**
- ✅ **Basic Information** - Profession, gender, contact details
- ✅ **Skills** - All technical and soft skills
- ✅ **Education** - Academic background
- ✅ **Experience** - Work history
- ✅ **Projects** - Project details with links
- ✅ **Certifications** - Professional certifications
- ✅ **Achievements** - Awards and accomplishments
- ✅ **Social Links** - GitHub, LinkedIn, Portfolio

---

### 5. **User Account Management**

#### **Authentication System**
- Secure JWT token-based authentication
- Login and registration forms
- Password visibility toggle
- Token validation on page load
- Auto-redirect for expired sessions

#### **Settings Page**
- **Change Password** - Update password securely
- **Delete Account** - Permanent account deletion with confirmation
- Clear success/error messaging
- Secure API communication

---

## 🏗️ Architecture

### **Technology Stack**

| Category | Technology |
|----------|-----------|
| **Frontend Framework** | React 18.x with Hooks |
| **Routing** | Hash-based routing (custom implementation) |
| **Charts & Visualization** | Plotly.js |
| **Icons** | Lucide React |
| **AI Integration** | Google Gemini 2.0 Flash API |
| **Styling** | Tailwind CSS (via classes) |
| **State Management** | React Context API + useState |
| **API Communication** | Fetch API |

---

## 🚀 Getting Started

### **Prerequisites**

```bash
Node.js >= 16.x
npm or yarn
```

### **Installation**

1. **Clone the repository**
```bash
git clone https://github.com/me-Afzal/CVAlyze.git
cd Frontend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**

Create a `.env` file in the root directory:

```env
VITE_API_KEY=your_gemini_api_key_here
```

4. **Start the development server**
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

---

## 🔧 Configuration

### **API Configuration**

Update the `API_BASE` constant in `App.jsx`:

```javascript
const API_BASE = 'https://cvalyze.shop/api/v1';
```

### **Gemini API Key**

The chatbot requires a Google Gemini API key. Set it in your `.env` file:

```env
VITE_API_KEY=your_google_gemini_api_key
```

Get your API key from: [Google AI Studio](https://makersuite.google.com/app/apikey)

---

## 📊 Dashboard Features Breakdown

### **Interactive Charts**

1. **Geographic Distribution Map**
   - Scatter plot on world map
   - Color-coded by candidate count
   - Tooltip with candidate names
   - Responsive zoom and pan

2. **Gender Distribution Pie Chart**
   - Color-coded segments
   - Percentage breakdown
   - Interactive legend

3. **Country Treemap**
   - Size represents candidate count
   - Color gradient for visual appeal
   - Hover for detailed statistics

4. **Skills Treemap**
   - Comprehensive skill visualization
   - Size based on skill frequency
   - All skills across all candidates

5. **Skill Coverage Heatmap**
   - Matrix of candidates vs. skills
   - Binary visualization (has skill / doesn't have skill)
   - Sortable by skill frequency
   - Scrollable for large datasets

---

## 🤖 AI Assistant Details

### **System Prompt Architecture**

The AI assistant uses a carefully crafted system prompt that:

- Provides full candidate data context
- Sets behavioral rules for professional responses
- Distinguishes between HR queries and casual chat
- Ensures concise, actionable insights
- Prevents data fabrication

### **Conversation Management**

- Maintains last 4 messages for context
- Formats messages for Gemini API
- Supports markdown in responses
- Auto-scrolls to latest message
- Clear chat history option

### **Query Examples & Expected Responses**

```
User: "Top 5 candidates"
AI: Provides ranked list with justification based on:
    - Skills match
    - Experience level
    - Education background
    - Project portfolio

User: "Who knows Python and Django?"
AI: Filters candidates with both skills and lists them

User: "Hello!"
AI: Casual greeting without referencing candidate data
```

---

## 🔐 Security Features

- JWT token-based authentication
- Token stored in localStorage
- Auto token validation on page load
- Secure password change flow
- Confirmation dialog for account deletion
- Protected routes (redirect to login if unauthenticated)

---

## 📱 Responsive Design

The application is fully responsive with breakpoints:

- **Mobile**: < 640px (sm)
- **Tablet**: 640px - 768px (md)
- **Desktop**: > 768px (lg)

All components adapt their layout, font sizes, and spacing for optimal viewing on any device.

---

## 🎨 Design System

### **Color Palette**

```css
Primary Blue: #1e3a8a (blue-900)
Secondary Blue: #3b82f6 (blue-500)
Light Blue: #dbeafe (blue-50)
Background: Gradient from white via blue-50 to blue-100
Accent: #93c5fd (blue-300)
Error: #dc2626 (red-600)
Success: #16a34a (green-600)
```

### **Typography**

- **Headings**: Bold, gradient text (blue-900 to blue-700)
- **Body**: Regular weight, blue-800/blue-900
- **Labels**: Semibold, blue-800

---

## 🐛 Error Handling

### **Upload Errors**

1. **Invalid CV Detection**
   - Clear error modal with requirements
   - Actionable suggestions
   - "Try Again" button to retry upload

2. **File Limit Exceeded**
   - Warning message: "Maximum 40 files at a time"
   - Disabled upload button

3. **Partial Success**
   - Shows successful and failed counts
   - Lists error details
   - Auto-redirect to dashboard with successful data

### **API Errors**

- Network error handling
- 401 Unauthorized → Auto logout
- 413 Payload Too Large → Clear message
- Generic error fallback with details

---

## 🔄 Data Flow

```
1. User uploads CVs → UploadPage
2. Files sent to API → Loading overlay with progress
3. API processes CVs → Three-stage pipeline
4. Response received → Store in localStorage
5. Navigate to Dashboard → Load data from localStorage
6. Render visualizations → Plotly.js charts
7. User interacts with AI → Gemini API calls
8. Chat responses → Markdown rendering
```

---

## 📦 Build & Deployment

### **Build for Production**

```bash
npm run build
```

This creates an optimized production build in the `dist/` folder.

### **Deployment Options**

1. **Vercel** (Recommended)
```bash
npm install -g vercel
vercel
```

2. **Netlify**
```bash
npm run build
# Upload dist/ folder to Netlify
```

3. **GitHub Pages**
```bash
npm run build
# Deploy dist/ folder to gh-pages branch
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 👥 Authors

- **Afzal A** - *Initial work* - [GitHub](https://github.com/me-Afzal)

---

## 🙏 Acknowledgments

- Google Gemini API for AI capabilities
- Plotly.js for interactive visualizations
- Lucide React for beautiful icons
- The React community for excellent documentation

---


## 🔮 Future Enhancements

- [ ] Candidate comparison side-by-side
- [ ] Export analytics to PDF/Excel
- [ ] Custom skill weighting
- [ ] Email integration for candidate outreach
- [ ] Team collaboration features
- [ ] Advanced filtering with boolean logic
- [ ] Interview scheduling integration
- [ ] Resume parsing improvement with ML

---

## 📊 Project Stats

![Lines of Code](https://img.shields.io/badge/Lines%20of%20Code-3000%2B-blue?style=flat-square)
![Components](https://img.shields.io/badge/Components-10%2B-green?style=flat-square)
![API Integrations](https://img.shields.io/badge/APIs-2-orange?style=flat-square)

---

**Built with ❤️ by the CVAlyze Team**