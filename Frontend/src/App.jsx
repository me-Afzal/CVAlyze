import React, { useState, useEffect, useRef } from 'react';
import { FileBarChart, Upload, LogOut, Settings, User, Mail, Lock, Trash2, Eye, EyeOff, MessageCircle, X, Send, BarChart3, Globe, PieChart, Grid, Download, Filter, Search, UserPen, ArrowRight, CheckCircle, Users, TrendingUp, Menu, Database, Loader2 } from 'lucide-react';
import * as Plotly from 'plotly.js-dist-min';

// Router Setup
const Router = ({ children }) => {
  const [currentPath, setCurrentPath] = useState(window.location.hash.slice(1) || '/');

  useEffect(() => {
    const handleHashChange = () => setCurrentPath(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return children(currentPath, (path) => {
    window.location.hash = path;
    setCurrentPath(path);
  });
};

// API Configuration
const API_BASE = import.meta.env.VITE_API_BASE;
const GEMINI_API_KEY = import.meta.env.VITE_API_KEY;

// Auth Context
const AuthContext = React.createContext();

const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('auth_token'));
  const [user, setUser] = useState(localStorage.getItem('username'));

  const login = (newToken, username) => {
    localStorage.setItem('auth_token', newToken);
    localStorage.setItem('username', username);
    setToken(newToken);
    setUser(username);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('username');
    setToken(null);
    setUser(null);
    window.location.hash = '/login';
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => React.useContext(AuthContext);

// ==================== RAG UTILITIES ====================

// Create chunks from CV data - each candidate becomes a chunk
const createChunks = (cvData) => {
  return cvData.map((cv, index) => {
    const skillsText = cv.skills?.map(s => typeof s === 'string' ? s : s?.name || '').join(', ') || '';
    const experienceText = cv.experience?.map(e => typeof e === 'string' ? e : e?.title || '').join('; ') || '';
    const educationText = cv.education?.map(e => typeof e === 'string' ? e : e?.degree || '').join('; ') || '';
    const certificationsText = cv.certifications?.map(c => typeof c === 'string' ? c : c?.name || '').join(', ') || '';
    const achievementsText = cv.achievements?.map(a => typeof a === 'string' ? a : '').join('; ') || '';
    const projectsText = cv.projects?.map(p => typeof p === 'string' ? p : p?.name || '').join(', ') || '';

    const searchableText = `
Candidate: ${cv.name || 'Unknown'}
Profession: ${cv.profession || 'Not specified'}
Location: ${cv.location || ''}, ${cv.country || ''}
Gender: ${cv.gender || ''}
Email: ${cv.email || ''}
Phone: ${cv.phone_number || ''}

Skills: ${skillsText}

Experience: ${experienceText}

Education: ${educationText}

Certifications: ${certificationsText}

Achievements: ${achievementsText}

Projects: ${projectsText}

Links: GitHub: ${cv.github_link || 'N/A'}, LinkedIn: ${cv.linkedin_link || 'N/A'}, Portfolio: ${cv.portfolio_link || 'N/A'}
    `.trim();

    return {
      id: index,
      text: searchableText,
      fullData: JSON.stringify(cv, null, 2),
      metadata: {
        name: cv.name,
        profession: cv.profession,
        country: cv.country,
        skills: skillsText
      }
    };
  });
};

// Get embeddings from Gemini
const getEmbedding = async (text, apiKey) => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: {
            parts: [{ text: text.slice(0, 10000) }]
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.status}`);
    }

    const data = await response.json();
    return data.embedding?.values || null;
  } catch (error) {
    console.error('Embedding error:', error);
    return null;
  }
};

// Cosine similarity between two vectors
const cosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) return 0;

  return dotProduct / (magnitudeA * magnitudeB);
};

// Build vector database with rate limiting
const buildVectorDB = async (chunks, apiKey, onProgress) => {
  const vectorDB = [];
  const batchSize = 5;
  const delayBetweenBatches = 1000;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    const batchPromises = batch.map(async (chunk) => {
      const embedding = await getEmbedding(chunk.text, apiKey);
      return {
        ...chunk,
        embedding
      };
    });

    const results = await Promise.all(batchPromises);
    vectorDB.push(...results.filter(r => r.embedding !== null));

    if (onProgress) {
      onProgress(Math.min((i + batchSize) / chunks.length * 100, 100));
    }

    if (i + batchSize < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }

  return vectorDB;
};

// Search for similar chunks
const searchSimilarChunks = async (query, vectorDB, apiKey, topK = 3) => {
  const queryEmbedding = await getEmbedding(query, apiKey);

  if (!queryEmbedding) {
    console.error('Failed to get query embedding');
    return [];
  }

  const similarities = vectorDB
    .filter(item => item.embedding)
    .map(item => ({
      ...item,
      similarity: cosineSimilarity(queryEmbedding, item.embedding)
    }));

  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
};

// ==================== END RAG UTILITIES ====================

// Utility function to normalize names
const normalizeName = (name) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Utility function to safely render data
const renderDataItem = (item) => {
  if (typeof item === 'string') return item;
  if (typeof item === 'object' && item !== null) {
    if (item.name) return item.name;
    if (item.title) return item.title;
    return JSON.stringify(item);
  }
  return String(item);
};

// Enhanced Loading Overlay Component
const LoadingOverlay = ({ files = [], currentFileIndex = 0, stage = 'extraction' }) => {
  const totalFiles = files.length;
  const baseProgress = totalFiles > 0 ? (currentFileIndex / totalFiles) * 70 : 0;

  const getStageProgress = () => {
    if (stage === 'extraction') return baseProgress;
    if (stage === 'feature-engineering') return 70 + 15;
    if (stage === 'cleaning') return 85 + 15;
    return baseProgress;
  };

  const progress = getStageProgress();

  const getStageText = () => {
    if (stage === 'extraction') return 'Extracting CV Data';
    if (stage === 'feature-engineering') return 'Engineering Features';
    if (stage === 'cleaning') return 'Cleaning & Finalizing Data';
    return 'Processing';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 overflow-y-auto p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-64 h-64 md:w-96 md:h-96 bg-blue-400/20 rounded-full blur-3xl animate-pulse top-10 left-10"></div>
        <div className="absolute w-64 h-64 md:w-96 md:h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse bottom-10 right-10" style={{ animationDelay: '1s' }}></div>
        <div className="absolute w-64 h-64 md:w-96 md:h-96 bg-blue-300/20 rounded-full blur-3xl animate-pulse top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-2xl w-full px-4 py-8 my-auto">
        <div className="relative w-24 h-24 md:w-32 md:h-32 mb-6 md:mb-8 flex-shrink-0">
          <div className="absolute inset-0 border-4 md:border-8 border-blue-200/30 rounded-full"></div>
          <div className="absolute inset-0 border-4 md:border-8 border-transparent border-t-white border-r-white rounded-full animate-spin"></div>
          <div className="absolute inset-2 md:inset-3 border-4 md:border-8 border-transparent border-b-blue-300 border-l-blue-300 rounded-full animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}></div>
          <div className="absolute inset-4 md:inset-6 border-4 md:border-8 border-transparent border-t-blue-400 rounded-full animate-spin" style={{ animationDuration: '2s' }}></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-xl md:text-2xl font-bold text-white">{Math.round(progress)}%</div>
          </div>
        </div>

        <div className="text-center space-y-3 md:space-y-4 mb-4 md:mb-6 flex-shrink-0">
          <h2 className="text-2xl md:text-3xl font-bold text-white animate-pulse">Processing CVs</h2>
          <p className="text-lg md:text-xl text-blue-100">{getStageText()}</p>
        </div>

        <div className="w-full max-w-md mb-4 md:mb-6 flex-shrink-0">
          <div className="flex justify-between items-center mb-2 gap-2">
            <div className={`flex items-center space-x-1 md:space-x-2 ${stage === 'extraction' ? 'text-white' : stage === 'feature-engineering' || stage === 'cleaning' ? 'text-green-300' : 'text-blue-300'}`}>
              <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${stage === 'extraction' ? 'bg-white animate-pulse' : stage === 'feature-engineering' || stage === 'cleaning' ? 'bg-green-300' : 'bg-blue-300'}`}></div>
              <span className="text-xs md:text-sm font-semibold">Extraction</span>
            </div>
            <div className={`flex items-center space-x-1 md:space-x-2 ${stage === 'feature-engineering' ? 'text-white' : stage === 'cleaning' ? 'text-green-300' : 'text-blue-300'}`}>
              <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${stage === 'feature-engineering' ? 'bg-white animate-pulse' : stage === 'cleaning' ? 'bg-green-300' : 'bg-blue-300'}`}></div>
              <span className="text-xs md:text-sm font-semibold">Features</span>
            </div>
            <div className={`flex items-center space-x-1 md:space-x-2 ${stage === 'cleaning' ? 'text-white' : 'text-blue-300'}`}>
              <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${stage === 'cleaning' ? 'bg-white animate-pulse' : 'bg-blue-300'}`}></div>
              <span className="text-xs md:text-sm font-semibold">Cleaning</span>
            </div>
          </div>
        </div>

        <div className="w-full max-w-md mb-4 md:mb-6 flex-shrink-0">
          <div className="h-2 md:h-3 bg-blue-700/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 via-white to-blue-400 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="flex justify-between mt-2 text-xs text-blue-200">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        {stage === 'extraction' && files.length > 0 && (
          <div className="w-full max-w-md bg-white/10 backdrop-blur-md rounded-xl p-3 md:p-4 mb-4 md:mb-6 flex-shrink-0">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-white font-semibold text-sm md:text-base">Processing Files</h3>
              <span className="text-blue-200 text-xs md:text-sm">{currentFileIndex} / {files.length}</span>
            </div>
            <div className="space-y-2 max-h-40 md:max-h-48 overflow-y-auto">
              {files.map((file, index) => (
                <div
                  key={index}
                  className={`flex items-center space-x-2 md:space-x-3 p-2 rounded-lg transition-all ${index < currentFileIndex
                    ? 'bg-green-500/20 border border-green-400/30'
                    : index === currentFileIndex
                      ? 'bg-blue-500/30 border border-blue-400/50 animate-pulse'
                      : 'bg-white/5 border border-white/10'
                    }`}
                >
                  {index < currentFileIndex ? (
                    <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-green-300 flex-shrink-0" />
                  ) : index === currentFileIndex ? (
                    <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                  ) : (
                    <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white/30 rounded-full flex-shrink-0"></div>
                  )}
                  <span className={`text-xs md:text-sm truncate ${index < currentFileIndex
                    ? 'text-green-200'
                    : index === currentFileIndex
                      ? 'text-white font-semibold'
                      : 'text-blue-200'
                    }`}>
                    {file.name || file}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(stage === 'feature-engineering' || stage === 'cleaning') && (
          <div className="w-full max-w-md bg-white/10 backdrop-blur-md rounded-xl p-3 md:p-4 mb-4 md:mb-6 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-5 h-5 md:w-6 md:h-6 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
              <div>
                <p className="text-white font-semibold text-sm md:text-base">
                  {stage === 'feature-engineering' ? 'Engineering Features' : 'Finalizing Data'}
                </p>
                <p className="text-blue-200 text-xs md:text-sm">
                  {stage === 'feature-engineering'
                    ? 'Analyzing skills, experience, and qualifications...'
                    : 'Cleaning and preparing your dashboard...'}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 md:mt-6 text-center flex-shrink-0">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
          <p className="text-xs md:text-sm text-blue-200">Please wait while we analyze your CVs</p>
        </div>
      </div>
    </div>
  );
};

// Welcome Page Component
const WelcomePage = ({ navigate }) => {
  const { isAuthenticated, token, logout } = useAuth();
  const [validatingToken, setValidatingToken] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setTokenValid(false);
        return;
      }

      setValidatingToken(true);
      try {
        const response = await fetch(`${API_BASE}/`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          setTokenValid(true);
        } else {
          logout();
          setTokenValid(false);
        }
      } catch (error) {
        console.error('Token validation error:', error);
        logout();
        setTokenValid(false);
      } finally {
        setValidatingToken(false);
      }
    };

    if (isAuthenticated && token) {
      validateToken();
    } else {
      setTokenValid(false);
    }
  }, [token, isAuthenticated, logout]);

  const handleGetStarted = () => {
    if (isAuthenticated && tokenValid) {
      navigate('/upload');
    } else {
      navigate('/login');
    }
  };

  if (validatingToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-blue-100 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-200/40 via-transparent to-transparent"></div>
        <div className="relative text-center">
          <div className="w-12 h-12 md:w-16 md:h-16 border-4 border-blue-200 border-t-blue-900 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-blue-800 text-base md:text-lg font-medium">Validating session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-blue-100 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-200/40 via-transparent to-transparent"></div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-8">
        <div className="max-w-5xl w-full">
          <div className="text-center mb-6 animate-fade-in">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-gradient-to-r from-blue-900 to-blue-700 p-3 md:p-4 rounded-2xl shadow-xl shadow-blue-300/50">
                <FileBarChart className="w-10 h-10 md:w-12 md:h-12 text-white" />
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-blue-900 to-blue-700 bg-clip-text text-transparent mb-3 tracking-tight">
              CVAlyze
            </h1>
            <div className="h-1 w-20 md:w-24 bg-gradient-to-r from-blue-300 via-blue-700 to-blue-300 mx-auto mb-4"></div>
            <p className="text-base md:text-lg lg:text-xl text-blue-800 font-light max-w-3xl mx-auto leading-relaxed px-4">
              Transform Your Hiring Process with AI-Powered Resume Analysis
            </p>
          </div>

          <div className="bg-white/60 backdrop-blur-xl border border-blue-200 rounded-3xl p-4 md:p-6 lg:p-8 mb-6 md:mb-8 shadow-2xl">
            <div className="text-center mb-4 md:mb-6">
              <p className="text-sm md:text-base lg:text-lg text-blue-900 font-light italic leading-relaxed px-2">
                "Upload multiple CVs and resumes to instantly analyze, compare, and discover the best candidates with intelligent insights and comprehensive analytics."
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 md:p-5 text-center transform hover:scale-105 transition-all hover:shadow-lg">
                <div className="bg-gradient-to-r from-blue-900 to-blue-700 w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <Upload className="w-6 h-6 md:w-7 md:h-7 text-white" />
                </div>
                <h3 className="text-blue-900 font-semibold text-sm md:text-base mb-2">Bulk Upload</h3>
                <p className="text-blue-700 text-xs md:text-sm">Upload multiple resumes at once</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 md:p-5 text-center transform hover:scale-105 transition-all hover:shadow-lg">
                <div className="bg-gradient-to-r from-blue-900 to-blue-700 w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <BarChart3 className="w-6 h-6 md:w-7 md:h-7 text-white" />
                </div>
                <h3 className="text-blue-900 font-semibold text-sm md:text-base mb-2">Smart Analytics</h3>
                <p className="text-blue-700 text-xs md:text-sm">AI-powered insights and comparisons</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 md:p-5 text-center transform hover:scale-105 transition-all hover:shadow-lg">
                <div className="bg-gradient-to-r from-blue-900 to-blue-700 w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <Users className="w-6 h-6 md:w-7 md:h-7 text-white" />
                </div>
                <h3 className="text-blue-900 font-semibold text-sm md:text-base mb-2">Find Top Talent</h3>
                <p className="text-blue-700 text-xs md:text-sm">Rank and filter best candidates</p>
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={handleGetStarted}
                className="group bg-gradient-to-r from-blue-900 to-blue-700 text-white px-8 md:px-10 py-3 md:py-4 rounded-2xl font-bold text-base md:text-lg hover:from-blue-800 hover:to-blue-600 transition-all transform hover:scale-105 shadow-2xl shadow-blue-300/50 inline-flex items-center space-x-2 md:space-x-3"
              >
                <span>{isAuthenticated && tokenValid ? 'Go to Dashboard' : 'Get Started'}</span>
                <ArrowRight className="w-4 h-4 md:w-5 md:h-5 group-hover:translate-x-2 transition-transform" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div className="bg-white/60 backdrop-blur-sm border border-blue-200 rounded-2xl p-4 md:p-5 flex items-start space-x-3 shadow-lg hover:shadow-xl transition-shadow">
              <div className="bg-green-100 border border-green-300 rounded-full p-2 flex-shrink-0">
                <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-green-700" />
              </div>
              <div>
                <h4 className="text-blue-900 font-semibold mb-1 text-sm md:text-base">Visual Dashboards</h4>
                <p className="text-blue-700 text-xs md:text-sm">Interactive charts and geographic distribution maps</p>
              </div>
            </div>

            <div className="bg-white/60 backdrop-blur-sm border border-blue-200 rounded-2xl p-4 md:p-5 flex items-start space-x-3 shadow-lg hover:shadow-xl transition-shadow">
              <div className="bg-green-100 border border-green-300 rounded-full p-2 flex-shrink-0">
                <Database className="w-4 h-4 md:w-5 md:h-5 text-green-700" />
              </div>
              <div>
                <h4 className="text-blue-900 font-semibold mb-1 text-sm md:text-base">RAG-Powered AI</h4>
                <p className="text-blue-700 text-xs md:text-sm">Smart retrieval finds the most relevant candidates</p>
              </div>
            </div>

            <div className="bg-white/60 backdrop-blur-sm border border-blue-200 rounded-2xl p-4 md:p-5 flex items-start space-x-3 shadow-lg hover:shadow-xl transition-shadow">
              <div className="bg-green-100 border border-green-300 rounded-full p-2 flex-shrink-0">
                <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-green-700" />
              </div>
              <div>
                <h4 className="text-blue-900 font-semibold mb-1 text-sm md:text-base">Skill Matching</h4>
                <p className="text-blue-700 text-xs md:text-sm">Analyze skills, experience, and qualifications</p>
              </div>
            </div>

            <div className="bg-white/60 backdrop-blur-sm border border-blue-200 rounded-2xl p-4 md:p-5 flex items-start space-x-3 shadow-lg hover:shadow-xl transition-shadow">
              <div className="bg-green-100 border border-green-300 rounded-full p-2 flex-shrink-0">
                <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-green-700" />
              </div>
              <div>
                <h4 className="text-blue-900 font-semibold mb-1 text-sm md:text-base">Instant Insights</h4>
                <p className="text-blue-700 text-xs md:text-sm">Get comprehensive candidate profiles in seconds</p>
              </div>
            </div>
          </div>

          <div className="text-center mt-4 md:mt-6">
            <p className="text-blue-700 text-xs md:text-sm px-4">
              Trusted by HR professionals worldwide • Fast • Accurate • Intelligent
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Login/Register Page
const AuthPage = ({ navigate }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/login' : '/register';
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid username or password');
        } else if (response.status === 400) {
          throw new Error(data.detail || 'Invalid input');
        } else if (response.status === 409) {
          throw new Error('Username already exists');
        } else {
          throw new Error(data.detail || 'Request failed');
        }
      }

      if (isLogin) {
        login(data.Token, username);
        navigate('/upload');
      } else {
        setError('Registration successful! Please login.');
        setIsLogin(true);
        setPassword('');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-200/40 via-transparent to-transparent"></div>

      <div className="relative w-full max-w-md">
        <button
          onClick={() => navigate('/welcome')}
          className="mb-4 text-blue-700 hover:text-blue-900 flex items-center space-x-2 text-sm md:text-base"
        >
          <ArrowRight className="w-4 h-4 rotate-180" />
          <span>Back to Welcome</span>
        </button>

        <div className="bg-white/80 backdrop-blur-xl border border-blue-300 rounded-2xl p-6 md:p-8 shadow-2xl shadow-blue-300/50">
          <div className="flex items-center justify-center mb-6 md:mb-8">
            <div className="bg-gradient-to-r from-blue-900 to-blue-700 p-2 md:p-3 rounded-xl">
              <FileBarChart className="w-6 h-6 md:w-8 md:h-8 text-white" />
            </div>
          </div>

          <h2 className="text-2xl md:text-3xl font-bold text-center mb-2 bg-gradient-to-r from-blue-900 to-blue-700 bg-clip-text text-transparent">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-blue-800 text-center mb-6 md:mb-8 text-sm md:text-base">CVAlyze - Premium HR Analytics</p>

          {error && (
            <div className={`mb-4 p-3 border rounded-lg text-sm ${error.includes('successful')
              ? 'bg-green-100 border-green-300 text-green-700'
              : 'bg-red-100 border-red-300 text-red-700'
              }`}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">
            <div>
              <label className="block text-blue-800 text-sm font-medium mb-2">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 md:pl-11 pr-4 py-2.5 md:py-3 bg-blue-50 border border-blue-300 rounded-xl text-blue-900 placeholder-blue-400 focus:outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-200 transition-all text-sm md:text-base"
                  placeholder="Enter username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-blue-800 text-sm font-medium mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 md:pl-11 pr-11 md:pr-12 py-2.5 md:py-3 bg-blue-50 border border-blue-300 rounded-xl text-blue-900 placeholder-blue-400 focus:outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-200 transition-all text-sm md:text-base"
                  placeholder="Enter password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-600 hover:text-blue-800"
                >
                  {showPassword ? <EyeOff className="w-4 h-4 md:w-5 md:h-5" /> : <Eye className="w-4 h-4 md:w-5 md:h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 md:py-3 bg-gradient-to-r from-blue-900 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-800 hover:to-blue-600 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-300/50 text-sm md:text-base"
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <div className="mt-5 md:mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-blue-700 hover:text-blue-900 text-xs md:text-sm transition-colors font-medium"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// UploadPage component
const UploadPage = ({ navigate }) => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [invalidCVError, setInvalidCVError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({ currentFileIndex: 0, stage: 'extraction' });
  const { token, logout } = useAuth();
  const fileInputRef = useRef();

  const MAX_FILES = 40;

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setInvalidCVError(null);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFiles = Array.from(e.dataTransfer.files);
      if (selectedFiles.length > MAX_FILES) {
        setError(`You can only upload a maximum of ${MAX_FILES} files at a time.`);
        setFiles([]);
      } else {
        setError('');
        setFiles(selectedFiles);
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setInvalidCVError(null);
      if (selectedFiles.length > MAX_FILES) {
        setError(`You can only upload a maximum of ${MAX_FILES} files at a time.`);
        setFiles([]);
      } else {
        setError('');
        setFiles(selectedFiles);
      }
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    if (files.length > MAX_FILES) {
      setError(`You can only upload a maximum of ${MAX_FILES} files at a time.`);
      return;
    }

    setUploading(true);
    setInvalidCVError(null);
    setUploadProgress({ currentFileIndex: 0, stage: 'extraction' });

    const totalFiles = files.length;
    const estimatedTimePerFile = 3000;
    let progressInterval = null;
    let isBackendComplete = false;

    const startProgressSimulation = () => {
      let currentIndex = 0;
      progressInterval = setInterval(() => {
        if (isBackendComplete) {
          clearInterval(progressInterval);
          return;
        }
        if (currentIndex < totalFiles) {
          currentIndex++;
          setUploadProgress(prev => ({ ...prev, currentFileIndex: currentIndex }));
        } else {
          clearInterval(progressInterval);
        }
      }, estimatedTimePerFile);
    };

    startProgressSimulation();

    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    try {
      const response = await fetch(`${API_BASE}/upload_cvs`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      isBackendComplete = true;
      if (progressInterval) clearInterval(progressInterval);

      if (response.status === 401) {
        logout();
        return;
      }

      if (response.status === 413) {
        setUploading(false);
        setError('Upload failed: File size too large.');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Upload failed');
      }

      setUploadProgress({ currentFileIndex: totalFiles, stage: 'feature-engineering' });
      const data = await response.json();
      setUploadProgress({ currentFileIndex: totalFiles, stage: 'cleaning' });

      if (!data.jsonCv || data.jsonCv.length === 0) {
        setUploading(false);
        setInvalidCVError({
          message: 'The uploaded files do not appear to be valid CVs/Resumes.',
          suggestion: 'Please ensure you are uploading proper CV/Resume documents.',
          requirements: ['Candidate name and contact information', 'Professional experience or education details', 'Standard CV/Resume format (PDF, DOCX, or TXT)'],
          errors: data.errors || []
        });
        setFiles([]);
        return;
      }

      if (data.errors && data.errors.length > 0) {
        setInvalidCVError({
          isPartial: true,
          successCount: data.jsonCv.length,
          errorCount: data.errors.length,
          errors: data.errors
        });
        localStorage.setItem('cv_data', JSON.stringify(data.jsonCv));
        localStorage.removeItem('vector_db_cache');
        setTimeout(() => navigate('/dashboard'), 3000);
      } else {
        localStorage.setItem('cv_data', JSON.stringify(data.jsonCv));
        localStorage.removeItem('vector_db_cache');
        navigate('/dashboard');
      }
    } catch (err) {
      isBackendComplete = true;
      if (progressInterval) clearInterval(progressInterval);
      console.error('Upload error:', err);
      setError('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleClearInvalidError = () => {
    setInvalidCVError(null);
    setFiles([]);
    setError('');
  };

  return (
    <>
      {uploading && (
        <LoadingOverlay
          files={files}
          currentFileIndex={uploadProgress.currentFileIndex}
          stage={uploadProgress.stage}
        />
      )}

      <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-blue-100">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-200/40 via-transparent to-transparent"></div>

        <nav className="relative border-b border-blue-200 bg-white/60 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 py-3 md:py-4 flex justify-between items-center">
            <div className="flex items-center space-x-2 md:space-x-3">
              <FileBarChart className="w-6 h-6 md:w-8 md:h-8 text-blue-900" />
              <span className="text-lg md:text-2xl font-bold bg-gradient-to-r from-blue-900 to-blue-700 bg-clip-text text-transparent">CVAlyze</span>
            </div>
            <div className="flex items-center space-x-2 md:space-x-4">
              <button onClick={() => navigate('/settings')} className="p-1.5 md:p-2 text-blue-700 hover:text-blue-900 transition-colors">
                <Settings className="w-5 h-5 md:w-6 md:h-6" />
              </button>
              <button onClick={logout} className="flex items-center space-x-1 md:space-x-2 px-3 md:px-4 py-1.5 md:py-2 bg-blue-100 border border-blue-300 rounded-lg text-blue-800 hover:bg-blue-200 transition-all text-sm md:text-base">
                <LogOut className="w-4 h-4 md:w-5 md:h-5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </nav>

        <div className="relative max-w-4xl mx-auto px-4 py-8 md:py-16">
          <div className="text-center mb-8 md:mb-12">
            <h1 className="text-2xl md:text-4xl font-bold mb-3 md:mb-4 bg-gradient-to-r from-blue-900 to-blue-700 bg-clip-text text-transparent">
              Upload CVs for Analysis
            </h1>
            <p className="text-blue-800 text-sm md:text-base px-4">Drag and drop or click to select CV files (.pdf, .docx, .txt)</p>
            <p className="text-blue-700 text-xs md:text-sm mt-2">Maximum {MAX_FILES} files per upload</p>
          </div>

          {error && !invalidCVError && (
            <div className="mb-6 p-3 md:p-4 bg-red-100 border border-red-300 rounded-xl text-red-700 text-center text-sm md:text-base">
              <p className="font-semibold">{error}</p>
            </div>
          )}

          {invalidCVError && !invalidCVError.isPartial && (
            <div className="mb-6 bg-red-50 border-2 border-red-300 rounded-2xl p-4 md:p-6 shadow-lg">
              <div className="flex items-start space-x-3 md:space-x-4">
                <div className="bg-red-100 rounded-full p-2 md:p-3 flex-shrink-0">
                  <X className="w-6 h-6 md:w-8 md:h-8 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg md:text-xl font-bold text-red-700 mb-2">Invalid File Format Detected</h3>
                  <p className="text-red-600 mb-3 md:mb-4 text-sm md:text-base">{invalidCVError.message}</p>
                  <div className="bg-white border border-red-200 rounded-lg p-3 md:p-4 mb-3 md:mb-4">
                    <p className="text-gray-700 font-semibold mb-2 text-sm md:text-base">{invalidCVError.suggestion}</p>
                    <ul className="space-y-1">
                      {invalidCVError.requirements.map((req, idx) => (
                        <li key={idx} className="flex items-start text-gray-600 text-sm md:text-base">
                          <CheckCircle className="w-3 h-3 md:w-4 md:h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button onClick={handleClearInvalidError} className="px-4 md:px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-all flex items-center space-x-2 text-sm md:text-base">
                    <Upload className="w-4 h-4 md:w-5 md:h-5" />
                    <span>Try Again with Valid CVs</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {invalidCVError && invalidCVError.isPartial && (
            <div className="mb-6 bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-4 md:p-6 shadow-lg">
              <div className="flex items-start space-x-3 md:space-x-4">
                <div className="bg-yellow-100 rounded-full p-2 md:p-3 flex-shrink-0">
                  <TrendingUp className="w-6 h-6 md:w-8 md:h-8 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg md:text-xl font-bold text-yellow-700 mb-2">Partial Success</h3>
                  <p className="text-yellow-600 mb-3 text-sm md:text-base">
                    Successfully processed: <span className="font-bold">{invalidCVError.successCount}</span> CVs<br />
                    Failed to process: <span className="font-bold">{invalidCVError.errorCount}</span> files
                  </p>
                  <p className="text-gray-600 text-xs md:text-sm">Redirecting to dashboard...</p>
                </div>
              </div>
            </div>
          )}

          {!invalidCVError && (
            <>
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-8 md:p-16 text-center cursor-pointer transition-all ${dragActive ? 'border-blue-900 bg-blue-100' : 'border-blue-300 bg-blue-50/50 hover:border-blue-700 hover:bg-blue-100/50'} backdrop-blur-xl`}
              >
                <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.txt" onChange={handleFileChange} className="hidden" />
                <Upload className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 md:mb-4 text-blue-700" />
                <h3 className="text-lg md:text-xl font-semibold text-blue-900 mb-2">Drop CV files here</h3>
                <p className="text-blue-800 mb-3 md:mb-4 text-sm md:text-base">or click to browse</p>
                <p className="text-xs md:text-sm text-blue-700">Supports PDF, DOCX, and TXT formats</p>
                <p className="text-xs md:text-sm text-blue-600 mt-2 font-semibold">Max {MAX_FILES} files at a time</p>
              </div>

              {files.length > 0 && (
                <div className="mt-6 md:mt-8 bg-white/60 backdrop-blur-xl border border-blue-200 rounded-2xl p-4 md:p-6">
                  <h3 className="text-base md:text-lg font-semibold text-blue-800 mb-4">Selected Files ({files.length}/{MAX_FILES})</h3>
                  <div className="space-y-2 max-h-48 md:max-h-64 overflow-y-auto">
                    {files.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 md:p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <span className="text-blue-900 truncate text-sm md:text-base flex-1 mr-2">{file.name}</span>
                        <span className="text-blue-700 text-xs md:text-sm flex-shrink-0">{(file.size / 1024).toFixed(1)} KB</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleUpload}
                    disabled={uploading || files.length === 0 || files.length > MAX_FILES}
                    className="w-full mt-4 md:mt-6 py-2.5 md:py-3 bg-gradient-to-r from-blue-900 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-800 hover:to-blue-600 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-300/50 text-sm md:text-base"
                  >
                    {files.length > MAX_FILES ? `Too many files (Max ${MAX_FILES})` : 'Upload and Analyze'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

// Candidate Detail Modal
const CandidateDetailModal = ({ candidate, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-blue-200 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl my-4">
        <div className="sticky top-0 bg-gradient-to-r from-blue-900 to-blue-700 p-4 md:p-6 flex justify-between items-center">
          <h2 className="text-xl md:text-2xl font-bold text-white">{normalizeName(candidate.name)}</h2>
          <button onClick={onClose} className="p-2 hover:bg-blue-800 rounded-lg transition-colors">
            <X className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 md:p-4">
            <h3 className="text-lg md:text-xl font-bold text-blue-900 mb-3">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div>
                <p className="text-xs md:text-sm text-blue-700 font-semibold">Profession</p>
                <p className="text-blue-900 text-sm md:text-base">{candidate.profession || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs md:text-sm text-blue-700 font-semibold">Gender</p>
                <p className="text-blue-900 capitalize text-sm md:text-base">{candidate.gender || 'N/A'}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs md:text-sm text-blue-700 font-semibold">Email</p>
                <p className="text-blue-900 break-all text-sm md:text-base">{candidate.email || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs md:text-sm text-blue-700 font-semibold">Phone</p>
                <p className="text-blue-900 text-sm md:text-base">{candidate.phone_number || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs md:text-sm text-blue-700 font-semibold">Location</p>
                <p className="text-blue-900 text-sm md:text-base">{candidate.location || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs md:text-sm text-blue-700 font-semibold">Country</p>
                <p className="text-blue-900 text-sm md:text-base">{candidate.country || 'N/A'}</p>
              </div>
            </div>
          </div>

          {candidate.skills && Array.isArray(candidate.skills) && candidate.skills.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 md:p-4">
              <h3 className="text-lg md:text-xl font-bold text-blue-900 mb-3">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {candidate.skills.map((skill, i) => (
                  <span key={i} className="px-2 md:px-3 py-1 bg-blue-200 border border-blue-300 rounded-lg text-blue-900 text-xs md:text-sm">
                    {renderDataItem(skill)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {candidate.education && Array.isArray(candidate.education) && candidate.education.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 md:p-4">
              <h3 className="text-lg md:text-xl font-bold text-blue-900 mb-3">Education</h3>
              <ul className="space-y-2">
                {candidate.education.map((edu, i) => (
                  <li key={i} className="text-blue-900 flex items-start text-sm md:text-base">
                    <span className="text-blue-700 mr-2">•</span>
                    <span>{renderDataItem(edu)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {candidate.experience && Array.isArray(candidate.experience) && candidate.experience.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 md:p-4">
              <h3 className="text-lg md:text-xl font-bold text-blue-900 mb-3">Experience</h3>
              <ul className="space-y-2">
                {candidate.experience.map((exp, i) => (
                  <li key={i} className="text-blue-900 flex items-start text-sm md:text-base">
                    <span className="text-blue-700 mr-2">•</span>
                    <span>{renderDataItem(exp)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {candidate.projects && Array.isArray(candidate.projects) && candidate.projects.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 md:p-4">
              <h3 className="text-lg md:text-xl font-bold text-blue-900 mb-3">Projects</h3>
              <div className="space-y-3">
                {candidate.projects.map((project, i) => {
                  const projectName = typeof project === 'object' ? project.name : renderDataItem(project);
                  const projectLinks = typeof project === 'object' && Array.isArray(project.links) ? project.links : null;
                  return (
                    <div key={i} className="bg-white border border-blue-200 rounded-lg p-3">
                      <p className="text-blue-900 font-semibold mb-2 text-sm md:text-base">{projectName}</p>
                      {projectLinks && projectLinks.length > 0 ? (
                        <div className="space-y-1">
                          {projectLinks.map((link, linkIdx) => (
                            <a key={linkIdx} href={link} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:text-blue-900 text-xs md:text-sm underline block break-all">
                              Link {linkIdx + 1}: {link}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="text-blue-600 text-xs md:text-sm italic">No links given</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {candidate.certifications && Array.isArray(candidate.certifications) && candidate.certifications.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 md:p-4">
              <h3 className="text-lg md:text-xl font-bold text-blue-900 mb-3">Certifications</h3>
              <ul className="space-y-2">
                {candidate.certifications.map((cert, i) => (
                  <li key={i} className="text-blue-900 flex items-start text-sm md:text-base">
                    <span className="text-blue-700 mr-2">✓</span>
                    <span>{renderDataItem(cert)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {candidate.achievements && Array.isArray(candidate.achievements) && candidate.achievements.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 md:p-4">
              <h3 className="text-lg md:text-xl font-bold text-blue-900 mb-3">Achievements</h3>
              <ul className="space-y-2">
                {candidate.achievements.map((achievement, i) => (
                  <li key={i} className="text-blue-900 flex items-start text-sm md:text-base">
                    <span className="text-blue-700 mr-2">★</span>
                    <span>{renderDataItem(achievement)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 md:p-4">
            <h3 className="text-lg md:text-xl font-bold text-blue-900 mb-3">Links</h3>
            <div className="flex flex-wrap gap-2 md:gap-3">
              {candidate.github_link && (
                <a href={candidate.github_link} target="_blank" rel="noopener noreferrer" className="px-3 md:px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-all text-xs md:text-sm">
                  GitHub Profile
                </a>
              )}
              {candidate.linkedin_link && (
                <a href={candidate.linkedin_link} target="_blank" rel="noopener noreferrer" className="px-3 md:px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-all text-xs md:text-sm">
                  LinkedIn Profile
                </a>
              )}
              {candidate.portfolio_link && (
                <a href={candidate.portfolio_link} target="_blank" rel="noopener noreferrer" className="px-3 md:px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-all text-xs md:text-sm">
                  Portfolio
                </a>
              )}
              {!candidate.github_link && !candidate.linkedin_link && !candidate.portfolio_link && (
                <p className="text-blue-700 text-sm md:text-base">No links available</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Dashboard Page
const DashboardPage = ({ navigate }) => {
  const [cvData, setCvData] = useState([]);
  const [filters, setFilters] = useState({ country: 'all', profession: 'all' });
  const [tableFilters, setTableFilters] = useState({ gender: 'all', profession: 'all', location: 'all' });
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const { logout } = useAuth();

  useEffect(() => {
    try {
      const storedData = localStorage.getItem('cv_data');
      if (storedData && storedData !== 'undefined' && storedData !== 'null') {
        const parsedData = JSON.parse(storedData);
        const normalizedData = Array.isArray(parsedData)
          ? parsedData.map(cv => ({ ...cv, name: normalizeName(cv.name) }))
          : [];
        setCvData(normalizedData);
      } else {
        setCvData([]);
      }
    } catch (error) {
      console.error('Error parsing CV data:', error);
      setCvData([]);
    }
  }, []);

  useEffect(() => {
    if (cvData.length > 0) {
      renderMapChart();
      renderGenderChart();
      renderSkillsChart();
      renderCountryChart();
      renderHeatmap();
    }
  }, [cvData, filters]);

  const renderMapChart = () => {
    const filteredData = cvData.filter(cv => {
      if (filters.country !== 'all' && cv.country !== filters.country) return false;
      if (filters.profession !== 'all' && cv.profession !== filters.profession) return false;
      return cv.latitude && cv.longitude;
    });

    const locationGroups = {};
    filteredData.forEach(cv => {
      const key = `${cv.latitude.toFixed(2)},${cv.longitude.toFixed(2)}`;
      if (!locationGroups[key]) {
        locationGroups[key] = { lat: cv.latitude, lon: cv.longitude, candidates: [] };
      }
      locationGroups[key].candidates.push(cv);
    });

    const locations = Object.values(locationGroups);

    const data = [{
      type: 'scattergeo',
      mode: 'markers',
      lon: locations.map(loc => loc.lon),
      lat: locations.map(loc => loc.lat),
      text: locations.map(loc => {
        const names = loc.candidates.map(c => c.name).join('<br>');
        const location = loc.candidates[0].location || loc.candidates[0].country;
        return `<b>${location}</b><br>Candidates (${loc.candidates.length}):<br>${names}`;
      }),
      marker: {
        size: locations.map(loc => Math.min(10 + loc.candidates.length * 5, 50)),
        color: locations.map(loc => loc.candidates.length),
        colorscale: [[0, '#bfdbfe'], [0.5, '#1e40af'], [1, '#1e3a8a']],
        line: { width: 2, color: '#fff' },
        colorbar: { title: 'Count', tickfont: { color: '#1e3a8a', size: 10 }, titlefont: { color: '#1e3a8a', size: 11 } }
      },
      hovertemplate: '%{text}<extra></extra>'
    }];

    const layout = {
      geo: {
        projection: { type: 'natural earth' },
        bgcolor: 'rgba(255,255,255,0)',
        showland: true, landcolor: '#f3f4f6',
        showocean: true, oceancolor: '#e5e7eb',
        showcountries: true, countrycolor: '#d1d5db'
      },
      paper_bgcolor: 'rgba(255,255,255,0)',
      plot_bgcolor: 'rgba(255,255,255,0)',
      margin: { t: 10, b: 10, l: 10, r: 10 },
      font: { color: '#1e3a8a', size: 11 }
    };

    Plotly.newPlot('map-chart', data, layout, { responsive: true, displayModeBar: false });
  };

  const renderGenderChart = () => {
    const genderCounts = cvData.reduce((acc, cv) => {
      const gender = cv.gender || 'Unknown';
      acc[gender] = (acc[gender] || 0) + 1;
      return acc;
    }, {});

    const data = [{
      values: Object.values(genderCounts),
      labels: Object.keys(genderCounts),
      type: 'pie',
      marker: { colors: ['#1e3a8a', '#3b82f6', '#93c5fd', '#dbeafe'], line: { color: '#fff', width: 2 } },
      textfont: { color: '#fff', size: 12, family: 'Arial' },
      textposition: 'inside'
    }];

    const layout = {
      paper_bgcolor: 'rgba(255,255,255,0)',
      plot_bgcolor: 'rgba(255,255,255,0)',
      font: { color: '#1e3a8a', size: 11 },
      margin: { t: 20, b: 20, l: 20, r: 20 },
      showlegend: true,
      legend: { font: { color: '#1e3a8a', size: 10 }, bgcolor: 'rgba(255,255,255,0.8)' }
    };

    Plotly.newPlot('gender-chart', data, layout, { responsive: true, displayModeBar: false });
  };

  const renderSkillsChart = () => {
    const skillCounts = {};
    cvData.forEach(cv => {
      (cv.skills || []).forEach(skill => {
        const skillStr = typeof skill === 'string' ? skill : (skill?.name || String(skill));
        skillCounts[skillStr] = (skillCounts[skillStr] || 0) + 1;
      });
    });

    const sortedSkills = Object.entries(skillCounts).sort((a, b) => b[1] - a[1]);
    const filteredData = sortedSkills.map(s => ({ label: s[0], value: s[1] }));
    const colors = ['#1e3a8a', '#1e40af', '#3b82f6', '#60a5fa', '#93c5fd', '#1d4ed8', '#2563eb'];

    const data = [{
      type: 'treemap',
      labels: filteredData.map(d => d.label),
      parents: filteredData.map(() => ''),
      values: filteredData.map(d => d.value),
      text: filteredData.map(d => `${d.value}`),
      textposition: 'middle center',
      marker: { colors: filteredData.map((_, i) => colors[i % colors.length]), line: { color: '#fff', width: 2 } },
      textfont: { color: '#fff', size: 10, family: 'Arial' },
      hovertemplate: '<b>%{label}</b><br>Count: %{value}<extra></extra>'
    }];

    const layout = {
      paper_bgcolor: 'rgba(255,255,255,0)',
      plot_bgcolor: 'rgba(255,255,255,0)',
      margin: { t: 10, b: 10, l: 10, r: 10 },
      height: Math.max(300, Math.min(800, filteredData.length * 8))
    };

    Plotly.newPlot('skills-chart', data, layout, { responsive: true, displayModeBar: false });
  };

  const renderCountryChart = () => {
    const countryCounts = {};
    cvData.forEach(cv => {
      const country = cv.country || 'Unknown';
      countryCounts[country] = (countryCounts[country] || 0) + 1;
    });

    const sortedCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]);
    const filteredData = sortedCountries.map(c => ({ label: c[0], value: c[1] })).filter(item => item.value > 0);
    const colors = ['#1e3a8a', '#1e40af', '#3b82f6', '#60a5fa', '#93c5fd', '#1d4ed8', '#2563eb'];

    const data = [{
      type: 'treemap',
      labels: filteredData.map(d => d.label),
      parents: filteredData.map(() => ''),
      values: filteredData.map(d => d.value),
      text: filteredData.map(d => `${d.value}`),
      textposition: 'middle center',
      marker: { colors: filteredData.map((_, i) => colors[i % colors.length]), line: { color: '#fff', width: 3 } },
      textfont: { color: '#fff', size: 14, family: 'Arial' },
      hovertemplate: '<b>%{label}</b><br>Candidates: %{value}<extra></extra>'
    }];

    const layout = {
      paper_bgcolor: 'rgba(255,255,255,0)',
      plot_bgcolor: 'rgba(255,255,255,0)',
      margin: { t: 10, b: 10, l: 10, r: 10 }
    };

    Plotly.newPlot('country-chart', data, layout, { responsive: true, displayModeBar: false });
  };

  const renderHeatmap = () => {
    const allSkills = [...new Set(cvData.flatMap(cv =>
      (cv.skills || []).map(skill => typeof skill === 'string' ? skill : (skill?.name || String(skill)))
    ))];

    const skillFrequency = {};
    cvData.forEach(cv => {
      (cv.skills || []).forEach(skill => {
        const skillStr = typeof skill === 'string' ? skill : (skill?.name || String(skill));
        skillFrequency[skillStr] = (skillFrequency[skillStr] || 0) + 1;
      });
    });

    const sortedSkills = allSkills.sort((a, b) => (skillFrequency[b] || 0) - (skillFrequency[a] || 0));
    const zData = cvData.map(cv => {
      const cvSkills = (cv.skills || []).map(skill => typeof skill === 'string' ? skill : (skill?.name || String(skill)));
      return sortedSkills.map(skill => cvSkills.includes(skill) ? 1 : 0);
    });

    const numSkills = sortedSkills.length;
    const numCandidates = cvData.length;

    const data = [{
      z: zData,
      x: sortedSkills,
      y: cvData.map(cv => cv.name),
      type: 'heatmap',
      colorscale: [[0, '#ffffff'], [1, '#1e3a8a']],
      showscale: true,
      colorbar: { tickvals: [0, 1], ticktext: ['No Skill', 'Has Skill'], tickfont: { color: '#1e3a8a', size: 9 }, outlinewidth: 0, len: 0.5, thickness: 12 },
      hovertemplate: '<b>%{y}</b><br>Skill: <b>%{x}</b><extra></extra>',
      xgap: 1, ygap: 1
    }];

    const layout = {
      paper_bgcolor: 'rgba(255,255,255,0)',
      plot_bgcolor: 'rgba(255,255,255,0)',
      xaxis: { title: { text: `Skills (Total: ${numSkills})`, font: { color: '#1e3a8a', size: 11 } }, gridcolor: '#e5e7eb', tickangle: -45, tickfont: { size: numSkills > 100 ? 6 : 9, color: '#1e3a8a' }, automargin: true },
      yaxis: { title: { text: `Candidates (Total: ${numCandidates})`, font: { color: '#1e3a8a', size: 11 } }, gridcolor: '#e5e7eb', tickfont: { size: numCandidates > 50 ? 6 : 9, color: '#1e3a8a' }, automargin: true },
      margin: { t: 20, b: Math.max(80, Math.min(150, numSkills * 2)), l: Math.max(100, Math.min(200, numCandidates * 2.5)), r: 30 },
      height: Math.max(400, numCandidates * 25),
      font: { color: '#1e3a8a' }
    };

    Plotly.newPlot('heatmap-chart', data, layout, { responsive: true, displayModeBar: false, scrollZoom: true });
  };

  const filteredTableData = cvData.filter(cv => {
    if (tableFilters.gender !== 'all' && cv.gender !== tableFilters.gender) return false;
    if (tableFilters.profession !== 'all' && cv.profession !== tableFilters.profession) return false;
    if (tableFilters.location !== 'all' && cv.country !== tableFilters.location) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-blue-100">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-200/40 via-transparent to-transparent"></div>

      <nav className="relative border-b border-blue-200 bg-white/60 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 md:py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2 md:space-x-3">
            <FileBarChart className="w-6 h-6 md:w-8 md:h-8 text-blue-900" />
            <span className="text-lg md:text-2xl font-bold bg-gradient-to-r from-blue-900 to-blue-700 bg-clip-text text-transparent">CVAlyze Dashboard</span>
          </div>
          <div className="flex items-center space-x-2 md:space-x-4">
            <button onClick={() => navigate('/upload')} className="p-1.5 md:p-2 text-blue-700 hover:text-blue-900">
              <Upload className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            <button onClick={() => navigate('/settings')} className="p-1.5 md:p-2 text-blue-700 hover:text-blue-900">
              <Settings className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            <button onClick={logout} className="flex items-center space-x-1 md:space-x-2 px-3 md:px-4 py-1.5 md:py-2 bg-blue-100 border border-blue-300 rounded-lg text-blue-800 hover:bg-blue-200 text-sm md:text-base">
              <LogOut className="w-4 h-4 md:w-5 md:h-5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="relative max-w-7xl mx-auto px-4 py-4 md:py-8 space-y-4 md:space-y-6">
        {/* Map Section */}
        <div className="bg-white/60 backdrop-blur-xl border border-blue-200 rounded-2xl p-4 md:p-6 shadow-xl">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 space-y-3 md:space-y-0">
            <h2 className="text-xl md:text-2xl font-bold text-blue-800 flex items-center">
              <Globe className="w-5 h-5 md:w-6 md:h-6 mr-2" /> Geographic Distribution
            </h2>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
              <select value={filters.country} onChange={(e) => setFilters({ ...filters, country: e.target.value })} className="w-full sm:w-auto px-3 md:px-4 py-2 bg-blue-50 border border-blue-300 rounded-lg text-blue-900 focus:outline-none text-sm md:text-base">
                <option value="all">All Countries</option>
                {[...new Set(cvData.map(cv => cv.country))].map(country => <option key={country} value={country}>{country}</option>)}
              </select>
              <select value={filters.profession} onChange={(e) => setFilters({ ...filters, profession: e.target.value })} className="w-full sm:w-auto px-3 md:px-4 py-2 bg-blue-50 border border-blue-300 rounded-lg text-blue-900 focus:outline-none text-sm md:text-base">
                <option value="all">All Professions</option>
                {[...new Set(cvData.map(cv => cv.profession))].map(prof => <option key={prof} value={prof}>{prof}</option>)}
              </select>
            </div>
          </div>
          <div id="map-chart" className="h-64 md:h-96 w-full"></div>
        </div>

        {/* Country & Gender Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="bg-white/60 backdrop-blur-xl border border-blue-200 rounded-2xl p-4 md:p-6 shadow-xl">
            <h2 className="text-lg md:text-xl font-bold text-blue-800 mb-3 md:mb-4 flex items-center">
              <Globe className="w-4 h-4 md:w-5 md:h-5 mr-2" /> Country Distribution
            </h2>
            <div id="country-chart" className="h-64 md:h-80 w-full"></div>
          </div>
          <div className="bg-white/60 backdrop-blur-xl border border-blue-200 rounded-2xl p-4 md:p-6 shadow-xl">
            <h2 className="text-lg md:text-xl font-bold text-blue-800 mb-3 md:mb-4 flex items-center">
              <PieChart className="w-4 h-4 md:w-5 md:h-5 mr-2" /> Gender Distribution
            </h2>
            <div id="gender-chart" className="h-64 md:h-80 w-full"></div>
          </div>
        </div>

        {/* Skills Tree Map */}
        <div className="bg-white/60 backdrop-blur-xl border border-blue-200 rounded-2xl p-4 md:p-6 shadow-xl">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-3 md:mb-4 space-y-2 md:space-y-0">
            <h2 className="text-xl md:text-2xl font-bold text-blue-800 flex items-center">
              <BarChart3 className="w-5 h-5 md:w-6 md:h-6 mr-2" /> Skills Tree Map
            </h2>
            <div className="bg-blue-100 border border-blue-300 rounded-lg px-3 md:px-4 py-2">
              <p className="text-blue-900 font-semibold text-xs md:text-sm">
                Total Unique Skills: {Object.keys(cvData.reduce((acc, cv) => {
                  (cv.skills || []).forEach(skill => {
                    const skillStr = typeof skill === 'string' ? skill : (skill?.name || String(skill));
                    acc[skillStr] = true;
                  });
                  return acc;
                }, {})).length}
              </p>
            </div>
          </div>
          <div id="skills-chart" className="min-h-[300px] md:min-h-96 w-full"></div>
          <p className="text-blue-700 text-xs md:text-sm mt-2 md:mt-3 text-center italic">
            Showing all skills across all candidates • Size indicates skill frequency
          </p>
        </div>

        {/* Skill Coverage Heatmap */}
        <div className="bg-white/60 backdrop-blur-xl border border-blue-200 rounded-2xl p-4 md:p-6 shadow-xl">
          <h2 className="text-xl md:text-2xl font-bold text-blue-800 mb-3 md:mb-4 flex items-center">
            <Grid className="w-5 h-5 md:w-6 md:h-6 mr-2" /> Skill Coverage Heatmap
          </h2>
          <div id="heatmap-chart" className="h-96 w-full overflow-auto"></div>
        </div>

        {/* Matrix Table */}
        <div className="bg-white/60 backdrop-blur-xl border border-blue-200 rounded-2xl p-4 md:p-6 shadow-xl">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 space-y-3 md:space-y-0">
            <h2 className="text-xl md:text-2xl font-bold text-blue-800 flex items-center">
              <Grid className="w-5 h-5 md:w-6 md:h-6 mr-2" /> Candidate Matrix
            </h2>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
              <select value={tableFilters.gender} onChange={(e) => setTableFilters({ ...tableFilters, gender: e.target.value })} className="w-full sm:w-auto px-3 md:px-4 py-2 bg-blue-50 border border-blue-300 rounded-lg text-blue-900 text-xs md:text-sm focus:outline-none">
                <option value="all">All Genders</option>
                {[...new Set(cvData.map(cv => cv.gender))].map(gender => <option key={gender} value={gender}>{gender}</option>)}
              </select>
              <select value={tableFilters.profession} onChange={(e) => setTableFilters({ ...tableFilters, profession: e.target.value })} className="w-full sm:w-auto px-3 md:px-4 py-2 bg-blue-50 border border-blue-300 rounded-lg text-blue-900 text-xs md:text-sm focus:outline-none">
                <option value="all">All Professions</option>
                {[...new Set(cvData.map(cv => cv.profession))].map(prof => <option key={prof} value={prof}>{prof}</option>)}
              </select>
              <select value={tableFilters.location} onChange={(e) => setTableFilters({ ...tableFilters, location: e.target.value })} className="w-full sm:w-auto px-3 md:px-4 py-2 bg-blue-50 border border-blue-300 rounded-lg text-blue-900 text-xs md:text-sm focus:outline-none">
                <option value="all">All Locations</option>
                {[...new Set(cvData.map(cv => cv.country))].map(loc => <option key={loc} value={loc}>{loc}</option>)}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-blue-300">
                  <th className="text-left p-2 md:p-3 text-blue-800 font-semibold text-xs md:text-sm">Name</th>
                  <th className="text-left p-2 md:p-3 text-blue-800 font-semibold text-xs md:text-sm">Profession</th>
                  <th className="text-left p-2 md:p-3 text-blue-800 font-semibold text-xs md:text-sm">Phone</th>
                  <th className="text-left p-2 md:p-3 text-blue-800 font-semibold text-xs md:text-sm">Email</th>
                  <th className="text-left p-2 md:p-3 text-blue-800 font-semibold text-xs md:text-sm">Location</th>
                  <th className="text-left p-2 md:p-3 text-blue-800 font-semibold text-xs md:text-sm">Gender</th>
                  <th className="text-left p-2 md:p-3 text-blue-800 font-semibold text-xs md:text-sm">Country</th>
                </tr>
              </thead>
              <tbody>
                {filteredTableData.map((cv, idx) => (
                  <tr key={idx} className="border-b border-blue-200 hover:bg-blue-100 transition-colors">
                    <td className="p-2 md:p-3 text-blue-900 text-xs md:text-sm">{cv.name}</td>
                    <td className="p-2 md:p-3 text-blue-800 text-xs md:text-sm">{cv.profession}</td>
                    <td className="p-2 md:p-3 text-blue-800 text-xs md:text-sm">{cv.phone_number}</td>
                    <td className="p-2 md:p-3 text-blue-800 text-xs md:text-sm break-all">{cv.email}</td>
                    <td className="p-2 md:p-3 text-blue-800 text-xs md:text-sm">{cv.location || 'N/A'}</td>
                    <td className="p-2 md:p-3 text-blue-800 capitalize text-xs md:text-sm">{cv.gender}</td>
                    <td className="p-2 md:p-3 text-blue-800 text-xs md:text-sm">{cv.country}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Candidate Cards */}
        <div className="bg-white/60 backdrop-blur-xl border border-blue-200 rounded-2xl p-4 md:p-6 shadow-xl">
          <h2 className="text-xl md:text-2xl font-bold text-blue-800 mb-4 md:mb-6">Candidate Profiles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filteredTableData.map((cv, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedCandidate(cv)}
                className="bg-gradient-to-br from-blue-100 to-blue-50 border border-blue-200 rounded-xl p-4 md:p-6 hover:border-blue-700 transition-all transform hover:scale-[1.02] cursor-pointer shadow-md hover:shadow-xl"
              >
                <div className="flex items-start justify-between mb-3 md:mb-4">
                  <div>
                    <h3 className="text-lg md:text-xl font-bold text-blue-900 mb-1">{cv.name}</h3>
                    <p className="text-blue-800 text-xs md:text-sm">{cv.profession}</p>
                  </div>
                  <span className="px-2 md:px-3 py-1 bg-blue-200 border border-blue-300 rounded-full text-blue-900 text-xs capitalize">{cv.gender}</span>
                </div>
                <div className="space-y-2 mb-3 md:mb-4">
                  <p className="text-blue-800 text-xs md:text-sm flex items-center break-all">
                    <Mail className="w-3 h-3 md:w-4 md:h-4 mr-2 text-blue-700 flex-shrink-0" />
                    {cv.email}
                  </p>
                  {cv.phone_number && <p className="text-blue-800 text-xs md:text-sm">{cv.phone_number}</p>}
                  {cv.location && <p className="text-blue-800 text-xs md:text-sm">{cv.location}</p>}
                </div>
                {cv.skills && Array.isArray(cv.skills) && cv.skills.length > 0 && (
                  <div className="mb-3 md:mb-4">
                    <p className="text-blue-800 text-xs font-semibold mb-2">Top Skills:</p>
                    <div className="flex flex-wrap gap-1">
                      {cv.skills.slice(0, 6).map((skill, i) => (
                        <span key={i} className="px-2 py-1 bg-blue-200 border border-blue-300 rounded text-xs text-blue-900">
                          {renderDataItem(skill)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {cv.projects && Array.isArray(cv.projects) && cv.projects.length > 0 && (
                  <div className="mb-3 md:mb-4">
                    <p className="text-blue-800 text-xs font-semibold mb-1">Projects: {cv.projects.length}</p>
                  </div>
                )}
                <div className="flex space-x-2">
                  {cv.github_link && (
                    <a href={cv.github_link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex-1 px-2 md:px-3 py-2 bg-blue-200 border border-blue-300 rounded-lg text-blue-900 text-xs md:text-sm text-center hover:bg-blue-300 transition-all">
                      GitHub
                    </a>
                  )}
                  {cv.linkedin_link && (
                    <a href={cv.linkedin_link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex-1 px-2 md:px-3 py-2 bg-blue-200 border border-blue-300 rounded-lg text-blue-900 text-xs md:text-sm text-center hover:bg-blue-300 transition-all">
                      LinkedIn
                    </a>
                  )}
                </div>
                <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-blue-300">
                  <button className="w-full px-2 md:px-3 py-2 bg-blue-900 text-white rounded-lg text-xs md:text-sm hover:bg-blue-800 transition-all">
                    View Full Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chatbot Button */}
      <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-50">
        {!chatOpen && (
          <div className="absolute bottom-16 md:bottom-20 right-0 bg-white border-2 border-blue-300 rounded-lg p-2 md:p-3 shadow-xl mb-2 w-48 md:w-64 animate-bounce hidden sm:block">
            <p className="text-blue-900 text-xs md:text-sm font-medium">
              Hey friend! I am here to assist you (RAG-Powered! 🚀)
            </p>
            <div className="absolute bottom-0 right-6 md:right-8 transform translate-y-1/2 rotate-45 w-3 h-3 md:w-4 md:h-4 bg-white border-r-2 border-b-2 border-blue-300"></div>
          </div>
        )}
        <button onClick={() => setChatOpen(true)} className="p-3 md:p-4 bg-gradient-to-r from-blue-900 to-blue-700 rounded-full shadow-2xl shadow-blue-500/50 hover:scale-110 transition-transform">
          <UserPen className="w-5 h-5 md:w-6 md:h-6 text-white" />
        </button>
      </div>

      {chatOpen && <ChatAssistant cvData={cvData} onClose={() => setChatOpen(false)} />}
      {selectedCandidate && <CandidateDetailModal candidate={selectedCandidate} onClose={() => setSelectedCandidate(null)} />}
    </div>
  );
};

// ==================== RAG-ENHANCED CHAT ASSISTANT ====================
const ChatAssistant = ({ cvData, onClose }) => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hey, I am Analysis Assistant powered by RAG! 🚀 I can find the most relevant candidates for your queries. How can I help you?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [vectorDB, setVectorDB] = useState([]);
  const [buildingDB, setBuildingDB] = useState(false);
  const [dbProgress, setDbProgress] = useState(0);
  const [dbReady, setDbReady] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const initVectorDB = async () => {
      if (cvData.length === 0) {
        setDbReady(true);
        return;
      }

      const cachedDB = localStorage.getItem('vector_db_cache');
      const cachedDataHash = localStorage.getItem('cv_data_hash');
      const currentDataHash = JSON.stringify(cvData).length.toString();

      if (cachedDB && cachedDataHash === currentDataHash) {
        try {
          const parsed = JSON.parse(cachedDB);
          if (parsed.length > 0 && parsed[0].embedding) {
            setVectorDB(parsed);
            setDbReady(true);
            console.log('Loaded vector DB from cache');
            return;
          }
        } catch (e) {
          console.log('Cache invalid, rebuilding...');
        }
      }

      setBuildingDB(true);
      setDbProgress(0);

      try {
        const chunks = createChunks(cvData);
        console.log(`Creating embeddings for ${chunks.length} candidates...`);

        const db = await buildVectorDB(chunks, GEMINI_API_KEY, (progress) => {
          setDbProgress(Math.round(progress));
        });

        setVectorDB(db);
        localStorage.setItem('vector_db_cache', JSON.stringify(db));
        localStorage.setItem('cv_data_hash', currentDataHash);

        console.log(`Vector DB built with ${db.length} entries`);
        setDbReady(true);
      } catch (error) {
        console.error('Error building vector DB:', error);
        setDbReady(true);
      } finally {
        setBuildingDB(false);
      }
    };

    initVectorDB();
  }, [cvData]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (customQuery) => {
    const query = customQuery || input;
    if (!query.trim()) return;

    const userMessage = { role: 'user', content: query };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      let relevantContext = '';
      let retrievedCandidates = [];

      if (vectorDB.length > 0) {
        console.log('Searching for relevant candidates...');
        const similarChunks = await searchSimilarChunks(query, vectorDB, GEMINI_API_KEY, 3);

        if (similarChunks.length > 0) {
          retrievedCandidates = similarChunks.map(chunk => ({
            name: chunk.metadata.name,
            similarity: (chunk.similarity * 100).toFixed(1)
          }));

          relevantContext = `
=== RETRIEVED RELEVANT CANDIDATES (Top ${similarChunks.length} matches) ===
${similarChunks.map((chunk, idx) => `
--- Candidate ${idx + 1} (Relevance: ${(chunk.similarity * 100).toFixed(1)}%) ---
${chunk.fullData}
`).join('\n')}
=== END OF RETRIEVED CANDIDATES ===
`;
          console.log('Retrieved candidates:', retrievedCandidates);
        }
      }

      const systemPrompt = `You are **CVAlyze**, an intelligent HR analysis assistant that helps recruiters, employers, and analysts evaluate candidates.

${relevantContext ? `
I have retrieved the TOP 3 MOST RELEVANT candidates based on semantic search of the user's query. Focus your analysis primarily on these candidates:

${relevantContext}

IMPORTANT: The candidates above were retrieved using semantic similarity matching. Prioritize information from these candidates when answering the user's query.
` : ''}

${cvData.length > 0 ? `
For reference, here's a summary of ALL candidates available:
Total Candidates: ${cvData.length}
Professions: ${[...new Set(cvData.map(cv => cv.profession))].join(', ')}
Countries: ${[...new Set(cvData.map(cv => cv.country))].join(', ')}
` : 'No candidate data available.'}

Your behavior rules:
1. When the user asks about specific skills, qualifications, or candidate recommendations, focus on the RETRIEVED RELEVANT CANDIDATES shown above.
2. If the retrieved candidates don't match the user's needs, mention this and suggest what the user might want to search for instead.
3. For casual/unrelated queries, respond naturally without forcing candidate data into the conversation.
4. Keep responses concise and actionable - like a helpful colleague.
5. Always indicate which candidates you're discussing and why they're relevant.
6. Never fabricate candidate data.
7. Format responses in markdown for better readability.
8. If RAG retrieved candidates, briefly mention that these are the top matches found.`;

      const limitedMessages = messages.slice(1).slice(-4);

      const chatHistory = limitedMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      chatHistory.push({ role: 'user', parts: [{ text: query }] });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: chatHistory,
            system_instruction: { parts: [{ text: systemPrompt }] }
          })
        }
      );

      const data = await response.json();

      let aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || data?.output_text || "Sorry, I couldn't process that.";

      if (retrievedCandidates.length > 0) {
        const retrievalNote = `\n\n---\n *Retrieved ${retrievedCandidates.length} relevant candidates: ${retrievedCandidates.map(c => `${c.name} (${c.similarity}%)`).join(', ')}*`;
        aiResponse += retrievalNote;
      }

      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
    } catch (error) {
      console.error("Chat Error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, there was an error processing your request.' }]);
    } finally {
      setLoading(false);
    }
  };

  const parseMarkdown = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  };

  const handleClearChat = () => {
    setMessages([{ role: 'assistant', content: "Hey, I am Analysis Assistant powered by RAG! 🚀 I can find the most relevant candidates for your queries. How can I help you?" }]);
  };

  const handleRebuildDB = async () => {
    localStorage.removeItem('vector_db_cache');
    localStorage.removeItem('cv_data_hash');
    setDbReady(false);
    setBuildingDB(true);
    setDbProgress(0);

    try {
      const chunks = createChunks(cvData);
      const db = await buildVectorDB(chunks, GEMINI_API_KEY, (progress) => {
        setDbProgress(Math.round(progress));
      });
      setVectorDB(db);
      localStorage.setItem('vector_db_cache', JSON.stringify(db));
      localStorage.setItem('cv_data_hash', JSON.stringify(cvData).length.toString());
      setDbReady(true);
    } catch (error) {
      console.error('Error rebuilding vector DB:', error);
      setDbReady(true);
    } finally {
      setBuildingDB(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-0 md:p-4">
      <div className="bg-white border-0 md:border border-blue-300 rounded-none md:rounded-2xl w-full h-full md:h-[600px] md:max-w-2xl flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-3 md:p-4 border-b border-blue-200 bg-gradient-to-r from-blue-100 to-blue-50">
          <div className="flex items-center space-x-2 md:space-x-3">
            <UserPen className="w-5 h-5 md:w-6 md:h-6 text-blue-800" />
            <div>
              <h3 className="text-lg md:text-xl font-bold text-blue-800">Analysis Assistant</h3>
              <div className="flex items-center space-x-2">
                {buildingDB ? (
                  <span className="text-xs text-blue-600 flex items-center">
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Building RAG index... {dbProgress}%
                  </span>
                ) : dbReady && vectorDB.length > 0 ? (
                  <span className="text-xs text-green-600 flex items-center">
                    <Database className="w-3 h-3 mr-1" />
                    RAG Ready ({vectorDB.length} candidates indexed)
                  </span>
                ) : (
                  <span className="text-xs text-yellow-600">RAG unavailable</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={handleRebuildDB} disabled={buildingDB} className="p-1.5 md:p-2 hover:bg-blue-200 rounded-lg transition-colors disabled:opacity-50" title="Rebuild RAG index">
              <Database className={`w-4 h-4 md:w-5 md:h-5 text-blue-800 ${buildingDB ? 'animate-pulse' : ''}`} />
            </button>
            <button onClick={handleClearChat} className="p-1.5 md:p-2 hover:bg-blue-200 rounded-lg transition-colors" title="Clear chat history">
              <Trash2 className="w-4 h-4 md:w-5 md:h-5 text-blue-800" />
            </button>
            <button onClick={onClose} className="p-1.5 md:p-2 hover:bg-blue-200 rounded-lg transition-colors">
              <X className="w-4 h-4 md:w-5 md:h-5 text-blue-800" />
            </button>
          </div>
        </div>

        {buildingDB && (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-200">
            <div className="flex items-center space-x-3">
              <div className="flex-1 h-2 bg-blue-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-blue-700 transition-all duration-300" style={{ width: `${dbProgress}%` }} />
              </div>
              <span className="text-xs text-blue-700 font-medium">{dbProgress}%</span>
            </div>
            <p className="text-xs text-blue-600 mt-1">Creating semantic embeddings for candidate search...</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4 bg-blue-50/30">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] md:max-w-[80%] p-2.5 md:p-3 rounded-xl text-sm md:text-base ${msg.role === 'user' ? 'bg-blue-900 text-white' : 'bg-white border border-blue-200 text-blue-900'}`}>
                <div dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }} />
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-blue-200 p-2.5 md:p-3 rounded-xl">
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-900 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-900 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-blue-900 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                  <span className="text-xs text-blue-600">Searching & analyzing...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 md:p-4 border-t border-blue-200 bg-white">
          <div className="mb-2 md:mb-3 space-y-2">
            <button onClick={() => sendMessage('Find candidates with Python and Machine Learning skills')} disabled={loading || !dbReady} className="w-full px-3 md:px-4 py-2 bg-blue-100 border border-blue-300 rounded-lg text-blue-900 text-xs md:text-sm hover:bg-blue-200 transition-all text-left disabled:opacity-50">
              🔍 Find candidates with Python and Machine Learning skills
            </button>
            <button onClick={() => sendMessage('Top 3 candidates for a senior developer role')} disabled={loading || !dbReady} className="w-full px-3 md:px-4 py-2 bg-blue-100 border border-blue-300 rounded-lg text-blue-900 text-xs md:text-sm hover:bg-blue-200 transition-all text-left disabled:opacity-50">
              💡 Top 3 candidates for a senior developer role
            </button>
          </div>
          <div className="flex space-x-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder={dbReady ? "Ask me anything about candidates..." : "Building index..."}
              disabled={!dbReady}
              className="flex-1 px-3 md:px-4 py-2.5 md:py-3 bg-blue-50 border border-blue-300 rounded-xl text-blue-900 placeholder-blue-400 focus:outline-none focus:border-blue-900 text-sm md:text-base disabled:opacity-50"
            />
            <button onClick={() => sendMessage()} disabled={loading || !input.trim() || !dbReady} className="px-3 md:px-4 py-2.5 md:py-3 bg-gradient-to-r from-blue-900 to-blue-700 rounded-xl text-white hover:from-blue-800 hover:to-blue-600 transition-all disabled:opacity-50">
              <Send className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Settings Page - FIXED
const SettingsPage = ({ navigate }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { token, user, logout } = useAuth();

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${API_BASE}/register/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: user,
          oldpassword: oldPassword,
          newpassword: newPassword
        })
      });

      const data = await response.json();
      if (response.ok) {
        setMessage('Password changed successfully!');
        setOldPassword('');
        setNewPassword('');
      } else {
        setMessage(data.detail || 'Failed to change password');
      }
    } catch (error) {
      setMessage('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) return;

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${API_BASE}/register/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: user,
          password: deletePassword
        })
      });

      const data = await response.json();
      if (response.ok) {
        alert('Account deleted successfully');
        logout();
      } else {
        setMessage(data.detail || 'Failed to delete account');
      }
    } catch (error) {
      setMessage('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearRAGCache = () => {
    localStorage.removeItem('vector_db_cache');
    localStorage.removeItem('cv_data_hash');
    setMessage('RAG cache cleared successfully! It will rebuild on next chat open.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-blue-100">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-200/40 via-transparent to-transparent"></div>

      <nav className="relative border-b border-blue-200 bg-white/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-3 md:py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2 md:space-x-3">
            <FileBarChart className="w-6 h-6 md:w-8 md:h-8 text-blue-900" />
            <span className="text-lg md:text-2xl font-bold bg-gradient-to-r from-blue-900 to-blue-700 bg-clip-text text-transparent">CVAlyze</span>
          </div>
          <button onClick={() => navigate('/dashboard')} className="px-3 md:px-4 py-1.5 md:py-2 bg-blue-100 border border-blue-300 rounded-lg text-blue-800 hover:bg-blue-200 text-sm md:text-base">
            Back to Dashboard
          </button>
        </div>
      </nav>

      <div className="relative max-w-4xl mx-auto px-4 py-8 md:py-16">
        <div className="text-center mb-8 md:mb-12">
          <h1 className="text-2xl md:text-4xl font-bold mb-3 md:mb-4 bg-gradient-to-r from-blue-900 to-blue-700 bg-clip-text text-transparent">
            Account Settings
          </h1>
          <p className="text-blue-800 text-sm md:text-base">Manage your account preferences</p>
        </div>

        {message && (
          <div className="mb-4 md:mb-6 p-3 md:p-4 bg-blue-100 border border-blue-300 rounded-xl text-blue-900 text-center text-sm md:text-base">
            {message}
          </div>
        )}

        {/* RAG Cache Management */}
        <div className="bg-white/60 backdrop-blur-xl border border-blue-200 rounded-2xl p-4 md:p-8 mb-6 md:mb-8 shadow-xl">
          <h2 className="text-xl md:text-2xl font-bold text-blue-800 mb-4 md:mb-6 flex items-center">
            <Database className="w-5 h-5 md:w-6 md:h-6 mr-2" /> RAG Settings
          </h2>
          <p className="text-blue-700 mb-4 text-sm md:text-base">
            The RAG (Retrieval-Augmented Generation) system creates semantic embeddings for your candidate data to enable intelligent search.
          </p>
          <button onClick={handleClearRAGCache} className="w-full py-2.5 md:py-3 bg-gradient-to-r from-blue-700 to-blue-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-blue-500 transition-all text-sm md:text-base">
            Clear RAG Cache & Rebuild
          </button>
        </div>

        {/* Change Password */}
        <div className="bg-white/60 backdrop-blur-xl border border-blue-200 rounded-2xl p-4 md:p-8 mb-6 md:mb-8 shadow-xl">
          <h2 className="text-xl md:text-2xl font-bold text-blue-800 mb-4 md:mb-6 flex items-center">
            <Lock className="w-5 h-5 md:w-6 md:h-6 mr-2" /> Change Password
          </h2>
          <form onSubmit={handlePasswordChange} className="space-y-4 md:space-y-6">
            <div>
              <label className="block text-blue-800 text-sm font-medium mb-2">Current Password</label>
              <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="w-full px-3 md:px-4 py-2.5 md:py-3 bg-blue-50 border border-blue-300 rounded-xl text-blue-900 placeholder-blue-400 focus:outline-none focus:border-blue-900 text-sm md:text-base" required />
            </div>
            <div>
              <label className="block text-blue-800 text-sm font-medium mb-2">New Password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 md:px-4 py-2.5 md:py-3 bg-blue-50 border border-blue-300 rounded-xl text-blue-900 placeholder-blue-400 focus:outline-none focus:border-blue-900 text-sm md:text-base" required />
            </div>
            <button type="submit" disabled={loading} className="w-full py-2.5 md:py-3 bg-gradient-to-r from-blue-900 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-800 hover:to-blue-600 transition-all disabled:opacity-50 text-sm md:text-base">
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>

        {/* Delete Account - FIXED: Complete className */}
        <div className="bg-white/60 backdrop-blur-xl border border-red-300 rounded-2xl p-4 md:p-8 shadow-xl">
          <h2 className="text-xl md:text-2xl font-bold text-red-600 mb-4 md:mb-6 flex items-center">
            <Trash2 className="w-5 h-5 md:w-6 md:h-6 mr-2" /> Delete Account
          </h2>
          <p className="text-blue-800 mb-4 md:mb-6 text-sm md:text-base">This action is permanent and cannot be undone. All your data will be deleted.</p>
          <form onSubmit={handleDeleteAccount} className="space-y-4 md:space-y-6">
            <div>
              <label className="block text-red-600 text-sm font-medium mb-2">Confirm Password</label>
              <input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} className="w-full px-3 md:px-4 py-2.5 md:py-3 bg-red-50 border border-red-300 rounded-xl text-red-900 placeholder-red-400 focus:outline-none focus:border-red-600 text-sm md:text-base" required />
            </div>
            <button type="submit" disabled={loading} className="w-full py-2.5 md:py-3 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-xl font-semibold hover:from-red-700 hover:to-red-600 transition-all disabled:opacity-50 text-sm md:text-base">
              {loading ? 'Deleting...' : 'Delete Account Permanently'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// Main App Component
const App = () => {
  return (
    <AuthProvider>
      <Router>
        {(currentPath, navigate) => {
          const { isAuthenticated } = useAuth();

          if (currentPath === '/' || currentPath === '/welcome') {
            return <WelcomePage navigate={navigate} />;
          }

          if (!isAuthenticated && currentPath !== '/login') {
            return <WelcomePage navigate={navigate} />;
          }

          switch (currentPath) {
            case '/login':
              return <AuthPage navigate={navigate} />;
            case '/upload':
              return <UploadPage navigate={navigate} />;
            case '/dashboard':
              return <DashboardPage navigate={navigate} />;
            case '/settings':
              return <SettingsPage navigate={navigate} />;
            default:
              return <WelcomePage navigate={navigate} />;
          }
        }}
      </Router>
    </AuthProvider>
  );
};

export default App;