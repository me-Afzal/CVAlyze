import React, { useState, useEffect, useRef } from 'react';
import { FileBarChart, Upload, LogOut, Settings, User, Mail, Lock, Trash2, Eye, EyeOff, MessageCircle, X, Send, BarChart3, Globe, PieChart, Grid, Download, Filter, Search, UserPen, ArrowRight, CheckCircle, Users, TrendingUp } from 'lucide-react';
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
const API_BASE = 'http://cvalyze.shop/api/v1';
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

// Enhanced Loading Overlay Component with File Progress
const LoadingOverlay = ({ files = [], currentFileIndex = 0, stage = 'extraction' }) => {
  const totalFiles = files.length;
  const baseProgress = totalFiles > 0 ? (currentFileIndex / totalFiles) * 70 : 0; // 70% for file extraction

  const getStageProgress = () => {
    if (stage === 'extraction') return baseProgress;
    if (stage === 'feature-engineering') return 70 + 15; // 85%
    if (stage === 'cleaning') return 85 + 15; // 100%
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 bg-blue-400/20 rounded-full blur-3xl animate-pulse top-10 left-10"></div>
        <div className="absolute w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse bottom-10 right-10" style={{ animationDelay: '1s' }}></div>
        <div className="absolute w-96 h-96 bg-blue-300/20 rounded-full blur-3xl animate-pulse top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Loading content */}
      <div className="relative z-10 flex flex-col items-center max-w-2xl w-full px-4">
        {/* Spinner */}
        <div className="relative w-32 h-32 mb-8">
          {/* Outer ring */}
          <div className="absolute inset-0 border-8 border-blue-200/30 rounded-full"></div>

          {/* Spinning rings */}
          <div className="absolute inset-0 border-8 border-transparent border-t-white border-r-white rounded-full animate-spin"></div>
          <div className="absolute inset-3 border-8 border-transparent border-b-blue-300 border-l-blue-300 rounded-full animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}></div>
          <div className="absolute inset-6 border-8 border-transparent border-t-blue-400 rounded-full animate-spin" style={{ animationDuration: '2s' }}></div>

          {/* Center percentage */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{Math.round(progress)}%</div>
            </div>
          </div>
        </div>

        {/* Text */}
        <div className="text-center space-y-4 mb-6">
          <h2 className="text-3xl font-bold text-white animate-pulse">
            Processing CVs
          </h2>
          <p className="text-xl text-blue-100">
            {getStageText()}
          </p>
        </div>

        {/* Stage Indicator */}
        <div className="w-full max-w-md mb-6">
          <div className="flex justify-between items-center mb-2">
            <div className={`flex items-center space-x-2 ${stage === 'extraction' ? 'text-white' : stage === 'feature-engineering' || stage === 'cleaning' ? 'text-green-300' : 'text-blue-300'}`}>
              <div className={`w-3 h-3 rounded-full ${stage === 'extraction' ? 'bg-white animate-pulse' : stage === 'feature-engineering' || stage === 'cleaning' ? 'bg-green-300' : 'bg-blue-300'}`}></div>
              <span className="text-sm font-semibold">File Extraction</span>
            </div>
            <div className={`flex items-center space-x-2 ${stage === 'feature-engineering' ? 'text-white' : stage === 'cleaning' ? 'text-green-300' : 'text-blue-300'}`}>
              <div className={`w-3 h-3 rounded-full ${stage === 'feature-engineering' ? 'bg-white animate-pulse' : stage === 'cleaning' ? 'bg-green-300' : 'bg-blue-300'}`}></div>
              <span className="text-sm font-semibold">Feature Engineering</span>
            </div>
            <div className={`flex items-center space-x-2 ${stage === 'cleaning' ? 'text-white' : 'text-blue-300'}`}>
              <div className={`w-3 h-3 rounded-full ${stage === 'cleaning' ? 'bg-white animate-pulse' : 'bg-blue-300'}`}></div>
              <span className="text-sm font-semibold">Cleaning</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-md mb-6">
          <div className="h-3 bg-blue-700/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 via-white to-blue-400 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="flex justify-between mt-2 text-xs text-blue-200">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        {/* File Progress List */}
        {stage === 'extraction' && files.length > 0 && (
          <div className="w-full max-w-md bg-white/10 backdrop-blur-md rounded-xl p-4 max-h-64 overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-white font-semibold">Processing Files</h3>
              <span className="text-blue-200 text-sm">{currentFileIndex} / {totalFiles}</span>
            </div>
            <div className="space-y-2">
              {files.map((file, index) => (
                <div
                  key={index}
                  className={`flex items-center space-x-3 p-2 rounded-lg transition-all ${index < currentFileIndex
                    ? 'bg-green-500/20 border border-green-400/30'
                    : index === currentFileIndex
                      ? 'bg-blue-500/30 border border-blue-400/50 animate-pulse'
                      : 'bg-white/5 border border-white/10'
                    }`}
                >
                  {index < currentFileIndex ? (
                    <CheckCircle className="w-5 h-5 text-green-300 flex-shrink-0" />
                  ) : index === currentFileIndex ? (
                    <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                  ) : (
                    <div className="w-5 h-5 border-2 border-white/30 rounded-full flex-shrink-0"></div>
                  )}
                  <span className={`text-sm truncate ${index < currentFileIndex
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

        {/* Feature Engineering / Cleaning Message */}
        {(stage === 'feature-engineering' || stage === 'cleaning') && (
          <div className="w-full max-w-md bg-white/10 backdrop-blur-md rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
              <div>
                <p className="text-white font-semibold">
                  {stage === 'feature-engineering' ? 'Engineering Features' : 'Finalizing Data'}
                </p>
                <p className="text-blue-200 text-sm">
                  {stage === 'feature-engineering'
                    ? 'Analyzing skills, experience, and qualifications...'
                    : 'Cleaning and preparing your dashboard...'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Bottom info */}
        <div className="mt-6 text-center">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
          <p className="text-sm text-blue-200">
            Please wait while we analyze your CVs
          </p>
        </div>
      </div>
    </div>
  );
};

// Welcome Page Component
const WelcomePage = ({ navigate }) => {
  const { isAuthenticated } = useAuth(); // Add this to check authentication

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate('/upload');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-blue-100 overflow-hidden">
      {/* Animated background - matching other pages */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-200/40 via-transparent to-transparent"></div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-8">
        <div className="max-w-5xl w-full">
          {/* Logo and Title - Reduced size */}
          <div className="text-center mb-6 animate-fade-in">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-gradient-to-r from-blue-900 to-blue-700 p-4 rounded-2xl shadow-xl shadow-blue-300/50">
                <FileBarChart className="w-12 h-12 text-white" />
              </div>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-900 to-blue-700 bg-clip-text text-transparent mb-3 tracking-tight">
              CVAlyze
            </h1>
            <div className="h-1 w-24 bg-gradient-to-r from-blue-300 via-blue-700 to-blue-300 mx-auto mb-4"></div>
            <p className="text-lg md:text-xl text-blue-800 font-light max-w-3xl mx-auto leading-relaxed">
              Transform Your Hiring Process with AI-Powered Resume Analysis
            </p>
          </div>

          {/* Main Quote Box - Reduced padding */}
          <div className="bg-white/60 backdrop-blur-xl border border-blue-200 rounded-3xl p-6 md:p-8 mb-8 shadow-2xl">
            <div className="text-center mb-6">
              <p className="text-base md:text-lg text-blue-900 font-light italic leading-relaxed">
                "Upload multiple CVs and resumes to instantly analyze, compare, and discover the best candidates with intelligent insights and comprehensive analytics."
              </p>
            </div>

            {/* Features Grid - Reduced padding */}
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-center transform hover:scale-105 transition-all hover:shadow-lg">
                <div className="bg-gradient-to-r from-blue-900 to-blue-700 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <Upload className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-blue-900 font-semibold text-base mb-2">Bulk Upload</h3>
                <p className="text-blue-700 text-sm">Upload multiple resumes at once</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-center transform hover:scale-105 transition-all hover:shadow-lg">
                <div className="bg-gradient-to-r from-blue-900 to-blue-700 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <BarChart3 className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-blue-900 font-semibold text-base mb-2">Smart Analytics</h3>
                <p className="text-blue-700 text-sm">AI-powered insights and comparisons</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-center transform hover:scale-105 transition-all hover:shadow-lg">
                <div className="bg-gradient-to-r from-blue-900 to-blue-700 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-blue-900 font-semibold text-base mb-2">Find Top Talent</h3>
                <p className="text-blue-700 text-sm">Rank and filter best candidates</p>
              </div>
            </div>

            {/* Get Started Button - UPDATED */}
            <div className="text-center">
              <button
                onClick={handleGetStarted}
                className="group bg-gradient-to-r from-blue-900 to-blue-700 text-white px-10 py-4 rounded-2xl font-bold text-lg hover:from-blue-800 hover:to-blue-600 transition-all transform hover:scale-105 shadow-2xl shadow-blue-300/50 inline-flex items-center space-x-3"
              >
                <span>{isAuthenticated ? 'Go to Dashboard' : 'Get Started'}</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
              </button>
            </div>
          </div>

          {/* Key Benefits */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white/60 backdrop-blur-sm border border-blue-200 rounded-2xl p-5 flex items-start space-x-3 shadow-lg hover:shadow-xl transition-shadow">
              <div className="bg-green-100 border border-green-300 rounded-full p-2 flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <h4 className="text-blue-900 font-semibold mb-1 text-base">Visual Dashboards</h4>
                <p className="text-blue-700 text-sm">Interactive charts and geographic distribution maps</p>
              </div>
            </div>

            <div className="bg-white/60 backdrop-blur-sm border border-blue-200 rounded-2xl p-5 flex items-start space-x-3 shadow-lg hover:shadow-xl transition-shadow">
              <div className="bg-green-100 border border-green-300 rounded-full p-2 flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <h4 className="text-blue-900 font-semibold mb-1 text-base">AI Assistant</h4>
                <p className="text-blue-700 text-sm">Chat with AI to get candidate recommendations</p>
              </div>
            </div>

            <div className="bg-white/60 backdrop-blur-sm border border-blue-200 rounded-2xl p-5 flex items-start space-x-3 shadow-lg hover:shadow-xl transition-shadow">
              <div className="bg-green-100 border border-green-300 rounded-full p-2 flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <h4 className="text-blue-900 font-semibold mb-1 text-base">Skill Matching</h4>
                <p className="text-blue-700 text-sm">Analyze skills, experience, and qualifications</p>
              </div>
            </div>

            <div className="bg-white/60 backdrop-blur-sm border border-blue-200 rounded-2xl p-5 flex items-start space-x-3 shadow-lg hover:shadow-xl transition-shadow">
              <div className="bg-green-100 border border-green-300 rounded-full p-2 flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <h4 className="text-blue-900 font-semibold mb-1 text-base">Instant Insights</h4>
                <p className="text-blue-700 text-sm">Get comprehensive candidate profiles in seconds</p>
              </div>
            </div>
          </div>

          {/* Footer tagline */}
          <div className="text-center mt-6">
            <p className="text-blue-700 text-sm">
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
        {/* Back to Welcome */}
        <button
          onClick={() => navigate('/welcome')}
          className="mb-4 text-blue-700 hover:text-blue-900 flex items-center space-x-2"
        >
          <ArrowRight className="w-4 h-4 rotate-180" />
          <span>Back to Welcome</span>
        </button>

        <div className="bg-white/80 backdrop-blur-xl border border-blue-300 rounded-2xl p-8 shadow-2xl shadow-blue-300/50">
          <div className="flex items-center justify-center mb-8">
            <div className="bg-gradient-to-r from-blue-900 to-blue-700 p-3 rounded-xl">
              <FileBarChart className="w-8 h-8 text-white" />
            </div>
          </div>

          <h2 className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-blue-900 to-blue-700 bg-clip-text text-transparent">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-blue-800 text-center mb-8">CVAlyze - Premium HR Analytics</p>

          {error && (
            <div className={`mb-4 p-3 border rounded-lg text-sm ${error.includes('successful')
              ? 'bg-green-100 border-green-300 text-green-700'
              : 'bg-red-100 border-red-300 text-red-700'
              }`}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-blue-800 text-sm font-medium mb-2">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-600" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-blue-50 border border-blue-300 rounded-xl text-blue-900 placeholder-blue-400 focus:outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-200 transition-all"
                  placeholder="Enter username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-blue-800 text-sm font-medium mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-600" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3 bg-blue-50 border border-blue-300 rounded-xl text-blue-900 placeholder-blue-400 focus:outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-200 transition-all"
                  placeholder="Enter password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-600 hover:text-blue-800"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-900 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-800 hover:to-blue-600 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-300/50"
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-blue-700 hover:text-blue-900 text-sm transition-colors font-medium"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// UploadPage component's handleUpload function
const UploadPage = ({ navigate }) => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState({
    currentFileIndex: 0,
    stage: 'extraction' // extraction, feature-engineering, cleaning
  });
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

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFiles = Array.from(e.dataTransfer.files);

      if (selectedFiles.length > MAX_FILES) {
        setError(`You can only upload a maximum of ${MAX_FILES} files at a time. You selected ${selectedFiles.length} files.`);
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

      if (selectedFiles.length > MAX_FILES) {
        setError(`You can only upload a maximum of ${MAX_FILES} files at a time. You selected ${selectedFiles.length} files.`);
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
    setUploadProgress({ currentFileIndex: 0, stage: 'extraction' });

    const totalFiles = files.length;
    const estimatedTimePerFile = 4000; // 4 seconds per file (for simulation only)

    let progressInterval = null;
    let isBackendComplete = false;

    // Start progress simulation - but this can be interrupted
    const startProgressSimulation = () => {
      let currentIndex = 0;

      progressInterval = setInterval(() => {
        if (isBackendComplete) {
          clearInterval(progressInterval);
          return;
        }

        if (currentIndex < totalFiles) {
          currentIndex++;
          setUploadProgress(prev => ({
            ...prev,
            currentFileIndex: currentIndex
          }));
        } else {
          clearInterval(progressInterval);
        }
      }, estimatedTimePerFile);
    };

    startProgressSimulation();

    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    try {
      // Make the actual API call
      const response = await fetch(`${API_BASE}/upload_cvs`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      // Backend responded - stop simulation
      isBackendComplete = true;
      if (progressInterval) {
        clearInterval(progressInterval);
      }

      if (response.status === 401) {
        logout();
        return;
      }

      if (response.status === 413) {
        alert('Upload failed: File size too large. Please try uploading fewer files at once or contact support.');
        setUploading(false);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Upload failed with status ${response.status}`);
      }

      // Move to feature engineering stage (even if files aren't all "shown" as complete)
      setUploadProgress({ currentFileIndex: totalFiles, stage: 'feature-engineering' });

      // Small delay to show the stage change (0.5 second)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Move to cleaning stage
      setUploadProgress({ currentFileIndex: totalFiles, stage: 'cleaning' });

      // Parse response
      const data = await response.json();

      // Small delay to show the cleaning stage (0.5 second)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Save and navigate
      localStorage.setItem('cv_data', JSON.stringify(data.jsonCv));
      navigate('/dashboard');

    } catch (err) {
      isBackendComplete = true;
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      console.error('Upload error:', err);
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
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
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <FileBarChart className="w-8 h-8 text-blue-900" />
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-900 to-blue-700 bg-clip-text text-transparent">CVAlyze</span>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/settings')}
                className="p-2 text-blue-700 hover:text-blue-900 transition-colors"
              >
                <Settings className="w-6 h-6" />
              </button>
              <button
                onClick={logout}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-100 border border-blue-300 rounded-lg text-blue-800 hover:bg-blue-200 transition-all"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </nav>

        <div className="relative max-w-4xl mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-900 to-blue-700 bg-clip-text text-transparent">
              Upload CVs for Analysis
            </h1>
            <p className="text-blue-800">Drag and drop or click to select CV files (.pdf, .docx, .txt)</p>
            <p className="text-blue-700 text-sm mt-2">Maximum {MAX_FILES} files per upload</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-xl text-red-700 text-center">
              <p className="font-semibold">{error}</p>
            </div>
          )}

          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all ${dragActive
              ? 'border-blue-900 bg-blue-100'
              : 'border-blue-300 bg-blue-50/50 hover:border-blue-700 hover:bg-blue-100/50'
              } backdrop-blur-xl`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt"
              onChange={handleFileChange}
              className="hidden"
            />

            <Upload className="w-16 h-16 mx-auto mb-4 text-blue-700" />
            <h3 className="text-xl font-semibold text-blue-900 mb-2">Drop CV files here</h3>
            <p className="text-blue-800 mb-4">or click to browse</p>
            <p className="text-sm text-blue-700">Supports PDF, DOCX, and TXT formats</p>
            <p className="text-sm text-blue-600 mt-2 font-semibold">Max {MAX_FILES} files at a time</p>
          </div>

          {files.length > 0 && (
            <div className="mt-8 bg-white/60 backdrop-blur-xl border border-blue-200 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-blue-800 mb-4">
                Selected Files ({files.length}/{MAX_FILES})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {files.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <span className="text-blue-900 truncate">{file.name}</span>
                    <span className="text-blue-700 text-sm">{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleUpload}
                disabled={uploading || files.length === 0 || files.length > MAX_FILES}
                className="w-full mt-6 py-3 bg-gradient-to-r from-blue-900 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-800 hover:to-blue-600 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-300/50"
              >
                {files.length > MAX_FILES ? `Too many files (Max ${MAX_FILES})` : 'Upload and Analyze'}
              </button>
            </div>
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
      <div className="bg-white border border-blue-200 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-gradient-to-r from-blue-900 to-blue-700 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">{normalizeName(candidate.name)}</h2>
          <button onClick={onClose} className="p-2 hover:bg-blue-800 rounded-lg transition-colors">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="text-xl font-bold text-blue-900 mb-3">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-blue-700 font-semibold">Profession</p>
                <p className="text-blue-900">{candidate.profession || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-blue-700 font-semibold">Gender</p>
                <p className="text-blue-900 capitalize">{candidate.gender || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-blue-700 font-semibold">Email</p>
                <p className="text-blue-900 break-all">{candidate.email || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-blue-700 font-semibold">Phone</p>
                <p className="text-blue-900">{candidate.phone_number || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-blue-700 font-semibold">Location</p>
                <p className="text-blue-900">{candidate.location || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-blue-700 font-semibold">Country</p>
                <p className="text-blue-900">{candidate.country || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Skills */}
          {candidate.skills && Array.isArray(candidate.skills) && candidate.skills.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="text-xl font-bold text-blue-900 mb-3">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {candidate.skills.map((skill, i) => (
                  <span key={i} className="px-3 py-1 bg-blue-200 border border-blue-300 rounded-lg text-blue-900 text-sm">
                    {renderDataItem(skill)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {candidate.education && Array.isArray(candidate.education) && candidate.education.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="text-xl font-bold text-blue-900 mb-3">Education</h3>
              <ul className="space-y-2">
                {candidate.education.map((edu, i) => (
                  <li key={i} className="text-blue-900 flex items-start">
                    <span className="text-blue-700 mr-2">•</span>
                    <span>{renderDataItem(edu)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Experience */}
          {candidate.experience && Array.isArray(candidate.experience) && candidate.experience.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="text-xl font-bold text-blue-900 mb-3">Experience</h3>
              <ul className="space-y-2">
                {candidate.experience.map((exp, i) => (
                  <li key={i} className="text-blue-900 flex items-start">
                    <span className="text-blue-700 mr-2">•</span>
                    <span>{renderDataItem(exp)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Projects */}
          {candidate.projects && Array.isArray(candidate.projects) && candidate.projects.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="text-xl font-bold text-blue-900 mb-3">Projects</h3>
              <div className="space-y-3">
                {candidate.projects.map((project, i) => {
                  const projectName = typeof project === 'object' ? project.name : renderDataItem(project);
                  const projectLinks = typeof project === 'object' && Array.isArray(project.links) ? project.links : null;

                  return (
                    <div key={i} className="bg-white border border-blue-200 rounded-lg p-3">
                      <p className="text-blue-900 font-semibold mb-2">{projectName}</p>
                      {projectLinks && projectLinks.length > 0 ? (
                        <div className="space-y-1">
                          {projectLinks.map((link, linkIdx) => (
                            <a
                              key={linkIdx}
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-700 hover:text-blue-900 text-sm underline block">
                              Link {linkIdx + 1}: {link}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="text-blue-600 text-sm italic">No links given</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Certifications */}
          {candidate.certifications && Array.isArray(candidate.certifications) && candidate.certifications.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="text-xl font-bold text-blue-900 mb-3">Certifications</h3>
              <ul className="space-y-2">
                {candidate.certifications.map((cert, i) => (
                  <li key={i} className="text-blue-900 flex items-start">
                    <span className="text-blue-700 mr-2">✓</span>
                    <span>{renderDataItem(cert)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Achievements */}
          {candidate.achievements && Array.isArray(candidate.achievements) && candidate.achievements.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="text-xl font-bold text-blue-900 mb-3">Achievements</h3>
              <ul className="space-y-2">
                {candidate.achievements.map((achievement, i) => (
                  <li key={i} className="text-blue-900 flex items-start">
                    <span className="text-blue-700 mr-2">★</span>
                    <span>{renderDataItem(achievement)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Links */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="text-xl font-bold text-blue-900 mb-3">Links</h3>
            <div className="flex flex-wrap gap-3">
              {candidate.github_link && (
                <a href={candidate.github_link} target="_blank" rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-all">
                  GitHub Profile
                </a>
              )}
              {candidate.linkedin_link && (
                <a href={candidate.linkedin_link} target="_blank" rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-all">
                  LinkedIn Profile
                </a>
              )}
              {candidate.portfolio_link && (
                <a href={candidate.portfolio_link} target="_blank" rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-all">
                  Portfolio
                </a>
              )}
              {!candidate.github_link && !candidate.linkedin_link && !candidate.portfolio_link && (
                <p className="text-blue-700">No links available</p>
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
          ? parsedData.map(cv => ({
            ...cv,
            name: normalizeName(cv.name)
          }))
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
        locationGroups[key] = {
          lat: cv.latitude,
          lon: cv.longitude,
          candidates: []
        };
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
        colorscale: [
          [0, '#bfdbfe'],
          [0.5, '#1e40af'],
          [1, '#1e3a8a']
        ],
        line: { width: 2, color: '#fff' },
        colorbar: {
          title: 'Count',
          tickfont: { color: '#1e3a8a' },
          titlefont: { color: '#1e3a8a' }
        }
      },
      hovertemplate: '%{text}<extra></extra>'
    }];

    const layout = {
      geo: {
        projection: { type: 'natural earth' },
        bgcolor: 'rgba(255,255,255,0)',
        showland: true,
        landcolor: '#f3f4f6',
        showocean: true,
        oceancolor: '#e5e7eb',
        showcountries: true,
        countrycolor: '#d1d5db'
      },
      paper_bgcolor: 'rgba(255,255,255,0)',
      plot_bgcolor: 'rgba(255,255,255,0)',
      margin: { t: 0, b: 0, l: 0, r: 0 },
      font: { color: '#1e3a8a' }
    };

    Plotly.newPlot('map-chart', data, layout, { responsive: true });
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
      marker: {
        colors: ['#1e3a8a', '#3b82f6', '#93c5fd', '#dbeafe'],
        line: { color: '#fff', width: 2 }
      },
      textfont: { color: '#fff', size: 14, family: 'Arial' },
      textposition: 'inside'
    }];

    const layout = {
      paper_bgcolor: 'rgba(255,255,255,0)',
      plot_bgcolor: 'rgba(255,255,255,0)',
      font: { color: '#1e3a8a' },
      margin: { t: 20, b: 20, l: 20, r: 20 },
      showlegend: true,
      legend: {
        font: { color: '#1e3a8a' },
        bgcolor: 'rgba(255,255,255,0.8)'
      }
    };

    Plotly.newPlot('gender-chart', data, layout, { responsive: true });
  };

  const renderSkillsChart = () => {
    const skillCounts = {};
    cvData.forEach(cv => {
      (cv.skills || []).forEach(skill => {
        const skillStr = typeof skill === 'string' ? skill : (skill?.name || String(skill));
        skillCounts[skillStr] = (skillCounts[skillStr] || 0) + 1;
      });
    });

    const sortedSkills = Object.entries(skillCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);
    const filteredData = sortedSkills.map(s => ({ label: s[0], value: s[1] })).filter(item => item.value > 0);

    const colors = ['#1e3a8a', '#1e40af', '#3b82f6', '#60a5fa', '#93c5fd', '#1d4ed8', '#2563eb', '#3b82f6'];

    const data = [{
      type: 'treemap',
      labels: filteredData.map(d => d.label),
      parents: filteredData.map(() => ''),
      values: filteredData.map(d => d.value),
      text: filteredData.map(d => `${d.value}`),
      textposition: 'middle center',
      marker: {
        colors: filteredData.map((_, i) => colors[i % colors.length]),
        line: { color: '#fff', width: 2 }
      },
      textfont: {
        color: '#fff',
        size: 14,
        family: 'Arial'
      },
      hovertemplate: '<b>%{label}</b><br>Count: %{value}<extra></extra>'
    }];

    const layout = {
      paper_bgcolor: 'rgba(255,255,255,0)',
      plot_bgcolor: 'rgba(255,255,255,0)',
      margin: { t: 20, b: 20, l: 20, r: 20 }
    };

    Plotly.newPlot('skills-chart', data, layout, { responsive: true });
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
      marker: {
        colors: filteredData.map((_, i) => colors[i % colors.length]),
        line: { color: '#fff', width: 3 }
      },
      textfont: {
        color: '#fff',
        size: 16,
        family: 'Arial'
      },
      hovertemplate: '<b>%{label}</b><br>Candidates: %{value}<extra></extra>'
    }];

    const layout = {
      paper_bgcolor: 'rgba(255,255,255,0)',
      plot_bgcolor: 'rgba(255,255,255,0)',
      margin: { t: 20, b: 20, l: 20, r: 20 }
    };

    Plotly.newPlot('country-chart', data, layout, { responsive: true });
  };

  const renderHeatmap = () => {
    // Get ALL unique skills from ALL candidates (no limit)
    const allSkills = [...new Set(cvData.flatMap(cv =>
      (cv.skills || []).map(skill => typeof skill === 'string' ? skill : (skill?.name || String(skill)))
    ))];

    // Sort skills by frequency (most common first) for better visualization
    const skillFrequency = {};
    cvData.forEach(cv => {
      (cv.skills || []).forEach(skill => {
        const skillStr = typeof skill === 'string' ? skill : (skill?.name || String(skill));
        skillFrequency[skillStr] = (skillFrequency[skillStr] || 0) + 1;
      });
    });

    const sortedSkills = allSkills.sort((a, b) => (skillFrequency[b] || 0) - (skillFrequency[a] || 0));

    // Build the heatmap matrix
    const zData = cvData.map(cv => {
      const cvSkills = (cv.skills || []).map(skill =>
        typeof skill === 'string' ? skill : (skill?.name || String(skill))
      );
      return sortedSkills.map(skill => cvSkills.includes(skill) ? 1 : 0);
    });

    // Calculate appropriate sizing based on data
    const numSkills = sortedSkills.length;
    const numCandidates = cvData.length;

    // Dynamically adjust height based on number of candidates
    const chartHeight = Math.max(500, numCandidates * 30);

    // Adjust font size based on number of skills for readability
    const xAxisFontSize = numSkills > 100 ? 6 : (numSkills > 50 ? 8 : 10);
    const yAxisFontSize = numCandidates > 50 ? 7 : (numCandidates > 30 ? 8 : 10);

    // Adjust margins based on content
    const bottomMargin = Math.max(120, Math.min(200, numSkills * 2.5));
    const leftMargin = Math.max(150, Math.min(250, numCandidates * 3));

    const data = [{
      z: zData,
      x: sortedSkills,
      y: cvData.map(cv => cv.name),
      type: 'heatmap',
      colorscale: [
        [0, '#ffffff'],      // White for no skill
        [1, '#1e3a8a']       // Dark blue for has skill
      ],
      showscale: true,
      colorbar: {
        tickvals: [0, 1],
        ticktext: ['No Skill', 'Has Skill'],
        tickfont: { color: '#1e3a8a', size: 11 },
        outlinewidth: 0,
        len: 0.5,
        thickness: 15
      },
      hovertemplate: '<b>%{y}</b><br>Skill: <b>%{x}</b><br>%{z}<extra></extra>',
      xgap: 1,
      ygap: 1
    }];

    const layout = {
      paper_bgcolor: 'rgba(255,255,255,0)',
      plot_bgcolor: 'rgba(255,255,255,0)',
      xaxis: {
        title: {
          text: `Skills (Total: ${numSkills})`,
          font: { color: '#1e3a8a', size: 12, weight: 'bold' }
        },
        gridcolor: '#e5e7eb',
        tickangle: -45,
        side: 'bottom',
        tickfont: {
          size: xAxisFontSize,
          color: '#1e3a8a'
        },
        automargin: true
      },
      yaxis: {
        title: {
          text: `Candidates (Total: ${numCandidates})`,
          font: { color: '#1e3a8a', size: 12, weight: 'bold' }
        },
        gridcolor: '#e5e7eb',
        tickfont: {
          size: yAxisFontSize,
          color: '#1e3a8a'
        },
        automargin: true
      },
      margin: { t: 30, b: bottomMargin, l: leftMargin, r: 50 },
      height: chartHeight,
      font: { color: '#1e3a8a' }
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      scrollZoom: true
    };

    Plotly.newPlot('heatmap-chart', data, layout, config);
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
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <FileBarChart className="w-8 h-8 text-blue-900" />
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-900 to-blue-700 bg-clip-text text-transparent">CVAlyze Dashboard</span>
          </div>
          <div className="flex items-center space-x-4">
            <button onClick={() => navigate('/upload')} className="p-2 text-blue-700 hover:text-blue-900">
              <Upload className="w-6 h-6" />
            </button>
            <button onClick={() => navigate('/settings')} className="p-2 text-blue-700 hover:text-blue-900">
              <Settings className="w-6 h-6" />
            </button>
            <button onClick={logout} className="flex items-center space-x-2 px-4 py-2 bg-blue-100 border border-blue-300 rounded-lg text-blue-800 hover:bg-blue-200">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      <div className="relative max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Map Section */}
        <div className="bg-white/60 backdrop-blur-xl border border-blue-200 rounded-2xl p-6 shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-blue-800 flex items-center">
              <Globe className="w-6 h-6 mr-2" /> Geographic Distribution
            </h2>
            <div className="flex space-x-3">
              <select
                value={filters.country}
                onChange={(e) => setFilters({ ...filters, country: e.target.value })}
                className="px-4 py-2 bg-blue-50 border border-blue-300 rounded-lg text-blue-900 focus:outline-none focus:border-blue-900"
              >
                <option value="all">All Countries</option>
                {[...new Set(cvData.map(cv => cv.country))].map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
              <select
                value={filters.profession}
                onChange={(e) => setFilters({ ...filters, profession: e.target.value })}
                className="px-4 py-2 bg-blue-50 border border-blue-300 rounded-lg text-blue-900 focus:outline-none focus:border-blue-900"
              >
                <option value="all">All Professions</option>
                {[...new Set(cvData.map(cv => cv.profession))].map(prof => (
                  <option key={prof} value={prof}>{prof}</option>
                ))}
              </select>
            </div>
          </div>
          <div id="map-chart" className="h-96"></div>
        </div>

        {/* Country & Gender Row */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white/60 backdrop-blur-xl border border-blue-200 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-blue-800 mb-4 flex items-center">
              <Globe className="w-5 h-5 mr-2" /> Country Distribution
            </h2>
            <div id="country-chart" className="h-80"></div>
          </div>
          <div className="bg-white/60 backdrop-blur-xl border border-blue-200 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-blue-800 mb-4 flex items-center">
              <PieChart className="w-5 h-5 mr-2" /> Gender Distribution
            </h2>
            <div id="gender-chart" className="h-80"></div>
          </div>
        </div>

        {/* Skills Tree Map - Full Width */}
        <div className="bg-white/60 backdrop-blur-xl border border-blue-200 rounded-2xl p-6 shadow-xl">
          <h2 className="text-2xl font-bold text-blue-800 mb-4 flex items-center">
            <BarChart3 className="w-6 h-6 mr-2" /> Skills Tree Map
          </h2>
          <div id="skills-chart" className="h-96"></div>
        </div>

        {/* Skill Coverage Heatmap - Full Width */}
        <div className="bg-white/60 backdrop-blur-xl border border-blue-200 rounded-2xl p-6 shadow-xl">
          <h2 className="text-2xl font-bold text-blue-800 mb-4 flex items-center">
            <Grid className="w-6 h-6 mr-2" /> Skill Coverage Heatmap
          </h2>
          <div id="heatmap-chart" className="h-96 overflow-auto"></div>
        </div>

        {/* Matrix Table */}
        <div className="bg-white/60 backdrop-blur-xl border border-blue-200 rounded-2xl p-6 shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-blue-800 flex items-center">
              <Grid className="w-6 h-6 mr-2" /> Candidate Matrix
            </h2>
            <div className="flex space-x-3">
              <select
                value={tableFilters.gender}
                onChange={(e) => setTableFilters({ ...tableFilters, gender: e.target.value })}
                className="px-4 py-2 bg-blue-50 border border-blue-300 rounded-lg text-blue-900 text-sm focus:outline-none"
              >
                <option value="all">All Genders</option>
                {[...new Set(cvData.map(cv => cv.gender))].map(gender => (
                  <option key={gender} value={gender}>{gender}</option>
                ))}
              </select>
              <select
                value={tableFilters.profession}
                onChange={(e) => setTableFilters({ ...tableFilters, profession: e.target.value })}
                className="px-4 py-2 bg-blue-50 border border-blue-300 rounded-lg text-blue-900 text-sm focus:outline-none"
              >
                <option value="all">All Professions</option>
                {[...new Set(cvData.map(cv => cv.profession))].map(prof => (
                  <option key={prof} value={prof}>{prof}</option>
                ))}
              </select>
              <select
                value={tableFilters.location}
                onChange={(e) => setTableFilters({ ...tableFilters, location: e.target.value })}
                className="px-4 py-2 bg-blue-50 border border-blue-300 rounded-lg text-blue-900 text-sm focus:outline-none"
              >
                <option value="all">All Locations</option>
                {[...new Set(cvData.map(cv => cv.country))].map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-blue-300">
                  <th className="text-left p-3 text-blue-800 font-semibold">Name</th>
                  <th className="text-left p-3 text-blue-800 font-semibold">Profession</th>
                  <th className="text-left p-3 text-blue-800 font-semibold">Phone</th>
                  <th className="text-left p-3 text-blue-800 font-semibold">Email</th>
                  <th className="text-left p-3 text-blue-800 font-semibold">Location</th>
                  <th className="text-left p-3 text-blue-800 font-semibold">Gender</th>
                  <th className="text-left p-3 text-blue-800 font-semibold">Country</th>
                </tr>
              </thead>
              <tbody>
                {filteredTableData.map((cv, idx) => (
                  <tr key={idx} className="border-b border-blue-200 hover:bg-blue-100 transition-colors">
                    <td className="p-3 text-blue-900">{cv.name}</td>
                    <td className="p-3 text-blue-800">{cv.profession}</td>
                    <td className="p-3 text-blue-800">{cv.phone_number}</td>
                    <td className="p-3 text-blue-800 text-sm">{cv.email}</td>
                    <td className="p-3 text-blue-800">{cv.location || 'N/A'}</td>
                    <td className="p-3 text-blue-800 capitalize">{cv.gender}</td>
                    <td className="p-3 text-blue-800">{cv.country}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Candidate Cards */}
        <div className="bg-white/60 backdrop-blur-xl border border-blue-200 rounded-2xl p-6 shadow-xl">
          <h2 className="text-2xl font-bold text-blue-800 mb-6">Candidate Profiles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTableData.map((cv, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedCandidate(cv)}
                className="bg-gradient-to-br from-blue-100 to-blue-50 border border-blue-200 rounded-xl p-6 hover:border-blue-700 transition-all transform hover:scale-[1.02] cursor-pointer shadow-md hover:shadow-xl"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-blue-900 mb-1">{cv.name}</h3>
                    <p className="text-blue-800 text-sm">{cv.profession}</p>
                  </div>
                  <span className="px-3 py-1 bg-blue-200 border border-blue-300 rounded-full text-blue-900 text-xs capitalize">{cv.gender}</span>
                </div>

                <div className="space-y-2 mb-4">
                  <p className="text-blue-800 text-sm flex items-center">
                    <Mail className="w-4 h-4 mr-2 text-blue-700" />
                    {cv.email}
                  </p>
                  {cv.phone_number && (
                    <p className="text-blue-800 text-sm">{cv.phone_number}</p>
                  )}
                  {cv.location && (
                    <p className="text-blue-800 text-sm">{cv.location}</p>
                  )}
                </div>

                {cv.skills && Array.isArray(cv.skills) && cv.skills.length > 0 && (
                  <div className="mb-4">
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

                {(cv.projects && Array.isArray(cv.projects) && cv.projects.length > 0) && (
                  <div className="mb-4">
                    <p className="text-blue-800 text-xs font-semibold mb-1">Projects: {cv.projects.length}</p>
                  </div>
                )}

                <div className="flex space-x-2">
                  {cv.github_link && (
                    <a href={cv.github_link} target="_blank" rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 px-3 py-2 bg-blue-200 border border-blue-300 rounded-lg text-blue-900 text-sm text-center hover:bg-blue-300 transition-all">
                      GitHub
                    </a>
                  )}
                  {cv.linkedin_link && (
                    <a href={cv.linkedin_link} target="_blank" rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 px-3 py-2 bg-blue-200 border border-blue-300 rounded-lg text-blue-900 text-sm text-center hover:bg-blue-300 transition-all">
                      LinkedIn
                    </a>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-blue-300">
                  <button className="w-full px-3 py-2 bg-blue-900 text-white rounded-lg text-sm hover:bg-blue-800 transition-all">
                    View Full Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chatbot Button with Tooltip */}
      <div className="fixed bottom-8 right-8 z-50">
        {!chatOpen && (
          <div className="absolute bottom-20 right-0 bg-white border-2 border-blue-300 rounded-lg p-3 shadow-xl mb-2 w-64 animate-bounce">
            <p className="text-blue-900 text-sm font-medium">
              Hey friend! I am here to assist you to clear your queries
            </p>
            <div className="absolute bottom-0 right-8 transform translate-y-1/2 rotate-45 w-4 h-4 bg-white border-r-2 border-b-2 border-blue-300"></div>
          </div>
        )}
        <button
          onClick={() => setChatOpen(true)}
          className="p-4 bg-gradient-to-r from-blue-900 to-blue-700 rounded-full shadow-2xl shadow-blue-500/50 hover:scale-110 transition-transform"
        >
          <UserPen className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Chatbot Modal */}
      {chatOpen && <ChatAssistant cvData={cvData} onClose={() => setChatOpen(false)} />}

      {/* Candidate Detail Modal */}
      {selectedCandidate && (
        <CandidateDetailModal
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
        />
      )}
    </div>
  );
};

// Chat Assistant Component
const ChatAssistant = ({ cvData, onClose }) => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hey, I am Analysis Assistant. How can I help you?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

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
      const systemPrompt = `You are **CVAlyze**, an intelligent HR analysis assistant that helps recruiters, employers, and analysts evaluate candidates.

You have access to structured candidate data:
${JSON.stringify(cvData, null, 2)}

Your behavior rules:
1. If the user's query is about candidates, resumes, skills, experience, ranking, recommendations, or comparisons, use the candidate data above to answer. Provide clear, concise insights and focus on useful analysis — not generic statements.
2. If the user's message is casual or unrelated to candidate data (e.g., greetings, small talk, tech questions, etc.), respond naturally without mentioning or using candidate data.
3. Keep every response concise and conversational — like a helpful colleague. Only give detailed explanations if the user explicitly asks for them.
4. When analyzing candidates, highlight only the most relevant points (skills, experience fit, strengths, weaknesses, or ranking).
5. Never fabricate candidate data beyond what's provided.
6. Always stay focused, polite, and professional.
7. Always give response in markdown form`;

      const limitedMessages = messages.slice(1).slice(-4);

      const chatHistory = limitedMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      chatHistory.push({
        role: 'user',
        parts: [{ text: query }]
      });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: chatHistory,
            system_instruction: {
              parts: [{ text: systemPrompt }]
            }
          })
        }
      );

      const data = await response.json();

      const aiResponse =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        data?.output_text ||
        "Sorry, I couldn't process that.";

      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
    } catch (error) {
      console.error("Gemini API Error:", error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, there was an error processing your request.' }
      ]);
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

  // Clear chat history
  const handleClearChat = () => {
    setMessages([
      { role: 'assistant', content: "Hey, I am Analysis Assistant. How can I help you?" }
    ]);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-blue-300 rounded-2xl w-full max-w-2xl h-[600px] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-blue-200 bg-gradient-to-r from-blue-100 to-blue-50">
          <div className="flex items-center space-x-3">
            <UserPen className="w-6 h-6 text-blue-800" />
            <h3 className="text-xl font-bold text-blue-800">Analysis Assistant</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleClearChat}
              className="p-2 hover:bg-blue-200 rounded-lg transition-colors"
              title="Clear chat history"
            >
              <Trash2 className="w-5 h-5 text-blue-800" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-blue-200 rounded-lg transition-colors">
              <X className="w-5 h-5 text-blue-800" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-blue-50/30">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-xl ${msg.role === 'user'
                ? 'bg-blue-900 text-white'
                : 'bg-white border border-blue-200 text-blue-900'
                }`}>
                <div dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }} />
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-blue-200 p-3 rounded-xl">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-blue-900 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-900 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-blue-900 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-blue-200 bg-white">
          <div className="mb-3">
            <button
              onClick={() => sendMessage('Top 5 candidates based on skill, experience, education')}
              className="w-full px-4 py-2 bg-blue-100 border border-blue-300 rounded-lg text-blue-900 text-sm hover:bg-blue-200 transition-all text-left"
            >
              💡 Top 5 candidates based on skill, experience, education
            </button>
          </div>
          <div className="flex space-x-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Ask me anything about candidates..."
              className="flex-1 px-4 py-3 bg-blue-50 border border-blue-300 rounded-xl text-blue-900 placeholder-blue-400 focus:outline-none focus:border-blue-900"
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="px-4 py-3 bg-gradient-to-r from-blue-900 to-blue-700 rounded-xl text-white hover:from-blue-800 hover:to-blue-600 transition-all disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Settings Page
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
      const response = await fetch(`${API_BASE}/register`, {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-blue-100">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-200/40 via-transparent to-transparent"></div>

      <nav className="relative border-b border-blue-200 bg-white/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <FileBarChart className="w-8 h-8 text-blue-900" />
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-900 to-blue-700 bg-clip-text text-transparent">CVAlyze</span>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-blue-100 border border-blue-300 rounded-lg text-blue-800 hover:bg-blue-200"
          >
            Back to Dashboard
          </button>
        </div>
      </nav>

      <div className="relative max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-900 to-blue-700 bg-clip-text text-transparent">
            Account Settings
          </h1>
          <p className="text-blue-800">Manage your account preferences</p>
        </div>

        {message && (
          <div className="mb-6 p-4 bg-blue-100 border border-blue-300 rounded-xl text-blue-900 text-center">
            {message}
          </div>
        )}

        {/* Change Password */}
        <div className="bg-white/60 backdrop-blur-xl border border-blue-200 rounded-2xl p-8 mb-8 shadow-xl">
          <h2 className="text-2xl font-bold text-blue-800 mb-6 flex items-center">
            <Lock className="w-6 h-6 mr-2" /> Change Password
          </h2>
          <form onSubmit={handlePasswordChange} className="space-y-6">
            <div>
              <label className="block text-blue-800 text-sm font-medium mb-2">Current Password</label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full px-4 py-3 bg-blue-50 border border-blue-300 rounded-xl text-blue-900 placeholder-blue-400 focus:outline-none focus:border-blue-900"
                required
              />
            </div>
            <div>
              <label className="block text-blue-800 text-sm font-medium mb-2">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 bg-blue-50 border border-blue-300 rounded-xl text-blue-900 placeholder-blue-400 focus:outline-none focus:border-blue-900"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-900 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-800 hover:to-blue-600 transition-all disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>

        {/* Delete Account */}
        <div className="bg-white/60 backdrop-blur-xl border border-red-300 rounded-2xl p-8 shadow-xl">
          <h2 className="text-2xl font-bold text-red-600 mb-6 flex items-center">
            <Trash2 className="w-6 h-6 mr-2" /> Delete Account
          </h2>
          <p className="text-blue-800 mb-6">This action is permanent and cannot be undone. All your data will be deleted.</p>
          <form onSubmit={handleDeleteAccount} className="space-y-6">
            <div>
              <label className="block text-red-600 text-sm font-medium mb-2">Confirm Password</label>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="w-full px-4 py-3 bg-red-50 border border-red-300 rounded-xl text-red-900 placeholder-red-400 focus:outline-none focus:border-red-600"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-xl font-semibold hover:from-red-700 hover:to-red-600 transition-all disabled:opacity-50"
            >
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

          // Always show welcome page first if on root or /welcome
          if (currentPath === '/' || currentPath === '/welcome') {
            return <WelcomePage navigate={navigate} />;
          }

          // Redirect to welcome if not authenticated and not on login page
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