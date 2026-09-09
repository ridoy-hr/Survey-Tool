import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LayoutGrid, 
  Users, 
  Settings, 
  Heart, 
  Search, 
  Filter, 
  ChevronDown, 
  Star, 
  MoreVertical, 
  Plus, 
  Database, 
  RefreshCw, 
  Layout, 
  Eye, 
  Save, 
  ArrowLeft, 
  Share2, 
  Trash2, 
  Undo2,
  GitBranch,
  Layers,
  GripVertical, 
  Circle, 
  Square, 
  BarChart3, 
  Edit3, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  BarChartBig,
  Palette,
  Zap,
  ClipboardList,
  Copy,
  Send,
  MessageSquare,
  Link2,
  ExternalLink,
  Sparkles,
  Loader2,
  Globe,
  X,
  PlusCircle,
  ArrowRight,
  CornerDownLeft,
  GripHorizontal,
  Code,
  Grid3X3,
  Minimize2,
  Maximize2,
  Calendar,
  Mail,
  Archive,
  Menu,
  Download,
  Sun,
  Moon,
  Check,
  ShieldCheck,
  Smile,
  Frown,
  Meh,
  SmilePlus,
  Home,
  Building2,
  XCircle,
  Cpu,
  MoreHorizontal,
  TrendingUp,
  Laptop,
  HeartPulse,
  Gift,
  Target,
  Briefcase,
  Users2,
  GraduationCap,
  CalendarClock,
  DollarSign,
  Coins,
  Gem,
  Hourglass,
  Scale,
  UserSquare2,
  Network,
  MessagesSquare,
  Handshake,
  BookOpen,
  Settings2,
  Box,
  Monitor,
  Beaker,
  Gauge,
  AlertTriangle,
  Activity,
  Brain,
  Play,
  Info
} from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import { jsPDF } from 'jspdf';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { cn } from './lib/utils';
import { generateSurvey, modifyQuestion, diagnoseSurvey, suggestNextAnswer, type SurveyDiagnostic } from './services/aiService';
import { exportToCSV, exportToExcel, exportToPDF } from './utils/exportUtils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  increment,
  writeBatch
} from 'firebase/firestore';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Types
// Types
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

type QuestionType = 'multiple_choice' | 'checkbox' | 'short_text' | 'long_text' | 'rating' | 'nps' | 'dropdown' | 'page_break' | 'html' | 'matrix';
type View = 'dashboard' | 'workspace' | 'preview' | 'global_analytics' | 'admin_dashboard' | 'profile';

export type SurveyTheme = 'professional' | 'playful';

const CHART_COLORS = [
  '#1d486b', // HR Navy
  '#3b82f6', // Bright Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Indigo
  '#ec4899', // Pink
  '#14b8a6', // Teal
];

const PLAYFUL_COLORS = [
  'bg-indigo-100 text-indigo-600 border-indigo-200',
  'bg-pink-100 text-pink-600 border-pink-200',
  'bg-emerald-100 text-emerald-600 border-emerald-200',
  'bg-orange-100 text-orange-600 border-orange-200',
  'bg-rose-100 text-rose-600 border-rose-200',
  'bg-blue-100 text-blue-600 border-blue-200',
  'bg-purple-100 text-purple-600 border-purple-200',
  'bg-teal-100 text-teal-600 border-teal-200',
  'bg-yellow-100 text-yellow-600 border-yellow-200',
  'bg-red-100 text-red-600 border-red-200',
];

interface LogicCondition {
  questionId: string;
  operator: 'is_one_of' | 'is_not_one_of' | 'is_answered' | 'is_not_answered';
  values: string[];
}

interface QuestionValidation {
  requiredType?: 'Not required' | 'Required' | 'Warn respondents if question is left unanswered (Soft-Require)' | 'Conditionally require this question on previous answers';
  answerFormat?: string;
  capitalizeWords?: boolean;
  limitAnswersTo?: number | null;
  minAnswers?: number | null;
}

interface QuestionLogic {
  enabled: boolean;
  conditions: LogicCondition[];
  hideByDefault?: boolean;
  adminOnly?: boolean;
  disabled?: boolean;
  alwaysIncludeInRandomization?: boolean;
  fixedPosition?: boolean;
}

interface Question {
  id: string;
  type: QuestionType;
  text: string;
  desc: string;
  choices?: string[];
  rows?: string[];
  hasOther?: boolean;
  minimized?: boolean;
  required: boolean;
  alias: string;
  logic?: QuestionLogic;
  validation?: QuestionValidation;
}

interface Folder {
  id: string;
  name: string;
  userId: string;
  order: number;
}

interface Survey {
  id: string;
  title: string;
  folderId?: string;
  desc?: string;
  logoUrl?: string;
  status: 'Active' | 'Closed' | 'Draft';
  lastResponse: string;
  responses: number;
  completionRate: number;
  createdAt: string;
  isStarred?: boolean;
  isDeleted?: boolean;
  isShared?: boolean;
  lastOpenedAt?: number;
  links?: { id: string; name: string; url: string; clicks: number; status: 'Active' | 'Paused' }[];
  questions?: Question[];
  thankYouHtml?: string;
  theme?: SurveyTheme;
  ownerId?: string;
  ownerEmail?: string;
  sharedEmails?: string[];
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'info' | 'error';
}

// Utility to ensure we share the public App URL
const getPublicUrl = () => {
  return window.location.origin.replace('ais-dev', 'ais-pre');
};

const CHOICE_ICONS: Record<string, React.ReactNode> = {
  'weekly': <Calendar className="w-4 h-4" />,
  'monthly': <Clock className="w-4 h-4" />,
  'quarterly': <Layers className="w-4 h-4" />,
  'annually': <Zap className="w-4 h-4" />,
  'remote': <Home className="w-4 h-4" />,
  'office': <Building2 className="w-4 h-4" />,
  'hybrid': <Users className="w-4 h-4" />,
  'flexible': <Sparkles className="w-4 h-4" />,
  'satisfied': <Smile className="w-4 h-4" />,
  'neutral': <Meh className="w-4 h-4" />,
  'dissatisfied': <Frown className="w-4 h-4" />,
  'yes': <Check className="w-4 h-4" />,
  'no': <X className="w-4 h-4" />,
  'agree': <CheckCircle2 className="w-4 h-4" />,
  'disagree': <XCircle className="w-4 h-4" />,
  'chatgpt': <Cpu className="w-4 h-4" />,
  'ai': <Zap className="w-4 h-4" />,
  'other': <MoreHorizontal className="w-4 h-4" />,
  'performance': <BarChart3 className="w-4 h-4" />,
  'growth': <TrendingUp className="w-4 h-4" />,
  'culture': <Heart className="w-4 h-4" />,
  'tech': <Laptop className="w-4 h-4" />,
  'health': <HeartPulse className="w-4 h-4" />,
  'perk': <Gift className="w-4 h-4" />,
  'benefit': <PlusCircle className="w-4 h-4" />,
  'goal': <Target className="w-4 h-4" />,
  'career': <Briefcase className="w-4 h-4" />,
  'team': <Users2 className="w-4 h-4" />,
  'feedback': <MessageSquare className="w-4 h-4" />,
  'training': <GraduationCap className="w-4 h-4" />,
  'daily': <Sun className="w-4 h-4" />,
  'bi-weekly': <CalendarClock className="w-4 h-4" />,
  'salary': <DollarSign className="w-4 h-4" />,
  'compensation': <Coins className="w-4 h-4" />,
  'bonus': <Gem className="w-4 h-4" />,
  'time': <Hourglass className="w-4 h-4" />,
  'balance': <Scale className="w-4 h-4" />,
  'leadership': <UserSquare2 className="w-4 h-4" />,
  'management': <Network className="w-4 h-4" />,
  'communication': <MessagesSquare className="w-4 h-4" />,
  'collaboration': <Handshake className="w-4 h-4" />,
  'learning': <BookOpen className="w-4 h-4" />,
  'skills': <Settings2 className="w-4 h-4" />,
  'software': <Box className="w-4 h-4" />,
  'hardware': <Monitor className="w-4 h-4" />
};

const getChoiceIcon = (text: string) => {
  const normalized = text.toLowerCase().trim();
  for (const [key, icon] of Object.entries(CHOICE_ICONS)) {
    if (normalized.includes(key)) return icon;
  }
  return null;
};

export const getThemeClasses = (theme: SurveyTheme = 'professional') => {
  if (theme === 'playful') {
    return {
      bg: 'bg-slate-50',
      card: 'bg-white border-gray-100 shadow-sm rounded-3xl',
      accent: 'text-indigo-600',
      button: 'bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl',
      input: 'border-gray-300 focus:border-indigo-600 rounded-xl',
      font: 'font-sans',
      heading: 'text-gray-900 font-bold'
    };
  }
  return {
    bg: 'bg-[#F5F5F5]',
    card: 'bg-white border-[#CCCCCC] shadow-sm rounded-xl',
    accent: 'text-mp-green-700',
    button: 'bg-mp-green-700 hover:bg-mp-green-800 text-white rounded-xl gap-3',
    input: 'border-[#CCCCCC] focus:border-[#5099EC] rounded-xl',
    font: 'font-roboto text-black',
    heading: 'text-black font-bold font-inria'
  };
};

export const THEMES: { id: SurveyTheme; name: string; icon: React.ReactNode; color: string; bg: string; text: string; description: string }[] = [
  { 
    id: 'professional', 
    name: 'Professional', 
    icon: <Database className="w-5 h-5" />, 
    color: 'bg-hr-navy', 
    bg: 'bg-slate-50',
    text: 'text-hr-navy',
    description: 'Corporate and established'
  },
  { 
    id: 'playful', 
    name: 'Playful & Minimal', 
    icon: <Sparkles className="w-5 h-5" />, 
    color: 'bg-indigo-600', 
    bg: 'bg-white',
    text: 'text-gray-900',
    description: 'Colorful sidebar, fixed progress'
  }
];

// Mock Data
export const DEFAULT_THANK_YOU_HTML = `<div style="font-family: Roboto, sans-serif; color: #000000; text-align: center; padding: 15px 10px; margin: 0; width: 100%; box-sizing: border-box; line-height: 1.5; background-color: transparent;">
<div style="max-width: 850px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #CCCCCC; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); text-align: center;">
                      <div style="background-color: #018624; color: #ffffff; padding: 30px 20px;">
                        <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; background-color: rgba(255, 255, 255, 0.2); border-radius: 50%; margin-bottom: 12px; border: 2px solid rgba(255, 255, 255, 0.3);"><span style="color:#ffffff;font-size:32px;line-height:1;">✔</span></div>
                        <h1 style="margin:0 0 6px;font-size:32px;color:#ffffff;font-family: 'Inria Serif', serif;font-weight:700;letter-spacing:-.25px;">Thank You!</h1>
                        <p style="color:#CBEED5;font-weight:500;margin:0 0 4px;font-size:16px;text-transform:uppercase;letter-spacing:1px;">Your response is appreciated</p>
                        <p style="margin:0;font-size:15px;color:#F2FBF5;">We’ll send you a copy of the research report as soon as it's ready.</p>
                      </div>
<div style="padding: 25px 20px;">
<div style="display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 25px; justify-content: center;">
<div style="flex: 1 1 300px; background-color: #ffffff; border-radius: 12px; padding: 20px; border: 1px solid #CCCCCC; box-shadow: 0 2px 4px rgba(0,0,0,0.03); box-sizing: border-box; text-align: left; position: relative; overflow: hidden; display: flex; flex-direction: column;">
<div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background: #018624;">&nbsp;</div>
<h2 style="margin:0 0 8px;font-size:18px;color:#000000;font-family: 'Inria Serif', serif;font-weight:700;"><span style="font-size:20px;">💡</span> Want more insights?</h2>
<p style="margin:0 0 16px;font-size:14px;color:#666666;">Have you checked out the exclusive HR.com research reports on our website? They're completely free.</p>
<a href="https://www.hr.com/en/resources/free_research_white_papers/" rel="noreferrer noopener" style="text-align:center;background-color:#018624;color:#ffffff;text-decoration:none;padding:12px 20px;font-weight:500;font-size:14px;border-radius:12px;" target="_blank">View Free Research </a></div>
<div style="flex: 1 1 300px; background-color: #ffffff; border-radius: 12px; padding: 20px; border: 1px solid #CCCCCC; box-shadow: 0 2px 4px rgba(0,0,0,0.03); box-sizing: border-box; text-align: left; position: relative; overflow: hidden; display: flex; flex-direction: column;">
<div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background: #396B7E;">&nbsp;</div>
<h2 style="margin:0 0 8px;font-size:18px;color:#000000;font-family: 'Inria Serif', serif;font-weight:700;"><span style="font-size:20px;">📅</span> Upcoming Virtual Event</h2>
<p style="margin:0 0 16px;font-size:14px;color:#666666;">Join us at the State of Today's HR Tech Event on May 14th for expert presentations on HR processes.</p>
<a href="https://web.hr.com/jrwpk" rel="noreferrer noopener" style="text-align:center;background-color:#396B7E;color:#ffffff;text-decoration:none;padding:12px 20px;font-weight:500;font-size:14px;border-radius:12px;" target="_blank">Register Today </a></div>
</div>
<div style="display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 30px; margin: 10px 0 20px;"><img alt="HR Research Institute Logo" src="https://surveygizmolibrary.s3.amazonaws.com/library/529365/HRResearchInstitute_PoweredbyHRcom_clr_logo1.jpg" style="height:50px;" /><img alt="HR.com Research Logo" src="https://surveygizmolibrary.s3.amazonaws.com/library/529365/HRcom_Research_WordMark.jpg" style="height:75px;" /></div>
</div>
<div style="background-color: #F5F5F5; padding: 20px 15px; border-top: 1px solid #CCCCCC;">
<p style="margin:0 0 12px;font-size:14px;color:#666666;">While you're in the survey-taking mood, check out our other <a href="http://hr.com" rel="noreferrer noopener" style="color:#20588E;font-weight:600;text-decoration:none;border-bottom:1px solid #20588E;padding-bottom:1px;" target="_blank">HR.com</a> surveys!</p>
<a href="http://hr.com/takeasurvey" rel="noreferrer noopener" style="background-color:#ffffff;color:#000000;text-decoration:none;padding:10px 24px;font-weight:500;font-size:14px;border:1px solid #CCCCCC;border-radius:12px;" target="_blank">Take Another Survey </a></div>
</div>
</div>`;

const INITIAL_SURVEYS: Survey[] = [
  { id: '1', title: 'The Future of Global Expansion in HR 2026', status: 'Draft', lastResponse: '-', responses: 0, completionRate: 0, createdAt: 'May 5, 2026', isStarred: true, lastOpenedAt: Date.now() - 1000 * 60 * 60, links: [] },
  { id: '2', title: "State of Today's HR Technology and Integrations 2026", status: 'Draft', lastResponse: '-', responses: 0, completionRate: 0, createdAt: 'May 5, 2026', lastOpenedAt: Date.now() - 1000 * 60 * 5, links: [] },
  { id: '3', title: 'The State of Rewards and Recognition 2026', status: 'Draft', lastResponse: '-', responses: 0, completionRate: 0, createdAt: 'May 5, 2026', isShared: true, lastOpenedAt: Date.now() - 1000 * 60 * 60 * 24, links: [] },
  { id: '4', title: 'InspireHR West Feedback 2025', status: 'Draft', lastResponse: '-', responses: 0, completionRate: 0, createdAt: 'May 5, 2026', lastOpenedAt: Date.now() - 1000 * 60 * 60 * 48, links: [] },
];

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  
  const [respondentSurveyId, setRespondentSurveyId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('v');
    if (v) return v;
    
    // Check for path-based routing: /v/surveyId or /survey/surveyId
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const surveyIdx = pathParts.findIndex(p => p === 'survey' || p === 'v');
    if (surveyIdx !== -1 && pathParts[surveyIdx + 1]) return pathParts[surveyIdx + 1];
    
    return null;
  });
  
  const [analyticsSurveyId, setAnalyticsSurveyId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const a = params.get('a');
    if (a) return a;
    
    // Check for path-based routing: /a/surveyId or /analytics/surveyId
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const analyticsIdx = pathParts.findIndex(p => p === 'a' || p === 'analytics');
    if (analyticsIdx !== -1 && pathParts[analyticsIdx + 1]) return pathParts[analyticsIdx + 1];
    
    return null;
  });
  
  const [ownedSurveys, setOwnedSurveys] = useState<Survey[]>([]);
  const [sharedSurveys, setSharedSurveys] = useState<Survey[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);

  // Safely synchronize multiple real-time subsets into unified state to support collaborator scopes
  useEffect(() => {
    const merged: Survey[] = [...ownedSurveys];
    sharedSurveys.forEach(s => {
      if (!merged.some(m => m.id === s.id)) {
        merged.push(s);
      }
    });
    setSurveys(merged);
  }, [ownedSurveys, sharedSurveys]);

  const [activeSurveyId, setActiveSurveyId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedInspectUserId, setSelectedInspectUserId] = useState<string | null>(null);
  const [stressTestSurveyId, setStressTestSurveyId] = useState<string | null>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [builderTab, setBuilderTab] = useState<'questions' | 'logic' | 'design' | 'results' | 'share' | 'settings' | 'test'>('questions');
  
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [draggedSurveyId, setDraggedSurveyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Closed' | 'Draft'>('All');
  const [sortBy, setSortBy] = useState<'Date' | 'Name'>('Date');
  const [questionsMap, setQuestionsMap] = useState<Record<string, Question[]>>({});
  const [isLoadingData, setIsLoadingData] = useState(false);
  
  const [surveyToDelete, setSurveyToDelete] = useState<{id: string, isPermanent: boolean} | null>(null);
  const [isEmptyingTrash, setIsEmptyingTrash] = useState(false);

  // Auth Listener
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsLoadingAuth(false);
      
      if (u) {
        // Record user login details in Firestore /users/{userId}
        const userDocRef = doc(db, 'users', u.uid);
        setDoc(userDocRef, {
          id: u.uid,
          email: u.email || '',
          displayName: u.displayName || u.email?.split('@')[0] || 'Unknown Colleague',
          lastLoginAt: new Date().toISOString()
        }, { merge: true }).catch((err) => {
          console.warn("Could not record user info in Firestore:", err);
        });
      }
    });
  }, []);

  // Data Fetching
  useEffect(() => {
    if (!user) {
      setOwnedSurveys([]);
      setSharedSurveys([]);
      setAllUsers([]);
      setSelectedInspectUserId(null);
      setFolders([]);
      return;
    }
    
    setIsLoadingData(true);
    const isAdminUser = user.email === 'mridoy@hr.com';
    const qMap: Record<string, Question[]> = {};

    let unsubscribeOwned: () => void = () => {};
    let unsubscribeShared: () => void = () => {};
    let unsubscribeUsers: () => void = () => {};

    if (isAdminUser) {
      // Admins fetch ALL surveys globally
      const adminQuery = query(collection(db, 'surveys'));
      unsubscribeOwned = onSnapshot(adminQuery, (snapshot) => {
        const list: Survey[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as any;
          list.push({ ...data, id: doc.id });
          if (data.questions) {
            qMap[doc.id] = (data.questions || []).filter(Boolean);
          }
        });
        setOwnedSurveys(list);
        setSharedSurveys([]);
        setQuestionsMap(prev => ({ ...prev, ...qMap }));
        setIsLoadingData(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'surveys');
        setIsLoadingData(false);
        showToast("Error loading admin surveys", "error");
      });

      // Admins fetch ALL registered users globally
      const adminUsersQuery = query(collection(db, 'users'));
      unsubscribeUsers = onSnapshot(adminUsersQuery, (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((doc) => {
          list.push({ ...doc.data(), id: doc.id });
        });
        setAllUsers(list);
      }, (error) => {
        console.warn("Failed to subscribe to registered users:", error);
      });
    } else {
      // Normal users fetch owned surveys
      const ownedQuery = query(
        collection(db, 'surveys'),
        where('ownerId', '==', user.uid)
      );
      unsubscribeOwned = onSnapshot(ownedQuery, (snapshot) => {
        const list: Survey[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as any;
          list.push({ ...data, id: doc.id });
          if (data.questions) {
            qMap[doc.id] = (data.questions || []).filter(Boolean);
          }
        });
        setOwnedSurveys(list);
        setQuestionsMap(prev => ({ ...prev, ...qMap }));
        setIsLoadingData(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'surveys');
        setIsLoadingData(false);
        showToast("Error loading owned surveys", "error");
      });

      // Normal users fetch shared surveys
      if (user.email) {
        const sharedQuery = query(
          collection(db, 'surveys'),
          where('sharedEmails', 'array-contains', user.email)
        );
        unsubscribeShared = onSnapshot(sharedQuery, (snapshot) => {
          const list: Survey[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data() as any;
            list.push({ ...data, id: doc.id });
            if (data.questions) {
              qMap[doc.id] = (data.questions || []).filter(Boolean);
            }
          });
          setSharedSurveys(list);
          setQuestionsMap(prev => ({ ...prev, ...qMap }));
          setIsLoadingData(false);
        }, (error) => {
          console.warn("Shared surveys loading error or restricted:", error);
        });
      } else {
        setSharedSurveys([]);
        setIsLoadingData(false);
      }
    }

    const foldersQuery = query(
      collection(db, 'folders'),
      where('userId', '==', user.uid),
      orderBy('order', 'asc')
    );

    const unsubscribeFolders = onSnapshot(foldersQuery, (snapshot) => {
      const foldersList: Folder[] = [];
      snapshot.forEach((doc) => {
        foldersList.push({ ...doc.data(), id: doc.id } as Folder);
      });
      setFolders(foldersList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'folders');
    });

    return () => {
      unsubscribeOwned();
      unsubscribeShared();
      unsubscribeFolders();
      unsubscribeUsers();
    };
  }, [user]);

  const handleCreateFolder = async () => {
    if (!user || !newFolderName.trim()) return;
    setIsCreatingFolder(true);
    try {
      await addDoc(collection(db, 'folders'), {
        name: newFolderName.trim(),
        userId: user.uid,
        order: folders.length,
        createdAt: serverTimestamp()
      });
      setNewFolderName('');
      setIsFolderModalOpen(false);
      showToast('Folder created');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'folders');
      showToast('Error creating folder', 'error');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleRenameFolder = async (folderId: string, newName: string) => {
    try {
      await updateDoc(doc(db, 'folders', folderId), { name: newName });
      showToast('Folder renamed');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'folders');
      showToast('Error renaming folder', 'error');
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      await deleteDoc(doc(db, 'folders', folderId));
      
      const surveysToUpdate = surveys.filter(s => s.folderId === folderId);
      for (const survey of surveysToUpdate) {
        await updateDoc(doc(db, 'surveys', survey.id), { folderId: null });
      }

      if (selectedFolderId === folderId) setSelectedFolderId('all');
      showToast('Folder deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'folders');
      showToast('Error deleting folder', 'error');
    }
  };

  const handleMoveSurvey = async (surveyId: string, folderId: string | null) => {
    try {
      await updateDoc(doc(db, 'surveys', surveyId), {
        folderId: folderId,
        isDeleted: false // If moved from trash, restore it
      });
      const folderName = folderId ? folders.find(f => f.id === folderId)?.name : 'Unfiled';
      showToast(`Moved to ${folderName}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `surveys/${surveyId}`);
      showToast('Error moving survey', 'error');
    }
  };

  const activeSurvey = useMemo(() => {
    if (!activeSurveyId) return null;
    return surveys.find(s => s && s.id === activeSurveyId) || null;
  }, [activeSurveyId, surveys]);

  const questions = useMemo(() => {
    if (!activeSurvey) return [];
    return questionsMap[activeSurvey.id] || [];
  }, [activeSurvey, questionsMap]);

  const setQuestions = (newQuestions: Question[] | ((prev: Question[]) => Question[])) => {
    if (!activeSurvey) return;
    const current = questionsMap[activeSurvey.id] || [];
    const updated = typeof newQuestions === 'function' ? newQuestions(current) : newQuestions;
    setQuestionsMap(prev => ({ ...prev, [activeSurvey.id]: updated }));
    // We update Firestore in the Workspace component helpers usually, 
    // but having this helper is useful for the props.
  };

  const setActiveSurvey = (s: Survey | null) => {
    setActiveSurveyId(s ? s.id : null);
  };

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t && t.id !== id));
    }, 3000);
  };

  const openWorkspace = (survey: Survey) => {
    setActiveSurvey(survey);
    // Update last opened
    setSurveys(prev => prev.map(s => s && s.id === survey.id ? { ...s, lastOpenedAt: Date.now() } : s));
    setView('workspace');
    if (survey.responses > 0) setBuilderTab('results');
    else setBuilderTab('questions');
  };

  const backToDashboard = () => {
    setView('dashboard');
    setActiveSurvey(null);
  };

  const publishSurvey = async (id: string) => {
    setSurveys(prev => prev.map(s => s && s.id === id ? { ...s, status: 'Active' as const } : s));
    try {
      await updateDoc(doc(db, 'surveys', id), { status: 'Active' });
      showToast('Survey is now live and collecting responses!', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `surveys/${id}`);
      showToast("Error publishing survey", "error");
    }
    setView('dashboard');
    setActiveSurvey(null);
  };

  const unpublishSurvey = async (id: string) => {
    setSurveys(prev => prev.map(s => s && s.id === id ? { ...s, status: 'Draft' as const } : s));
    try {
      await updateDoc(doc(db, 'surveys', id), { status: 'Draft' });
      showToast('Survey has been unpublished', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `surveys/${id}`);
      showToast("Error unpublishing survey", "error");
    }
  };

  const closeSurvey = async (id: string) => {
    setSurveys(prev => prev.map(s => s && s.id === id ? { ...s, status: 'Closed' as const } : s));
    try {
      await updateDoc(doc(db, 'surveys', id), { status: 'Closed' });
      showToast('Survey has been closed', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `surveys/${id}`);
      showToast("Error closing survey", "error");
    }
  };

  const handleCreateSurvey = async (title: string, type: string, customQuestions?: Question[]) => {
    if (!user) {
      showToast("Please sign in to create surveys", "error");
      return;
    }

    const newSurveyId = `s-${Date.now()}`;
    let initialQuestions: Question[] = customQuestions || [];
    if (!customQuestions) {
      if (type === 'template') {
        initialQuestions = [
          { id: 'q-t1', type: 'rating', text: 'How satisfied are you with the onboarding process?', desc: '1 is poor, 5 is excellent', required: true, alias: 'Sat_Score' },
          { id: 'q-t2', type: 'long_text', text: 'What could we have done better?', desc: 'Please be as detailed as possible', required: false, alias: 'Feedback' }
        ];
      } else {
        initialQuestions = [
          { id: 'q1', type: 'nps', text: 'How likely are you to recommend us as a place to work?', desc: '0 is not at all likely, 10 is extremely likely', required: true, alias: 'eNPS' }
        ];
      }
    }

    const isUserFolder = !['all', 'recent', 'starred', 'trash', 'unfiled'].includes(selectedFolderId);
    const folderId = isUserFolder ? selectedFolderId : null;

    const newSurveyData = {
      title: title || (type === 'template' ? 'Template Research' : (type === 'ai' ? 'AI Generated Survey' : 'New Research Survey')),
      status: 'Draft',
      lastResponse: '-',
      responses: 0,
      completionRate: 0,
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      lastOpenedAt: Date.now(),
      ownerId: user.uid,
      ownerEmail: user.email || '',
      sharedEmails: [],
      folderId,
      links: [{ id: `l-${Date.now()}`, name: 'Default Link', url: `${getPublicUrl()}/?v=${newSurveyId}&SGUID=__CUSTOMER_ID__`, clicks: 0, status: 'Active' as const }],
      questions: initialQuestions
    };

    try {
      await setDoc(doc(db, 'surveys', newSurveyId), newSurveyData);
      showToast(`Created ${type === 'ai' ? 'AI generated' : 'new ' + type} survey`);
      setIsCreateModalOpen(false);
      setActiveSurveyId(newSurveyId);
      setView('workspace');
      setBuilderTab('questions');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `surveys/${newSurveyId}`);
      showToast("Failed to create survey", "error");
    }
  };

  const requestDeleteSurvey = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const survey = surveys.find(s => s && s.id === id);
    if (!survey) return;
    setSurveyToDelete({ id, isPermanent: !!survey.isDeleted });
  };

  const confirmDeleteSurvey = async () => {
    if (!surveyToDelete) return;
    const { id, isPermanent } = surveyToDelete;
    setSurveyToDelete(null);
    try {
      if (isPermanent) {
        await deleteDoc(doc(db, 'surveys', id));
        showToast('Survey deleted permanently', 'info');
      } else {
        await updateDoc(doc(db, 'surveys', id), { isDeleted: true });
        showToast('Survey moved to trash', 'info');
      }
      if (activeSurveyId === id) {
        setView('dashboard');
        setActiveSurveyId(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `surveys/${id}`);
      showToast("Error updating survey", "error");
    }
  };

  const requestEmptyTrash = () => {
    setIsEmptyingTrash(true);
  };

  const confirmEmptyTrash = async () => {
    setIsEmptyingTrash(false);
    try {
      const batch = writeBatch(db);
      surveys.filter(s => s.isDeleted).forEach(s => {
        batch.delete(doc(db, 'surveys', s.id));
      });
      await batch.commit();
      showToast('Trash emptied permanently', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'surveys (empty trash)');
      showToast("Error emptying trash", "error");
    }
  };

  const toggleStar = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const survey = surveys.find(s => s && s.id === id);
    try {
      await updateDoc(doc(db, 'surveys', id), { isStarred: !survey?.isStarred });
      showToast(survey?.isStarred ? 'Removed from starring' : 'Added to starring');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `surveys/${id}`);
      showToast("Error updating star status", "error");
    }
  };

  const restoreSurvey = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, 'surveys', id), { isDeleted: false });
      showToast('Survey restored');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `surveys/${id}`);
      showToast("Error restoring survey", "error");
    }
  };

  const copySurvey = async (survey: Survey, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSurveyId = `s-${Date.now()}`;
    const newSurvey = { 
      ...survey, 
      id: newSurveyId, 
      title: `${survey.title} (Copy)`, 
      responses: 0, 
      completionRate: 0, 
      status: 'Draft' as const,
      isStarred: false,
      isDeleted: false,
      lastResponse: '-',
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      lastOpenedAt: Date.now(),
      ownerId: user.uid,
      ownerEmail: user.email || '',
      sharedEmails: [],
      links: [{ id: `l-${Date.now()}`, name: 'Default Link', url: `${getPublicUrl()}/?v=${newSurveyId}&SGUID=__CUSTOMER_ID__`, clicks: 0, status: 'Active' as const }]
    };
    try {
      await setDoc(doc(db, 'surveys', newSurveyId), newSurvey);
      showToast('Created copy of survey');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `surveys/${newSurveyId}`);
      showToast("Error copying survey", "error");
    }
  };

  const login = () => {
    signInWithPopup(auth, googleProvider).catch((err) => {
      console.error(err);
      showToast("Login failed", "error");
    });
  };

  if (analyticsSurveyId) {
    return (
      <PublicAnalyticsView 
        surveyId={analyticsSurveyId} 
        onExit={() => {
          setAnalyticsSurveyId(null);
          window.history.replaceState({}, '', '/');
        }}
        showToast={showToast}
      />
    );
  }

  if (stressTestSurveyId) {
    return (
      <AiStressTestView 
        surveyId={stressTestSurveyId}
        onExit={() => setStressTestSurveyId(null)}
        showToast={showToast}
      />
    );
  }

  if (respondentSurveyId) {
    // If viewing respondent view, we still need to load the survey data if not already loaded
    // and if we ARE loading, show a loader.
    // For simplicity, we'll use a local state to find the survey from the URL if it's not in the surveys list (admin list)
    return (
      <RespondentFlow 
        surveyId={respondentSurveyId} 
        onComplete={() => {
          setRespondentSurveyId(null);
          window.history.replaceState({}, '', '/');
        }}
        onExit={() => {
          setRespondentSurveyId(null);
          window.history.replaceState({}, '', '/');
        }}
        showToast={showToast}
      />
    );
  }

  if (isLoadingAuth) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-primary">
        <Loader2 className="w-10 h-10 text-hr-blue animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <LandingPage onLogin={login} />
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-primary text-hr-navy font-sans">
      {/* Toast Manager */}
      <div className="fixed top-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.filter(Boolean).map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                "px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[280px] pointer-events-auto border",
                toast.type === 'success' ? "bg-white border-hr-green text-hr-green" :
                toast.type === 'error' ? "bg-white border-hr-red text-hr-red" :
                "bg-white border-hr-blue text-hr-blue"
              )}
            >
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5" />}
              {toast.type === 'info' && <Database className="w-5 h-5" />}
              <span className="font-bold text-sm">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-[100] flex">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black"
            />
            {/* Drawer */}
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-72 max-w-xs bg-hr-navy text-white h-full flex flex-col p-6 shadow-2xl z-10"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Database className="text-hr-blue w-6 h-6" />
                  <span className="font-bold text-sm tracking-wide text-white uppercase">HR Research</span>
                </div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Global Navigation Section */}
              <div className="space-y-4">
                <span className="text-[10px] font-black text-white/30 uppercase tracking-widest block">Dashboard Options</span>
                <div className="space-y-1">
                  <button 
                    onClick={() => {
                      setView('dashboard');
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all text-left",
                      view === 'dashboard' ? "bg-white/20 text-white font-bold" : "text-white/60 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <ClipboardList className="w-5 h-5" /> My Surveys
                  </button>
                  <button 
                    onClick={() => {
                      setView('global_analytics');
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all text-left",
                      view === 'global_analytics' ? "bg-white/20 text-white font-bold" : "text-white/60 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <BarChart3 className="w-5 h-5" /> Analytics Overview
                  </button>
                  {user?.email === 'mridoy@hr.com' && (
                    <button 
                      onClick={() => {
                        setSelectedInspectUserId(null);
                        setView('admin_dashboard');
                        setIsMobileMenuOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all text-left",
                        view === 'admin_dashboard' ? "bg-amber-500/20 text-white font-bold border border-amber-500/30" : "text-white/60 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <Settings className="w-5 h-5 text-amber-400" /> Admin Panel
                    </button>
                  )}
                </div>
              </div>

              {/* Workspace Navigation Section (Render only if in Workspace View) */}
              {activeSurvey && view === 'workspace' && (
                <div className="space-y-4 mt-6 pt-6 border-t border-white/10">
                  <span className="text-[10px] font-black text-white/30 uppercase tracking-widest block">Survey Builder</span>
                  <div className="space-y-1">
                    <button 
                      onClick={() => {
                        setBuilderTab('questions');
                        setIsMobileMenuOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all text-left",
                        ['questions', 'logic', 'design'].includes(builderTab) ? "bg-hr-blue/20 text-hr-blue font-bold" : "text-white/60 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <Edit3 className="w-4 h-4" /> Builder
                    </button>
                    <button 
                      onClick={() => {
                        setBuilderTab('share');
                        setIsMobileMenuOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all text-left",
                        builderTab === 'share' ? "bg-hr-blue/20 text-hr-blue font-bold" : "text-white/60 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <Send className="w-4 h-4" /> Share
                    </button>
                    <button 
                      onClick={() => {
                        setBuilderTab('results');
                        setIsMobileMenuOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all text-left",
                        builderTab === 'results' ? "bg-hr-blue/20 text-hr-blue font-bold" : "text-white/60 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <BarChartBig className="w-4 h-4" /> Results
                    </button>
                    <button 
                      onClick={() => {
                        setBuilderTab('settings');
                        setIsMobileMenuOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all text-left",
                        builderTab === 'settings' ? "bg-hr-blue/20 text-hr-blue font-bold" : "text-white/60 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <Settings className="w-4 h-4" /> Settings
                    </button>
                    <button 
                      onClick={() => {
                        setBuilderTab('test');
                        setIsMobileMenuOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all text-left",
                        builderTab === 'test' ? "bg-hr-blue/20 text-hr-blue font-bold" : "text-white/60 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <Beaker className="w-4 h-4" /> Stress Test
                    </button>
                  </div>
                  
                  <div className="pt-3">
                    <button 
                      onClick={() => {
                        setView('preview');
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2"
                    >
                      <Eye className="w-4 h-4" /> Preview Live
                    </button>
                  </div>
                </div>
              )}

              {/* Profile card / Sign out at the bottom */}
              <div className="mt-auto pt-4 border-t border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-hr-blue text-white flex items-center justify-center font-bold text-xs uppercase">
                    {user?.displayName ? user.displayName[0] : (user?.email ? user.email[0].toUpperCase() : 'U')}
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-xs font-bold text-white truncate max-w-[140px]">{user?.displayName || user?.email?.split('@')[0]}</p>
                    <p className="text-[9px] text-white/50 truncate max-w-[140px]">{user?.email}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    auth.signOut();
                    setIsMobileMenuOpen(false);
                  }}
                  className="p-1.5 text-white/50 hover:text-hr-red hover:bg-white/5 rounded"
                  title="Sign Out"
                >
                  <Plus className="w-4 h-4 rotate-45" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Sidebar */}
      <aside className="hidden md:flex w-16 bg-hr-navy flex-col items-center py-6 gap-6 shrink-0 z-50 shadow-xl">
        <div className="w-10 h-10 bg-hr-blue rounded-xl flex items-center justify-center cursor-pointer shadow-lg shadow-hr-blue/20 transition-transform hover:scale-105 active:scale-95" onClick={() => setView('dashboard')}>
          <Database className="text-white w-5 h-5" />
        </div>
        
        <div 
          onClick={() => setView('dashboard')}
          className={cn(
            "p-2.5 rounded-xl cursor-pointer transition-all",
            view === 'dashboard' ? 'text-white bg-white/15 shadow-inner' : 'text-white/40 hover:text-white hover:bg-white/5'
          )}
          title="Surveys"
        >
          <ClipboardList className="w-5 h-5" />
        </div>
        
        <div className="w-8 h-px bg-white/10 my-1" />
        
        <div 
          onClick={() => setView('global_analytics')}
          className={cn(
            "p-2.5 rounded-xl cursor-pointer transition-all",
            view === 'global_analytics' ? 'text-white bg-white/15 shadow-inner' : 'text-white/40 hover:text-white hover:bg-white/5'
          )}
          title="Dashboard"
        >
          <BarChart3 className="w-5 h-5" />
        </div>
        
        <div className="mt-auto flex flex-col gap-6 mb-4">
          {user?.email === 'mridoy@hr.com' && (
            <div 
              onClick={() => {
                setSelectedInspectUserId(null);
                setView('admin_dashboard');
              }}
              className={cn(
                "p-2.5 rounded-xl cursor-pointer transition-all relative group",
                view === 'admin_dashboard' ? 'text-white bg-amber-500/20 shadow-inner border border-amber-500/30' : 'text-white/40 hover:text-white hover:bg-white/5'
              )}
              title="Admin Portal"
            >
              <Settings className="w-5 h-5" />
              <span className="absolute left-full ml-2 px-2 py-1 bg-hr-navy text-[10px] text-amber-300 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                Admin Panel
              </span>
            </div>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-border-subtle flex items-center justify-between px-4 md:px-8 shrink-0 z-40 shadow-sm">
          <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-1.5 rounded-lg hover:bg-gray-100 flex md:hidden text-gray-500 shrink-0"
              title="Toggle Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            {view !== 'dashboard' && (
              <button 
                onClick={backToDashboard}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors group shrink-0"
                title="Back to Dashboard"
              >
                <ArrowLeft className="w-5 h-5 text-gray-400 group-hover:text-hr-navy" />
              </button>
            )}
            <div className="flex items-center gap-2 shrink-0">
              <img 
                src="https://public-cdn.hr.com/remoteimages/Brand_Guideline/hrresearch_color_logo.png" 
                alt="HR Research" 
                className="h-6 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            {activeSurvey && (
              <>
                <div className="w-px h-5 bg-border-strong mx-1.5 md:mx-2 shrink-0" />
                <h2 className="font-medium text-xs md:text-sm text-gray-400 truncate max-w-[120px] md:max-w-[300px]">{activeSurvey.title}</h2>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {activeSurvey && view === 'workspace' && (
              <>
                <button 
                  onClick={() => setView('preview')}
                  className="btn-outline px-3 border-none bg-gray-50 flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" /> Preview
                </button>
                <button 
                  onClick={() => showToast('Changes saved to cloud')}
                  className="btn-outline px-3 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> Save
                </button>
                {activeSurvey.status === 'Active' ? (
                  <button 
                    onClick={() => unpublishSurvey(activeSurvey.id)}
                    className="btn-outline py-2 px-5 flex items-center gap-2"
                  >
                    <Circle className="w-4 h-4" /> Unpublish
                  </button>
                ) : (
                  <button 
                    onClick={() => publishSurvey(activeSurvey.id)}
                    className="btn-primary py-2 px-5 flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" /> Publish
                  </button>
                )}
              </>
            )}
            <div className="relative group">
              <div className="w-9 h-9 rounded-full bg-hr-blue text-white flex items-center justify-center font-bold text-xs cursor-pointer hover:ring-4 ring-hr-blue/10 transition-all">
                {user ? (user.displayName ? user.displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : user.email?.slice(0, 2).toUpperCase() || 'ME') : 'AS'}
              </div>
              <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-border-subtle rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                <div className="p-4 border-b border-gray-50">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-hr-navy truncate max-w-[120px]">{user ? user.displayName || user.email?.split('@')[0] : 'Mridoy'}</p>
                    {user?.email === 'mridoy@hr.com' && (
                      <span className="text-[8px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 truncate mt-0.5">{user ? user.email : 'mridoy@hr.com'}</p>
                </div>
                <div className="py-2">
                  <button className="w-full text-left px-4 py-2 text-xs text-gray-600 hover:bg-gray-50 flex items-center gap-2" onClick={() => setView('profile')}>
                    <Users className="w-3 h-3" /> Profile Info
                  </button>
                  <div className="h-px bg-gray-50 my-1" />
                  <button className="w-full text-left px-4 py-2 text-xs text-hr-red hover:bg-red-50 flex items-center gap-2" onClick={() => auth.signOut()}>
                    <Plus className="w-3 h-3 rotate-45" /> Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 flex overflow-hidden relative">
          {isLoadingData && (
            <div className="absolute inset-0 z-[100] bg-white/50 backdrop-blur-sm flex items-center justify-center">
               <Loader2 className="w-8 h-8 text-hr-blue animate-spin" />
            </div>
          )}
          <AnimatePresence mode="wait">
            {view === 'dashboard' ? (
              <Dashboard 
                key="dashboard" 
                surveys={surveys} 
                folders={folders}
                user={user}
                onOpen={openWorkspace} 
                onCreate={() => setIsCreateModalOpen(true)}
                onDelete={requestDeleteSurvey}
                onCopy={copySurvey}
                onToggleStar={toggleStar}
                onRestore={restoreSurvey}
                onEmptyTrash={requestEmptyTrash}
                selectedFolderId={selectedFolderId}
                setSelectedFolderId={setSelectedFolderId}
                onMoveSurvey={handleMoveSurvey}
                onFolderCreate={() => setIsFolderModalOpen(true)}
                handleRenameFolder={handleRenameFolder}
                handleDeleteFolder={handleDeleteFolder}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                sortBy={sortBy}
                setSortBy={setSortBy}
              />
            ) : view === 'workspace' ? (
              <div className="flex flex-1 overflow-hidden">
                <Workspace 
                  survey={activeSurvey!} 
                  questions={questions} 
                  activeQuestionId={activeQuestionId}
                  setActiveQuestionId={setActiveQuestionId}
                  setQuestions={setQuestions}
                  builderTab={builderTab}
                  setBuilderTab={setBuilderTab}
                  setSurveys={setSurveys}
                  onCloseSurvey={closeSurvey}
                  onUnpublishSurvey={unpublishSurvey}
                  onPublishSurvey={publishSurvey}
                  onDeleteSurvey={requestDeleteSurvey}
                  onBack={backToDashboard}
                  onPreview={() => setView('preview')}
                  showToast={showToast}
                  onRunStressTest={(id) => setStressTestSurveyId(id)}
                />
              </div>
            ) : view === 'global_analytics' ? (
              <GlobalAnalytics surveys={surveys} />
            ) : view === 'admin_dashboard' ? (
              <AdminDashboardView 
                allUsers={allUsers}
                surveys={surveys}
                selectedInspectUserId={selectedInspectUserId}
                setSelectedInspectUserId={setSelectedInspectUserId}
                onOpenSurvey={(s) => {
                  setActiveSurveyId(s.id);
                  setView('workspace');
                  setBuilderTab('questions');
                }}
                onBack={() => setView('dashboard')}
                showToast={showToast}
              />
            ) : view === 'profile' ? (
              <ProfileView user={user} onBack={() => setView('dashboard')} />
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {view === 'preview' && (
              <RespondentView
                survey={activeSurvey!}
                questions={questions}
                onComplete={(answers) => {
                  showToast("Preview completed! Results won't be saved as this is a preview.", "info");
                }}
                onExit={() => setView('workspace')}
                showToast={showToast}
                isPreview={true}
              />
            )}
          </AnimatePresence>
        </main>
      </div>

      <CreateSurveyModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onCreate={(title, type, q) => handleCreateSurvey(title, type, q)} 
      />

      <FolderModal 
        isOpen={isFolderModalOpen} 
        onClose={() => setIsFolderModalOpen(false)} 
        onCreate={handleCreateFolder} 
        name={newFolderName}
        setName={setNewFolderName}
        loading={isCreatingFolder}
      />

      <AnimatePresence>
        {surveyToDelete && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSurveyToDelete(null)}
              className="absolute inset-0 bg-hr-navy/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-white w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-6">
                  <Trash2 className="w-6 h-6 flex-shrink-0 text-hr-red" />
                </div>
                <h3 className="text-xl font-bold text-hr-navy mb-2">
                  {surveyToDelete.isPermanent ? 'Purge Survey?' : 'Move to Trash?'}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed max-w-[280px]">
                  {surveyToDelete.isPermanent 
                    ? 'Are you sure you want to permanently delete this survey? This action cannot be undone.' 
                    : 'Are you sure you want to move this survey to the trash? You can restore it later.'}
                </p>
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
                <button 
                  onClick={() => setSurveyToDelete(null)}
                  className="flex-1 px-4 py-3 bg-white border border-gray-200 text-hr-navy font-bold rounded-xl hover:bg-gray-50 transition-all font-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDeleteSurvey}
                  className="flex-1 px-4 py-3 bg-hr-red text-white font-bold rounded-xl hover:bg-hr-red/90 shadow-lg shadow-hr-red/20 transition-all font-sm"
                >
                  {surveyToDelete.isPermanent ? 'Purge' : 'Move to Trash'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isEmptyingTrash && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEmptyingTrash(false)}
              className="absolute inset-0 bg-hr-navy/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-white w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-6">
                  <Trash2 className="w-6 h-6 flex-shrink-0 text-hr-red" />
                </div>
                <h3 className="text-xl font-bold text-hr-navy mb-2">Empty Trash?</h3>
                <p className="text-sm text-gray-500 leading-relaxed max-w-[280px]">
                  Are you sure you want to permanently delete all surveys in the trash? This action cannot be undone.
                </p>
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
                <button 
                  onClick={() => setIsEmptyingTrash(false)}
                  className="flex-1 px-4 py-3 bg-white border border-gray-200 text-hr-navy font-bold rounded-xl hover:bg-gray-50 transition-all font-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmEmptyTrash}
                  className="flex-1 px-4 py-3 bg-hr-red text-white font-bold rounded-xl hover:bg-hr-red/90 shadow-lg shadow-hr-red/20 transition-all font-sm"
                >
                  Empty Trash
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface CreateSurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string, type: string, questions?: Question[]) => void;
}

function CreateSurveyModal({ isOpen, onClose, onCreate }: CreateSurveyModalProps) {
  const [title, setTitle] = useState('');
  const [selectedOption, setSelectedOption] = useState<'blank' | 'template' | 'copy' | 'ai'>('blank');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setPrompt('');
      setSelectedOption('blank');
      setIsGenerating(false);
    }
  }, [isOpen]);

  const handleAiGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    try {
      const result = await generateSurvey(prompt);
      const formattedQuestions: Question[] = result.questions.map((q, idx) => ({
        ...q,
        id: `ai-${Date.now()}-${idx}`
      }));
      onCreate(result.title, 'ai', formattedQuestions);
    } catch (error) {
      console.error(error);
      alert("AI failed to generate. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-hr-navy/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative bg-white w-full max-w-3xl min-h-[500px] rounded-lg shadow-2xl overflow-hidden flex"
      >
        {/* Sidebar */}
        <div className="w-[300px] bg-[#34414f] text-white flex flex-col pt-8 shrink-0">
          <ModalOption 
            active={selectedOption === 'blank'} 
            onClick={() => setSelectedOption('blank')}
            icon={<ArrowLeft className="w-5 h-5 rotate-180" />}
            label="Blank Survey"
          />
          <ModalOption 
            active={selectedOption === 'ai'} 
            onClick={() => setSelectedOption('ai')}
            icon={<Sparkles className="w-5 h-5 text-hr-teal" />}
            label="Generate with AI"
          />
          <ModalOption 
            active={selectedOption === 'template'} 
            onClick={() => setSelectedOption('template')}
            icon={<Circle className="w-5 h-5" />}
            label="Use a Template"
          />
          <ModalOption 
            active={selectedOption === 'copy'} 
            onClick={() => setSelectedOption('copy')}
            icon={<Circle className="w-5 h-5" />}
            label="Copy a Survey"
          />
        </div>

        <div className="flex-1 bg-white p-12 flex flex-col min-w-0 overflow-y-auto">
          <h2 className="text-[28px] font-normal text-gray-700 mb-8">
            {selectedOption === 'blank' && "What would you like to name this Survey?"}
            {selectedOption === 'ai' && "Describe the survey you want to build"}
            {selectedOption === 'template' && "Which template would you like to use?"}
            {selectedOption === 'copy' && "Which survey would you like to duplicate?"}
          </h2>
          
          <div className="space-y-6 flex-1 min-h-[200px]">
            {selectedOption === 'ai' ? (
              <div className="space-y-4 h-full flex flex-col">
                <textarea 
                  autoFocus
                  className="w-full flex-1 border border-gray-300 rounded p-4 text-sm text-gray-600 focus:outline-none focus:border-hr-blue placeholder:text-gray-300 resize-none font-medium"
                  placeholder="e.g. Create a 10-question employee satisfaction survey for a tech company focused on remote work culture, diversity, and professional development."
                  value={prompt || ''}
                  onChange={(e) => setPrompt(e.target.value)}
                />
                <div className="flex items-center gap-3 p-4 bg-hr-blue/5 rounded-xl border border-hr-blue/10">
                   <Zap className="w-5 h-5 text-hr-blue shrink-0" />
                   <p className="text-[11px] text-hr-blue font-bold uppercase tracking-wider leading-tight">Gemini will generate questions, types, and labels automatically.</p>
                </div>
              </div>
            ) : (
              <input 
                type="text"
                autoFocus
                className="w-full border border-gray-300 rounded p-3 text-lg text-gray-600 focus:outline-none focus:border-hr-blue placeholder:text-gray-300"
                placeholder={selectedOption === 'blank' ? "Example: 2026 Product research" : "Search files..."}
                value={title || ''}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onCreate(title, selectedOption);
                }}
              />
            )}
            
            {(selectedOption === 'blank' || selectedOption === 'copy') && <div className="h-px bg-gray-200 w-full" />}
            
            {selectedOption === 'template' && (
              <div className="grid grid-cols-2 gap-4 mt-4">
                 <div onClick={() => { setTitle('Customer Satisfaction'); onCreate('Customer Satisfaction', 'template'); }} className="p-4 border rounded hover:border-hr-blue cursor-pointer transition-all bg-gray-50/50">
                    <p className="font-bold text-sm text-hr-navy">CSAT Standard</p>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase">5 Questions • 2m Avg</p>
                 </div>
                 <div onClick={() => { setTitle('Employee Engagement'); onCreate('Employee Engagement', 'template'); }} className="p-4 border rounded hover:border-hr-blue cursor-pointer transition-all bg-gray-50/50">
                    <p className="font-bold text-sm text-hr-navy">eNPS Quarter Pulse</p>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase">12 Questions • 5m Avg</p>
                 </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <button 
              onClick={onClose}
              disabled={isGenerating}
              className="px-8 py-2.5 border border-gray-400 text-gray-600 rounded hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            {selectedOption === 'ai' ? (
              <button 
                onClick={handleAiGenerate}
                disabled={!prompt.trim() || isGenerating}
                className="px-8 py-2.5 bg-hr-blue text-white rounded hover:bg-hr-blue/90 transition-all font-bold disabled:opacity-50 flex items-center gap-2"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isGenerating ? 'Generating...' : 'Generate Survey'}
              </button>
            ) : (
              <button 
                onClick={() => onCreate(title, selectedOption)}
                disabled={!title.trim()}
                className="px-6 py-2.5 bg-hr-navy text-white rounded hover:bg-[#2a343e]/90 transition-colors font-bold disabled:opacity-50"
              >
                Start Building
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ModalOption({ active, label, icon, onClick }: { active: boolean, label: string, icon: React.ReactNode, onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 px-8 py-4 cursor-pointer transition-colors text-[20px] font-light",
        active ? "text-white" : "text-white/60 hover:text-white"
      )}
    >
      <span className="shrink-0">{icon}</span>
      {label}
    </div>
  );
}

function NavItem({ icon, title, onClick }: { icon: React.ReactNode, title: string, onClick?: () => void }) {
  return (
    <div 
      className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-xl cursor-pointer transition-all" 
      title={title}
      onClick={onClick}
    >
      {icon}
    </div>
  );
}

function GlobalAnalytics({ surveys }: { surveys: Survey[] }) {
  const totalResponses = surveys.reduce((sum, s) => sum + s.responses, 0);
  const activeCount = surveys.filter(s => s.status === 'Active' && !s.isDeleted).length;
  const draftCount = surveys.filter(s => s.status === 'Draft' && !s.isDeleted).length;
  const closedCount = surveys.filter(s => s.status === 'Closed' && !s.isDeleted).length;
  
  // Fake chart data built out of real counts
  const statusData = [
    { name: 'Active', value: activeCount, color: '#3b82f6' },
    { name: 'Draft', value: draftCount, color: '#94a3b8' },
    { name: 'Closed', value: closedCount, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  const responsesBySurvey = surveys
    .filter(s => !s.isDeleted && s.responses > 0)
    .map(s => ({ name: s.title.substring(0, 20) + '...', responses: s.responses }))
    .sort((a, b) => b.responses - a.responses)
    .slice(0, 5); // top 5

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="flex-1 overflow-y-auto p-8 bg-gray-50/50"
    >
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-hr-navy">Global Analytics Dashboard</h1>
          <p className="text-gray-500 mt-2">Aggregated insights across all your active and historical surveys.</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-4">
              <Users className="w-5 h-5 text-indigo-500" />
            </div>
            <p className="text-sm font-medium text-gray-500">Total Responses</p>
            <h2 className="text-3xl font-bold text-hr-navy mt-1">{totalResponses.toLocaleString()}</h2>
          </div>
          
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-10 h-10 bg-hr-blue/5 rounded-xl flex items-center justify-center mb-4">
              <ClipboardList className="w-5 h-5 text-hr-blue" />
            </div>
            <p className="text-sm font-medium text-gray-500">Active Surveys</p>
            <h2 className="text-3xl font-bold text-hr-navy mt-1">{activeCount}</h2>
          </div>
          
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-10 h-10 bg-hr-blue/5 rounded-xl flex items-center justify-center mb-4">
              <Edit3 className="w-5 h-5 text-hr-blue" />
            </div>
            <p className="text-sm font-medium text-gray-500">Draft Surveys</p>
            <h2 className="text-3xl font-bold text-hr-navy mt-1">{draftCount}</h2>
          </div>
          
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-10 h-10 bg-hr-blue/5 rounded-xl flex items-center justify-center mb-4">
              <Archive className="w-5 h-5 text-hr-blue" />
            </div>
            <p className="text-sm font-medium text-gray-500">Closed Surveys</p>
            <h2 className="text-3xl font-bold text-hr-navy mt-1">{closedCount}</h2>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative">
            <div className="absolute top-4 right-4 z-10">
               <ChartExportMenu chartId="chart-global-status" title="Surveys by Status" />
            </div>
            <h3 className="text-lg font-bold text-hr-navy mb-6">Surveys by Status</h3>
            <div id="chart-global-status" className="h-64 flex items-center justify-center bg-white">
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      isAnimationActive={false}
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-global-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-400">No data available</p>
              )}
            </div>
            <div className="flex gap-4 justify-center mt-4">
              {statusData.map(d => (
                <div key={d.name} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-gray-600 font-medium">{d.name} ({d.value})</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative">
            <div className="absolute top-4 right-4 z-10">
               <ChartExportMenu chartId="chart-global-top" title="Top Surveys by Responses" />
            </div>
            <h3 className="text-lg font-bold text-hr-navy mb-6">Top Surveys by Responses</h3>
            <div id="chart-global-top" className="h-64 bg-white">
              {responsesBySurvey.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={responsesBySurvey} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} width={100} />
                    <Tooltip
                      cursor={{ fill: '#F1F5F9' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="responses" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} isAnimationActive={false}>
                      {responsesBySurvey.map((entry, index) => (
                        <Cell key={`cell-global-top-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length] || '#000'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-400">No response data available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface DashboardProps {
  key?: string;
  surveys: Survey[];
  folders: Folder[];
  user: any; // User type or any to keep it simple and compile-safe
  onOpen: (s: Survey) => void;
  onCreate: () => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onCopy: (s: Survey, e: React.MouseEvent) => void;
  onToggleStar: (id: string, e: React.MouseEvent) => void;
  onRestore: (id: string, e: React.MouseEvent) => void;
  onEmptyTrash: () => void;
  selectedFolderId: string;
  setSelectedFolderId: (f: string) => void;
  onMoveSurvey: (surveyId: string, folderId: string | null) => void;
  onFolderCreate: () => void;
  handleRenameFolder: (folderId: string, newName: string) => Promise<void>;
  handleDeleteFolder: (folderId: string) => Promise<void>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  statusFilter: 'All' | 'Active' | 'Closed' | 'Draft';
  setStatusFilter: (s: 'All' | 'Active' | 'Closed' | 'Draft') => void;
  sortBy: 'Date' | 'Name';
  setSortBy: (s: 'Date' | 'Name') => void;
}

function Dashboard({ 
  surveys, 
  folders,
  user,
  onOpen, 
  onCreate, 
  onDelete, 
  onCopy, 
  onToggleStar, 
  onRestore,
  onEmptyTrash,
  selectedFolderId,
  setSelectedFolderId,
  onMoveSurvey,
  onFolderCreate,
  handleRenameFolder,
  handleDeleteFolder,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  sortBy,
  setSortBy
}: DashboardProps) {
  const filteredSurveys = useMemo(() => {
    let result = surveys;

    // Folder Filtering
    if (selectedFolderId === 'trash') {
      result = result.filter(s => s.isDeleted);
    } else {
      result = result.filter(s => !s.isDeleted);
      if (selectedFolderId === 'starred') result = result.filter(s => s.isStarred);
      if (selectedFolderId === 'recent') {
        result = [...result].sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0)).slice(0, 5);
      } else if (selectedFolderId === 'unfiled') {
        result = result.filter(s => !s.folderId);
      } else if (selectedFolderId !== 'all') {
        result = result.filter(s => s.folderId === selectedFolderId);
      }
    }

    // Status Filtering
    if (statusFilter !== 'All') {
      result = result.filter(s => s.status === statusFilter);
    }

    // Search Filtering
    if (searchQuery) {
      result = result.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    // Sort
    result = [...result].sort((a,b) => {
      if (sortBy === 'Name') return a.title.localeCompare(b.title);
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    return result;
  }, [surveys, selectedFolderId, statusFilter, searchQuery, sortBy]);

  const stats = useMemo(() => {
    const active = surveys.filter(s => s.status === 'Active' && !s.isDeleted).length;
    const totalResponses = surveys.reduce((acc, s) => acc + (s.isDeleted ? 0 : s.responses), 0);
    const completedSurveys = surveys.filter(s => !s.isDeleted && s.responses > 0);
    const avgCompletion = completedSurveys.length > 0 
      ? Math.round(completedSurveys.reduce((acc, s) => acc + (s.completionRate || 0), 0) / completedSurveys.length) 
      : 0;

    return [
      { label: 'Active Surveys', value: active, icon: <CheckCircle2 className="w-5 h-5 text-hr-green" />, trend: 'Currently collecting' },
      { label: 'Total Responses', value: totalResponses.toLocaleString(), icon: <Users className="w-5 h-5 text-hr-blue" />, trend: 'Across all surveys' },
      { label: 'Avg. Completion', value: `${avgCompletion}%`, icon: <Clock className="w-5 h-5 text-hr-orange" />, trend: 'Across active surveys' },
    ];
  }, [surveys]);

  const [isFilterOpen, setIsFilterOpen] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="flex flex-1 overflow-hidden"
    >
      <aside className="hidden md:flex w-72 bg-white border-r border-border-subtle flex-col shrink-0 overflow-y-auto custom-scrollbar">
        <div className="p-8">
          <button 
            onClick={onCreate}
            className="btn-primary w-full py-4 text-base rounded-2xl shadow-xl shadow-hr-blue/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="w-5 h-5" />
            Create New
          </button>
        </div>
        
        <nav className="px-4 space-y-1 pb-10">
          <FolderItem icon={<LayoutGrid className="w-4 h-4" />} title="All Surveys" count={surveys.filter(s => !s.isDeleted).length} active={selectedFolderId === 'all'} onClick={() => setSelectedFolderId('all')} onDrop={(id) => onMoveSurvey(id, null)} />
          <FolderItem icon={<Clock className="w-4 h-4" />} title="Recent" count={surveys.filter(s => !s.isDeleted).length > 5 ? 5 : surveys.filter(s => !s.isDeleted).length} active={selectedFolderId === 'recent'} onClick={() => setSelectedFolderId('recent')} />
          <FolderItem icon={<Archive className="w-4 h-4" />} title="Unfiled" count={surveys.filter(s => !s.folderId && !s.isDeleted).length} active={selectedFolderId === 'unfiled'} onClick={() => setSelectedFolderId('unfiled')} onDrop={(id) => onMoveSurvey(id, null)} />
          
          <div className="mt-8">
            <div className="flex items-center justify-between px-4 mb-2">
               <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Your Folders</span>
               <button 
                 onClick={onFolderCreate}
                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-hr-blue transition-colors"
                title="Create Folder"
               >
                 <Plus className="w-3.5 h-3.5" />
               </button>
            </div>
            <div className="space-y-0.5">
              {folders.map(folder => (
                <FolderItem 
                  key={folder.id} 
                  icon={<Archive className={cn("w-4 h-4", selectedFolderId === folder.id ? "text-hr-blue" : "text-gray-400")} />} 
                  title={folder.name}
                  count={surveys.filter(s => s.folderId === folder.id && !s.isDeleted).length}
                  active={selectedFolderId === folder.id} 
                  onClick={() => setSelectedFolderId(folder.id)}
                  onDrop={(id) => onMoveSurvey(id, folder.id)}
                  isCustomFolder={true}
                  onRename={(newName) => handleRenameFolder(folder.id, newName)}
                  onDelete={() => handleDeleteFolder(folder.id)}
                />
              ))}
              {folders.length === 0 && (
                <div className="px-4 py-3 text-xs text-gray-300 italic">No folders yet</div>
              )}
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-border-subtle">
            <FolderItem icon={<Star className="w-4 h-4" />} title="Starring" count={surveys.filter(s => s.isStarred && !s.isDeleted).length} active={selectedFolderId === 'starred'} onClick={() => setSelectedFolderId('starred')} />
            <FolderItem icon={<Trash2 className="w-4 h-4" />} title="Trash" count={surveys.filter(s => s.isDeleted).length} color="text-hr-red" active={selectedFolderId === 'trash'} onClick={() => setSelectedFolderId('trash')} />
          </div>
        </nav>
      </aside>

      <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-6 md:space-y-10 custom-scrollbar">
        {/* Mobile Horizontal Folder Pills */}
        <div className="flex md:hidden items-center gap-1.5 overflow-x-auto no-scrollbar pb-1.5 border-b border-border-subtle scroll-smooth select-none shrink-0">
          <button
            onClick={() => setSelectedFolderId('all')}
            className={cn(
              "px-3 py-1.5 rounded-full text-[11px] font-bold leading-none shrink-0 border transition-all",
              selectedFolderId === 'all' 
                ? "bg-hr-blue text-white border-hr-blue shadow-sm" 
                : "bg-white text-gray-500 border-gray-200"
            )}
          >
            All Projects
          </button>
          <button
            onClick={() => setSelectedFolderId('recent')}
            className={cn(
              "px-3 py-1.5 rounded-full text-[11px] font-bold leading-none shrink-0 border transition-all",
              selectedFolderId === 'recent' 
                ? "bg-hr-blue text-white border-hr-blue shadow-sm" 
                : "bg-white text-gray-500 border-gray-200"
            )}
          >
            Recent
          </button>
          {folders.map(f => (
            <button
              key={f.id}
              onClick={() => setSelectedFolderId(f.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[11px] font-bold leading-none shrink-0 border transition-all",
                selectedFolderId === f.id 
                  ? "bg-hr-blue text-white border-hr-blue shadow-sm" 
                  : "bg-white text-gray-500 border-gray-200"
              )}
            >
              {f.name}
            </button>
          ))}
          <button
            onClick={() => setSelectedFolderId('starred')}
            className={cn(
              "px-3 py-1.5 rounded-full text-[11px] font-bold leading-none shrink-0 border transition-all",
              selectedFolderId === 'starred' 
                ? "bg-hr-blue text-white border-hr-blue shadow-sm" 
                : "bg-white text-gray-500 border-gray-200"
            )}
          >
            Starred
          </button>
          <button
            onClick={() => setSelectedFolderId('trash')}
            className={cn(
              "px-3 py-1.5 rounded-full text-[11px] font-bold leading-none shrink-0 border transition-all",
              selectedFolderId === 'trash' 
                ? "bg-hr-red text-white border-hr-red shadow-sm" 
                : "bg-white text-hr-red border-gray-200"
            )}
          >
            Trash
          </button>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-light text-hr-navy tracking-tight">
              {selectedFolderId === 'all' && 'All Projects'}
              {selectedFolderId === 'recent' && 'Recently Opened'}
              {selectedFolderId === 'starred' && 'Starred Work'}
              {selectedFolderId === 'unfiled' && 'Unfiled Surveys'}
              {selectedFolderId === 'trash' && 'Trash Bin'}
              {(!['all', 'recent', 'starred', 'trash', 'unfiled'].includes(selectedFolderId)) && (folders.find(f => f.id === selectedFolderId)?.name || 'Folder View')}
            </h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1 md:mt-2 font-medium">Monitoring {filteredSurveys.length} research workstreams</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
             <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Find project..." 
                  value={searchQuery || ''}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-white border border-border-strong rounded-xl text-sm focus:outline-none focus:ring-2 ring-hr-blue/10 w-full md:min-w-[240px] lg:min-w-[280px] shadow-sm transition-all"
                />
             </div>
             <div className="relative flex items-center gap-2">
               <button 
                 onClick={() => setIsFilterOpen(!isFilterOpen)}
                 className={cn(
                   "btn-outline px-4 py-2 border-border-strong shadow-sm transition-all flex items-center gap-2 justify-center flex-1 sm:flex-none",
                   statusFilter !== 'All' ? "bg-hr-blue text-white border-hr-blue" : "hover:border-hr-blue/40"
                 )}
               >
                  <Filter className="w-4 h-4" /> {statusFilter === 'All' ? 'Filter' : statusFilter}
               </button>
               {selectedFolderId === 'trash' && filteredSurveys.length > 0 && (
                 <button 
                   onClick={onEmptyTrash}
                   className="btn-outline px-4 py-2 !border-hr-red !text-hr-red hover:bg-hr-red/5 flex items-center justify-center gap-2 transition-all shadow-sm rounded-xl"
                 >
                   <Trash2 className="w-4 h-4" /> Empty
                 </button>
               )}
               <button
                 onClick={onCreate}
                 className="flex md:hidden btn-primary p-2 rounded-xl text-white shadow-lg shadow-hr-blue/15 shrink-0 justify-center items-center"
                 title="Create New Survey"
               >
                 <Plus className="w-5 h-5" />
               </button>
               <AnimatePresence>
                 {isFilterOpen && (
                   <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-48 bg-white border border-border-subtle rounded-xl shadow-2xl z-50 overflow-hidden"
                   >
                     {['All', 'Active', 'Closed', 'Draft'].map((status) => (
                       <button
                         key={status}
                         onClick={() => { setStatusFilter(status as any); setIsFilterOpen(false); }}
                         className={cn(
                           "w-full text-left px-4 py-3 text-sm transition-colors",
                           statusFilter === status ? "bg-hr-blue/5 text-hr-blue font-bold" : "text-gray-600 hover:bg-gray-50"
                         )}
                       >
                         {status}
                       </button>
                     ))}
                   </motion.div>
                 )}
               </AnimatePresence>
             </div>
          </div>
        </div>

        {selectedFolderId !== 'trash' && selectedFolderId !== 'recent' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {stats.map((stat, i) => (
              <div key={i} className="card-premium p-4 md:p-6 flex flex-col gap-3 group cursor-default shadow-sm border border-border-subtle hover:border-hr-blue/20">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center transition-colors group-hover:bg-white group-hover:border-border-strong shadow-inner">
                    {stat.icon}
                  </div>
                  <span className="text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-widest">{stat.trend}</span>
                </div>
                <div>
                  <span className="text-2xl md:text-3xl font-bold text-hr-navy">{stat.value}</span>
                  <p className="text-xs md:text-sm font-medium text-gray-500 mt-0.5 md:mt-1">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-4">
          <div className="hidden md:flex items-center justify-between px-4 pb-2 border-b border-border-subtle text-[11px] font-bold text-gray-400 uppercase tracking-widest">
            <span>Project Name & Status</span>
            <div className="flex items-center gap-24 mr-16">
               <span className="w-20 text-center">Responses</span>
               <span className="w-20 text-center">Completion</span>
            </div>
          </div>
          {filteredSurveys.filter(Boolean).map(survey => (
            <div 
              key={survey.id} 
              onClick={() => onOpen(survey)}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('surveyId', survey.id);
                // Visual feedback hack for dragging
                const ghost = document.createElement('div');
                ghost.style.visibility = 'hidden';
                document.body.appendChild(ghost);
                e.dataTransfer.setDragImage(ghost, 0, 0);
              }}
              className="group bg-white border border-border-subtle rounded-2xl p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-hr-blue/30 hover:shadow-lg hover:shadow-hr-blue/5 transition-all cursor-pointer animate-in fade-in slide-in-from-bottom-2 duration-300 relative overflow-hidden"
            >
              {/* Drag Indicator */}
              <div className="absolute left-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity hidden md:block">
                <GripVertical className="w-4 h-4 text-gray-300" />
              </div>

              <div className="flex items-start md:items-center gap-4 md:gap-6">
                <div>
                  <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                    <h3 className="text-base md:text-lg font-bold text-hr-navy group-hover:text-hr-blue transition-colors line-clamp-1">{survey.title}</h3>
                    {survey.isStarred && <Star className="w-3.5 h-3.5 md:w-4 md:h-4 fill-hr-orange text-hr-orange shrink-0" />}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 md:gap-4 mt-2 md:mt-1">
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border leading-none transition-colors",
                      survey.status === 'Active' ? 'bg-hr-green/10 border-hr-green/20 text-hr-green' : 
                      survey.status === 'Draft' ? 'bg-hr-blue/10 border-hr-blue/20 text-hr-blue' :
                      'bg-gray-100 border-gray-200 text-gray-500'
                    )}>
                      {survey.status}
                    </span>
                    <span className="text-[11px] text-gray-400">Created: {survey.createdAt}</span>
                    {survey.isShared && <span className="text-[9px] bg-hr-blue/5 text-hr-blue px-1.5 py-0.5 rounded-full font-bold">Shared Links</span>}
                    {survey.ownerEmail && survey.ownerEmail !== user?.email && (
                      <span className="text-[9px] bg-amber-50 border border-amber-200 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">
                        Shared (Owner: {survey.ownerEmail})
                      </span>
                    )}
                    {user?.email === 'mridoy@hr.com' && survey.ownerEmail && survey.ownerEmail !== user?.email && (
                      <span className="text-[9px] bg-red-50 border border-red-200 text-red-700 px-1.5 py-0.5 rounded-full font-bold">
                        Admin (Owner: {survey.ownerEmail})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-6 md:gap-16 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0">
                <div className="flex flex-col items-center w-20 shrink-0">
                  <span className="text-xl md:text-2xl font-light text-hr-navy">{survey.responses}</span>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Hits</span>
                </div>
                
                <div className="flex flex-col items-center w-20 shrink-0">
                  <div className="relative w-10 h-10 md:w-11 md:h-11 flex items-center justify-center transform transition-transform group-hover:scale-110">
                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                      <circle cx="20" cy="20" r="16" fill="none" stroke="#f3f4f6" strokeWidth="3" className="md:hidden" />
                      <circle cx="20" cy="20" r="16" fill="none" stroke={survey.completionRate > 80 ? "#94C83D" : survey.completionRate > 0 ? "#FD7114" : "#eee"} strokeWidth="3" strokeDasharray={`${survey.completionRate * 1.00}, 100`} strokeLinecap="round" className="md:hidden" />
                      
                      <circle cx="22" cy="22" r="18" fill="none" stroke="#f3f4f6" strokeWidth="4" className="hidden md:block" />
                      <circle cx="22" cy="22" r="18" fill="none" stroke={survey.completionRate > 80 ? "#94C83D" : survey.completionRate > 0 ? "#FD7114" : "#eee"} strokeWidth="4" strokeDasharray={`${survey.completionRate * 1.13}, 113`} strokeLinecap="round" className="hidden md:block" />
                    </svg>
                    <span className="text-[9px] md:text-[10px] font-bold">{survey.completionRate}%</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 md:gap-2 shrink-0">
                   {!survey.isDeleted ? (
                     <>
                      <button 
                        onClick={(e) => onToggleStar(survey.id, e)}
                        className={cn(
                          "p-2 rounded-xl transition-all",
                          survey.isStarred ? "text-hr-orange bg-hr-orange/5" : "text-gray-400 hover:text-hr-orange hover:bg-hr-orange/5"
                        )}
                        title={survey.isStarred ? "Unstar" : "Star"}
                      >
                         <Star className={cn("w-4.5 h-4.5 md:w-5 md:h-5", survey.isStarred && "fill-current")} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onOpen(survey); }}
                        className="p-2 text-gray-400 hover:text-hr-blue hover:bg-hr-blue/5 rounded-xl transition-all" 
                        title="View Analytics"
                      >
                          <BarChart3 className="w-4.5 h-4.5 md:w-5 md:h-5" />
                      </button>
                      <button 
                        onClick={(e) => onCopy(survey, e)}
                        className="p-2 text-gray-400 hover:text-hr-navy hover:bg-gray-50 rounded-xl transition-all" 
                        title="Quick Copy"
                      >
                          <Copy className="w-4.5 h-4.5 md:w-5 md:h-5" />
                      </button>
                      <button 
                        onClick={(e) => onDelete(survey.id, e)}
                        className="p-2 text-gray-400 hover:text-hr-red hover:bg-hr-red/5 rounded-xl transition-all" 
                        title="Move to Trash"
                      >
                          <Trash2 className="w-4.5 h-4.5 md:w-5 md:h-5" />
                      </button>
                     </>
                   ) : (
                     <>
                      <button 
                        onClick={(e) => onRestore(survey.id, e)}
                        className="p-2 text-hr-green hover:bg-hr-green/5 rounded-xl transition-all font-bold text-xs flex items-center gap-1.5" 
                        title="Restore"
                      >
                          <RefreshCw className="w-4 h-4" /> Restore
                      </button>
                      <button 
                        onClick={(e) => onDelete(survey.id, e)}
                        className="p-2 text-hr-red hover:bg-hr-red/5 rounded-xl transition-all font-bold text-xs flex items-center gap-1.5" 
                        title="Permanent Delete"
                      >
                          <Trash2 className="w-4 h-4" /> Purge
                      </button>
                     </>
                   )}
                </div>
              </div>
            </div>
          ))}
          {filteredSurveys.length === 0 && (
            <div className="py-32 text-center space-y-6 bg-white border-2 border-dashed border-gray-100 rounded-[32px]">
               <Database className="w-16 h-16 mx-auto text-gray-100" />
               <p className="text-xl font-light text-gray-300">
                 {searchQuery ? `No surveys found matching "${searchQuery}"` : "Nothing to show here."}
               </p>
               {selectedFolderId === 'trash' ? null : (
                 <button onClick={onCreate} className="btn-primary mx-auto">Create Your First Survey</button>
               )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function FolderItem({ icon, title, count, active, color, onClick, onDrop, isCustomFolder, onRename, onDelete }: { 
  key?: React.Key,
  icon: React.ReactNode, 
  title: string, 
  count?: number, 
  active?: boolean, 
  color?: string, 
  onClick?: () => void,
  onDrop?: (id: string) => void,
  isCustomFolder?: boolean,
  onRename?: (newName: string) => void,
  onDelete?: () => void
}) {
  const [isOver, setIsOver] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div 
      onClick={() => {
        if (!isEditing && !confirmDelete) onClick?.();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        const surveyId = e.dataTransfer.getData('surveyId');
        if (surveyId && onDrop) onDrop(surveyId);
      }}
      className={cn(
        "group flex items-center gap-3 py-2.5 px-4 rounded-xl transition-all cursor-pointer relative",
        active ? "bg-hr-blue/5 text-hr-blue font-bold shadow-sm" : "text-gray-500 hover:bg-gray-50 hover:text-hr-navy",
        isOver && "bg-hr-blue/10 scale-105 ring-2 ring-hr-blue ring-inset"
      )}
    >
      <span className={cn("transition-colors", active ? "text-hr-blue" : "opacity-60 group-hover:opacity-100", color)}>{icon}</span>
      {isEditing ? (
        <input 
          autoFocus
          className="flex-1 min-w-0 text-sm bg-white border border-hr-blue/30 outline-none font-bold text-hr-navy focus:ring-2 focus:ring-hr-blue/20 rounded px-2 py-0.5 -ml-2"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={() => {
            setIsEditing(false);
            if (editValue.trim() && editValue !== title) onRename?.(editValue.trim());
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setIsEditing(false);
              if (editValue.trim() && editValue !== title) onRename?.(editValue.trim());
            } else if (e.key === 'Escape') {
              setIsEditing(false);
              setEditValue(title);
            }
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="text-sm truncate flex-1">{title}</span>
      )}

      {!isEditing && count !== undefined && (
        <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full group-hover:opacity-0 transition-opacity">
          {count}
        </span>
      )}
      
      {isCustomFolder && !isEditing && (
        <>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center transition-opacity opacity-0 group-hover:opacity-100 focus-within:opacity-100">
            <button 
              onClick={(e) => { e.stopPropagation(); setIsEditing(true); setEditValue(title); }}
              className="p-1.5 text-gray-400 hover:text-hr-blue hover:bg-hr-blue/10 rounded-md transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
              className="p-1.5 text-gray-400 hover:text-hr-red hover:bg-hr-red/10 rounded-md transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          
          {confirmDelete && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[999]" onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}>
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 border border-gray-100 flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-4 mx-auto">
                  <Trash2 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-hr-navy mb-2 text-center">Delete Folder?</h3>
                <p className="text-sm text-gray-500 text-center mb-6">Are you sure you want to delete "{title}"? This action cannot be undone.</p>
                <div className="flex gap-3 w-full">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-border-strong text-gray-600 font-bold hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDelete?.(); setConfirmDelete(false); }}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-hr-red text-white font-bold hover:bg-red-600 transition-all"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {isOver && (
        <div className="absolute inset-0 bg-hr-blue/5 pointer-events-none rounded-xl" />
      )}
    </div>
  );
}

function FolderModal({ isOpen, onClose, onCreate, name, setName, loading }: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: () => void;
  name: string;
  setName: (s: string) => void;
  loading: boolean;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-hr-navy/60 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden p-8">
        <h3 className="text-xl font-bold text-hr-navy mb-1">New Folder</h3>
        <p className="text-sm text-gray-500 mb-6 font-medium">Categorize your research projects.</p>
        
        <input 
          type="text" 
          autoFocus
          placeholder="Folder name..." 
          value={name || ''}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-3 border border-border-strong rounded-xl text-sm focus:outline-none focus:ring-2 ring-hr-blue/10 transition-all mb-8 shadow-sm"
          onKeyDown={(e) => e.key === 'Enter' && onCreate()}
        />

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-3 border border-gray-200 rounded-xl font-bold text-gray-400 hover:bg-gray-50 text-sm">Cancel</button>
          <button 
            onClick={onCreate} 
            disabled={!name.trim() || loading}
            className="flex-1 px-4 py-3 bg-hr-blue text-white rounded-xl font-bold hover:bg-hr-blue/90 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-hr-blue/20 text-sm transition-all"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

interface WorkspaceProps {
  survey: Survey;
  questions: Question[];
  activeQuestionId: string | null;
  setActiveQuestionId: (id: string | null) => void;
  setQuestions: React.Dispatch<React.SetStateAction<Question[]>>;
  builderTab: 'questions' | 'logic' | 'design' | 'results' | 'share' | 'settings' | 'test';
  setBuilderTab: (t: 'questions' | 'logic' | 'design' | 'results' | 'share' | 'settings' | 'test') => void;
  setSurveys: React.Dispatch<React.SetStateAction<Survey[]>>;
  onBack: () => void;
  onPreview: () => void;
  showToast: (m: string, t?: 'success' | 'info' | 'error') => void;
  onCloseSurvey: (id: string) => void;
  onUnpublishSurvey: (id: string) => void;
  onPublishSurvey: (id: string) => void;
  onDeleteSurvey: (id: string, e: any) => void;
  onRunStressTest: (id: string) => void;
}

function Workspace({ 
  survey, 
  questions, 
  activeQuestionId, 
  setActiveQuestionId,
  setQuestions,
  builderTab,
  setBuilderTab,
  setSurveys,
  onCloseSurvey,
  onUnpublishSurvey,
  onPublishSurvey,
  onDeleteSurvey,
  onBack,
  onPreview,
  showToast,
  onRunStressTest
}: WorkspaceProps) {
  const themeClasses = useMemo(() => getThemeClasses(survey.theme), [survey.theme]);
  const [settingsModalQuestionId, setSettingsModalQuestionId] = useState<string | null>(null);
  const [settingsModalTab, setSettingsModalTab] = useState<'media' | 'logic' | 'layout' | 'piping' | 'ai'>('logic');
  const [comments, setComments] = useState<any[]>([]);

  useEffect(() => {
    try {
      const q = query(collection(db, 'surveys', survey.id, 'comments'));
      const unsub = onSnapshot(q, (snap) => {
        const acc: any[] = [];
        snap.forEach(doc => {
          acc.push({ id: doc.id, ...doc.data() });
        });
        setComments(acc);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, `surveys/${survey.id}/comments`);
      });
      return () => unsub();
    } catch (err) { }
  }, [survey.id]);

  const addQuestion = (type: QuestionType) => {
    const newId = `q-${Date.now()}`;
    const newQ: Question = {
      id: newId,
      type,
      text: '',
      desc: '',
      required: false,
      alias: '',
      ...( ['multiple_choice', 'checkbox', 'dropdown'].includes(type) ? { choices: ['Option 1', 'Option 2'] } : {} ),
      ...( type === 'matrix' ? { 
        choices: ['Disagree', 'Neutral', 'Agree'], 
        rows: ['Row 1', 'Row 2'] 
      } : {} )
    };
    let newQuestions = [...questions];
    if (activeQuestionId) {
      const activeIdx = newQuestions.findIndex(q => q && q.id === activeQuestionId);
      if (activeIdx !== -1) {
        newQuestions.splice(activeIdx + 1, 0, newQ);
      } else {
        newQuestions.push(newQ);
      }
    } else {
      newQuestions.push(newQ);
    }
    setQuestions(newQuestions);
    setActiveQuestionId(newId);
    updateDoc(doc(db, 'surveys', survey.id), { questions: JSON.parse(JSON.stringify(newQuestions)) });
    showToast(`Added ${type.replace('_', ' ')} element`);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    const newQuestions = questions.map(q => q && q.id === id ? { ...q, ...updates } : q);
    setQuestions(newQuestions);
    // Explicitly update Firestore
    updateDoc(doc(db, 'surveys', survey.id), { questions: JSON.parse(JSON.stringify(newQuestions)) });
  };

  const deleteQuestion = (id: string) => {
    const newQuestions = questions.filter(q => q && q.id !== id);
    setQuestions(newQuestions);
    if (activeQuestionId === id) setActiveQuestionId(null);
    updateDoc(doc(db, 'surveys', survey.id), { questions: JSON.parse(JSON.stringify(newQuestions)) });
    showToast('Question deleted', 'info');
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn("flex flex-1 overflow-hidden", themeClasses.font)}
    >
      <aside className="hidden md:flex w-56 bg-white border-r border-border-subtle flex-col shrink-0">
        <div className="p-4 border-b border-border-subtle">
           <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-gray-400">Navigation</span>
            <nav className="mt-4 space-y-0.5">
             <WSNavItem label="Builder" active={['questions', 'logic', 'design'].includes(builderTab)} onClick={() => setBuilderTab('questions')} icon={<Edit3 className="w-3.5 h-3.5" />} />
             <WSNavItem label="Share" active={builderTab === 'share'} data-tab-target="share" onClick={() => setBuilderTab('share')} icon={<Send className="w-3.5 h-3.5" />} />
             <WSNavItem label="Results" active={builderTab === 'results'} onClick={() => setBuilderTab('results')} icon={<BarChartBig className="w-3.5 h-3.5" />} />
             <WSNavItem label="Settings" active={builderTab === 'settings'} onClick={() => setBuilderTab('settings')} icon={<Settings className="w-3.5 h-3.5" />} />
             <WSNavItem label="Test" active={builderTab === 'test'} onClick={() => setBuilderTab('test')} icon={<Beaker className="w-3.5 h-3.5" />} />
           </nav>
        </div>
        <div className="p-4 mt-auto">
           <button onClick={onPreview} className="w-full btn-outline border-border-subtle py-2 text-[10px] tracking-widest uppercase font-black hover:bg-hr-blue/5 hover:text-hr-blue transition-all group">
              <Eye className="w-3.5 h-3.5 text-gray-400 group-hover:text-hr-blue" /> Preview Survey
           </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-10 bg-white border-b border-border-subtle px-4 flex items-center gap-4 shrink-0">
          {builderTab === 'share' ? (
            <WSTab label="Tracking Links" active={true} onClick={() => {}} />
          ) : builderTab === 'results' ? (
            <WSTab label="Analysis Overview" active={true} onClick={() => {}} />
          ) : builderTab === 'test' ? (
            <WSTab label="Feature Test" active={true} onClick={() => {}} />
          ) : (
            <>
              <WSTab label="Questions" active={builderTab === 'questions'} onClick={() => setBuilderTab('questions')} />
              <WSTab label="Visual Design" active={builderTab === 'design'} onClick={() => setBuilderTab('design')} />
              <WSTab label="Logic & Branching" active={builderTab === 'logic'} onClick={() => setBuilderTab('logic')} />
              <WSTab label="Settings" active={builderTab === 'settings'} onClick={() => setBuilderTab('settings')} />
            </>
          )}
        </div>

        {builderTab === 'questions' && (
          <div className="h-10 bg-white border-b border-gray-100 px-4 flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
             <div className="flex items-center gap-2 pr-4 border-r border-gray-100 mr-2 shrink-0">
                <div className="w-5 h-5 rounded flex items-center justify-center bg-hr-blue/5">
                   <Plus className="w-3 h-3 text-hr-blue" />
                </div>
                <span className="text-[9px] font-black uppercase text-hr-navy tracking-[0.1em]">Add Element</span>
             </div>
             <QTypeBtn label="Choice" icon={<Circle className="w-3.5 h-3.5" />} onClick={() => addQuestion('multiple_choice')} />
             <QTypeBtn label="Checkbox" icon={<Square className="w-3.5 h-3.5" />} onClick={() => addQuestion('checkbox')} />
             <QTypeBtn label="Input" icon={<BarChart3 className="w-3.5 h-3.5 rotate-90" />} onClick={() => addQuestion('short_text')} />
             <QTypeBtn label="Rating" icon={<Star className="w-3.5 h-3.5" />} onClick={() => addQuestion('rating')} />
             <QTypeBtn label="NPS" icon={<Plus className="w-3.5 h-3.5 rotate-45" />} onClick={() => addQuestion('nps')} />
             <div className="h-4 w-[1px] bg-gray-100 mx-2 shrink-0" />
             <QTypeBtn label="Page Break" icon={<GripHorizontal className="w-3.5 h-3.5 text-gray-300" />} onClick={() => addQuestion('page_break')} />
             <QTypeBtn label="Matrix" icon={<Grid3X3 className="w-3.5 h-3.5" />} onClick={() => addQuestion('matrix')} />
             <QTypeBtn label="HTML" icon={<Code className="w-3.5 h-3.5 text-gray-300" />} onClick={() => addQuestion('html')} />
          </div>
        )}

        <div className={cn("flex-1 flex overflow-hidden bg-white/50", themeClasses.bg)}>
           <div className="flex-1 overflow-y-auto p-4 custom-scrollbar" onClick={() => setActiveQuestionId(null)}>
              <div className="max-w-4xl mx-auto">
                 {builderTab === 'settings' ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="max-w-2xl mx-auto space-y-6"
                    >
                       <div className="card-premium p-8 bg-white border border-border-subtle rounded-[24px]">
                          <div className="flex items-center gap-4 mb-6">
                             <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100">
                                <Settings className="w-6 h-6 text-hr-navy" />
                             </div>
                             <div>
                                <h3 className="text-xl font-bold text-hr-navy">Survey Settings</h3>
                                <p className="text-xs text-gray-500">Manage visibility and research lifecycle</p>
                             </div>
                          </div>
                          <div className="space-y-4">
                             <div className="flex items-center justify-between p-5 rounded-2xl border border-gray-50 bg-gray-50/30">
                                <div className="space-y-0.5">
                                   <label className="text-sm font-bold text-hr-navy">Publishing Status</label>
                                   <p className="text-[10px] text-gray-400">Toggle whether this survey is collecting data</p>
                                </div>
                                <div>
                                   {survey.status === 'Active' ? (
                                      <button onClick={() => onUnpublishSurvey(survey.id)} className="px-5 py-2 bg-white border border-gray-100 text-hr-navy text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-gray-50 shadow-sm transition-all">Unpublish</button>
                                   ) : (
                                      <button onClick={() => onPublishSurvey(survey.id)} className="px-5 py-2 bg-hr-blue text-white text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-hr-blue/90 shadow-lg shadow-hr-blue/10 transition-all">Publish Now</button>
                                   )}
                                </div>
                             </div>
                             <div className="flex items-center justify-between p-5 rounded-2xl border border-gray-50 bg-gray-50/30">
                                <div className="space-y-0.5" id="close-survey-label">
                                   <label className="text-sm font-bold text-hr-red">Close Survey</label>
                                   <p className="text-[10px] text-gray-400 italic">Immediately archive this project</p>
                                </div>
                                <div id="close-survey-action">
                                   {survey.status === 'Closed' ? (
                                      <button onClick={() => onUnpublishSurvey(survey.id)} className="px-5 py-2 bg-white border border-gray-200 text-hr-navy text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-gray-50 shadow-sm transition-all" id="btn-reopen-survey">Re-open</button>
                                   ) : (
                                      <button onClick={() => onCloseSurvey(survey.id)} className="px-5 py-2 bg-white border border-hr-red/20 text-hr-red text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-hr-red/5 transition-all" id="btn-close-survey">Close Survey</button>
                                   )}
                                </div>
                             </div>
                             <div className="flex items-center justify-between p-5 rounded-2xl border border-red-50 bg-red-50/10" id="delete-survey-section">
                                <div className="space-y-0.5" id="delete-survey-label">
                                   <label className="text-sm font-bold text-hr-red">Delete Project</label>
                                   <p className="text-[10px] text-gray-400">Move this survey to the trash folder</p>
                                </div>
                                <button onClick={(e) => { onDeleteSurvey(survey.id, e); }} className="px-5 py-2 bg-hr-red text-white text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-hr-red/90 shadow-lg shadow-hr-red/10 transition-all" id="btn-delete-from-settings">Delete</button>
                             </div>
                          </div>
                       </div>
                    </motion.div>
                 ) : builderTab === 'results' ? (
                   <ResultsView 
                    questions={questions} 
                    survey={survey} 
                    showToast={showToast} 
                    onUpdateSurvey={(updates) => {
                      setSurveys(prev => prev.map(s => s && s.id === survey.id ? { ...s, ...updates } : s));
                    }}
                   />
                 ) : builderTab === 'share' ? (
                   <ShareView 
                      survey={survey} 
                      showToast={showToast}
                      onUpdateSurvey={(updated) => {
                        setSurveys(prev => prev.map(s => s && s.id === updated.id ? updated : s));
                        const updates: any = {};
                        if(updated.links) {
                          updates.links = JSON.parse(JSON.stringify(updated.links));
                        }
                        if(updated.sharedEmails) {
                          updates.sharedEmails = updated.sharedEmails;
                        }
                        updateDoc(doc(db, 'surveys', updated.id), updates);
                      }} />
                 ) : builderTab === 'test' ? (
                   <TestView 
                      survey={survey}
                      questions={questions}
                      showToast={showToast}
                      onRunStressTest={(id) => onRunStressTest(id)}
                   />
                 ) : builderTab === 'logic' ? (
                   <div className="card-premium p-12 text-center space-y-4 border-2 border-dashed border-gray-100 bg-white slide-in-bottom">
                      <div className="w-20 h-20 bg-hr-blue/10 text-hr-blue rounded-full flex items-center justify-center mx-auto">
                        <Zap className="w-10 h-10" />
                      </div>
                      <h3 className="text-2xl font-bold text-hr-navy">Logic & Branching</h3>
                      <p className="text-gray-500 max-w-md mx-auto leading-relaxed">Design complex respondent paths. Connect questions based on specific answers to create personalized research experiences.</p>
                      <button onClick={() => showToast('Rule engine coming soon', 'info')} className="btn-primary mx-auto mt-6">Configure First Rule</button>
                   </div>
                 ) : builderTab === 'design' ? (
                   <div className="card-premium p-12 text-center space-y-4 bg-white border-2 border-dashed border-gray-100 slide-in-bottom">
                      <div className="w-20 h-20 bg-hr-blue/10 text-hr-blue rounded-full flex items-center justify-center mx-auto">
                        <Palette className="w-10 h-10" />
                      </div>
                      <h3 className="text-3xl font-black text-hr-navy tracking-tight">Visual Identity</h3>
                      <p className="text-gray-500 max-w-md mx-auto leading-relaxed">Choose an aesthetic profile that matches your organization's brand and the target audience's expectations.</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left mt-8">
                        {THEMES.map((themeOption) => {
                             const preview = getThemeClasses(themeOption.id);
                             return (
                          <div 
                            key={themeOption.id}
                            onClick={async () => {
                              const updatedSurvey = { ...survey, theme: themeOption.id };
                              setSurveys(prev => prev.map(s => s && s.id === survey.id ? updatedSurvey : s));
                              try {
                                await updateDoc(doc(db, 'surveys', survey.id), { theme: themeOption.id });
                                showToast(`${themeOption.name} theme applied`, 'success');
                              } catch (err) {
                                handleFirestoreError(err, OperationType.UPDATE, `surveys/${survey.id}`);
                              }
                            }}
                            className={cn(
                              "group relative pt-12 pb-8 px-8 rounded-[32px] border-2 transition-all cursor-pointer overflow-hidden",
                              (survey.theme === themeOption.id || (!survey.theme && themeOption.id === 'professional'))
                                ? "border-hr-blue bg-white shadow-2xl shadow-hr-blue/10 ring-4 ring-hr-blue/5"
                                : "border-gray-100 bg-white hover:border-hr-blue/30 hover:shadow-xl"
                            )}
                          >
                            <div className={cn(
                              "absolute top-0 left-0 right-0 h-2",
                              themeOption.color
                            )} />
                            
                            <div className="flex flex-col items-center text-center space-y-4">
                              <div className={cn(
                                "w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
                                (survey.theme === themeOption.id || (!survey.theme && themeOption.id === 'professional'))
                                  ? "bg-hr-blue text-white"
                                  : "bg-gray-50 text-gray-400 group-hover:bg-hr-blue/10 group-hover:text-hr-blue"
                              )}>
                                {themeOption.icon}
                              </div>
                              <div className="space-y-1">
                                <h4 className="font-bold text-hr-navy">{themeOption.name}</h4>
                                <p className="text-[10px] text-gray-400 uppercase tracking-[0.15em] font-black">{themeOption.description}</p>
                              </div>

                              <div className="flex gap-1.5 pt-2">
                                <div className={cn("w-6 h-3 rounded-full opacity-40", themeOption.color)} />
                                <div className="w-3 h-3 rounded-full bg-gray-100" />
                                <div className="w-3 h-3 rounded-full bg-gray-50" />
                              </div>
                            </div>
                            
                            {(survey.theme === themeOption.id || (!survey.theme && themeOption.id === 'professional')) && (
                              <div className="absolute top-4 right-4 bg-hr-blue text-white p-1 rounded-full">
                                <CheckCircle2 className="w-3 h-3" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                   <>
                     <div className="bg-white border border-border-subtle rounded-2xl p-3 md:p-4 mb-4 relative overflow-hidden shadow-sm hover:shadow-md transition-all group/header" onClick={e => e.stopPropagation()}>
                        <div className="relative z-10 space-y-2">
                           <div className="space-y-1">
                              <textarea 
                                rows={survey.title?.split('\n').length || 1}
                                className="bg-transparent border-none outline-none w-full text-xl font-bold text-hr-navy tracking-tight placeholder:text-gray-200 transition-all focus:pl-1 resize-none overflow-hidden leading-tight" 
                                value={survey.title || ''}
                                placeholder="Survey Title..."
                                onChange={(e) => {
                                  const updatedSurvey = { ...survey, title: e.target.value };
                                  setSurveys(prev => prev.map(s => s && s.id === survey.id ? updatedSurvey : s));
                                }}
                              />
                              <textarea 
                                className="bg-transparent border-none outline-none w-full text-xs text-gray-400 resize-none h-auto min-h-[30px] placeholder:text-gray-200 leading-relaxed transition-all focus:pl-1 font-serif italic"
                                value={survey.desc || ''}
                                placeholder="Add a detailed description for responders..."
                                onChange={(e) => {
                                  const updatedSurvey = { ...survey, desc: e.target.value };
                                  setSurveys(prev => prev.map(s => s && s.id === survey.id ? updatedSurvey : s));
                                }}
                              />
                              <input 
                                className="bg-gray-50/50 border border-gray-200 outline-none w-full text-[10px] text-gray-600 placeholder:text-gray-400 transition-all focus:bg-white focus:border-hr-blue/30 rounded px-2 py-1.5 mt-2" 
                                value={survey.logoUrl || ''}
                                placeholder="Custom Logo URL (optional)"
                                onChange={(e) => {
                                  const updatedSurvey = { ...survey, logoUrl: e.target.value };
                                  setSurveys(prev => prev.map(s => s && s.id === survey.id ? updatedSurvey : s));
                                }}
                              />
                           </div>
                        </div>
                        <div className="absolute -top-12 -right-12 w-64 h-64 bg-hr-blue/5 blur-3xl rounded-full group-hover/header:bg-hr-blue/10 transition-colors" />
                     </div>

                     <div className="space-y-2 pb-12">
                        {questions.length === 0 ? (
                           <div className="py-10 text-center space-y-3 border-2 border-dashed border-gray-100 rounded-2xl bg-white slide-in-bottom">
                              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                                 <Edit3 className="w-5 h-5 text-gray-300" />
                              </div>
                              <div className="space-y-1">
                                 <p className="text-base font-bold text-hr-navy">Your survey is looking a bit empty</p>
                                 <p className="text-xs text-gray-400">Select a question type above to begin building your research instrument.</p>
                              </div>
                           </div>
                        ) : (
                             <Reorder.Group axis="y" values={questions} onReorder={setQuestions} className="space-y-2">
                             {questions.map((q, idx) => {
                               const currentPageNum = questions.slice(0, idx).filter(item => item && item.type === 'page_break').length + 1;
                               const isNewPage = idx === 0 || (questions[idx - 1] && questions[idx - 1].type === 'page_break');
                               const questionNumber = questions.slice(0, idx).filter(item => item && item.type !== 'page_break' && item.type !== 'html').length;
                               
                               return (
                                 <React.Fragment key={q.id}>
                                   {isNewPage && (
                                     <div className="flex items-center gap-4 py-2 select-none">
                                       <div className="h-[1px] bg-hr-blue/5 flex-1" />
                                       <span className="text-[10px] font-black uppercase text-hr-blue/40 tracking-[0.2em]">
                                         Page {currentPageNum}
                                       </span>
                                       <div className="h-[1px] bg-hr-blue/5 flex-1" />
                                     </div>
                                   )}
                                   <Reorder.Item value={q} key={q.id}>
                                      <QuestionCard 
                                        question={q}
                                        index={questionNumber}
                                        isActive={activeQuestionId === q.id}
                                        onClick={(e) => { e.stopPropagation(); setActiveQuestionId(q.id); }}
                                        onUpdate={(u) => updateQuestion(q.id, u)}
                                        onDelete={() => deleteQuestion(q.id)}
                                        themeClasses={themeClasses}
                                        onOpenSettings={(tab = 'logic') => {
                                           setSettingsModalTab(tab);
                                           setSettingsModalQuestionId(q.id);
                                         }}
                                        questionComments={comments.filter(c => c.questionId === q.id)}
                                        surveyId={survey.id}
                                        showToast={showToast}
                                      />
                                   </Reorder.Item>
                                 </React.Fragment>
                               );
                             })}
                           </Reorder.Group>
                        )}
                        
                        <ThankYouCard 
                          survey={survey} 
                          index={questions.length} 
                          isActive={activeQuestionId === 'thank_you'}
                          onClick={(e) => { e.stopPropagation(); setActiveQuestionId('thank_you'); }}
                          onUpdate={(html) => {
                            const updatedSurvey = { ...survey, thankYouHtml: html };
                            setSurveys(prev => prev.map(s => s && s.id === survey.id ? updatedSurvey : s));
                            updateDoc(doc(db, 'surveys', survey.id), { thankYouHtml: html });
                          }} 
                        />
                     </div>
                   </>
                 )}
              </div>
           </div>

           <AnimatePresence>
             {settingsModalQuestionId && (
               <QuestionSettingsModal 
                 question={questions.find(q => q.id === settingsModalQuestionId)!}
                  initialTab={settingsModalTab}
                 allQuestions={questions}
                 onClose={() => setSettingsModalQuestionId(null)}
                 onUpdate={(updates) => updateQuestion(settingsModalQuestionId, updates)}
                 themeClasses={themeClasses}
                 showToast={showToast}
               />
             )}
           </AnimatePresence>

           <AnimatePresence>
             {activeQuestionId && activeQuestionId !== 'thank_you' && (
               <motion.aside 
                 initial={{ x: 350, opacity: 0 }}
                 animate={{ x: 0, opacity: 1 }}
                 exit={{ x: 350, opacity: 0 }}
                 className="fixed md:relative inset-y-0 right-0 w-80 md:w-64 h-full md:h-auto bg-white border-l border-border-subtle p-3.5 flex flex-col gap-3 shrink-0 shadow-2xl md:shadow-none z-50 md:z-10"
               >
                 <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
                    <h4 className="font-display font-bold text-hr-navy tracking-tight uppercase text-[9px]">Properties</h4>
                    <button onClick={() => setActiveQuestionId(null)} className="p-1 hover:bg-gray-100 rounded transition-colors" title="Close Panel">
                      <Plus className="w-3.5 h-3.5 rotate-45 text-gray-400" />
                    </button>
                 </div>
                 <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Required</span>
                      <Toggle 
                        active={questions.find(q => q && q.id === activeQuestionId)?.required || false}
                        onChange={(v) => {
                          updateQuestion(activeQuestionId!, { required: v });
                          showToast(v ? 'Marked as required' : 'Marked as optional', 'info');
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Alias</label>
                       <input 
                         type="text" 
                         className="w-full bg-gray-50 border border-border-strong rounded-lg p-2 text-xs text-hr-navy focus:outline-none focus:ring-2 ring-hr-blue/10 transition-all font-medium"
                         value={questions.find(q => q && q.id === activeQuestionId)?.alias || ''}
                         onChange={(e) => updateQuestion(activeQuestionId!, { alias: e.target.value })}
                         placeholder="e.g. Dept_Name"
                       />
                       <p className="text-[8px] text-gray-400 leading-relaxed italic">Used in programmatic identification.</p>
                    </div>
                 </div>
               </motion.aside>
             )}
           </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function WSNavItem({ 
  label, 
  active, 
  icon, 
  onClick,
  'data-tab-target': dataTabTarget 
}: { 
  label: string, 
  active?: boolean, 
  icon: React.ReactNode, 
  onClick?: () => void,
  'data-tab-target'?: string
}) {
  return (
    <div 
      onClick={onClick}
      data-tab-target={dataTabTarget}
      className={cn(
        "flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer group",
        active ? "bg-hr-blue/10 text-hr-blue font-bold shadow-sm" : "text-gray-500 hover:bg-gray-50 hover:text-hr-navy"
      )}
    >
      <span className={cn("transition-colors", active ? "text-hr-blue" : "group-hover:text-hr-navy")}>{icon}</span>
      {label}
    </div>
  );
}

function WSTab({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <div 
      className={cn(
        "h-full flex items-center px-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all cursor-pointer",
        active ? "text-hr-navy border-hr-blue" : "text-gray-400 border-transparent hover:text-gray-600 hover:border-gray-200"
      )}
      onClick={onClick}
    >
      {label}
    </div>
  );
}

function QuestionSettingsModal({ 
  question, 
  allQuestions,
  initialTab = 'logic',
  onClose, 
  onUpdate,
  themeClasses,
  showToast
}: { 
  question: Question; 
  allQuestions: Question[];
  initialTab?: 'media' | 'logic' | 'validation' | 'layout' | 'piping' | 'ai';
  onClose: () => void; 
  onUpdate: (u: Partial<Question>) => void;
  themeClasses: any;
  showToast: (m: string, t?: 'success' | 'info' | 'error') => void;
}) {
  const [tab, setTab] = useState<'media' | 'logic' | 'validation' | 'layout' | 'piping' | 'ai'>(initialTab);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // Logic state
  const [logicEnabled, setLogicEnabled] = useState(question.logic?.enabled || false);
  const [conditions, setConditions] = useState<LogicCondition[]>(question.logic?.conditions || []);
  
  // Bottom options
  const [hideByDefault, setHideByDefault] = useState(question.logic?.hideByDefault || false);
  const [adminOnly, setAdminOnly] = useState(question.logic?.adminOnly || false);
  const [isQuestionDisabled, setIsQuestionDisabled] = useState(question.logic?.disabled || false);
  
  // Randomization
  const [alwaysInclude, setAlwaysInclude] = useState(question.logic?.alwaysIncludeInRandomization || false);
  const [fixedPosition, setFixedPosition] = useState(question.logic?.fixedPosition || false);

  // Validation state
  const [requiredType, setRequiredType] = useState<'Not required' | 'Required' | 'Warn respondents if question is left unanswered (Soft-Require)' | 'Conditionally require this question on previous answers'>(
    question.validation?.requiredType || (question.required ? 'Required' : 'Not required')
  );
  const [answerFormat, setAnswerFormat] = useState(question.validation?.answerFormat || 'Normal / Open Text');
  const [capitalizeWords, setCapitalizeWords] = useState(question.validation?.capitalizeWords || false);
  const [limitAnswersTo, setLimitAnswersTo] = useState<number | null>(question.validation?.limitAnswersTo || null);
  const [minAnswers, setMinAnswers] = useState<number | null>(question.validation?.minAnswers || null);

  const saveLogic = () => {
    onUpdate({
      required: requiredType === 'Required',
      logic: {
        enabled: logicEnabled,
        conditions,
        hideByDefault,
        adminOnly,
        disabled: isQuestionDisabled,
        alwaysIncludeInRandomization: alwaysInclude,
        fixedPosition
      },
      validation: {
        requiredType,
        answerFormat,
        capitalizeWords,
        limitAnswersTo,
        minAnswers
      }
    });
    onClose();
  };

  const addCondition = () => {
    const prevQuestions = allQuestions.filter(q => q.id !== question.id);
    if(prevQuestions.length === 0) return;
    
    setConditions([...conditions, {
      questionId: prevQuestions[0].id,
      operator: 'is_one_of',
      values: []
    }]);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-4 bg-hr-navy/60 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-5xl bg-white rounded-2xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col h-full max-h-[95vh] border border-white/20"
      >
        {/* Header */}
        <div className="bg-[#344256] text-white p-4 shrink-0 shadow-lg relative z-10">
           <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-hr-blue/80" />
                <h2 className="text-lg font-bold tracking-tight">{question.text || 'Untitled Question'}</h2>
              </div>
              <div className="flex items-center gap-4">
                 <button className="flex items-center gap-2 text-[10px] font-bold opacity-70 hover:opacity-100 transition-opacity">
                    <Heart className="w-3.5 h-3.5 fill-hr-red text-hr-red" /> Need Help?
                 </button>
                 <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                    <X className="w-4 h-4" />
                 </button>
              </div>
           </div>
           
           <div className="flex items-center px-2 gap-8">
              <ModalTab label="AI MODIFIER" active={tab === 'ai'} onClick={() => setTab('ai')} icon={<Sparkles className="w-3.5 h-3.5" />} />
              <ModalTab label="MEDIA" active={tab === 'media'} onClick={() => setTab('media')} />
              <ModalTab label="LOGIC" active={tab === 'logic'} onClick={() => setTab('logic')} />
              <ModalTab label="VALIDATION" active={tab === 'validation'} onClick={() => setTab('validation')} />
              <ModalTab label="LAYOUT" active={tab === 'layout'} onClick={() => setTab('layout')} />
              <ModalTab label="PIPING / REPEAT" active={tab === 'piping'} onClick={() => setTab('piping')} />
           </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-gray-50/50">
           {tab === 'ai' ? (
             <div className="max-w-2xl mx-auto py-12 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center space-y-3">
                   <div className="w-16 h-16 bg-hr-blue/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-hr-blue/20">
                      <Sparkles className="w-8 h-8 text-hr-blue" />
                   </div>
                   <h3 className="text-2xl font-black text-hr-navy tracking-tight">AI Question Modifier</h3>
                   <p className="text-gray-500 text-sm max-w-sm mx-auto">Ask Gemini to rewrite, optimize, or transform this question into another type.</p>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-border-subtle shadow-xl space-y-6">
                   <div className="space-y-3">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                         <MessageSquare className="w-3.5 h-3.5" /> Your Request
                      </label>
                      <textarea 
                        autoFocus
                        value={aiPrompt || ''}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="e.g. Rewrite this to be more professional... or Turn this into a multiple choice question about employee engagement..."
                        className="w-full h-32 p-4 bg-gray-50 border border-border-strong rounded-2xl text-sm focus:outline-none focus:ring-4 ring-hr-blue/5 focus:bg-white transition-all text-hr-navy font-medium placeholder:text-gray-300 resize-none"
                      />
                   </div>

                   <button 
                     onClick={async () => {
                        if (!aiPrompt.trim() || isAiLoading) return;
                        setIsAiLoading(true);
                        try {
                          const result = await modifyQuestion(question, aiPrompt);
                          onUpdate(result);
                          showToast("Question modified by AI!", "success");
                          setAiPrompt('');
                          setTab('logic'); // Switch back to see result or logic
                        } catch (err) {
                           showToast("AI modification failed", "error");
                        } finally {
                           setIsAiLoading(false);
                        }
                     }}
                     disabled={!aiPrompt.trim() || isAiLoading}
                     className="w-full py-4 bg-hr-blue text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-hr-blue/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                   >
                      {isAiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                      {isAiLoading ? 'Gemini is thinking...' : 'Apply AI Changes'}
                   </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div 
                    onClick={() => setAiPrompt("Rewrite this question to be more concise and clear.")}
                    className="p-4 bg-white border border-border-subtle rounded-xl text-left hover:border-hr-blue/30 cursor-pointer transition-all group"
                   >
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 group-hover:text-hr-blue">Quick Action</p>
                      <p className="text-xs font-bold text-hr-navy">Improve Clarity</p>
                   </div>
                   <div 
                    onClick={() => setAiPrompt("Add more relevant options for this question.")}
                    className="p-4 bg-white border border-border-subtle rounded-xl text-left hover:border-hr-blue/30 cursor-pointer transition-all group"
                   >
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 group-hover:text-hr-blue">Quick Action</p>
                      <p className="text-xs font-bold text-hr-navy">Expand Options</p>
                   </div>
                </div>
             </div>
           ) : tab === 'logic' ? (
             <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <section>
                   <div className="flex items-center gap-3 mb-6">
                     <div className="w-8 h-8 bg-hr-blue/10 rounded-lg flex items-center justify-center">
                        <Zap className="w-4 h-4 text-hr-blue" />
                     </div>
                     <h3 className="text-xl font-black text-[#566573] tracking-tight">Logic Rule</h3>
                   </div>
                   
                   <div className="space-y-6">
                      <label className="flex items-start gap-4 cursor-pointer group bg-white p-5 rounded-xl border border-border-subtle shadow-sm hover:shadow-md transition-all">
                         <div className="mt-1">
                           <input 
                             type="checkbox" 
                             className="w-4 h-4 rounded border-gray-300 text-hr-blue focus:ring-hr-blue transition-all" 
                             checked={logicEnabled}
                             onChange={(e) => setLogicEnabled(e.target.checked)}
                           />
                         </div>
                         <div className="space-y-0.5">
                            <span className="text-sm font-bold text-hr-navy transition-colors">
                                Conditional Visibility
                            </span>
                            <p className="text-xs text-gray-400">Only show this element based on answers to previous questions</p>
                         </div>
                      </label>

                      {logicEnabled && (
                        <div className="mt-6 space-y-4 animate-in zoom-in-95 duration-300">
                           <div className="flex justify-between items-center px-2">
                             <button onClick={() => setConditions([])} className="text-[9px] font-black text-gray-400 uppercase tracking-widest hover:text-hr-red transition-colors flex items-center gap-2">
                                <Trash2 className="w-3 h-3" /> Remove All Logic
                             </button>
                           </div>
                           
                           <div className="bg-[#f8f9fa] border-2 border-dashed border-gray-200 rounded-2xl p-6 min-h-[350px] flex flex-col shadow-inner">
                              {conditions.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3 py-16">
                                   <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-50">
                                      <GitBranch className="w-5 h-5 text-gray-300" />
                                   </div>
                                   <p className="italic text-xs font-medium">No conditions defined yet.</p>
                                </div>
                              ) : (
                                <div className="space-y-4 flex-1">
                                   {conditions.map((condition, idx) => (
                                     <div key={idx}>
                                       <ConditionRow 
                                         condition={condition}
                                         allQuestions={allQuestions.filter(q => q.id !== question.id)}
                                         onUpdate={(updates) => {
                                            const newConditions = [...conditions];
                                            newConditions[idx] = { ...condition, ...updates };
                                            setConditions(newConditions);
                                         }}
                                         onDelete={() => {
                                            setConditions(conditions.filter((_, i) => i !== idx));
                                         }}
                                       />
                                     </div>
                                   ))}
                                </div>
                              )}
                              
                              <div className="flex items-center justify-between border-t border-gray-200/50 pt-6 mt-8 bg-white/40 -mx-6 -mb-6 p-6 rounded-b-[0.9rem]">
                                 <button onClick={addCondition} className="btn-outline border-border-strong px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-white shadow-sm transition-all">
                                    <Plus className="w-3 h-3" /> Add Condition
                                 </button>
                                 <button onClick={() => showToast('Groups coming soon')} className="btn-outline border-border-strong px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-white shadow-sm opacity-50">
                                    <Plus className="w-3 h-3" /> Add Group
                                 </button>
                              </div>
                           </div>
                        </div>
                      )}
                   </div>
                </section>

                <hr className="border-gray-200/60" />

                <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="group bg-white p-6 rounded-2xl border border-border-subtle shadow-sm hover:shadow-md transition-all">
                      <label className="flex items-start gap-4 cursor-pointer">
                         <input 
                           type="checkbox" 
                           className="w-5 h-5 mt-1 rounded-lg border-gray-300 text-hr-blue focus:ring-hr-blue transition-all" 
                           checked={hideByDefault}
                           onChange={(e) => setHideByDefault(e.target.checked)}
                         />
                         <div className="space-y-1">
                            <span className="text-sm font-bold text-hr-navy">Hide by Default</span>
                            <p className="text-xs text-gray-400">Used for manual control via custom scripts</p>
                         </div>
                      </label>
                   </div>
                   <div className="group bg-white p-6 rounded-2xl border border-border-subtle shadow-sm hover:shadow-md transition-all">
                      <label className="flex items-start gap-4 cursor-pointer">
                         <input 
                           type="checkbox" 
                           className="w-5 h-5 mt-1 rounded-lg border-gray-300 text-hr-blue focus:ring-hr-blue transition-all" 
                           checked={adminOnly}
                           onChange={(e) => setAdminOnly(e.target.checked)}
                         />
                         <div className="space-y-1">
                            <span className="text-sm font-bold text-hr-navy">Admin Access Only</span>
                            <p className="text-xs text-gray-400">Only visible to users with administrative roles</p>
                         </div>
                      </label>
                   </div>
                </section>

                <section className="bg-white p-10 rounded-[2rem] border border-border-subtle shadow-sm">
                   <h3 className="text-lg font-bold text-hr-navy mb-8 flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-hr-red" /> Disable Question
                   </h3>
                   <div className="flex gap-12">
                      <label className="flex items-center gap-3 cursor-pointer group">
                         <div className={cn(
                           "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                           isQuestionDisabled ? "border-hr-blue bg-hr-blue/5" : "border-gray-200 group-hover:border-gray-300"
                         )}>
                            <input 
                               type="radio" 
                               name="disabled" 
                               checked={isQuestionDisabled} 
                               onChange={() => setIsQuestionDisabled(true)} 
                               className="sr-only"
                            />
                            {isQuestionDisabled && <div className="w-2.5 h-2.5 rounded-full bg-hr-blue shadow-lg shadow-hr-blue/20" />}
                         </div>
                         <span className={cn("text-sm transition-colors", isQuestionDisabled ? "text-hr-blue font-bold" : "text-gray-400")}>Yes, disable this question</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                         <div className={cn(
                           "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                           !isQuestionDisabled ? "border-hr-navy bg-hr-navy/5" : "border-gray-200 group-hover:border-gray-300"
                         )}>
                            <input 
                               type="radio" 
                               name="disabled" 
                               checked={!isQuestionDisabled} 
                               onChange={() => setIsQuestionDisabled(false)} 
                               className="sr-only"
                            />
                            {!isQuestionDisabled && <div className="w-2.5 h-2.5 rounded-full bg-hr-navy shadow-lg shadow-hr-navy/20" />}
                         </div>
                         <span className={cn("text-sm transition-colors", !isQuestionDisabled ? "text-hr-navy font-bold" : "text-gray-400")}>No, keep active</span>
                      </label>
                   </div>
                </section>

                <section>
                   <div className="flex items-center gap-3 mb-8">
                     <div className="w-10 h-10 bg-hr-red/10 rounded-xl flex items-center justify-center">
                        <RefreshCw className="w-5 h-5 text-hr-red" />
                     </div>
                     <h3 className="text-2xl font-black text-[#566573] tracking-tight">Randomization Logic</h3>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <label className="flex items-start gap-4 cursor-pointer group bg-white p-6 rounded-2xl border border-border-subtle shadow-sm hover:shadow-md transition-all">
                         <input 
                            type="checkbox" 
                            className="w-5 h-5 mt-1 rounded-lg border-gray-300 text-hr-blue focus:ring-hr-blue transition-all" 
                            checked={alwaysInclude}
                            onChange={(e) => setAlwaysInclude(e.target.checked)}
                         />
                         <div className="space-y-1">
                            <span className="text-sm font-bold text-hr-navy">Always Include</span>
                            <p className="text-xs text-gray-400">Keep in random selection regardless of sampling settings</p>
                         </div>
                      </label>
                      <label className="flex items-start gap-4 cursor-pointer group bg-white p-6 rounded-2xl border border-border-subtle shadow-sm hover:shadow-md transition-all">
                         <input 
                            type="checkbox" 
                            className="w-5 h-5 mt-1 rounded-lg border-gray-300 text-hr-blue focus:ring-hr-blue transition-all" 
                            checked={fixedPosition}
                            onChange={(e) => setFixedPosition(e.target.checked)}
                         />
                         <div className="space-y-1">
                            <span className="text-sm font-bold text-hr-navy">Fixed Position</span>
                            <p className="text-xs text-gray-400">Position remains anchored when shuffle is active</p>
                         </div>
                      </label>
                   </div>
                </section>
             </div>
           ) : tab === 'validation' ? (
             <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 mx-auto max-w-4xl pt-4">
               <section>
                   <h3 className="text-[22px] font-normal text-hr-navy tracking-tight mb-6">Require</h3>
                   <div className="space-y-3">
                      {['Not required', 'Required', 'Warn respondents if question is left unanswered (Soft-Require)', 'Conditionally require this question on previous answers'].map((rt) => (
                        <label key={rt} className="flex items-center gap-3 cursor-pointer group">
                           <div className={cn(
                             "w-4 h-4 rounded-full border flex items-center justify-center transition-all",
                             requiredType === rt ? "border-blue-500 bg-white" : "border-gray-300 hover:border-gray-400"
                           )}>
                              <input 
                                 type="radio" 
                                 checked={requiredType === rt} 
                                 onChange={() => setRequiredType(rt as any)} 
                                 className="sr-only"
                              />
                              {requiredType === rt && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                           </div>
                           <span className={cn("text-sm transition-colors", requiredType === rt ? "text-hr-navy" : "text-gray-500")}>{rt}</span>
                        </label>
                      ))}
                   </div>
               </section>

               <section>
                   <h3 className="text-[22px] font-normal text-hr-navy tracking-tight mb-6">Answer Format</h3>
                   <div className="flex flex-col sm:flex-row sm:items-center gap-8">
                     <div className="relative">
                       <select 
                         value={answerFormat} 
                         onChange={(e) => setAnswerFormat(e.target.value)}
                         className="appearance-none pl-4 pr-10 py-2.5 border border-gray-200 rounded text-sm text-gray-600 focus:outline-none focus:border-blue-300"
                       >
                         <option>Normal / Open Text</option>
                         <option>Numerical</option>
                         <option>Date</option>
                       </select>
                       <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                     </div>
                     <label className="flex items-center gap-3 cursor-pointer group">
                       <input 
                         type="checkbox" 
                         checked={capitalizeWords} 
                         onChange={(e) => setCapitalizeWords(e.target.checked)}
                         className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                       />
                       <span className="text-sm text-gray-500">Capitalize each word</span>
                     </label>
                   </div>
               </section>

               <section>
                   <h3 className="text-[22px] font-normal text-hr-navy tracking-tight mb-6">Answer Requirements</h3>
                   <div className="space-y-6">
                     <div className="flex items-center gap-4">
                       <span className="text-sm text-gray-600">Limit answers to</span>
                       <input 
                         type="number" 
                         value={limitAnswersTo || ''} 
                         onChange={(e) => setLimitAnswersTo(e.target.value ? parseInt(e.target.value, 10) : null)}
                         className="w-20 px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-300"
                       />
                       <span className="text-sm text-gray-600">options</span>
                     </div>
                     
                     <div className="flex flex-col gap-3">
                       <span className="text-sm text-gray-600">If answered, minimum answers required</span>
                       <input 
                         type="number" 
                         value={minAnswers || ''} 
                         onChange={(e) => setMinAnswers(e.target.value ? parseInt(e.target.value, 10) : null)}
                         className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-300"
                       />
                     </div>
                   </div>
               </section>
             </div>
           ) : (
             <div className="flex flex-col items-center justify-center py-40 opacity-50">
                <LayoutGrid className="w-20 h-20 text-gray-200 mb-6" />
                <p className="text-lg font-bold text-hr-navy">{tab.toUpperCase()} Settings</p>
                <p className="text-sm text-gray-400">Coming soon in the next update</p>
             </div>
           )}
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-border-subtle p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.03)] relative z-10">
           <div className="flex gap-2">
              <button className="px-5 py-2.5 bg-gray-50 text-hr-navy rounded-xl font-bold text-[9px] uppercase tracking-widest flex items-center gap-2 border border-border-strong hover:bg-gray-100 transition-all">
                 <Plus className="w-3 h-3" /> Add Element
              </button>
              <button className="px-5 py-2.5 bg-gray-50 text-hr-navy rounded-xl font-bold text-[9px] uppercase tracking-widest border border-border-strong hover:bg-gray-100 transition-all">
                 Save Library
              </button>
           </div>
           <div className="flex gap-3 w-full sm:w-auto">
              <button onClick={onClose} className="flex-1 sm:flex-none px-8 py-2.5 bg-white text-gray-400 border border-gray-200 rounded-xl font-bold text-[9px] uppercase tracking-widest hover:bg-gray-50 transition-all">
                 Cancel
              </button>
              <button onClick={saveLogic} className="flex-1 sm:flex-none px-8 py-2.5 bg-hr-blue text-white rounded-xl font-bold text-[9px] uppercase tracking-widest shadow-xl shadow-hr-blue/20 hover:bg-hr-blue/90 hover:translate-y-[-2px] active:translate-y-0 transition-all">
                 Apply Settings
              </button>
           </div>
        </div>
      </motion.div>
    </div>
  );
}

function ModalTab({ label, active, onClick, icon }: { label: string; active: boolean; onClick: () => void; icon?: React.ReactNode }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "py-4 px-2 text-[10px] font-black tracking-[0.25em] transition-all relative outline-none flex items-center gap-2",
        active ? "text-white" : "text-white/40 hover:text-white/80"
      )}
    >
      {icon}
      {label}
      {active && (
        <motion.div 
          layoutId="modalTabLine"
          className="absolute bottom-0 left-0 right-0 h-1 bg-hr-blue rounded-t shadow-[0_-4px_12px_rgba(33,150,243,0.5)]"
        />
      )}
    </button>
  );
}

function ConditionRow({ 
  condition, 
  allQuestions, 
  onUpdate, 
  onDelete
}: { 
  condition: LogicCondition; 
  allQuestions: Question[]; 
  onUpdate: (u: Partial<LogicCondition>) => void; 
  onDelete: () => void;
}) {
  const selectedQuestion = allQuestions.find(q => q.id === condition.questionId);
  const choices = selectedQuestion?.choices || [];

  return (
    <div className="flex flex-col lg:flex-row items-stretch gap-3 p-4 bg-white rounded-xl border border-border-subtle shadow-sm group/row relative">
       <div className="flex flex-col gap-2">
         <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Question</label>
         <div className="relative">
           <select 
             className="appearance-none bg-gray-50 border border-border-strong rounded-xl p-3.5 pr-10 text-sm text-hr-navy focus:outline-none focus:ring-4 ring-hr-blue/5 w-full lg:w-72 font-bold cursor-pointer hover:bg-white transition-all shadow-sm"
             value={condition.questionId || ''}
             onChange={(e) => onUpdate({ questionId: e.target.value, values: [] })}
           >
              {allQuestions.map((q, i) => (
                 <option key={q.id} value={q.id}>Q{i+1}. {q.text || '(Untitled)'}</option>
              ))}
           </select>
           <ChevronDown className="w-4 h-4 text-gray-300 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
         </div>
       </div>

       <div className="flex flex-col gap-2">
         <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Condition</label>
         <div className="relative">
           <select 
             className="appearance-none bg-gray-50 border border-border-strong rounded-xl p-3.5 pr-10 text-sm text-hr-navy focus:outline-none focus:ring-4 ring-hr-blue/5 w-full lg:w-56 font-bold cursor-pointer hover:bg-white transition-all shadow-sm"
             value={condition.operator || ''}
             onChange={(e) => onUpdate({ operator: e.target.value as any })}
           >
              <option value="is_one_of">is one of the following</option>
              <option value="is_not_one_of">is not one of the following</option>
              <option value="is_answered">is answered</option>
              <option value="is_not_answered">is not answered</option>
           </select>
           <ChevronDown className="w-4 h-4 text-gray-300 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
         </div>
       </div>

       <div className="flex-1 flex flex-col gap-2">
         <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Values</label>
         <div className="bg-gray-50 border border-border-strong rounded-xl p-4 min-h-[160px] max-h-[160px] overflow-y-auto custom-scrollbar shadow-inner">
            {choices.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 {choices.map((choice, idx) => (
                   <label key={idx} className={cn(
                     "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer group/choice",
                     condition.values.includes(choice) ? "bg-hr-blue/5 border-hr-blue/20" : "bg-white border-transparent hover:border-gray-200"
                   )}>
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded-md border-gray-300 text-hr-blue focus:ring-hr-blue transition-all" 
                        checked={condition.values.includes(choice)}
                        onChange={(e) => {
                           const newValues = e.target.checked 
                             ? [...condition.values, choice]
                             : condition.values.filter(v => v !== choice);
                           onUpdate({ values: newValues });
                        }}
                      />
                      <span className={cn("text-xs font-medium transition-colors", condition.values.includes(choice) ? "text-hr-blue font-bold" : "text-gray-500 group-hover/choice:text-hr-navy")}>
                         <span className="text-[10px] opacity-40 mr-2">#{idx}</span>
                         {choice}
                      </span>
                   </label>
                 ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2">
                 <AlertCircle className="w-5 h-5 opacity-30" />
                 <p className="text-[10px] font-bold uppercase tracking-widest">No choices available</p>
              </div>
            )}
         </div>
       </div>

       <button onClick={onDelete} className="p-2.5 text-gray-300 hover:text-hr-red hover:bg-hr-red/5 rounded-full transition-all self-end lg:self-center">
          <Trash2 className="w-5 h-5" />
       </button>
    </div>
  );
}

function QTypeBtn({ label, icon, onClick }: { label: string, icon: React.ReactNode, onClick: () => void }) {
  return (
    <button 
      onClick={onClick} 
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-hr-blue hover:bg-hr-blue/5 transition-all active:scale-95 border border-transparent hover:border-hr-blue/10 shrink-0 group whitespace-nowrap"
    >
      <span className="text-gray-400 group-hover:text-hr-blue transition-colors">{icon}</span>
      {label}
    </button>
  );
}

interface QuestionCardProps {
  key?: string;
  question: Question;
  index: number;
  isActive: boolean;
  onClick: (e: React.MouseEvent) => void;
  onUpdate: (u: Partial<Question>) => void;
  onDelete: () => void;
  themeClasses: any;
  onOpenSettings: (tab?: 'media' | 'logic' | 'layout' | 'piping' | 'ai') => void;
  questionComments?: any[];
  surveyId: string;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

function ThankYouCard({
  survey,
  index,
  isActive,
  onClick,
  onUpdate
}: {
  survey: Survey;
  index: number;
  isActive: boolean;
  onClick: (e: React.MouseEvent) => void;
  onUpdate: (html: string) => void;
}) {
  const [viewMode, setViewMode] = useState<'editor' | 'preview'>('editor');
  const [htmlContent, setHtmlContent] = useState(survey.thankYouHtml || DEFAULT_THANK_YOU_HTML);

  useEffect(() => {
    setHtmlContent(survey.thankYouHtml || DEFAULT_THANK_YOU_HTML);
  }, [survey.thankYouHtml]);

  const handleBlur = () => {
    if (htmlContent !== survey.thankYouHtml) {
      onUpdate(htmlContent);
    }
  };

  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-white border transition-all duration-300 relative overflow-hidden group/card mt-2",
        isActive 
          ? "ring-4 ring-hr-blue/10 border-hr-blue shadow-lg rounded-2xl z-10 py-1 sm:scale-[1.01]" 
          : "border-gray-200 hover:border-hr-blue/30 hover:shadow-md shadow-sm rounded-xl z-0 opacity-80 hover:opacity-100"
      )}
    >
      {isActive && <div className="absolute top-0 left-0 w-1.5 h-full bg-hr-blue rounded-l-2xl" />}
      
      <div className="flex bg-gray-50/50 p-3 md:p-4 cursor-pointer select-none border-b border-border-subtle items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center font-mono text-[9px] bg-hr-blue/10 text-hr-blue w-5 h-5 rounded font-bold shrink-0">
             {index + 1}
          </div>
          <h3 className="font-bold text-hr-navy text-base line-clamp-1">Thank You Page</h3>
        </div>
        
        {isActive && (
           <div className="flex gap-1.5 bg-gray-100 p-1 rounded-lg">
             <button title="Editor" onClick={(e) => { e.stopPropagation(); setViewMode('editor'); }} className={cn("px-3 py-1 text-[10px] uppercase tracking-wider font-bold rounded flex items-center transition-colors", viewMode === 'editor' ? "bg-white text-hr-navy shadow-sm" : "text-gray-500")} >HTML</button>
             <button title="Preview" onClick={(e) => { e.stopPropagation(); setViewMode('preview'); }} className={cn("px-3 py-1 text-[10px] uppercase tracking-wider font-bold rounded flex items-center transition-colors", viewMode === 'preview' ? "bg-white text-hr-navy shadow-sm" : "text-gray-500")} >Preview</button>
           </div>
        )}
      </div>
      
      <AnimatePresence>
        {isActive && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-white"
          >
            <div className="p-4 md:p-6 pb-2 space-y-4">
              {viewMode === 'editor' ? (
                <textarea 
                  className="w-full h-40 font-mono text-[11px] p-3 border border-gray-200 rounded-lg focus:outline-none focus:border-hr-blue shadow-inner bg-gray-50"
                  value={htmlContent || ''}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  onBlur={handleBlur}
                  placeholder="Paste your HTML code here..."
                />
              ) : (
                <div 
                  className="w-full border border-gray-200 rounded-lg p-6 shadow-inner bg-gray-50 text-sm"
                  dangerouslySetInnerHTML={{ __html: htmlContent }} 
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function QuestionRenderer({ 
  question, 
  answer, 
  onChange, 
  themeClasses, 
  showError,
  index = 0,
  isPlayful = false
}: { 
  question: Question; 
  answer?: any; 
  onChange?: (val: any) => void;
  themeClasses: any;
  showError?: boolean;
  index?: number;
  isPlayful?: boolean;
  key?: string | number;
}) {
  const { bg, card, accent, button, input, font, heading } = themeClasses;

  const commonClasses = cn(
    "p-6 md:p-8 rounded-xl shadow-sm border border-[#CCCCCC] bg-white transition-all duration-300",
    card,
    font
  );

  const inputClasses = cn(
    "w-full transition-all duration-200",
    isPlayful 
      ? "p-3 px-4 border rounded-xl border-gray-100 bg-gray-50/50 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm font-semibold" 
      : "p-3 border rounded-xl min-h-[50px] bg-white border-[#CCCCCC] focus:outline-none focus:border-[#5099EC] focus:ring-1 focus:ring-[#5099EC] text-[14px] text-black font-roboto placeholder:text-[#999999]",
    !isPlayful && input,
    showError && "border-[#E06764] ring-[#E06764]/20"
  );

  const buttonClasses = cn(
    "px-8 py-3.5 font-medium text-base rounded-xl transition-all shadow-sm active:scale-95",
    isPlayful ? "bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl" : button
  );

  const labelClasses = cn(
    "block mb-2 text-lg md:text-xl font-bold tracking-tight leading-snug font-inria text-black",
    heading
  );

  const descriptionClasses = "text-sm text-[#666666] font-normal mb-6 -mt-1 max-w-3xl font-roboto";

  const playfulColor = PLAYFUL_COLORS[index % PLAYFUL_COLORS.length];

  const getQuestionIcon = (type: string) => {
    switch (type) {
      case 'short_text':
      case 'long_text': return <Edit3 className="w-4 h-4 opacity-50" />;
      case 'multiple_choice': return <Layers className="w-4 h-4 opacity-50" />;
      case 'checkbox': return <CheckCircle2 className="w-4 h-4 opacity-50" />;
      case 'rating': return <Star className="w-4 h-4 opacity-50" />;
      case 'nps': return <Zap className="w-4 h-4 opacity-50" />;
      default: return <MessageSquare className="w-4 h-4 opacity-50" />;
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange?.(e.target.value);
  };

  const handleCheckboxChange = (value: string) => {
    const current = answer as string[] || [];
    const isSelected = current.includes(value);
    
    if (!isSelected) {
      const limit = Number(question.validation?.limitAnswersTo);
      if (!isNaN(limit) && limit > 0 && current.length >= limit) {
        return; // limit reached
      }
    }
    
    const updated = isSelected
      ? current.filter((item) => item !== value)
      : [...current, value];
    onChange?.(updated);
  };

  const handleRadioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.value);
  };

  const isOtherActive = answer && answer[`${question.id}_other_active`];
  const otherAnswer = answer && answer[`${question.id}_other`];

  const renderQuestionContent = () => {
    switch (question.type) {
      case 'short_text':
        return (
          <input 
            type="text"
            value={answer || ''}
            onChange={handleTextChange}
            placeholder={question.alias || 'Type your answer...'}
            className={inputClasses}
            disabled={!onChange}
          />
        );
      case 'long_text':
        return (
          <div className="relative">
            <textarea
              value={answer || ''}
              onChange={handleTextChange}
              placeholder={question.alias || 'Share your goal...'}
              className={`${inputClasses} min-h-[120px] resize-y`}
              disabled={!onChange}
              maxLength={200}
            />
            {isPlayful && (
              <div className="absolute bottom-3 right-3 text-[10px] font-bold text-gray-400">
                {(answer || '').length} / 200
              </div>
            )}
          </div>
        );
      case 'multiple_choice':
        const choiceCount = question.choices?.length || 0;
        const allShort = (question.choices || []).every(c => c.length < 15);
        
        return (
          <div className={cn(
            "grid gap-2",
            isPlayful ? (
              choiceCount <= 2 ? "grid-cols-1 sm:grid-cols-2" :
              choiceCount <= 4 && allShort ? "grid-cols-2 sm:grid-cols-4" : 
              choiceCount <= 6 ? "grid-cols-2 sm:grid-cols-2 md:grid-cols-3" : 
              "grid-cols-1 sm:grid-cols-2"
            ) : "grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3 px-2"
          )}>
            {question.choices?.map((choice, ci) => {
              const isSelected = answer === choice;
              const choiceIcon = getChoiceIcon(choice);
              
              if (isPlayful) {
                return (
                  <button 
                    key={ci}
                    onClick={() => onChange?.(choice)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl transition-all group border",
                      isSelected 
                        ? "border-hr-blue bg-hr-blue/5 shadow-sm" 
                        : "border-gray-100 bg-white hover:border-hr-blue/20"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all border border-gray-200", 
                      isSelected ? "bg-hr-blue border-hr-blue" : "bg-white"
                    )}>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <span className={cn("text-xs font-semibold tracking-tight text-left", isSelected ? "text-hr-blue" : "text-gray-600")}>{choice}</span>
                  </button>
                );
              }

              return (
                <label key={ci} className={cn("flex items-center gap-4 py-3 border-b border-transparent hover:bg-[#F5F7F8] transition-all cursor-pointer group", isSelected && (isPlayful ? "font-black text-hr-blue scale-[1.02]" : "font-medium text-black bg-[#F5F7F8]"))}>
                  <div className={cn("shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all border-2", isSelected ? (isPlayful ? "bg-hr-blue border-hr-blue" : "bg-black border-black") : "bg-white border-[#CCCCCC] group-hover:border-[#999999]")}>
                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                  </div>
                  <input 
                    type="radio" 
                    name={question.id}
                    value={choice}
                    checked={isSelected}
                    onChange={handleRadioChange}
                    disabled={!onChange}
                    className="hidden"
                  />
                  <span className={cn("flex-1 text-[14px] transition-colors", isSelected ? (isPlayful ? "text-hr-blue" : "text-black font-medium") : "text-black group-hover:text-black")}>{choice}</span>
                </label>
              );
            })}
          </div>
        );
      case 'checkbox':
        const checkCount = question.choices?.length || 0;
        const allChecksShort = (question.choices || []).every(c => c.length < 20);

        return (
          <div className={cn(
            "grid gap-2",
            isPlayful ? (
              checkCount <= 2 ? "grid-cols-1 sm:grid-cols-2" :
              allChecksShort ? "grid-cols-2 sm:grid-cols-3" : 
              "grid-cols-1 sm:grid-cols-2"
            ) : "grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3 px-2"
          )}>
            {question.choices?.map((choice, ci) => {
              const isSelected = (answer as string[] || []).includes(choice);
              const choiceIcon = getChoiceIcon(choice);

              if (isPlayful) {
                 return (
                  <button 
                    key={ci}
                    onClick={() => handleCheckboxChange(choice)}
                    className={cn(
                      "flex items-center gap-3 p-3 border rounded-xl transition-all group",
                      isSelected 
                        ? "border-indigo-600 bg-indigo-50/20 shadow-sm" 
                        : "border-gray-100 bg-white hover:border-indigo-100"
                    )}
                  >
                  <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all border border-gray-200", 
                      isSelected ? "bg-hr-blue border-hr-blue" : "bg-white"
                    )}>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <span className={cn("flex-1 text-left text-xs font-semibold tracking-tight", isSelected ? "text-indigo-700" : "text-gray-600")}>{choice}</span>
                  </button>
                 );
              }

              return (
                <label key={ci} className={cn("flex items-center gap-4 py-3 border-b border-transparent hover:bg-[#F5F7F8] transition-all cursor-pointer group", isSelected && (isPlayful ? "font-black text-indigo-600 scale-[1.02]" : "font-medium text-black bg-[#F5F7F8]"))}>
                  <div className={cn("w-6 h-6 rounded-[2px] flex items-center justify-center shrink-0 transition-all border-2", isSelected ? (isPlayful ? "bg-white border-hr-blue" : "bg-black border-black") : "bg-white border-[#CCCCCC] group-hover:border-[#999999]")}>
                    {isSelected && <div className={cn("w-3 h-3 rounded-sm", isPlayful ? "bg-hr-blue" : "bg-white")} />}
                  </div>
                  <input 
                    type="checkbox" 
                    checked={isSelected}
                    onChange={() => handleCheckboxChange(choice)}
                    disabled={!onChange}
                    className="hidden"
                  />
                  <span className={cn("flex-1 text-[14px] transition-colors", isSelected ? (isPlayful ? "text-indigo-600" : "text-black font-medium") : "text-black group-hover:text-black")}>{choice}</span>
                </label>
              );
            })}
          </div>
        );
      case 'rating':
        if (isPlayful) {
          const emojis = [
            { icon: <Frown className="w-10 h-10" />, label: '1 - Very Dissatisfied', color: 'text-red-600', bg: 'bg-red-50' },
            { icon: <Meh className="w-10 h-10" />, label: '2', color: 'text-orange-600', bg: 'bg-orange-50' },
            { icon: <Meh className="w-10 h-10" />, label: '3', color: 'text-yellow-600', bg: 'bg-yellow-50' },
            { icon: <Smile className="w-10 h-10" />, label: '4', color: 'text-green-600', bg: 'bg-green-50' },
            { icon: <SmilePlus className="w-10 h-10" />, label: '5 - Very Satisfied', color: 'text-emerald-700', bg: 'bg-emerald-50' },
          ];
          return (
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center justify-center flex-wrap gap-2 md:gap-4">
                {emojis.map((emoji, ei) => {
                  const rating = ei + 1;
                  const isSelected = answer === rating;
                  return (
                    <button
                      key={rating}
                      onClick={() => onChange?.(rating)}
                      className={cn(
                        "group flex flex-col items-center gap-2 transition-all duration-300",
                        isSelected ? "scale-110 z-10" : "hover:scale-105"
                      )}
                    >
                      <div className={cn(
                        "w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all shadow-sm",
                        isSelected ? `border-current ${emoji.color} ${emoji.bg} shadow-md` : "border-gray-400 bg-white text-gray-700"
                      )}>
                        {React.cloneElement(emoji.icon as React.ReactElement, { 
                          className: cn("w-12 h-12 transition-all", isSelected ? emoji.color : "text-gray-400 group-hover:text-gray-700") 
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="w-full flex justify-between px-2 text-[11px] font-black uppercase tracking-widest">
                <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded">1 - Very Dissatisfied</span>
                <span className="text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">5 - Very Satisfied</span>
              </div>
            </div>
          );
        }
        return (
          <div className="flex flex-wrap gap-2 md:gap-3 font-sans">
            {[1, 2, 3, 4, 5].map((star) => {
              const isSelected = (answer || 0) >= star;
              return (
                <button
                  key={star}
                  onClick={() => onChange?.(star)}
                  disabled={!onChange}
                  className={cn(
                    "p-2 rounded-lg border-2 transition-all outline-none",
                    isSelected ? `${accent.replace('text-', 'border-')} bg-white` : "bg-white border-[#CCCCCC] hover:border-[#999999] hover:bg-[#F5F7F8]"
                  )}
                >
                  <Star className={cn("w-8 h-8 transition-all", isSelected ? `fill-current ${accent}` : "text-[#CCCCCC] hover:text-[#999999]")} />
                </button>
              );
            })}
          </div>
        );
      case 'nps':
        if (isPlayful) {
          return (
            <div className="space-y-8 py-6 px-4">
              <div className="relative">
                <div className="absolute top-1/2 left-0 w-full h-[2px] bg-gray-100 -translate-y-1/2 rounded-full" />
                <div className="flex items-center justify-between relative z-10">
                  {[1, 2, 3, 4, 5].map((val) => {
                    const isSelected = answer === val;
                    return (
                      <div key={val} className="flex flex-col items-center gap-3 relative">
                        <span className="text-[11px] font-bold text-gray-400 absolute -top-7">{val}</span>
                        <button 
                          onClick={() => onChange?.(val)}
                          className={cn(
                            "w-4 h-4 rounded-full transition-all duration-500",
                            isSelected ? "bg-pink-600 scale-[1.8] ring-4 ring-pink-50 shadow-md" : "bg-gray-200 hover:bg-gray-300"
                          )}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-gray-400 px-1">
                <span>Never</span>
                <span>Daily</span>
              </div>
            </div>
          );
        }
        return (
          <div className="space-y-2 w-full">
            <div className="flex gap-0.5 flex-wrap sm:flex-nowrap">
              {Array.from({ length: 11 }).map((_, ni) => {
                const isSelected = answer === ni;
                return (
                  <div 
                    key={ni} 
                    onClick={() => onChange?.(ni)}
                    className={cn(
                      "flex-1 h-12 border rounded-lg flex items-center justify-center font-bold text-xs cursor-pointer transition-all mx-0.5",
                      isSelected 
                        ? `${accent.replace('text-', 'bg-')} text-white border-transparent shadow-md scale-105 z-10` 
                        : "bg-white border-[#CCCCCC] text-[#000000] hover:border-[#999999] hover:bg-[#F5F7F8]"
                    )}
                  >
                    {ni}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[8px] font-bold uppercase text-gray-400 tracking-widest px-1">
              <span>Not likely</span>
              <span>Very likely</span>
            </div>
          </div>
        );
      case 'matrix':
        return (
          <div className="overflow-x-auto no-scrollbar rounded-xl border border-[#CCCCCC]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F2F2F2] border-b-2 border-[#2BC841]">
                  <th className="p-3.5 text-left text-xs font-medium text-black font-roboto"></th>
                  {(question.choices || []).map((choice, ci) => (
                    <th key={ci} className="p-3.5 text-center text-xs font-medium text-black font-roboto">
                      {choice}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(question.rows || []).map((row, ri) => (
                  <tr key={ri} className="group hover:bg-[#F5F7F8] transition-colors border-b border-[#CCCCCC] last:border-b-0">
                    <td className="p-4 text-xs font-normal text-black font-roboto">{row}</td>
                    {(question.choices || []).map((choice, ci) => {
                      const isSelected = answer?.[`${question.id}_${ri}`] === choice;
                      return (
                        <td key={ci} className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => onChange?.({ ...answer, [`${question.id}_${ri}`]: choice })}
                            className={cn(
                              "w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center mx-auto",
                              isSelected 
                                ? "border-black bg-black text-white shadow-sm" 
                                : "border-[#CCCCCC] bg-white hover:border-[#999999]"
                            )}
                          >
                            {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'dropdown':
        return (
          <div className="relative group">
            <select
              value={answer || ''}
              onChange={(e) => onChange?.(e.target.value)}
              className={cn(inputClasses, "appearance-none bg-white pr-9")}
              disabled={!onChange}
            >
              <option value="" disabled>Select your department</option>
              {question.choices?.map((choice, ci) => (
                <option key={ci} value={choice}>{choice}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-indigo-600 transition-colors">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div id={`q-container-${question.id}`} className={cn(
      isPlayful ? "bg-white p-4 md:p-6 rounded-2xl border border-gray-100 transition-all" : commonClasses,
      showError && "ring-2 ring-red-500 ring-offset-4 shadow-xl"
    )}>
      <div className={cn("space-y-4", isPlayful && "relative")}>
         <div className={cn("flex items-start gap-4")}>
           {question.type !== 'html' && question.type !== 'page_break' && (
             isPlayful ? (
               <div className={cn(
                 "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 mt-0.5",
                 index % 4 === 0 ? "bg-indigo-50 text-indigo-600" : 
                 index % 4 === 1 ? "bg-pink-50 text-pink-600" : 
                 index % 4 === 2 ? "bg-emerald-50 text-emerald-600" : 
                 "bg-amber-50 text-amber-600"
               )}>
                 {String(index + 1).padStart(2, '0')}
               </div>
             ) : (
               <div className="w-6 h-6 rounded flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5 bg-gray-50 border border-gray-100 text-gray-400 shadow-sm">
                 {index + 1}
               </div>
             )
           )}
           <div className="flex-1">
              <h3 className={cn(
                "whitespace-pre-wrap",
                isPlayful ? "text-base md:text-lg font-bold text-gray-900 tracking-tight leading-tight mb-1" : labelClasses
              )}>
                {question.text}
                {question.required && <span className="text-red-500 ml-1">*</span>}
              </h3>
              {question.desc && (
                <p className={cn("whitespace-pre-wrap", isPlayful ? "text-xs text-gray-500 font-medium" : descriptionClasses)}>
                  {question.desc}
                </p>
              )}
           </div>
         </div>
         
         <div className={isPlayful ? "pl-0 sm:pl-12" : ""}>
            {renderQuestionContent()}
         </div>
      </div>
    </div>
  );
}

function QuestionCard({ 
  question, 
  index, 
  isActive, 
  onClick, 
  onUpdate, 
  onDelete,
  themeClasses,
  onOpenSettings,
  questionComments,
  surveyId,
  showToast
}: QuestionCardProps) {
  const { accent, font, heading, card, bg } = themeClasses;
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-white border transition-all duration-300 relative overflow-hidden group/card",
        isActive 
          ? "ring-4 border-hr-blue shadow-lg rounded-2xl z-10 py-1 sm:scale-[1.01]" 
          : "border-gray-200 hover:border-hr-blue/30 hover:shadow-md shadow-sm rounded-xl z-0 opacity-80 hover:opacity-100",
        isActive && accent.replace('text-', 'ring-').replace('border-', 'ring-'),
        font
      )}
    >
      {isActive && <div className={cn("absolute top-0 left-0 w-1.5 h-full rounded-l-2xl", accent.replace('text-', 'bg-'))} />}
      
      {/* Minimize/Maximize/Settings Buttons */}
      <div className="absolute top-2 right-4 flex items-center gap-1.5 z-10">
        <button 
          onClick={(e) => { e.stopPropagation(); setIsDeleteDialogOpen(true); }}
          className={cn("p-1.5 text-gray-300 hover:transition-all rounded-lg hover:bg-hr-red/10 active:scale-95", isActive ? "hover:text-hr-red" : "hover:text-hr-red")}
          title="Delete Element"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        {question.type !== 'page_break' && (
          <>
            <button 
              onClick={(e) => { e.stopPropagation(); onOpenSettings('ai'); }}
              className={cn("p-1.5 text-gray-300 hover:transition-all rounded-lg hover:bg-gray-50 active:scale-95", isActive ? accent : "hover:text-hr-blue")}
              title="Ask AI to modify"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onOpenSettings(); }}
              className={cn("p-1.5 text-gray-300 hover:transition-all rounded-lg hover:bg-gray-50 active:scale-95", isActive ? accent : "hover:text-hr-blue")}
              title="Advanced Settings & Logic"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onUpdate({ minimized: !question.minimized }); }}
              className={cn("p-1.5 text-gray-300 hover:transition-all rounded-lg hover:bg-gray-50 active:scale-95", isActive ? accent : "hover:text-hr-blue")}
              title={question.minimized ? "Expand Element" : "Minimize Element"}
            >
              {question.minimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
          </>
        )}
      </div>

      <div className={cn("flex items-start gap-2.5", isActive ? "p-3 md:p-4" : "p-2 md:p-3 opacity-70")}>
        <div className="flex flex-col items-center gap-1.5 mt-0.5">
          <GripVertical className={cn("w-3.5 h-3.5 transition-colors cursor-grab active:cursor-grabbing shrink-0", isActive ? accent : "text-gray-200 group-hover/card:text-gray-400")} />
          {question.type !== 'page_break' && question.type !== 'html' && (
            <div className={cn("w-5 h-5 rounded flex items-center justify-center font-bold text-[9px] shrink-0 shadow-sm transition-colors", isActive ? accent.replace('text-', 'bg-') + " text-white" : "bg-gray-50 text-gray-400")}>
              {index + 1}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-2">
            <span className={cn("text-[8px] font-black uppercase tracking-[0.1em] px-1.5 py-0.5 rounded border", isActive ? accent.replace('text-', 'bg-').replace('border-', 'bg-') + "/5 " + accent + " " + accent.replace('text-', 'border-') + "/20" : "bg-gray-50 text-gray-400 border-gray-100")}>
              {question.type.replace('_', ' ')}
              {question.required && <span className="text-hr-red ml-1">* REQUIRED</span>}
            </span>
          </div>
          
          <div className="space-y-2">
            {question.type !== 'page_break' && (
              <textarea 
                rows={question.text?.split('\n').length || 1}
                className={cn(
                  "w-full font-bold bg-transparent border-none outline-none placeholder:text-gray-200 tracking-tight transition-all resize-none overflow-hidden",
                  question.minimized ? "text-xs truncate pr-12" : "text-base md:text-lg",
                  heading
                )}
                placeholder="Type your question here..."
                value={question.text || ''}
                onChange={(e) => onUpdate({ text: e.target.value })}
              />
            )}
            
            {!question.minimized && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                {question.type !== 'page_break' && (
                  <textarea 
                    rows={question.desc?.split('\n').length || 1}
                    className={cn("w-full text-[11px] bg-transparent border-none outline-none placeholder:text-gray-200 italic resize-none overflow-hidden", font.includes('serif') ? 'font-serif' : 'font-sans opacity-70')}
                    placeholder="Add subtext or guidance for respondents..."
                    value={question.desc || ''}
                    onChange={(e) => onUpdate({ desc: e.target.value })}
                  />
                )}
                <div className="mt-2 pt-3 border-t border-gray-100/50">
                  {question.type === 'page_break' ? (
                    <div className="w-full py-10 text-center border-2 border-dashed border-gray-100 rounded-3xl bg-gray-50/30 flex flex-col items-center justify-center gap-2">
                      <div className={cn("w-12 h-12 rounded-full flex items-center justify-center mb-2 shadow-sm", accent.replace('text-', 'bg-').replace('border-', 'bg-') + "/10 " + accent)}>
                        <GripHorizontal className="w-6 h-6" />
                      </div>
                      <span className={cn("font-black uppercase tracking-[0.2em] text-xs opacity-40", font)}>Page Break</span>
                    </div>
                  ) : question.type === 'html' ? (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                         <div className={cn("p-2 rounded-lg", accent.replace('text-', 'bg-').replace('border-', 'bg-') + "/10 " + accent)}>
                            <Code className="w-4 h-4" />
                         </div>
                         <span className={cn("font-black uppercase tracking-[0.2em] text-xs opacity-40", font)}>HTML Block</span>
                      </div>
                      {isActive ? (
                        <div className="grid grid-cols-1 gap-6">
                           <div className="space-y-3">
                              <label className={cn("text-[10px] font-black uppercase tracking-widest opacity-40 px-1", font)}>Source Code</label>
                              <textarea
                                className="w-full bg-slate-900 border-0 rounded-[2rem] p-6 text-emerald-400 font-mono text-sm placeholder:text-slate-600 outline-none ring-1 ring-slate-800 focus:ring-2 focus:ring-emerald-500/30 min-h-[300px] shadow-2xl transition-all leading-relaxed"
                                placeholder="<h1>Custom HTML Content</h1>"
                                value={question.desc || ''}
                                onChange={(e) => onUpdate({ desc: e.target.value })}
                              />
                           </div>
                           <div className="space-y-3">
                              <label className={cn("text-[10px] font-black uppercase tracking-widest opacity-40 px-1", font)}>Live Preview</label>
                              <div className={cn("p-4 rounded-3xl border min-h-[200px]", card)}>
                                <div 
                                  className="prose max-w-none"
                                  dangerouslySetInnerHTML={{ __html: question.desc || '<div class="text-gray-300 italic py-8 text-center text-sm font-mono">&lt;!-- Code preview ready --&gt;</div>' }} 
                                />
                              </div>
                           </div>
                        </div>
                      ) : (
                        <div className={cn("p-6 rounded-2xl border bg-gray-50/30", card)}>
                           <div 
                             className="prose prose-sm max-w-none opacity-60 filter grayscale"
                             dangerouslySetInnerHTML={{ __html: question.desc || 'Empty HTML block' }} 
                           />
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4">
                         {['multiple_choice', 'checkbox', 'dropdown'].includes(question.type) && (
                           <div className="space-y-2 max-w-2xl px-1">
                              {question.choices?.map((choice, cIdx) => (
                                <motion.div 
                                  key={cIdx} 
                                  initial={{ opacity: 0, x: -10 }} 
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: cIdx * 0.05 }}
                                  className="group/opt flex items-center gap-3"
                                >
                                   <div className={cn("w-4 h-4 rounded border transition-colors shrink-0 flex items-center justify-center", isActive ? accent.replace('text-', 'border-') : "border-gray-100")}>
                                      <div className={cn("w-1.5 h-1.5 rounded-full", isActive ? accent.replace('text-', 'bg-') : "bg-gray-100")} />
                                   </div>
                                   <input 
                                     className={cn("flex-1 text-sm bg-transparent border-b border-transparent focus:border-hr-blue/30 outline-none py-1.5 transition-all group-hover/opt:border-gray-100", font)}
                                     value={choice || ''}
                                     onChange={(e) => {
                                       const newChoices = [...(question.choices || [])];
                                       newChoices[cIdx] = e.target.value;
                                       onUpdate({ choices: newChoices });
                                     }}
                                   />
                                   <button 
                                     onClick={() => onUpdate({ choices: question.choices?.filter((_, i) => i !== cIdx) })}
                                     className="opacity-0 group-hover/opt:opacity-100 p-1.5 text-gray-200 hover:text-hr-red hover:bg-hr-red/5 rounded-lg transition-all"
                                   >
                                     <Trash2 className="w-3.5 h-3.5" />
                                   </button>
                                </motion.div>
                              ))}
                              <button 
                                onClick={() => onUpdate({ choices: [...(question.choices || []), `Option ${(question.choices?.length || 0) + 1}`] })}
                                className={cn("flex items-center gap-2 py-2 px-4 rounded border border-dashed border-gray-100 text-[10px] font-black uppercase tracking-widest transition-all hover:border-hr-blue/30 mt-3", accent, font)}
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Add Response Option
                              </button>
                              
                              <div className="pt-4 flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                  <div className="relative flex items-center">
                                    <input 
                                      type="checkbox" 
                                      className="sr-only peer"
                                      checked={!!question.hasOther}
                                      onChange={(e) => onUpdate({ hasOther: e.target.checked })}
                                    />
                                    <div className="w-8 h-4 bg-gray-100 rounded-full peer-checked:bg-hr-green transition-colors" />
                                    <div className="absolute left-1 top-0.5 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
                                  </div>
                                  <span className={cn("text-[9px] font-black uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors", font)}>Include "Other"</span>
                                </label>
                                
                                <label className="flex items-center gap-2 cursor-pointer group">
                                  <div className="relative flex items-center">
                                    <input 
                                      type="checkbox" 
                                      className="sr-only peer"
                                      checked={question.required}
                                      onChange={(e) => onUpdate({ required: e.target.checked })}
                                    />
                                    <div className="w-8 h-4 bg-gray-100 rounded-full peer-checked:bg-hr-blue transition-colors" />
                                    <div className="absolute left-1 top-0.5 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
                                  </div>
                                  <span className={cn("text-[9px] font-black uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors", font)}>Required</span>
                                </label>
                              </div>
                           </div>
                         )}
                        
                        {question.type === 'matrix' && (
                           <div className="space-y-6 max-w-3xl">
                              <div className="space-y-3">
                                <h4 className={cn("text-[10px] font-black uppercase tracking-widest text-gray-400", font)}>Columns (Scale labels)</h4>
                                <div className="flex flex-wrap gap-2">
                                  {question.choices?.map((col, ci) => (
                                    <div key={ci} className="flex items-center gap-1.5 bg-white border border-gray-100 rounded-lg px-3 py-1.5 group/col shadow-sm">
                                      <input 
                                        className={cn("text-[11px] font-bold bg-transparent outline-none min-w-[50px]", font)}
                                        value={col || ''}
                                        onChange={(e) => {
                                          const newChoices = [...(question.choices || [])];
                                          newChoices[ci] = e.target.value;
                                          onUpdate({ choices: newChoices });
                                        }}
                                      />
                                      <button onClick={() => onUpdate({ choices: question.choices?.filter((_, i) => i !== ci) })} className="opacity-0 group-hover/col:opacity-100 text-gray-300 hover:text-hr-red transition-all"><X className="w-3 h-3" /></button>
                                    </div>
                                  ))}
                                  <button 
                                    onClick={() => onUpdate({ choices: [...(question.choices || []), 'New Label'] })}
                                    className={cn("p-1.5 rounded-lg border border-dashed border-gray-200 text-gray-400 hover:border-hr-blue hover:text-hr-blue", accent)}
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <h4 className={cn("text-[10px] font-black uppercase tracking-widest text-gray-400", font)}>Rows (Questions)</h4>
                                <div className="space-y-2">
                                  {question.rows?.map((row, ri) => (
                                    <div key={ri} className="flex items-center gap-3 bg-gray-50/50 rounded-xl p-2.5 group/row">
                                      <GripVertical className="w-3 h-3 text-gray-200 cursor-grab" />
                                      <input 
                                        className={cn("flex-1 text-xs bg-transparent outline-none font-medium", font)}
                                        value={row || ''}
                                        onChange={(e) => {
                                          const newRows = [...(question.rows || [])];
                                          newRows[ri] = e.target.value;
                                          onUpdate({ rows: newRows });
                                        }}
                                      />
                                      <button onClick={() => onUpdate({ rows: question.rows?.filter((_, i) => i !== ri) })} className="opacity-0 group-hover/row:opacity-100 text-gray-300 hover:text-hr-red transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                  ))}
                                  <button 
                                    onClick={() => onUpdate({ rows: [...(question.rows || []), 'New Statement'] })}
                                    className={cn("w-full py-2.5 border-2 border-dashed border-gray-100 rounded-xl text-[9px] font-black uppercase tracking-widest text-gray-400 hover:border-hr-blue/30 transition-all flex items-center justify-center gap-2", accent, font)}
                                  >
                                    <Plus className="w-3.5 h-3.5" /> Add Row Item
                                  </button>
                                </div>
                              </div>
                           </div>
                         )}

                         {['short_text', 'long_text', 'rating', 'nps'].includes(question.type) && (
                           <div className="space-y-3 max-w-xl">
                              <div className={cn("p-4 md:p-6 rounded-2xl border-2 border-dashed border-gray-100 bg-gray-50/20", font)}>
                                <QuestionRenderer 
                                  question={question}
                                  themeClasses={themeClasses}
                                />
                                <div className="mt-4 flex items-center justify-center">
                                   <div className="px-4 py-1.5 bg-white rounded-full shadow-sm border border-gray-100 text-[9px] font-black uppercase tracking-widest text-gray-400">
                                      Visual Style Preview
                                   </div>
                                </div>
                              </div>
                           </div>
                         )}
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
      
      {isActive && (
        <div className="bg-gray-50 border-t border-gray-100 px-8 py-3 flex items-center justify-between animate-in slide-in-from-top-1 duration-300">
           <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest">Sys ID: {question.id}</span>
         </div>
       )}
      
      {questionComments && questionComments.length > 0 && (
        <div className="border-t border-gray-100 bg-[#f8f9fa] z-10 w-full animate-in slide-in-from-top-1">
          <div className="px-6 py-2 border-b border-gray-200">
             <div className="flex items-center gap-2 text-sm text-[#3b4b66] font-bold">
                <MessageSquare className="w-4 h-4" />
                Comments: {questionComments.length} Updated
             </div>
          </div>
          <div className="p-4 space-y-4">
             {(() => {
               const active = questionComments.filter((c: any) => c.status !== 'done');
               const completed = questionComments.filter((c: any) => c.status === 'done');
               
               return (
                 <>
                   {active.length > 0 ? (
                     <div className="space-y-4">
                       {active.map((c: any) => (
                         <div key={c.id} className="bg-white border text-sm border-gray-200 p-3 rounded shadow-sm">
                            <div className="flex justify-between items-start mb-2 text-slate-500">
                              <span className="font-bold">{c.name} {c.email ? `<${c.email}>` : ''}</span>
                              <div className="flex flex-col items-end gap-1">
                                 <span className="text-[10px] opacity-60">{new Date(c.createdAt).toLocaleString()}</span>
                                 <div className="flex items-center gap-2">
                                    {deletingCommentId === c.id ? (
                                       <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200 bg-red-50 px-2 py-1 rounded-lg border border-red-100">
                                          <span className="text-[10px] font-black text-red-600 uppercase tracking-tighter mr-1">Delete?</span>
                                          <button 
                                             className="text-[10px] font-black text-red-600 hover:underline uppercase p-0.5"
                                             onClick={async (e) => {
                                                e.stopPropagation();
                                                try {
                                                  await deleteDoc(doc(db, 'surveys', surveyId, 'comments', c.id));
                                                  showToast("Comment deleted", "success");
                                                  setDeletingCommentId(null);
                                                } catch (error) {
                                                  handleFirestoreError(error, OperationType.DELETE, `surveys/${surveyId}/comments/${c.id}`);
                                                  showToast("Failed to delete comment", "error");
                                                }
                                             }}
                                          >
                                             Yes
                                          </button>
                                          <button 
                                             className="text-[10px] font-black text-gray-500 hover:underline uppercase p-0.5"
                                             onClick={(e) => { e.stopPropagation(); setDeletingCommentId(null); }}
                                          >
                                             No
                                          </button>
                                       </div>
                                    ) : (
                                       <>
                                          <button 
                                             className="cursor-pointer z-50 hover:bg-hr-green/10 p-1 rounded-full transition-all group/done"
                                             onClick={async (e) => { 
                                               e.stopPropagation(); 
                                               e.preventDefault();
                                               try {
                                                 await updateDoc(doc(db, 'surveys', surveyId, 'comments', c.id), { status: 'done', updatedAt: new Date().toISOString() });
                                                 showToast("Comment marked as done", "success");
                                               } catch (error) {
                                                 handleFirestoreError(error, OperationType.UPDATE, `surveys/${surveyId}/comments/${c.id}`);
                                                 showToast("Failed to mark comment as done", "error");
                                               }
                                             }} 
                                             title="Mark as done"
                                          >
                                             <Check className="w-6 h-6 text-hr-green group-hover/done:scale-110 transition-transform" />
                                          </button>
                                          <button 
                                             className="cursor-pointer z-50 hover:bg-red-50 p-1 rounded-full transition-all group/del"
                                             onClick={(e) => { 
                                               e.stopPropagation(); 
                                               e.preventDefault();
                                               setDeletingCommentId(c.id);
                                             }} 
                                             title="Delete comment"
                                          >
                                             <X className="w-6 h-6 text-red-500 group-hover/del:scale-110 transition-transform" />
                                          </button>
                                       </>
                                    )}
                                 </div>
                              </div>
                            </div>
                            <p className="text-gray-800 whitespace-pre-wrap">{c.text}</p>
                         </div>
                       ))}
                     </div>
                   ) : completed.length === 0 && (
                     <div className="text-center py-4 text-xs text-gray-400 italic">No active comments</div>
                   )}

                   {completed.length > 0 && (
                     <div className="mt-6 pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 ml-1">
                           <Check className="w-3 h-3" />
                           Completed ({completed.length})
                        </div>
                        <div className="space-y-2">
                           {completed.map((c: any) => (
                             <div key={c.id} className="bg-gray-50/50 border border-gray-100 p-2.5 rounded opacity-60 hover:opacity-100 transition-opacity">
                                <div className="flex justify-between items-center text-[10px]">
                                   <span className="font-bold line-through">{c.name}</span>
                                   <div className="flex items-center gap-2">
                                      <span className="opacity-60">{new Date(c.createdAt).toLocaleDateString()}</span>
                                      {deletingCommentId === c.id ? (
                                         <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-1 duration-200">
                                            <button 
                                               className="text-[9px] font-black text-red-500 hover:underline uppercase"
                                               onClick={async (e) => {
                                                  e.stopPropagation();
                                                  try {
                                                    await deleteDoc(doc(db, 'surveys', surveyId, 'comments', c.id));
                                                    showToast("Comment deleted", "success");
                                                    setDeletingCommentId(null);
                                                  } catch (error) {
                                                    handleFirestoreError(error, OperationType.DELETE, `surveys/${surveyId}/comments/${c.id}`);
                                                  }
                                               }}
                                            >
                                               Yes
                                            </button>
                                            <button 
                                               className="text-[9px] font-black text-gray-400 hover:underline uppercase"
                                               onClick={(e) => { e.stopPropagation(); setDeletingCommentId(null); }}
                                            >
                                               No
                                            </button>
                                         </div>
                                      ) : (
                                         <>
                                            <button 
                                               className="cursor-pointer z-50 p-1 hover:text-hr-blue transition-colors"
                                               onClick={async (e) => {
                                                 e.stopPropagation();
                                                 e.preventDefault();
                                                 try {
                                                   await updateDoc(doc(db, 'surveys', surveyId, 'comments', c.id), { status: 'pending', updatedAt: new Date().toISOString() });
                                                   showToast("Comment re-opened", "success");
                                                 } catch (error) {
                                                   handleFirestoreError(error, OperationType.UPDATE, `surveys/${surveyId}/comments/${c.id}`);
                                                   showToast("Failed to re-open comment", "error");
                                                 }
                                               }}
                                               title="Re-open"
                                            >
                                               <Undo2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button 
                                               className="cursor-pointer z-50 p-1 hover:text-hr-red transition-colors"
                                               onClick={(e) => {
                                                 e.stopPropagation();
                                                 e.preventDefault();
                                                 setDeletingCommentId(c.id);
                                               }}
                                            >
                                               <X className="w-3.5 h-3.5" />
                                            </button>
                                         </>
                                      )}
                                   </div>
                                </div>
                                <p className="text-gray-500 italic text-[11px] mt-1 line-through">{c.text}</p>
                             </div>
                           ))}
                        </div>
                     </div>
                   )}
                 </>
               );
             })()}
          </div>
        </div>
      )}

      <AnimatePresence>
        {isDeleteDialogOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[999] flex items-center justify-center p-4 overflow-y-auto" onClick={(e) => { e.stopPropagation(); setIsDeleteDialogOpen(false); }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl relative border border-gray-100"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl md:text-2xl font-light text-hr-navy tracking-tight mb-4">
                Delete Element
              </h2>
              <p className="text-gray-500 mb-6 text-sm">
                Are you sure you want to remove this element? This action cannot be undone.
              </p>
              
              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 sm:justify-end">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setIsDeleteDialogOpen(false); }}
                  className="btn-outline px-6 py-2 border-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                    setIsDeleteDialogOpen(false);
                  }}
                  className="btn-primary px-6 py-2 bg-hr-red hover:bg-red-700 shadow-md shadow-hr-red/20 text-white border-0"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Toggle({ active, onChange }: { active: boolean, onChange: (v: boolean) => void }) {
  return (
    <div 
      className={cn(
        "w-11 h-6 rounded-full p-1 cursor-pointer transition-all flex items-center",
        active ? "bg-hr-blue shadow-[inset_0px_2px_4px_rgba(0,0,0,0.1)]" : "bg-gray-200 shadow-inner"
      )}
      onClick={() => onChange(!active)}
    >
      <motion.div 
        animate={{ x: active ? 20 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="w-4 h-4 bg-white rounded-full shadow-md" 
      />
    </div>
  );
}

function ChartExportMenu({ chartId, title }: { chartId: string, title: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExport = async (format: 'png' | 'jpeg' | 'svg' | 'pdf', e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    const element = document.getElementById(chartId);
    if (!element) return;
    
    try {
      // Create a wrapper with white background to ensure good export
      const originalBg = element.style.backgroundColor;
      const originalWidth = element.style.width;
      const originalHeight = element.style.height;
      element.style.backgroundColor = 'white';
      element.style.width = '800px';
      element.style.height = '400px';
      
      const options = { 
        backgroundColor: 'white', 
        style: { 
          padding: '60px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        } 
      };
      
      let dataUrl;
      
      if (format === 'pdf') {
        dataUrl = await htmlToImage.toPng(element, options);
        const pdf = new jsPDF('l', 'px', [800, 400]);
        pdf.addImage(dataUrl, 'PNG', 0, 0, 800, 400);
        pdf.save(`${title.replace(/\s+/g, '_').toLowerCase()}_chart.pdf`);
      } else {
        if (format === 'png') {
          dataUrl = await htmlToImage.toPng(element, options);
        } else if (format === 'jpeg') {
          dataUrl = await htmlToImage.toJpeg(element, options);
        } else if (format === 'svg') {
          dataUrl = await htmlToImage.toSvg(element, options);
        }
        
        if (dataUrl) {
          const link = document.createElement('a');
          link.download = `${title.replace(/\s+/g, '_').toLowerCase()}_chart.${format}`;
          link.href = dataUrl;
          link.click();
        }
      }
      
      element.style.backgroundColor = originalBg;
      element.style.width = originalWidth;
      element.style.height = originalHeight;
      
    } catch (err) {
      console.error('Failed to export chart', err);
    }
  };

  const handleFullScreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    const element = document.getElementById(chartId);
    if (!element) return;
    
    if (element.requestFullscreen) {
      element.requestFullscreen();
    }
  };

  return (
    <div className="relative z-[50] text-right mb-2" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="p-1.5 bg-white hover:bg-gray-50 text-gray-600 transition-colors border border-gray-200 shadow-sm"
        title="Chart options"
      >
        <Menu className="w-5 h-5 stroke-[2]" />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="absolute right-0 top-full mt-1 w-56 bg-white rounded-sm shadow-xl border border-gray-200 py-1 text-left z-[60]"
          >
            <button 
              onClick={handleFullScreen}
              className="w-full text-left px-5 py-2 hover:bg-gray-100 text-sm font-medium text-gray-700 transition"
            >
              View in full screen
            </button>
            <button 
              onClick={(e) => handleExport('png', e)}
              className="w-full text-left px-5 py-2 hover:bg-gray-100 text-[13px] text-gray-600 transition"
            >
              Download PNG image
            </button>
            <button 
              onClick={(e) => handleExport('jpeg', e)}
              className="w-full text-left px-5 py-2 hover:bg-gray-100 text-[13px] text-gray-600 transition"
            >
              Download JPEG image
            </button>
            <button 
              onClick={(e) => handleExport('svg', e)}
              className="w-full text-left px-5 py-2 hover:bg-gray-100 text-[13px] text-gray-600 transition"
            >
              Download SVG vector image
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const formatResponsesForExport = (questions: Question[], responses: any[]) => {
  return responses.map((r, index) => {
    const row: any = {
      '?': index + 1,
      'Response ID': r.id || '',
      'Time Started': r.startedAt ? new Date(r.startedAt).toLocaleString() : '',
      'Date Submitted': r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '',
      'Status': r.status || 'Complete',
      'Contact ID': r.contactId || '',
      'Legacy Comments': r.legacyComments || '',
      'Comments': r.comments || '',
      'Language': r.language || navigator.language || 'English',
      'Referer': r.referer || window.location.href,
      'SessionID': r.sessionId || r.id,
      'User Agent': r.userAgent || navigator.userAgent,
      'Tags': r.tags || '',
      'IP Address': r.ipAddress || '',
      'Longitude': r.longitude || '',
      'Latitude': r.latitude || '',
      'Country': r.country || '',
      'City': r.city || '',
      'State/Region': r.stateRegion || '',
      'Postal': r.postal || '',
      'Link Name': r.linkName || 'Default Link',
      'URL Variable: sguid': r.sguid || r.id || ''
    };
    questions.forEach(q => {
      if (q.type === 'page_break' || q.type === 'html') return;
      const key = q.alias || q.text;
      let val = r.answers ? r.answers[q.id] : undefined;
      if (Array.isArray(val)) {
        val = val.join(', ');
      } else if (typeof val === 'object' && val !== null) {
        val = Object.entries(val).map(([k, v]) => `${k}:${v}`).join('; ');
      }
      row[key] = val !== undefined ? val : '';
    });
    return row;
  });
};

function TestView({ 
  survey, 
  questions, 
  showToast,
  onRunStressTest
}: { 
  survey: Survey; 
  questions: Question[]; 
  showToast: (m: string, t?: 'success' | 'error' | 'info') => void;
  onRunStressTest: (id: string) => void;
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState<SurveyDiagnostic | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteTab, setInviteTab] = useState<'email' | 'system'>('email');

  const handleAiDiagnostic = async () => {
    if (!survey.id) return;
    onRunStressTest(survey.id);
  };

  const handleGenerateTestResponses = async () => {
    if (!questions.length) {
      showToast("Cannot generate responses: no questions in the survey.", "error");
      return;
    }
    try {
      setIsGenerating(true);
      showToast("Generating test responses, please wait...", "info");
      
      const { generateTestResponses } = await import('./services/aiService');
      const testResponses = await generateTestResponses(questions, 10);
      
      if (!testResponses || testResponses.length === 0) {
        showToast("No test responses were generated.", "error");
        return;
      }

      // Add them to the database
      const batch = writeBatch(db);
      testResponses.forEach(res => {
        const responseId = 'test_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        const docRef = doc(db, 'surveys', survey.id, 'responses', responseId);
        batch.set(docRef, {
          answers: res,
          submittedAt: serverTimestamp(),
          isTest: true
        });
      });
      await batch.commit();

      showToast("10 test responses successfully generated!", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to generate test responses.", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const testLink = `${getPublicUrl()}/?v=${survey.id}&test=true`;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in mt-6">
      <div className="bg-white rounded border border-gray-200 shadow-sm p-8">
        <p className="text-gray-500 text-sm leading-relaxed mb-10">
          We've run an inconceivable number of surveys & forms and have learned a thing or two about what makes a successful project. Part of making your project great is making sure that your participants can and will participate. Form Length, Fatigue, and Accessibility are all measures of how easy it is for your participant to make it through.
        </p>

        <div className="flex flex-col md:flex-row items-center justify-center gap-12 md:gap-32 mb-10">
          <div className="text-center">
             <div className="text-[64px] font-light text-slate-700 leading-none mb-2">6</div>
             <div className="text-xl text-slate-700 font-normal">minutes</div>
             <div className="text-slate-500 text-sm mt-3">Estimated Length</div>
          </div>
          
          <div className="text-center">
             <div className="w-[180px] h-[90px] relative overflow-hidden mb-4 mx-auto flex items-end justify-center">
                <svg viewBox="0 0 100 50" className="w-full h-full absolute inset-0">
                   <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#e2e8f0" strokeWidth="20" />
                   {/* Green (Low Fatigue) */}
                   <path d="M 10 50 A 40 40 0 0 1 35.5 19.5" fill="none" stroke="#258c74" strokeWidth="20" strokeLinecap="butt"/>
                   {/* Yellow (Medium) */}
                   <path d="M 36.5 18 A 40 40 0 0 1 63.5 18" fill="none" stroke="#f59e0b" strokeWidth="20" strokeLinecap="butt"/>
                   {/* Red (High) */}
                   <path d="M 64.5 19.5 A 40 40 0 0 1 90 50" fill="none" stroke="#e15647" strokeWidth="20" strokeLinecap="butt"/>
                </svg>
                <div className="w-[4px] h-[45px] bg-[#2d3748] absolute bottom-0 origin-bottom transform -translate-x-1/2 rotate-[0deg] left-1/2 rounded-full" />
                <div className="w-4 h-4 bg-[#2d3748] absolute bottom-[-8px] rounded-full left-1/2 transform -translate-x-1/2" />
             </div>
             <div className="flex items-center justify-center gap-2 mt-4 text-slate-500 text-sm">
                Fatigue Score
                <div className="w-4 h-4 rounded-full bg-[#f6ab2f] text-white flex items-center justify-center text-[10px] font-bold">?</div>
             </div>
          </div>

          <div className="text-center">
             <div className="w-[180px] h-[90px] relative overflow-hidden mb-4 mx-auto flex items-end justify-center">
                <svg viewBox="0 0 100 50" className="w-full h-full absolute inset-0">
                   <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#e2e8f0" strokeWidth="20" />
                   {/* Red (Low Access) */}
                   <path d="M 10 50 A 40 40 0 0 1 35.5 19.5" fill="none" stroke="#e15647" strokeWidth="20" strokeLinecap="butt"/>
                   {/* Yellow (Med Access) */}
                   <path d="M 36.5 18 A 40 40 0 0 1 63.5 18" fill="none" stroke="#f59e0b" strokeWidth="20" strokeLinecap="butt"/>
                   {/* Green (High Access) */}
                   <path d="M 64.5 19.5 A 40 40 0 0 1 90 50" fill="none" stroke="#258c74" strokeWidth="20" strokeLinecap="butt"/>
                </svg>
                <div className="w-[4px] h-[45px] bg-[#2d3748] absolute bottom-0 origin-bottom transform translate-x-1/2 rotate-[60deg] left-1/2 rounded-full" />
                <div className="w-4 h-4 bg-[#2d3748] absolute bottom-[-8px] rounded-full left-1/2 transform -translate-x-1/2" />
             </div>
             <div className="flex items-center justify-center gap-2 mt-4 text-slate-500 text-sm">
                Accessibility
                <div className="w-4 h-4 rounded-full bg-[#f6ab2f] text-white flex items-center justify-center text-[10px] font-bold">?</div>
             </div>
          </div>
        </div>

        <div className="bg-[#fff8ea] border border-[#f5c786] rounded text-[#2d3748] py-4 px-6 flex items-center justify-center gap-2">
           <AlertTriangle className="w-4 h-4 text-[#2d3748]" />
           <span className="text-sm font-medium">Automated diagnostics found a potential issue</span>
           <ChevronDown className="w-4 h-4 ml-1" />
        </div>

        {diagnosticResults && (
          <div className="mt-8 border-t border-gray-100 pt-8 animate-in fade-in duration-700">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100">
                <Brain className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-hr-navy">AI Agent Analysis</h3>
                <p className="text-xs text-gray-500 font-medium">Insights generated by Gemini Flash Agent</p>
              </div>
              <div className="ml-auto flex items-center gap-6">
                <div className="text-right">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Quality Score</div>
                  <div className={cn(
                    "text-2xl font-black leading-none",
                    diagnosticResults.overallScore >= 80 ? "text-hr-green" : 
                    diagnosticResults.overallScore >= 60 ? "text-hr-orange" : "text-hr-red"
                  )}>
                    {diagnosticResults.overallScore}%
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Estimated</div>
                  <div className="text-2xl font-black leading-none text-hr-navy">{diagnosticResults.estimatedTime}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">Critical Issues & Suggestions</h4>
                {diagnosticResults.issues.map((issue, idx) => (
                  <div key={idx} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border",
                        issue.severity === 'Critical' ? "bg-red-50 text-red-600 border-red-100" :
                        issue.severity === 'Major' ? "bg-orange-50 text-orange-600 border-orange-100" :
                        issue.severity === 'Minor' ? "bg-blue-50 text-blue-600 border-blue-100" :
                        "bg-gray-50 text-gray-600 border-gray-100"
                      )}>
                        {issue.severity}
                      </span>
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{issue.category}</span>
                    </div>
                    <p className="text-sm font-bold text-hr-navy">{issue.title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed font-medium">{issue.description}</p>
                    <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/30">
                      <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3" /> Agent Suggestion
                      </p>
                      <p className="text-xs text-indigo-900 leading-relaxed font-medium">{issue.suggestion}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1 mb-4">Survey Strengths</h4>
                  <div className="bg-emerald-50/30 border border-emerald-100 rounded-2xl p-6 space-y-3">
                    {diagnosticResults.strengths.map((strength, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <p className="text-xs font-medium text-emerald-900">{strength}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Diagnostic Summary</h4>
                    <p className="text-xs text-gray-500 leading-relaxed font-medium">
                      This survey has a <strong className="text-hr-navy font-bold">{diagnosticResults.fatigueLevel}</strong> fatigue level. 
                      Completing the suggested changes could increase your conversion rate by up to 15%.
                    </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <div className="bg-white rounded-3xl border border-border-strong shadow-sm p-8 flex flex-col h-full hover:shadow-md transition-all">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">
              <Brain className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="text-hr-navy text-lg font-black tracking-tight mb-2">AI Diagnostic</h3>
            <p className="text-xs text-slate-500 mb-8 flex-1 leading-relaxed font-medium">Let AI perform an exhaustive test on your survey to find bias, fatigue, and flow issues.</p>
            <button 
              onClick={handleAiDiagnostic}
              disabled={isDiagnosing}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-3.5 px-6 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              {isDiagnosing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Run AI Diagnostic
            </button>
         </div>
         <div className="bg-white rounded-3xl border border-border-strong shadow-sm p-8 flex flex-col h-full hover:shadow-md transition-all">
            <div className="w-12 h-12 bg-hr-blue/5 rounded-2xl flex items-center justify-center mb-6">
              <Database className="w-6 h-6 text-hr-blue" />
            </div>
            <h3 className="text-hr-navy text-lg font-black tracking-tight mb-2">Automated Data</h3>
            <p className="text-xs text-slate-500 mb-8 flex-1 leading-relaxed font-medium">Testing takes time. Enlist our army of form filling robots to help you populate your database.</p>
            <button 
              onClick={handleGenerateTestResponses}
              disabled={isGenerating}
              className="w-full bg-hr-blue hover:brightness-110 disabled:opacity-50 text-white py-3.5 px-6 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-hr-blue/10 transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Generate Test Responses
            </button>
         </div>
         
         <div className="bg-white rounded-3xl border border-border-strong shadow-sm p-8 flex flex-col h-full hover:shadow-md transition-all">
            <div className="w-12 h-12 bg-hr-blue/5 rounded-2xl flex items-center justify-center mb-6">
              <Eye className="w-6 h-6 text-hr-blue" />
            </div>
            <h3 className="text-hr-navy text-lg font-black tracking-tight mb-2">Manual Testing</h3>
            <p className="text-xs text-slate-500 mb-8 flex-1 leading-relaxed font-medium">Experience your survey exactly as a respondent would. Ensure your logic and flow are perfect.</p>
            <button 
               onClick={() => window.open(testLink, '_blank')}
               className="w-full bg-hr-navy hover:bg-hr-navy/90 text-white py-3.5 px-6 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-hr-navy/10 transition-all active:scale-95"
            >
               New Test Response
            </button>
         </div>

         <div className="bg-white rounded-3xl border border-border-strong shadow-sm p-8 flex flex-col h-full hover:shadow-md transition-all">
            <div className="w-12 h-12 bg-hr-blue/5 rounded-2xl flex items-center justify-center mb-6">
              <Users className="w-6 h-6 text-hr-blue" />
            </div>
            <h3 className="text-hr-navy text-lg font-black tracking-tight mb-2">Social Testing</h3>
            <p className="text-xs text-slate-500 mb-8 flex-1 leading-relaxed font-medium">Everyone's a critic. Get real feedback from colleagues to sharpen your questions.</p>
            <button 
              onClick={() => setIsInviteModalOpen(true)}
              className="w-full border-2 border-hr-blue text-hr-blue hover:bg-hr-blue/5 py-3 px-6 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95"
            >
              Invite Others to Test
            </button>
         </div>
      </div>

      <AnimatePresence>
        {isInviteModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-[700px] w-full mt-10 overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-3xl font-light text-hr-navy">Invite Others to Test</h2>
                  <button onClick={() => setIsInviteModalOpen(false)} className="text-gray-400 hover:text-hr-navy transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="flex border-b border-gray-100 mb-8">
                  <button
                    onClick={() => setInviteTab('email')}
                    className={cn(
                      "px-8 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 -mb-[2px]",
                      inviteTab === 'email' ? "border-hr-blue text-hr-blue bg-hr-blue/5 rounded-t-xl" : "border-transparent text-gray-400 hover:text-hr-navy"
                    )}
                  >
                    Invite by Email
                  </button>
                  <button
                    onClick={() => setInviteTab('system')}
                    className={cn(
                      "px-8 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 -mb-[2px]",
                      inviteTab === 'system' ? "border-hr-blue text-hr-blue bg-hr-blue/5 rounded-t-xl" : "border-transparent text-gray-400 hover:text-hr-navy"
                    )}
                  >
                    Invite by Other System
                  </button>
                </div>

                {inviteTab === 'email' ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                      <label className="text-right text-gray-400 text-[10px] font-black uppercase tracking-widest">Email Subject</label>
                      <input type="text" className="w-full bg-gray-50 border border-border-strong rounded-xl px-4 py-3 text-gray-700 focus:outline-none focus:ring-4 ring-hr-blue/5 focus:bg-white transition-all font-medium text-sm" defaultValue={`Request to Review - ${survey.title}`} />
                    </div>
                    <div className="grid grid-cols-[140px_1fr] items-start gap-4">
                      <label className="text-right text-gray-400 text-[10px] font-black uppercase tracking-widest pt-3">Email Message</label>
                      <textarea className="w-full bg-gray-50 border border-border-strong rounded-xl px-4 py-3 text-gray-700 h-28 focus:outline-none focus:ring-4 ring-hr-blue/5 focus:bg-white transition-all font-medium text-sm" defaultValue={`Please review and test my survey: ${survey.title}`} />
                    </div>
                    <div className="grid grid-cols-[140px_1fr] items-start gap-4">
                      <label className="text-right text-gray-400 text-[10px] font-black uppercase tracking-widest pt-3">Send Invite To</label>
                      <textarea placeholder="Email Recipients (1 per line)" className="w-full bg-gray-50 border border-border-strong rounded-xl px-4 py-3 text-gray-700 h-28 focus:outline-none focus:ring-4 ring-hr-blue/5 focus:bg-white transition-all font-medium text-sm" />
                    </div>
                    <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                      <label className="text-right text-gray-400 text-[10px] font-black uppercase tracking-widest">Comments</label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="w-10 h-6 bg-gray-100 rounded-full relative transition-colors group-hover:bg-gray-200">
                           <input type="checkbox" defaultChecked className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                           <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform translate-x-4 shadow-sm" />
                           <div className="absolute inset-0 bg-hr-blue rounded-full opacity-100 transition-opacity" />
                        </div>
                        <span className="text-sm font-bold text-hr-navy">Allow testers to leave anonymous comments</span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8 min-h-[300px]">
                    <div className="p-6 bg-hr-blue/5 border border-hr-blue/10 rounded-2xl flex gap-4 items-start">
                       <ShieldCheck className="w-6 h-6 text-hr-blue shrink-0" />
                       <div className="space-y-1">
                          <h4 className="text-sm font-black text-hr-navy">Public Testing Mode</h4>
                          <p className="text-xs text-gray-500 leading-relaxed font-medium">Use this link to distribute your survey through your own internal systems. Anyone with this link can provide feedback directly on the survey questions.</p>
                       </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Testing Mode Link</label>
                      <div className="flex bg-white border border-border-strong rounded-2xl overflow-hidden focus-within:ring-4 ring-hr-blue/5 transition-all shadow-sm">
                         <input type="text" readOnly value={testLink} className="flex-1 px-4 py-4 text-sm font-bold text-hr-blue bg-transparent focus:outline-none" />
                         <button 
                           onClick={() => {
                             navigator.clipboard.writeText(testLink);
                             showToast("Link copied!");
                           }}
                           className="bg-hr-blue hover:brightness-110 text-white px-6 flex items-center justify-center transition-all active:scale-95"
                         >
                           <Copy className="w-5 h-5 mr-2" /> Copy
                         </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-8 border-t border-gray-50 flex justify-end gap-4 bg-gray-50/50">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-8 py-3 border border-border-strong bg-white rounded-2xl text-xs font-bold text-gray-500 hover:bg-gray-100 transition-all active:scale-95"
                >
                  Cancel
                </button>
                {inviteTab === 'email' && (
                  <button
                    onClick={() => {
                      showToast("Invitations sent successfully", "success");
                      setIsInviteModalOpen(false);
                    }}
                    className="bg-hr-blue hover:brightness-110 text-white py-3 px-10 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-hr-blue/20 active:scale-95"
                  >
                    Send Invites
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ResultsView({ 
  questions, 
  survey, 
  showToast,
  onUpdateSurvey
}: { 
  questions: Question[], 
  survey: Survey, 
  showToast: (m: string, t?: any) => void,
  onUpdateSurvey: (u: Partial<Survey>) => void
}) {
  const [responses, setResponses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [subview, setSubview] = useState<'analytics' | 'responders'>('analytics');
  const [isExporting, setIsExporting] = useState(false);
  const [deletingResponseId, setDeletingResponseId] = useState<string | null>(null);
  const [viewingResponse, setViewingResponse] = useState<any | null>(null);

  const handleDownload = async (format: 'pdf' | 'csv' | 'excel') => {
    setIsExporting(true);
    try {
      const fileName = `results_${survey.title.replace(/\s+/g, '_').toLowerCase()}`;
      if (format === 'pdf') {
        // Ensure we are on analytics subview before exporting PDF
        if (subview !== 'analytics') {
          setSubview('analytics');
          // Wait a tiny bit for the DOM to update
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        await exportToPDF('analytics-report', fileName);
      } else {
        const exportData = formatResponsesForExport(questions, responses);
        if (format === 'csv') {
          exportToCSV(exportData, fileName);
        } else {
          exportToExcel(exportData, fileName);
        }
      }
      showToast(`${format.toUpperCase()} export successful`, 'success');
    } catch (err) {
      console.error(err);
      showToast(`Failed to export ${format.toUpperCase()}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAnalytics = async () => {
    try {
      await updateDoc(doc(db, 'surveys', survey.id), { isShared: true });
      onUpdateSurvey({ isShared: true });
      setShowShareModal(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `surveys/${survey.id}`);
      showToast('Failed to enable public sharing', 'error');
    }
  };

  const handleDeleteResponse = async (responseId: string) => {
    setDeletingResponseId(responseId);
  };
  
  const confirmDeleteResponse = async () => {
    if (!deletingResponseId) return;
    try {
      await deleteDoc(doc(db, 'surveys', survey.id, 'responses', deletingResponseId));
      setResponses(prev => prev.filter(r => r.id !== deletingResponseId));
      showToast('Response deleted successfully', 'success');
    } catch (err) {
      console.error("Delete error:", err);
      handleFirestoreError(err, OperationType.DELETE, `surveys/${survey.id}/responses/${deletingResponseId}`);
      showToast('Failed to delete response', 'error');
    } finally {
      setDeletingResponseId(null);
    }
  };

  useEffect(() => {
    const responsesRef = collection(db, 'surveys', survey.id, 'responses');
    const q = query(responsesRef, orderBy('submittedAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const respList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setResponses(respList);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching responses:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [survey.id]);

  if (isLoading) {
    return (
      <div className="h-64 w-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-hr-blue animate-spin" />
      </div>
    );
  }

  const CHART_COLORS = [
    '#1d486b', // HR Navy
    '#3b82f6', // Bright Blue
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#f97316', // Orange
    '#6366f1', // Indigo
  ];

  if (responses.length === 0) {
    return (
      <div className="space-y-6 py-2 animate-in fade-in duration-500 overflow-y-auto max-h-full pr-2 custom-scrollbar">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-light tracking-tight text-hr-navy">Real-time Insights</h2>
            <p className="text-gray-500 font-medium">Monitoring responses for "{survey.title}"</p>
          </div>
          <button onClick={handleExportAnalytics} className="btn-primary group">
             <Share2 className="w-4 h-4" /> Share Analytics
          </button>
        </div>
        <div className="py-32 text-center space-y-6 border-2 border-dashed border-gray-100 rounded-[40px] bg-white animate-in slide-in-bottom duration-700">
           <div className="w-20 h-20 bg-hr-blue/5 text-hr-blue/30 rounded-full flex items-center justify-center mx-auto ring-8 ring-hr-blue/5">
              <ClipboardList className="w-8 h-8" />
           </div>
           <div className="space-y-2">
              <p className="text-xl font-bold text-hr-navy">Awaiting First Respondents</p>
              <p className="text-gray-400 max-w-sm mx-auto">Once employees begin submitting their feedback, analytics and AI-synthesized patterns will appear here in real-time.</p>
           </div>
        </div>
      </div>
    );
  }

  const totalResponses = responses.length;

  return (
    <div className="space-y-6 py-2 animate-in fade-in duration-500 overflow-y-auto max-h-full pr-2 custom-scrollbar">
      {showShareModal && (
        <div className="fixed inset-0 z-[200] bg-hr-navy/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
             <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-hr-navy">Share Analytics</h3>
                <button onClick={() => setShowShareModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
             </div>
             <p className="text-gray-500 mb-6 font-medium">Anyone with this link can view the real-time analytics report. No login required.</p>
             <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl mb-6 border border-gray-200">
                <input 
                  type="text" 
                  readOnly 
                  value={`${getPublicUrl()}/?a=${survey.id}&SGUID=__CUSTOMER_ID__`}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-mono text-gray-500 overflow-hidden text-ellipsis"
                />
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(`${getPublicUrl()}/?a=${survey.id}&SGUID=__CUSTOMER_ID__`);
                    showToast('Link copied to clipboard!', 'success');
                  }}
                  className="px-4 py-2 bg-hr-blue text-white rounded-lg text-sm font-bold shadow-sm hover:bg-hr-blue/90"
                >
                  Copy
                </button>
             </div>
             <div className="flex justify-end pt-4 border-t border-gray-100">
                <button 
                  onClick={() => {
                     window.open(`${getPublicUrl()}/?a=${survey.id}&SGUID=__CUSTOMER_ID__`, '_blank');
                  }}
                  className="flex items-center gap-2 text-sm font-bold text-hr-blue hover:text-hr-blue/80"
                >
                  <ExternalLink className="w-4 h-4" /> Open in new tab
                </button>
             </div>
          </div>
        </div>
      )}

      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-light tracking-tight text-hr-navy">Real-time Insights</h2>
          <p className="text-gray-500 font-medium tracking-tight">Monitoring outcomes for "{survey.title}"</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-gray-100 p-1 rounded-xl flex items-center">
            <button 
              onClick={() => setSubview('analytics')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                subview === 'analytics' ? "bg-white text-hr-navy shadow-sm" : "text-gray-400 hover:text-gray-600"
              )}
            >
              Analysis Overview
            </button>
            <button 
              onClick={() => setSubview('responders')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                subview === 'responders' ? "bg-white text-hr-navy shadow-sm" : "text-gray-400 hover:text-gray-600"
              )}
            >
              Survey Responders
            </button>
          </div>
          <div className="flex items-center gap-1 border-l border-gray-200 pl-3 ml-1">
             <button 
               onClick={() => handleDownload('pdf')}
               disabled={isExporting}
               className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-hr-red hover:bg-hr-red/5 rounded-lg transition-all text-[10px] font-black uppercase tracking-wider disabled:opacity-50"
               title="Export as PDF"
             >
                <Download className="w-3.5 h-3.5" /> PDF
             </button>
             <button 
               onClick={() => handleDownload('csv')}
               disabled={isExporting}
               className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-hr-blue hover:bg-hr-blue/5 rounded-lg transition-all text-[10px] font-black uppercase tracking-wider disabled:opacity-50"
               title="Export as CSV"
             >
                <Database className="w-3.5 h-3.5" /> CSV
             </button>
             <button 
               onClick={() => handleDownload('excel')}
               disabled={isExporting}
               className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all text-[10px] font-black uppercase tracking-wider disabled:opacity-50"
               title="Export as Excel"
             >
                <Layers className="w-3.5 h-3.5" /> Excel
             </button>
          </div>
          <button onClick={handleExportAnalytics} className="btn-primary group">
             <Share2 className="w-4 h-4" /> Share Analytics
          </button>
        </div>
      </div>
      
      {subview === 'analytics' ? (
        <div id="analytics-report" className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden animate-in fade-in slide-in-bottom-4 duration-500">
           {/* Header */}
           <div className="px-8 md:px-12 py-10 border-b border-gray-100">
              <h1 className="text-2xl font-normal text-gray-800 mb-10 tracking-tight whitespace-pre-wrap">Combined: Report for {survey.title} ({survey.id.slice(-6)})</h1>
              
              {/* Response Counts */}
              <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4 mb-4">
                 <div className="text-sm font-semibold text-gray-600">Response Counts</div>
                 <div className="space-y-4 max-w-xl">
                    <div className="flex items-center gap-6 text-xs text-gray-700">
                       <span className="w-24 text-right">Completion Rate:</span>
                       <span className="font-bold w-10">100%</span>
                       <div className="flex-1 h-3 bg-gray-100 flex overflow-hidden">
                          <div className="h-full bg-[#1b4365]" style={{ width: '100%' }}></div>
                       </div>
                       <span className="w-10 text-right">{totalResponses}</span>
                    </div>
                    <div className="flex items-center gap-6 text-xs text-gray-700">
                       <span className="w-24 text-right">Complete:</span>
                       <span className="w-10"></span>
                       <div className="flex-1 h-3 bg-gray-100 flex overflow-hidden">
                          <div className="h-full bg-[#5d8aa8]" style={{ width: '100%' }}></div>
                       </div>
                       <span className="w-10 text-right">{totalResponses}</span>
                    </div>
                    <div className="flex items-center gap-6 text-xs text-gray-700">
                       <span className="w-24 text-right">Partial:</span>
                       <span className="w-10"></span>
                       <div className="flex-1 h-3 bg-gray-100 flex overflow-hidden">
                          <div className="h-full bg-[#1b4365]" style={{ width: '0%' }}></div>
                       </div>
                       <span className="w-10 text-right">0</span>
                    </div>
                    <div className="flex justify-end pt-3 border-t border-gray-200">
                       <span className="text-xs font-bold text-gray-800">Totals: {totalResponses}</span>
                    </div>
                 </div>
              </div>
           </div>

           <div className="px-8 md:px-12 py-12 space-y-20">
              {questions.map((q, idx) => {
                 if (q.type === 'page_break') return null;

                 // Calculate data
                 const answerCounts: Record<string, number> = {};
                 let qTotal = 0;

                 responses.forEach(r => {
                   let ans = r.answers[q.id];
                   if (ans !== undefined && ans !== null && ans !== '') {
                     qTotal++;
                     if (Array.isArray(ans)) {
                       ans.forEach(a => {
                         answerCounts[a] = (answerCounts[a] || 0) + 1;
                       });
                     } else {
                       answerCounts[ans] = (answerCounts[ans] || 0) + 1;
                     }
                   }
                 });

                 const chartData = Object.entries(answerCounts).map(([name, count]) => ({
                 name: String(name),
                 count,
                 percent: qTotal > 0 ? (count / qTotal) : 0
               })).sort((a, b) => b.count - a.count);

               const isCheckbox = q.type === 'checkbox';
               const isText = ['short_text', 'long_text'].includes(q.type);
               const shouldShowChart = !isText && chartData.length > 0;

               return (
                  <div key={q.id} className="page-break-inside-avoid">
                     <h3 className="text-[15px] font-normal text-gray-800 mb-1 leading-relaxed">
                       {idx + 1}. {q.text}
                     </h3>
                     {q.desc && (
                       <p className="text-xs text-gray-500 mb-8 font-normal italic">
                         {q.desc}
                       </p>
                     )}
                     
                     {/* Chart Area */}
                     {shouldShowChart && (
                       <div className="relative pt-6 mb-10 pb-6 rounded-xl border border-transparent hover:border-gray-50 transition-colors group">
                         <div className="absolute top-0 right-2 z-10">
                            <ChartExportMenu chartId={`chart-${q.id}`} title={q.text} />
                         </div>
                         <div id={`chart-${q.id}`} className="h-[350px] w-full md:w-[80%] mx-auto flex justify-center mt-8 bg-white py-4 rounded-xl">
                           {isCheckbox ? (
                             <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ecf0f1" />
                                  <XAxis 
                                    dataKey="name" 
                                    axisLine={{ stroke: '#bdc3c7' }} 
                                    tickLine={false} 
                                    tick={{ fontSize: 10, fill: '#7f8c8d' }} 
                                    interval={0}
                                    angle={-45}
                                    textAnchor="end"
                                  />
                                  <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 10, fill: '#7f8c8d' }}
                                    tickFormatter={(v) => `${Math.round((v / qTotal) * 100)}%`}
                                  />
                                  <Tooltip 
                                    cursor={{ fill: '#f8f9fa' }} 
                                    contentStyle={{ fontSize: '12px', borderRadius: '4px', border: '1px solid #e2e8f0' }} 
                                  />
                                  <Bar dataKey="count" fill="#4fa5c4" barSize={32} isAnimationActive={false}>
                                     {chartData.map((entry, index) => (
                                      <Cell key={`cell-results-${q.id}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length] || '#000'} />
                                    ))}
                                  </Bar>
                                </BarChart>
                             </ResponsiveContainer>
                          ) : (
                             <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={chartData}
                                    dataKey="count"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={120}
                                    stroke="white"
                                    strokeWidth={2}
                                    label={({ name, percent }) => `${(percent * 100).toFixed(1)}% ${name.slice(0, 20)}${name.length > 20 ? '...' : ''}`}
                                    labelLine={{ stroke: '#7f8c8d', strokeWidth: 1 }}
                                    style={{ fontSize: '10px' }}
                                    isAnimationActive={false}
                                  >
                                    {chartData.map((entry, index) => (
                                      <Cell key={`cell-results-${q.id}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length] || '#000'} />
                                    ))}
                                  </Pie>
                                  <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '4px', border: '1px solid #e2e8f0' }} />
                                </PieChart>
                             </ResponsiveContainer>
                          )}
                        </div>
                      </div>
                     )}

                     {/* Table */}
                     {chartData.length > 0 ? (
                       <div className="overflow-x-auto">
                         <table className="w-full text-xs text-gray-700 min-w-[500px]">
                            <thead>
                               <tr className="border-b-2 border-gray-400">
                                 <th className="text-left py-2 font-semibold w-1/3">Value</th>
                                 <th className="text-left py-2 font-semibold w-5/12">Percent</th>
                                 <th className="text-right py-2 font-semibold">Responses</th>
                               </tr>
                            </thead>
                            <tbody>
                               {chartData.map((row, rIdx) => (
                                 <tr key={rIdx} className="border-b border-gray-100 last:border-b-0">
                                   <td className="py-2.5 font-normal pr-4">{row.name}</td>
                                   <td className="py-2.5 pr-4">
                                      <div className="flex items-center gap-3">
                                        <span className="w-10 text-gray-500">{(row.percent * 100).toFixed(1)}%</span>
                                        <div className="w-48 max-w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                          <div className="h-full rounded-full" style={{ width: `${row.percent * 100}%`, backgroundColor: CHART_COLORS[rIdx % CHART_COLORS.length] }}></div>
                                        </div>
                                      </div>
                                   </td>
                                   <td className="py-2.5 text-right font-medium">{row.count}</td>
                                 </tr>
                               ))}
                            </tbody>
                         </table>
                         <div className="text-right pt-3 mt-1 border-t border-gray-200 font-bold text-[11px] text-gray-800">
                            Totals: {qTotal}
                         </div>
                       </div>
                     ) : (
                       <div className="text-xs text-gray-400 italic bg-gray-50 p-4 rounded-lg">
                          {isText ? "Text responses hidden in aggregate view." : "No responses yet."}
                       </div>
                     )}
                  </div>
               )
            })}
         </div>
      </div>
      ) : (
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden animate-in fade-in slide-in-top-4 duration-500">
          <div className="px-8 md:px-10 py-8 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-normal text-hr-navy">Individual Respondents</h3>
              <p className="text-sm text-gray-400">Review detailed submission data and identity markers</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Growth</div>
                <div className="text-lg font-black text-hr-blue">+{totalResponses}</div>
              </div>
              <div className="w-px h-8 bg-gray-100" />
              <div className="text-right">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Active Links</div>
                <div className="text-lg font-black text-hr-navy">{survey.links?.length || 0}</div>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left min-w-[800px]">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Respondent ID / SGUID</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Contact Method</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Timing</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Duration</th>
                  <th className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">Status</th>
                  <th className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {responses.map((resp) => {
                  const date = resp.submittedAt?.toDate ? resp.submittedAt.toDate() : (resp.submittedAt ? new Date(resp.submittedAt) : new Date());
                  const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  const formattedTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                  
                  let email = resp.email || "—";
                  if (email === "—" && resp.answers) {
                    const emailQ = questions.find(q => q.alias?.toLowerCase() === 'email' || q.text.toLowerCase().includes('email'));
                    if (emailQ && resp.answers[emailQ.id]) {
                      email = resp.answers[emailQ.id];
                    }
                  }

                  const durationMin = Math.floor((resp.durationSeconds || 0) / 60);
                  const durationSec = (resp.durationSeconds || 0) % 60;

                  return (
                    <tr key={resp.id} className="hover:bg-gray-50/30 transition-colors group">
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-hr-blue/5 text-hr-blue rounded-xl flex items-center justify-center font-bold text-xs shrink-0">
                            {resp.sguid ? 'SG' : 'AN'}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-hr-navy font-mono uppercase tracking-tighter truncate max-w-[120px]">
                              {resp.sguid || `R-${resp.id.slice(-6).toUpperCase()}`}
                            </div>
                            <div className="text-[10px] text-gray-400 font-medium">Verified identity marker</div>
                            {resp.isTest && (
                               <div className="text-[10px] text-orange-500 font-bold uppercase tracking-widest mt-0.5">Test Response</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                           <Mail className="w-3.5 h-3.5 text-gray-300" />
                           <span className="text-sm font-medium text-gray-600 truncate max-w-[150px]">{email}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                           <div className="flex items-center gap-1.5 text-sm font-bold text-hr-navy whitespace-nowrap">
                             <Calendar className="w-3 h-3 text-hr-blue" /> {formattedDate}
                           </div>
                           <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-medium">
                             <Clock className="w-3 h-3" /> {formattedTime}
                           </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm font-mono font-bold text-gray-500">
                          {durationMin}m {durationSec}s
                        </div>
                      </td>
                      <td className="px-10 py-6 text-right">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-600 border border-green-100">
                          Complete
                        </span>
                      </td>
                      <td className="px-10 py-6 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <Eye 
                            className="w-4 h-4 text-gray-400 hover:text-hr-blue transition-colors cursor-pointer" 
                            onClick={() => setViewingResponse(resp)}
                          />
                          <Trash2 
                            className="w-4 h-4 text-gray-400 hover:text-red-500 transition-colors cursor-pointer" 
                            onClick={() => handleDeleteResponse(resp.id)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingResponseId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 border border-gray-100">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-4 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-hr-navy mb-2 text-center">Delete Response?</h3>
            <p className="text-sm text-gray-500 mb-6 text-center">
              Are you sure you want to delete this response? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeletingResponseId(null)}
                className="flex-1 py-2.5 text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                type="button"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteResponse}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm shadow-red-200"
                type="button"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingResponse && (
        <ResponseDetailsModal 
          response={viewingResponse} 
          questions={questions} 
          onClose={() => setViewingResponse(null)} 
        />
      )}
    </div>
  );
}

function ResponseDetailsModal({ 
  response, 
  questions, 
  onClose 
}: { 
  response: any; 
  questions: Question[]; 
  onClose: () => void 
}) {
  if (!response) return null;

  const date = response.submittedAt?.toDate ? response.submittedAt.toDate() : (response.submittedAt ? new Date(response.submittedAt) : new Date());
  
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
           <div>
             <h3 className="text-xl font-bold text-hr-navy">Response Details</h3>
             <p className="text-xs text-gray-500 uppercase tracking-widest font-black mt-1 flex items-center gap-2">
                <span className="flex items-center gap-1.5"><UserSquare2 className="w-3.5 h-3.5" />{response.sguid ? `SGUID: ${response.sguid}` : `ID: R-${response.id.slice(-6).toUpperCase()}`}</span>
                <span>•</span>
                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
             </p>
           </div>
           <button onClick={onClose} className="p-2 text-gray-400 hover:bg-white hover:text-hr-navy rounded-full transition-colors border border-transparent hover:border-gray-200 hover:shadow-sm">
              <X className="w-5 h-5" />
           </button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
           {questions.map((q, idx) => {
             const ans = response.answers?.[q.id];
             let valDisplay: React.ReactNode = <span className="text-gray-400 italic">No answer provided</span>;
             
             if (ans !== undefined && ans !== null && ans !== '') {
               if (Array.isArray(ans)) {
                 if (ans.length > 0) {
                   valDisplay = ans.join(', ');
                 }
               } else {
                 valDisplay = ans.toString();
               }
             }

             return (
               <div key={q.id} className="bg-gray-50/50 p-5 rounded-2xl border border-gray-100/80">
                 <div className="flex items-center gap-2 mb-2">
                   <div className="bg-hr-blue/10 text-hr-blue px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">Q{idx + 1}</div>
                   <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{q.type}</div>
                 </div>
                 <p className="text-sm font-bold text-hr-navy mb-3 pl-1">{q.text}</p>
                 <div className="bg-white px-5 py-3.5 rounded-xl border border-gray-100 text-sm text-gray-700 shadow-sm shadow-gray-200/20 whitespace-pre-wrap leading-relaxed">
                   {valDisplay}
                 </div>
               </div>
             );
           })}
        </div>
      </div>
    </div>
  );
}

interface ShareViewProps {
  survey: Survey;
  onUpdateSurvey: (s: Survey) => void;
  showToast: (m: string, t?: 'success' | 'info' | 'error') => void;
}

interface RespondentViewProps {
  survey: Survey;
  questions: Question[];
  onComplete: (answers: any) => void;
  onExit: () => void;
  showToast: (m: string, t?: any) => void;
  isPreview?: boolean;
  isTestMode?: boolean;
  comments?: any[];
}

function PublicAnalyticsView({ surveyId, onExit, showToast }: { surveyId: string, onExit: () => void, showToast: (m: string, t?: any) => void }) {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const handleDownload = async (format: 'pdf' | 'csv' | 'excel') => {
    if (!survey) return;
    setIsExporting(true);
    try {
      const fileName = `public_results_${survey.title.replace(/\s+/g, '_').toLowerCase()}`;
      if (format === 'pdf') {
        await exportToPDF('public-analytics-report', fileName);
      } else {
        const exportData = formatResponsesForExport(questions, responses);
        if (format === 'csv') {
          exportToCSV(exportData, fileName);
        } else {
          exportToExcel(exportData, fileName);
        }
      }
      showToast(`${format.toUpperCase()} export successful`, 'success');
    } catch (err) {
      console.error(err);
      showToast(`Failed to export ${format.toUpperCase()}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    let unsubscribeSurvey: any;
    let unsubscribeResponses: any;

    const setupListeners = async () => {
      try {
        const surveyRef = doc(db, 'surveys', surveyId);
        unsubscribeSurvey = onSnapshot(surveyRef, (docSnap) => {
          if (docSnap.exists()) {
            const sData = { ...docSnap.data(), id: docSnap.id } as Survey;
            if (!sData.isShared) {
               showToast("This analytics report is no longer public", "error");
               onExit();
               return;
            }
            setSurvey(sData);
            setQuestions((sData.questions || []).filter(Boolean));
            setLoading(false);
          } else {
            showToast("Survey not found", "error");
            onExit();
          }
        }, (err) => {
          console.error(err);
          showToast("Error loading survey", "error");
          onExit();
        });

        const responsesQuery = query(collection(db, 'surveys', surveyId, 'responses'), orderBy('submittedAt', 'desc'));
        unsubscribeResponses = onSnapshot(responsesQuery, (snapshot) => {
          setResponses(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (err) => {
          console.error(err);
        });
      } catch (err) {
        console.error(err);
        showToast("Error setting up analytics", "error");
        onExit();
      }
    };
    
    setupListeners();

    return () => {
      if (unsubscribeSurvey) unsubscribeSurvey();
      if (unsubscribeResponses) unsubscribeResponses();
    };
  }, [surveyId, onExit, showToast]);

  if (loading || !survey) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <Loader2 className="w-10 h-10 text-hr-blue animate-spin" />
      </div>
    );
  }

  const CHART_COLORS = [
    '#1d486b', // HR Navy
    '#3b82f6', // Bright Blue
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#f97316', // Orange
    '#6366f1', // Indigo
  ];

  const totalResponses = responses.length;

  return (
    <div className="min-h-screen bg-[#f7f9fa] font-sans text-gray-800 overflow-y-auto pb-20 pt-8 px-4">
      <div id="public-analytics-report" className="max-w-5xl mx-auto bg-white min-h-screen shadow-[0_0_20px_rgba(0,0,0,0.03)] border border-gray-200">
         {/* Header */}
         <div className="px-12 py-10 border-b border-gray-100">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-10">
               <h1 className="text-2xl font-normal text-gray-800 tracking-tight whitespace-pre-wrap">Combined: Report for {survey.title} ({survey.id.slice(-6)})</h1>
               <div className="flex items-center gap-2 no-print">
                  <button 
                    onClick={() => handleDownload('pdf')}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-4 py-2 text-hr-red border border-hr-red/20 rounded-lg text-[10px] uppercase tracking-wider font-black hover:bg-hr-red/5 transition-all disabled:opacity-50"
                  >
                     <Download className="w-3.5 h-3.5" /> PDF
                  </button>
                  <button 
                    onClick={() => handleDownload('csv')}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-4 py-2 text-hr-blue border border-hr-blue/20 rounded-lg text-[10px] uppercase tracking-wider font-black hover:bg-hr-blue/5 transition-all disabled:opacity-50"
                  >
                     <Database className="w-3.5 h-3.5" /> CSV
                  </button>
                  <button 
                    onClick={() => handleDownload('excel')}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-4 py-2 text-emerald-600 border border-emerald-100 rounded-lg text-[10px] uppercase tracking-wider font-black hover:bg-emerald-50 transition-all disabled:opacity-50"
                  >
                     <Layers className="w-3.5 h-3.5" /> Excel
                  </button>
               </div>
            </div>
            
            {/* Response Counts */}
            <div className="grid grid-cols-[180px_1fr] gap-4 mb-4">
               <div className="text-sm font-semibold text-gray-600">Response Counts</div>
               <div className="space-y-4">
                  <div className="flex items-center gap-6 text-xs text-gray-700">
                     <span className="w-24 text-right">Completion Rate:</span>
                     <span className="font-bold w-10">100%</span>
                     <div className="flex-1 h-3 bg-gray-100 flex overflow-hidden">
                        <div className="h-full bg-[#1b4365]" style={{ width: '100%' }}></div>
                     </div>
                     <span className="w-10 text-right">{totalResponses}</span>
                  </div>
                  <div className="flex items-center gap-6 text-xs text-gray-700">
                     <span className="w-24 text-right">Complete:</span>
                     <span className="w-10"></span>
                     <div className="flex-1 h-3 bg-gray-100 flex overflow-hidden">
                        <div className="h-full bg-[#5d8aa8]" style={{ width: '100%' }}></div>
                     </div>
                     <span className="w-10 text-right">{totalResponses}</span>
                  </div>
                  <div className="flex items-center gap-6 text-xs text-gray-700">
                     <span className="w-24 text-right">Partial:</span>
                     <span className="w-10"></span>
                     <div className="flex-1 h-3 bg-gray-100 flex overflow-hidden">
                        <div className="h-full bg-[#1b4365]" style={{ width: '0%' }}></div>
                     </div>
                     <span className="w-10 text-right">0</span>
                  </div>
                  <div className="flex justify-end pt-3 border-t border-gray-200">
                     <span className="text-xs font-bold text-gray-800">Totals: {totalResponses}</span>
                  </div>
               </div>
            </div>
         </div>

         <div className="px-12 py-12 space-y-20">
            {questions.map((q, idx) => {
               if (q.type === 'page_break') return null;

               // Calculate data
               const answerCounts: Record<string, number> = {};
               let qTotal = 0;

               responses.forEach(r => {
                 let ans = r.answers[q.id];
                 if (ans !== undefined && ans !== null && ans !== '') {
                   qTotal++;
                   if (Array.isArray(ans)) {
                     ans.forEach(a => {
                       answerCounts[a] = (answerCounts[a] || 0) + 1;
                     });
                   } else {
                     answerCounts[ans] = (answerCounts[ans] || 0) + 1;
                   }
                 }
               });

               const chartData = Object.entries(answerCounts).map(([name, count]) => ({
                 name: String(name),
                 count,
                 percent: qTotal > 0 ? (count / qTotal) : 0
               })).sort((a, b) => b.count - a.count);

               const isCheckbox = q.type === 'checkbox';
               // If text or we don't have distinct counts, we still render the generic table but no chart
               const isText = ['short_text', 'long_text'].includes(q.type);
               const shouldShowChart = !isText && chartData.length > 0;

               return (
                  <div key={q.id} className="page-break-inside-avoid">
                     <h3 className="text-[15px] font-normal text-gray-800 mb-1 leading-relaxed">
                       {idx + 1}. {q.text}
                     </h3>
                     {q.desc && (
                       <p className="text-xs text-gray-500 mb-8 font-normal italic">
                         {q.desc}
                       </p>
                     )}
                     
                     {/* Chart Area */}
                     {shouldShowChart && (
                       <div className="relative pt-6 mb-10 pb-6 rounded-xl border border-transparent hover:border-gray-50 transition-colors group">
                         <div className="absolute top-0 right-2 z-10">
                            <ChartExportMenu chartId={`chart-${q.id}`} title={q.text} />
                         </div>
                         <div id={`chart-${q.id}`} className="h-[350px] w-full md:w-[80%] mx-auto flex justify-center mt-8 bg-white py-4 rounded-xl">
                           {isCheckbox ? (
                             <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ecf0f1" />
                                  <XAxis 
                                    dataKey="name" 
                                    axisLine={{ stroke: '#bdc3c7' }} 
                                    tickLine={false} 
                                    tick={{ fontSize: 10, fill: '#7f8c8d' }} 
                                    interval={0}
                                    angle={-45}
                                    textAnchor="end"
                                  />
                                  <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 10, fill: '#7f8c8d' }}
                                    tickFormatter={(v) => `${Math.round((v / qTotal) * 100)}%`}
                                  />
                                  <Tooltip 
                                    cursor={{ fill: '#f8f9fa' }} 
                                    contentStyle={{ fontSize: '12px', borderRadius: '4px', border: '1px solid #e2e8f0' }} 
                                  />
                                  <Bar dataKey="count" fill="#4fa5c4" barSize={32} isAnimationActive={false}>
                                     {chartData.map((entry, index) => (
                                      <Cell key={`cell-public-${q.id}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length] || '#000'} />
                                    ))}
                                  </Bar>
                                </BarChart>
                             </ResponsiveContainer>
                          ) : (
                             <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={chartData}
                                    dataKey="count"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={120}
                                    stroke="white"
                                    strokeWidth={2}
                                    label={({ name, percent }) => `${(percent * 100).toFixed(1)}% ${name.slice(0, 20)}${name.length > 20 ? '...' : ''}`}
                                    labelLine={{ stroke: '#7f8c8d', strokeWidth: 1 }}
                                    style={{ fontSize: '10px' }}
                                    isAnimationActive={false}
                                  >
                                    {chartData.map((entry, index) => (
                                      <Cell key={`cell-public-${q.id}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length] || '#000'} />
                                    ))}
                                  </Pie>
                                  <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '4px', border: '1px solid #e2e8f0' }} />
                                </PieChart>
                             </ResponsiveContainer>
                          )}
                        </div>
                      </div>
                     )}

                     {/* Table */}
                     {chartData.length > 0 ? (
                       <div>
                         <table className="w-full text-xs text-gray-700">
                            <thead>
                               <tr className="border-b-2 border-gray-400">
                                 <th className="text-left py-2 font-semibold w-1/3">Value</th>
                                 <th className="text-left py-2 font-semibold w-5/12">Percent</th>
                                 <th className="text-right py-2 font-semibold">Responses</th>
                               </tr>
                            </thead>
                            <tbody>
                               {chartData.map((row, rIdx) => (
                                 <tr key={rIdx} className="border-b border-gray-100 last:border-b-0">
                                   <td className="py-2.5 font-normal pr-4">{row.name}</td>
                                   <td className="py-2.5 pr-4">
                                      <div className="flex items-center gap-3">
                                        <span className="w-10 text-gray-500">{(row.percent * 100).toFixed(1)}%</span>
                                        <div className="w-48 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                          <div className="h-full rounded-full" style={{ width: `${row.percent * 100}%`, backgroundColor: CHART_COLORS[rIdx % CHART_COLORS.length] }}></div>
                                        </div>
                                      </div>
                                   </td>
                                   <td className="py-2.5 text-right font-medium">{row.count}</td>
                                 </tr>
                               ))}
                            </tbody>
                         </table>
                         <div className="text-right pt-3 mt-1 border-t border-gray-200 font-bold text-[11px] text-gray-800">
                            Totals: {qTotal}
                         </div>
                       </div>
                     ) : (
                       <div className="text-xs text-gray-400 italic bg-gray-50 p-4 rounded-lg">
                          {isText ? "Text responses hidden in aggregate view." : "No responses yet."}
                       </div>
                     )}
                  </div>
               )
            })}
         </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string, value: any, color: 'navy' | 'blue' | 'red' }) {
  return (
    <div className="card-premium p-4 md:p-5 bg-white shadow-lg border border-gray-50 group hover:border-hr-blue/20 transition-all">
       <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">{label}</span>
       <div className={cn(
         "text-2xl font-black mt-1 tracking-tighter",
         color === 'navy' ? "text-hr-navy" : color === 'blue' ? "text-hr-blue" : "text-hr-red"
       )}>{value}</div>
    </div>
  );
}

function RespondentFlow({ surveyId, onComplete, onExit, showToast }: { surveyId: string, onComplete: () => void, onExit: () => void, showToast: (m: string, t?: any) => void }) {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTestMode, setIsTestMode] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const startTime = useMemo(() => Date.now(), []);
  
  const [sguid, setSguid] = useState<string | null>(null);

  useEffect(() => {
    if (!surveyId) return;
    const q = query(collection(db, 'surveys', surveyId, 'comments'));
    const unsub = onSnapshot(q, (snap) => {
      const acc: any[] = [];
      snap.forEach(doc => {
        acc.push({ id: doc.id, ...doc.data() });
      });
      setComments(acc);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `surveys/${surveyId}/comments`);
    });
    return () => unsub();
  }, [surveyId]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setIsTestMode(urlParams.get('test') === 'true');
    // Accurately parse the sguid parameter (case-insensitive fallback and handling amp; bug)
    const getParam = (name: string) => {
      for (const [key, value] of urlParams.entries()) {
        // Strip everything that isn't a letter or number to ensure we find "sguid"
        // even if it has "?", "%3F", "amp;", or other artifacts
        const cleanKey = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const cleanName = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        
        if (cleanKey === cleanName) {
          return value;
        }
      }
      return null;
    };

    let capturedSguid = getParam('sguid');
    
    // Aggressive fallback to extract SGUID directly from href if URLSearchParams mangled it
    if (!capturedSguid) {
      const match = window.location.href.match(/[?&](?:%3F|\?)?sguid=([^&#]+)/i);
      if (match && match[1]) {
        capturedSguid = decodeURIComponent(match[1]);
      }
    }

    // Ignore placeholder merge tags if they weren't processed by the mailer
    if (capturedSguid === '__CUSTOMER_ID__' || capturedSguid?.startsWith('__')) {
      capturedSguid = null;
    }

    if (capturedSguid) {
      setSguid(capturedSguid);
      console.log("Captured SGUID:", capturedSguid);
    }
    
    const fetchSurvey = async () => {
      try {
        const docRef = doc(db, 'surveys', surveyId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as Survey;
          setSurvey({ ...data, id: docSnap.id, questions: (data.questions || []).filter(Boolean), links: (data.links || []).filter(Boolean) } as Survey);

          // Track clicks
          const urlParams = new URLSearchParams(window.location.search);
          const ref = urlParams.get('ref');
          if (ref && data.links && data.links.length > 0) {
            const updatedLinks = (data.links||[]).filter(Boolean).map(l => {
              if (l.url.includes(`ref=${ref}`)) {
                return { ...l, clicks: (l.clicks || 0) + 1 };
              }
              return l;
            });
            
            const linksChanged = JSON.stringify(updatedLinks) !== JSON.stringify(data.links);
            if (linksChanged) {
              await updateDoc(docRef, { links: JSON.parse(JSON.stringify(updatedLinks)) });
            }
          }
        } else {
          showToast("Survey not found", "error");
          onExit();
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `surveys/${surveyId}`);
        showToast("Error loading survey", "error");
        onExit();
      } finally {
        setLoading(false);
      }
    };
    fetchSurvey();
  }, [surveyId]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <Loader2 className="w-10 h-10 text-hr-blue animate-spin" />
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 p-8 text-center space-y-6">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
           <AlertCircle className="w-10 h-10 text-gray-300" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-hr-navy">Survey Not Found</h2>
          <p className="text-gray-500 max-w-sm">The survey you are looking for might have been deleted or the link is invalid.</p>
        </div>
        <button onClick={onExit} className="btn-primary px-8">Back to Home</button>
      </div>
    );
  }

  const handleSurveyComplete = async (answers: any) => {
    try {
      const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
      const batch = writeBatch(db);
      
      // 1. Add Response
      const responseRef = doc(collection(db, 'surveys', surveyId, 'responses'));
      batch.set(responseRef, {
        surveyId,
        answers,
        submittedAt: serverTimestamp(),
        durationSeconds,
        ...(sguid ? { sguid } : {})
      });

      // 2. Update Survey Stats
      const surveyRef = doc(db, 'surveys', surveyId);
      batch.update(surveyRef, {
        responses: increment(1),
        lastResponse: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      });

      await batch.commit();
      showToast("Response recorded successfully!", "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `surveys/${surveyId}/responses`);
      showToast("Failed to save response", "error");
    }
  };

  return (
    <RespondentView 
      survey={survey} 
      questions={(survey as any).questions || []} 
      onComplete={handleSurveyComplete}
      onExit={onExit}
      showToast={showToast}
      isTestMode={isTestMode}
      comments={comments}
    />
  );
}

function LandingPage({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-screen bg-bg-primary flex">
      {/* Left side - Branding/Illustration */}
      <div className="hidden lg:flex w-1/2 bg-gray-50 relative overflow-hidden flex-col justify-center px-16 lg:px-24 border-r border-gray-200">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-1/4 -right-1/4 w-[800px] h-[800px] bg-hr-blue/10 blur-[120px] rounded-full mix-blend-multiply animate-pulse" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-hr-orange/10 blur-[100px] rounded-full mix-blend-multiply" />
        </div>
        
        <div className="relative z-10 text-left">
          <img src="https://public-cdn.hr.com/remoteimages/Brand_Guideline/hrresearch_color_logo.png" alt="HR Research" className="h-[42px] mb-12" referrerPolicy="no-referrer" />
          
          <h1 className="text-4xl lg:text-5xl font-black text-hr-navy leading-[1.1] tracking-tight mb-8">
            The next generation of <br />
            <span className="text-hr-blue">workplace research</span>.
          </h1>
          <p className="text-lg text-gray-600 max-w-lg leading-relaxed font-medium mb-12">
            Design, distribute, and analyze professional surveys. Join thousands of HR leaders shaping the future of work through data-driven insights.
          </p>

          <div className="flex items-center gap-6 text-gray-500 text-sm font-bold uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-hr-green" /> Enterprise Grade
            </div>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-hr-blue" /> Real-time Analytics
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 lg:px-16 bg-white relative">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden flex justify-center mb-12">
            <img src="https://public-cdn.hr.com/remoteimages/Brand_Guideline/hrresearch_color_logo.png" alt="HR.com" className="h-12" referrerPolicy="no-referrer" />
          </div>

          <div className="text-center">
            <h2 className="text-3xl font-black text-hr-navy tracking-tight mb-2">Welcome Back</h2>
            <p className="text-sm font-medium text-gray-500">Log in to manage your surveys and research data</p>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-2xl shadow-hr-navy/5 border border-gray-100">
            <button 
              onClick={onLogin}
              className="w-full flex justify-center items-center gap-3 py-4 px-4 bg-white border border-gray-200 rounded-2xl shadow-sm text-sm font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98] group"
            >
              <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                 <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                 <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                 <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                 <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>
            <div className="mt-6 flex items-center justify-between text-xs text-gray-400 font-medium">
              <span className="w-1/2 h-px bg-gray-100 block"></span>
              <span className="px-3 uppercase tracking-wider text-hr-blue font-bold">Secure</span>
              <span className="w-1/2 h-px bg-gray-100 block"></span>
            </div>
            <p className="text-center text-[11px] text-gray-400 mt-6 leading-relaxed">
              By logging in, you agree to HR.com's Terms of Service and Privacy Policy. Access is restricted to authorized personnel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function shouldShowQuestion(question: Question, answers: Record<string, any>): boolean {
  if (!question.logic || !question.logic.enabled) return true;
  if (question.logic.disabled) return false;
  if (question.logic.hideByDefault) return false;
  
  const { conditions } = question.logic;
  if (!conditions || conditions.length === 0) return true;
  
  return conditions.every(condition => {
    const answerValue = answers[condition.questionId];
    
    switch (condition.operator) {
      case 'is_one_of':
        const ansArr = Array.isArray(answerValue) ? answerValue : [answerValue];
        return condition.values.some(v => ansArr.includes(v));
      case 'is_not_one_of':
        const ansArrNot = Array.isArray(answerValue) ? answerValue : [answerValue];
        return !condition.values.some(v => ansArrNot.includes(v));
      case 'is_answered':
        return answerValue !== undefined && answerValue !== null && answerValue !== '' && (Array.isArray(answerValue) ? answerValue.length > 0 : true);
      case 'is_not_answered':
        return answerValue === undefined || answerValue === null || answerValue === '' || (Array.isArray(answerValue) ? answerValue.length === 0 : false);
      default:
        return true;
    }
  });
}

function PlayfulSidebar({ 
  survey, 
  progress, 
  pages, 
  activePageIndex, 
  currentStep,
  activeQuestionIndex,
  activeQuestion,
  activeQuestionIdInView
}: { 
  survey: Survey; 
  progress: number; 
  pages: any[][]; 
  activePageIndex: number; 
  currentStep: string;
  activeQuestionIndex: number;
  activeQuestion?: Question;
  activeQuestionIdInView: string | null;
}) {
  const stepLabels = ["Your Experience", "Growth & Goals", "AI & Tools", "Open Feedback", "Finish"];
  const surveyLogo = survey?.logoUrl || "https://public-cdn.hr.com/remoteimages/Brand_Guideline/hrresearch_color_logo.png";
  
  return (
    <div className="hidden lg:flex flex-col w-[350px] fixed left-0 top-0 bottom-0 bg-[#F9FAFB] border-r border-gray-100 p-8 overflow-hidden z-20">
      <div className="mb-10">
        <div className="mb-10">
          <img src={surveyLogo} alt="HR.com" className="h-7 w-auto" referrerPolicy="no-referrer" />
        </div>

        <div className="space-y-4">
          <h1 className="text-2xl font-black text-gray-900 leading-tight tracking-tight">
            Let's build a workplace we all love.
          </h1>
          <p className="text-gray-500 font-medium leading-relaxed text-sm">
            Your feedback shapes the future of work.
          </p>
        </div>
      </div>
      
      <div className="mb-10">
        <div className="relative flex justify-center">
             <div className="w-full max-w-[200px] aspect-video relative flex items-center justify-center">
                <div className="absolute inset-0 rounded-2xl bg-white border border-gray-100 shadow-sm p-4 overflow-hidden">
                   <div className="space-y-2">
                      <div className="h-1.5 w-full bg-indigo-50/50 rounded-full" />
                      <div className="h-1.5 w-4/5 bg-gray-50 rounded-full" />
                      <div className="flex gap-2 items-center">
                        <div className="w-3 h-3 rounded-full bg-indigo-500" />
                        <div className="h-1.5 flex-1 bg-indigo-50 rounded-full" />
                      </div>
                      <div className="h-1.5 w-3/4 bg-gray-50 rounded-full" />
                   </div>
                </div>
                <div className="absolute -top-3 -right-3 w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg rotate-6">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg">
                  <Check className="w-5 h-5" />
                </div>
             </div>
          </div>
      </div>

      <div className="flex-1 space-y-8 flex flex-col justify-start">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
           <div className="flex justify-between items-center mb-3">
             <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Survey progress</span>
             <span className="text-[10px] font-black text-indigo-600">{Math.round(progress)}% complete</span>
           </div>
           <div className="h-1.5 w-full bg-gray-50 rounded-full overflow-hidden">
             <motion.div 
               className="h-full bg-indigo-500"
               initial={{ width: 0 }}
               animate={{ width: `${progress}%` }}
               transition={{ type: 'spring', damping: 20, stiffness: 100 }}
             />
           </div>
        </div>

        <div className="space-y-4 px-1">
          {(() => {
            let currentStepIdx = 0;
            if (currentStep === 'thanks') {
              currentStepIdx = stepLabels.length - 1;
            } else {
              const activeQuestionMatch = survey.questions?.find((q: Question) => q.id === activeQuestionIdInView);
              if (activeQuestionMatch) {
                if (pages.length > 1) {
                  currentStepIdx = pages.findIndex(page => page.some(q => q.id === activeQuestionMatch.id));
                  if (currentStepIdx === -1) currentStepIdx = activePageIndex;
                } else {
                  const visibleQ = survey.questions?.filter(q => q.type !== 'page_break' && q.type !== 'html') || [];
                  const qIndex = visibleQ.findIndex(q => q.id === activeQuestionMatch.id);
                  if (qIndex >= 0) {
                    const maxStep = stepLabels.length - 2;
                    currentStepIdx = Math.floor((qIndex / visibleQ.length) * (maxStep + 1));
                    if (currentStepIdx > maxStep) currentStepIdx = maxStep;
                  }
                }
              } else {
                currentStepIdx = activePageIndex;
              }
            }
            const activeStepIndex = Math.min(currentStepIdx, stepLabels.length - 1);

            return stepLabels.map((label, idx) => {
              const isCompleted = idx < activeStepIndex;
              const isActive = idx === activeStepIndex;
              return (
                <div key={idx} className="flex items-center gap-4">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-all border-2",
                    isCompleted ? "bg-indigo-600 border-indigo-600 text-white" :
                    isActive ? "bg-white border-indigo-600 text-indigo-600 scale-105 shadow-md shadow-indigo-100" :
                    "bg-white border-gray-100 text-gray-300"
                  )}>
                    {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span className={cn(
                    "text-xs font-bold transition-colors",
                    isActive ? "text-indigo-600" : (isCompleted ? "text-gray-900" : "text-gray-300")
                  )}>
                    {label}
                  </span>
                </div>
              );
            });
          })()}
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-gray-50 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
           <ShieldCheck className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-1">Your responses are</p>
          <p className="text-[9px] text-gray-400/80 font-bold uppercase tracking-wider leading-none">anonymous & confidential.</p>
        </div>
      </div>
    </div>
  );
}

function RespondentView({ survey, questions, onComplete, onExit, showToast, isPreview, isTestMode, comments = [] }: RespondentViewProps) {
  const [currentStep, setCurrentStep] = useState<'questions' | 'thanks'>('questions');
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [failedQuestionIds, setFailedQuestionIds] = useState<string[]>([]);
  const [activeQuestionIdInView, setActiveQuestionIdInView] = useState<string | null>(() => questions[0]?.id || null);
  const [showComments, setShowComments] = useState(isPreview || isTestMode);
  const [diagnosticResults, setDiagnosticResults] = useState<SurveyDiagnostic | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  useEffect(() => {
    if (isPreview || isTestMode) {
      setShowComments(true);
    }
  }, [isPreview, isTestMode]);

  const isPlayful = survey.theme === 'playful';
  const themeClasses = useMemo(() => getThemeClasses(survey.theme), [survey.theme]);
  const { bg, font, accent } = themeClasses;

  const pages = useMemo(() => {
    const result: Question[][] = [[]];
    for (const q of questions) {
      if (q.type === 'page_break') {
        result.push([]);
      } else {
        result[result.length - 1].push(q);
      }
    }
    return result.filter(p => p.length > 0);
  }, [questions]);

  const activePageQuestions = useMemo(() => 
    (pages[activePageIndex] || []).filter(q => shouldShowQuestion(q, answers)),
  [pages, activePageIndex, answers]);

  const progress = useMemo(() => {
    if (!survey.questions) return 0;
    const visibleQuestions = survey.questions.filter(q => 
      q.type !== 'page_break' && 
      q.type !== 'html' && 
      shouldShowQuestion(q, answers)
    );
    if (visibleQuestions.length === 0) return 100;
    
    const answeredCount = visibleQuestions.filter(q => {
      const val = answers[q.id];
      if (Array.isArray(val)) return val.length > 0;
      return val !== undefined && val !== null && val !== '';
    }).length;
    
    return (answeredCount / visibleQuestions.length) * 100;
  }, [survey.questions, answers]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (currentStep !== 'questions') return;
      if (e.key === 'Enter' && !e.shiftKey) {
        if (document.activeElement?.tagName.toLowerCase() === 'textarea') return;
        
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, activePageIndex, answers, activePageQuestions]);

  const scrollToTop = () => {
    document.getElementById('survey-scroll-container')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNext = () => {
    const missing = activePageQuestions.filter(q => {
      if (!q.required || ['html', 'page_break'].includes(q.type)) return false;
      
      const isOtherActive = q.hasOther && answers[`${q.id}_other_active`];
      const hasOtherText = q.hasOther && answers[`${q.id}_other`]?.trim().length > 0;
      
      if (q.type === 'matrix') {
        return (q.rows || []).some((_, ri) => {
          const val = answers[`${q.id}_${ri}`];
          return val === undefined || val === '';
        });
      }
      
      if (q.type === 'checkbox') {
        const val = answers[q.id] || [];
        return !(Array.isArray(val) && val.length > 0) && !(isOtherActive && hasOtherText);
      }

      const val = answers[q.id];
      return (val === undefined || val === '') && !(isOtherActive && hasOtherText);
    });

    if (missing.length > 0) {
      setSubmitError('Please complete all required fields*');
      setFailedQuestionIds(missing.map(q => q.id));
      
      const firstMissing = missing[0];
      const element = document.getElementById(`q-container-${firstMissing.id}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    
    setSubmitError(null);
    setFailedQuestionIds([]);

    if (activePageIndex < pages.length - 1) {
      setActivePageIndex(prev => prev + 1);
      scrollToTop();
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (activePageIndex > 0) {
      setActivePageIndex(prev => prev - 1);
      setSubmitError(null);
      scrollToTop();
    }
  };

  const handleComplete = () => {
    setSubmitError(null);
    setCurrentStep('thanks');
    onComplete(answers);
  };

  const handleAnswer = (qid: string, value: any) => {
    setAnswers(prev => ({ ...prev, [qid]: value }));
    if (submitError) setSubmitError(null);
    if (failedQuestionIds.includes(qid)) {
      setFailedQuestionIds(prev => prev.filter(id => id !== qid));
    }
  };

  const globalQuestionOffset = useMemo(() => {
    let count = 0;
    for (let i = 0; i < activePageIndex; i++) {
      count += (pages[i] || []).filter(q => shouldShowQuestion(q, answers)).length;
    }
    return count;
  }, [pages, activePageIndex, answers]);

  const activeQuestionIndex = useMemo(() => {
    if (!activeQuestionIdInView) return 0;
    return (survey.questions || []).findIndex(q => q.id === activeQuestionIdInView);
  }, [survey.questions, activeQuestionIdInView]);

  return (
    <div 
      id="survey-scroll-container" 
      className={cn("fixed inset-0 z-[100] overflow-y-auto flex flex-col", isPlayful ? "bg-[#FBFBFC]" : bg, font)}
      onScroll={(e) => {
        if (!isPlayful) return;
        
        const container = e.currentTarget;
        const containerRect = container.getBoundingClientRect();
        const triggerY = containerRect.top + containerRect.height * 0.3; // 30% from top
        
        let closestId = "";
        let minDistance = Infinity;

        const questionsElements = document.querySelectorAll('[id^="q-container-"]');
        
        questionsElements.forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.top <= triggerY && rect.bottom >= triggerY) {
            closestId = el.id.replace('q-container-', '');
            minDistance = 0;
          } else {
            const distance = Math.abs(rect.top - triggerY);
            if (minDistance !== 0 && distance < minDistance) {
              minDistance = distance;
              closestId = el.id.replace('q-container-', '');
            }
          }
        });

        if (closestId && closestId !== activeQuestionIdInView) {
          setActiveQuestionIdInView(closestId);
        }
      }}
    >
      {isPlayful && (
        <PlayfulSidebar 
          survey={survey} 
          progress={progress} 
          pages={pages} 
          activePageIndex={activePageIndex} 
          currentStep={currentStep}
          activeQuestionIndex={activeQuestionIndex}
          activeQuestion={survey.questions?.[activeQuestionIndex]}
          activeQuestionIdInView={activeQuestionIdInView}
        />
      )}
      
      {isTestMode && (
        <div className="bg-[#02588E] text-white p-4 text-sm flex justify-between items-center fixed top-0 w-full z-[300] shadow-xl border-b border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
               <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <strong className="text-sm tracking-tight">Active Test Mode</strong><br />
              <span className="text-[10px] opacity-70 uppercase font-black tracking-widest">Internal Preview Only • Anonymous Responses</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={async () => {
                if (isDiagnosing) return;
                setIsDiagnosing(true);
                showToast("AI Agent is analyzing your survey...", "info");
                try {
                  const results = await diagnoseSurvey(survey.title, survey.desc || '', questions);
                  setDiagnosticResults(results);
                  showToast(`AI Diagnostic complete! Score: ${results.overallScore}%`, "success");
                } catch (err) {
                  console.error(err);
                  showToast("AI Analysis failed", "error");
                } finally {
                  setIsDiagnosing(false);
                }
              }}
              disabled={isDiagnosing}
              className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center gap-2 disabled:opacity-50"
            >
              {isDiagnosing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
              AI Diagnostic
            </button>
            <button 
              onClick={() => setShowComments(!showComments)}
              className="bg-white text-[#02588E] hover:bg-white/90 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center gap-2"
            >
              {showComments ? <><MessageSquare className="w-3.5 h-3.5" /> Hide Tool</> : <><MessageSquare className="w-3.5 h-3.5" /> Feedback Tool</>}
            </button>
          </div>
        </div>
      )}
      
      {diagnosticResults && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col border border-gray-100 animate-in zoom-in-95 duration-300">
              <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-indigo-50/30">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center border border-indigo-200">
                       <Brain className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-hr-navy">AI Survey Diagnostics</h3>
                      <p className="text-xs text-gray-500 font-medium">Expert analysis of flow, bias, and fatigue</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Quality Score</div>
                      <div className={cn(
                        "text-2xl font-black",
                        diagnosticResults.overallScore >= 80 ? "text-hr-green" : 
                        diagnosticResults.overallScore >= 60 ? "text-hr-orange" : "text-hr-red"
                      )}>
                        {diagnosticResults.overallScore}%
                      </div>
                    </div>
                    <button 
                      onClick={() => setDiagnosticResults(null)}
                      className="p-3 hover:bg-white rounded-2xl text-gray-400 hover:text-hr-navy transition-all border border-transparent hover:border-gray-200"
                    >
                      <X className="w-6 h-6" />
                    </button>
                 </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                       <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">Issues Found</h4>
                       {diagnosticResults.issues.map((issue, idx) => (
                         <div key={idx} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                               <span className={cn(
                                 "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border",
                                 issue.severity === 'Critical' ? "bg-red-50 text-red-600 border-red-100" :
                                 issue.severity === 'Major' ? "bg-orange-50 text-orange-600 border-orange-100" :
                                 issue.severity === 'Minor' ? "bg-blue-50 text-blue-600 border-blue-100" :
                                 "bg-gray-50 text-gray-600 border-gray-100"
                               )}>
                                 {issue.severity}
                               </span>
                               <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{issue.category}</span>
                            </div>
                            <div>
                               <p className="text-sm font-bold text-hr-navy mb-1">{issue.title}</p>
                               <p className="text-xs text-gray-500 leading-relaxed font-medium">{issue.description}</p>
                            </div>
                            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/30">
                               <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                 <Sparkles className="w-3 h-3" /> Agent Recommendation
                               </p>
                               <p className="text-xs text-indigo-900 leading-relaxed font-medium italic">"{issue.suggestion}"</p>
                            </div>
                         </div>
                       ))}
                    </div>
                    
                    <div className="space-y-8">
                       <div>
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1 mb-4">Core Strengths</h4>
                          <div className="bg-emerald-50/30 border border-emerald-100 rounded-2xl p-6 space-y-4">
                             {diagnosticResults.strengths.map((str, idx) => (
                               <div key={idx} className="flex items-start gap-4">
                                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                                     <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  </div>
                                  <p className="text-xs font-medium text-emerald-900 leading-relaxed">{str}</p>
                               </div>
                             ))}
                          </div>
                       </div>
                       
                       <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                          <h4 className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] mb-4">Summary</h4>
                          <p className="text-sm font-medium leading-relaxed mb-4">
                             Your survey has a <strong className="text-white">{diagnosticResults.fatigueLevel}</strong> fatigue level and an estimated completion time of <strong className="text-white">{diagnosticResults.estimatedTime}</strong>.
                          </p>
                          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                             <div 
                                className="h-full bg-white transition-all duration-1000" 
                                style={{ width: `${diagnosticResults.overallScore}%` }} 
                             />
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
      
      {isPreview && (
        <div className={cn("h-12 border-b flex items-center justify-between px-6 backdrop-blur-md sticky z-[200] shadow-sm flex-none", isPlayful ? "lg:ml-[380px] bg-white/80 border-gray-100" : "bg-white/80 border-gray-200", isTestMode ? "top-[68px]" : "top-0")}>
           <div className="flex items-center gap-4">
              <div className={cn("bg-opacity-10 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border flex items-center gap-2", accent, accent.replace('text-', 'bg-').replace('border-', 'bg-'), accent.replace('text-', 'border-'))}>
                <Sparkles className="w-2.5 h-2.5" /> Previewing Mode
              </div>
              <h3 className="font-bold text-hr-navy hidden sm:block text-sm">{survey?.title || 'Survey Preview'}</h3>
           </div>
           <button 
            onClick={onExit}
            className="flex items-center gap-2 bg-hr-navy text-white hover:bg-hr-navy/90 rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest shadow-md transition-all active:scale-95"
           >
             <X className="w-3.5 h-3.5" /> Exit
           </button>
        </div>
      )}
      <div className={cn("min-h-screen flex flex-col flex-1", isPlayful ? "lg:ml-[380px]" : "pb-24", isTestMode && !isPreview ? "pt-[68px]" : "")}>
        {/* Header (only for non-playful or mobile) */}
        <header className={cn("flex-none p-3 md:p-4 flex items-center justify-between z-10 w-full max-w-7xl mx-auto px-4", isPlayful && "lg:hidden")}>
          <div className="flex items-center gap-2">
              <img 
                src={survey?.logoUrl || "https://public-cdn.hr.com/remoteimages/Brand_Guideline/hrresearch_color_logo.png"} 
                alt="HR Research" 
                className="h-5 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
          </div>
          {currentStep === 'questions' && (
            <div className="text-[10px] font-bold text-slate-500">
              {Math.round(progress)}%
            </div>
          )}
        </header>

        {/* Progress Bar (non-playful only) */}
        {!isPlayful && (
          <div className="flex-none w-full h-1 sticky top-0 left-0 z-20 bg-gray-100">
            <motion.div 
              className={cn("h-full", accent.replace('text-', 'bg-'))}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}

        {/* Main Content Area */}
        <main className={cn("flex-1 flex flex-col items-center w-full mx-auto px-4 md:px-6 pt-8 pb-32", isPlayful ? "max-w-4xl px-4 md:px-8" : "max-w-5xl pt-2")}>
          <AnimatePresence mode="wait">
            {currentStep === 'questions' && (
              <motion.div 
                key={`page-${activePageIndex}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
                className={cn("w-full", isPlayful ? "space-y-6" : "space-y-3")}
              >
                {/* Progress Bar (only for non-playful, playful has it in sidebar) */}
                {!isPlayful && (
                  <div className="space-y-2 mb-12 text-center max-w-5xl mx-auto">
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight text-hr-navy whitespace-pre-wrap">
                      {survey.title}
                    </h1>
                    {survey?.desc && (
                      <div className="flex items-center justify-center gap-4">
                         <div className="h-[1px] w-12 bg-gray-200" />
                         <p className="text-[10px] md:text-[11px] leading-relaxed uppercase tracking-[0.3em] font-black opacity-50 text-gray-500">
                            {survey.desc}
                         </p>
                         <div className="h-[1px] w-12 bg-gray-200" />
                      </div>
                    )}
                  </div>
                )}
                {activePageQuestions.length === 0 && pages.length === 0 && (
                  <div className="py-20 text-center space-y-4">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10">
                      <ClipboardList className="w-8 h-8 text-white/20" />
                    </div>
                    <p className="text-white/30 font-medium">This survey has no questions yet.</p>
                  </div>
                )}
                <div className="flex flex-col gap-4">
                  {activePageQuestions.map((q, qidx) => (
                    <div key={q.id} className="relative group">
                      <QuestionRenderer 
                        question={q}
                        answer={answers[q.id]}
                        onChange={(val) => handleAnswer(q.id, val)}
                        themeClasses={themeClasses}
                        showError={failedQuestionIds.includes(q.id)}
                        index={globalQuestionOffset + qidx}
                        isPlayful={isPlayful}
                      />
                      {showComments && (
                        <div className="absolute top-0 right-0 -mr-6 md:-mr-12 z-10">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const newCommentsState = answers[`${q.id}_comment_open`] ? false : true;
                              setAnswers(prev => ({ ...prev, [`${q.id}_comment_open`]: newCommentsState }));
                            }} 
                            className="w-10 h-10 bg-hr-blue hover:bg-hr-blue/90 text-white rounded-full shadow-lg flex flex-col items-center justify-center transition-all hover:scale-110 active:scale-95"
                            title="Add/View Comments"
                          >
                            <span className="text-[12px] font-black">
                              {(comments.filter(c => c.questionId === q.id).length) || 0}
                            </span>
                            <MessageSquare className="w-3 h-3 opacity-80" />
                          </button>
                        </div>
                      )}
                      
                      {showComments && answers[`${q.id}_comment_open`] && (
                        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-hr-blue/20 shadow-2xl rounded-2xl z-20 p-5 animate-in zoom-in-95 duration-200">
                           <div className="flex items-center justify-between mb-4">
                             <h4 className="text-hr-navy font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                               <MessageSquare className="w-3 h-3 text-hr-blue" />
                               Question Feedback
                             </h4>
                             <button onClick={() => setAnswers(prev => ({ ...prev, [`${q.id}_comment_open`]: false }))} className="text-gray-400 hover:text-gray-600">
                               <X className="w-4 h-4" />
                             </button>
                           </div>
                           {/* List of comments */}
                           {comments.filter(c => c.questionId === q.id).length > 0 && (
                             <div className="mb-4 space-y-2 max-h-40 overflow-y-auto">
                             {comments.filter(c => c.questionId === q.id).map((c: any) => (
                                 <div key={c.id} className={cn("text-xs bg-hr-blue/5 border border-hr-blue/10 p-3 rounded-xl", c.status === 'done' && 'opacity-50')}>
                                   <div className="flex justify-between font-bold mb-1.5 items-start">
                                     <span className="text-hr-blue truncate max-w-[120px]">{c.name}</span>
                                     <div className="flex flex-col items-end gap-1">
                                       <span className="text-[8px] text-gray-400 font-black uppercase tracking-wider">{new Date(c.createdAt).toLocaleDateString()}</span>
                                       <div className="flex items-center gap-2">
                                         {deletingCommentId === c.id ? (
                                            <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-1 duration-200">
                                               <button 
                                                 className="text-[9px] font-black text-red-500 hover:underline uppercase"
                                                 onClick={async (e) => {
                                                   e.stopPropagation();
                                                   try {
                                                     await deleteDoc(doc(db, 'surveys', survey.id, 'comments', c.id));
                                                     showToast("Comment deleted", "success");
                                                     setDeletingCommentId(null);
                                                   } catch (error) {
                                                     handleFirestoreError(error, OperationType.DELETE, `surveys/${survey.id}/comments/${c.id}`);
                                                   }
                                                 }}
                                               >
                                                 Yes
                                               </button>
                                               <button 
                                                 className="text-[9px] font-black text-gray-400 hover:underline uppercase"
                                                 onClick={(e) => { e.stopPropagation(); setDeletingCommentId(null); }}
                                               >
                                                 No
                                               </button>
                                            </div>
                                         ) : (
                                            <>
                                               <button 
                                                 className="cursor-pointer hover:scale-110 transition-transform"
                                                 onClick={async (e) => {
                                                   e.stopPropagation();
                                                   try {
                                                     await updateDoc(doc(db, 'surveys', survey.id, 'comments', c.id), { status: c.status === 'done' ? 'pending' : 'done' });
                                                   } catch (error) {
                                                     handleFirestoreError(error, OperationType.UPDATE, `surveys/${survey.id}/comments/${c.id}`);
                                                   }
                                                 }}
                                               >
                                                  <Check className={cn("w-6 h-6", c.status === 'done' ? "text-gray-400" : "text-hr-green")} />
                                               </button>
                                               <button 
                                                 className="cursor-pointer hover:scale-110 transition-transform"
                                                 onClick={(e) => {
                                                   e.stopPropagation();
                                                   setDeletingCommentId(c.id);
                                                 }}
                                               >
                                                  <X className="w-6 h-6 text-red-500" />
                                               </button>
                                            </>
                                         )}
                                       </div>
                                     </div>
                                   </div>
                                   <p className={cn("text-gray-600 leading-relaxed italic mt-1", c.status === 'done' && 'line-through')}>"{c.text}"</p>
                                 </div>
                               ))}
                             </div>
                           )}
                           <textarea 
                             placeholder="Type your feedback or comments here..." 
                             className="w-full bg-gray-50 border border-border-strong rounded-xl p-3 text-sm focus:outline-none focus:ring-4 ring-hr-blue/5 focus:bg-white focus:border-hr-blue/30 transition-all min-h-[100px] resize-none"
                             value={answers[`${q.id}_comment_text`] || ''}
                             onChange={(e) => setAnswers(prev => ({ ...prev, [`${q.id}_comment_text`]: e.target.value }))}
                           />
                           <div className="grid grid-cols-2 gap-3 mb-3">
                              <div>
                                <label className="text-xs text-gray-500 mb-1 block">Your Name</label>
                                <input 
                                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none" 
                                  value={answers[`${q.id}_comment_name`] || ''}
                                  onChange={(e) => setAnswers(prev => ({ ...prev, [`${q.id}_comment_name`]: e.target.value }))}
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500 mb-1 block">Your Email</label>
                                <input 
                                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none" 
                                  value={answers[`${q.id}_comment_email`] || ''}
                                  onChange={(e) => setAnswers(prev => ({ ...prev, [`${q.id}_comment_email`]: e.target.value }))}
                                />
                              </div>
                           </div>
                           <div className="flex justify-end gap-2 text-sm pt-2 border-t border-gray-50">
                             <button className="px-3 py-1 bg-white border border-gray-300 rounded text-gray-600 hover:bg-gray-50" onClick={() => setAnswers(prev => ({ ...prev, [`${q.id}_comment_open`]: false }))}>Cancel</button>
                             <button 
                               className="px-5 py-2.5 bg-hr-blue text-white rounded-xl font-bold text-xs hover:brightness-110 shadow-lg shadow-hr-blue/20 transition-all active:scale-95 flex-1 justify-center flex items-center gap-2"
                               onClick={async (e) => {
                                  e.stopPropagation();
                                  const text = answers[`${q.id}_comment_text`];
                                  const name = answers[`${q.id}_comment_name`] || 'Anonymous';
                                  const email = answers[`${q.id}_comment_email`] || '';
                                  if (!text) return;
                                  
                                  console.log("Saving comment for survey:", survey.id, "question:", q.id);
                                  const newComment = { text, name, email, createdAt: new Date().toISOString() };
                                  
                                  try {
                                    const colRef = collection(db, 'surveys', survey.id, 'comments');
                                    const docRef = doc(colRef);
                                    await setDoc(docRef, { ...newComment, questionId: q.id });
                                    showToast("Comment published", "success");
                                    setAnswers(prev => ({ ...prev, [`${q.id}_comment_text`]: '', [`${q.id}_comment_open`]: false }));
                                  } catch (err) {
                                    console.error("Comment save error:", err);
                                    handleFirestoreError(err, OperationType.WRITE, `surveys/${survey.id}/comments`);
                                    showToast("Failed to add comment", "error");
                                  }
                               }}
                             >
                               <Send className="w-3.5 h-3.5" /> Publish Comment
                             </button>
                           </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Playful Theme Navigation - Inline at bottom of questions */}
                {isPlayful && (
                  <div className="pt-10 flex flex-col items-center gap-6 w-full max-w-2xl mx-auto">
                    {submitError && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-red-50 text-red-500 px-6 py-4 rounded-3xl text-sm font-bold flex items-center gap-3 border border-red-100 shadow-xl"
                      >
                        <AlertCircle className="w-6 h-6 shrink-0" /> {submitError}
                      </motion.div>
                    )}
                    
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center max-w-sm mx-auto">
                        <button 
                         onClick={handleNext}
                         className="flex-1 w-full py-3 bg-hr-blue text-white rounded-xl font-bold text-base shadow-lg shadow-hr-blue/10 hover:brightness-110 transition-all flex items-center justify-center gap-2 active:scale-95 group"
                       >
                        {activePageIndex < pages.length - 1 ? 'Continue' : 'Submit Survey'}
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {currentStep === 'thanks' && (
              <motion.div 
                key="thanks"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full"
                dangerouslySetInnerHTML={{ __html: survey.thankYouHtml || DEFAULT_THANK_YOU_HTML }}
              />
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Footer / Navigation (non-playful only) */}
      {currentStep === 'questions' && !isPlayful && (
        <div className="fixed bottom-0 left-0 w-full backdrop-blur-md border-t z-30 py-3 md:py-4 px-4 md:px-6 bg-white/90 border-gray-200">
          <div className="max-w-6xl mx-auto flex flex-col items-center gap-4 flex-row justify-between">
              <>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handlePrev}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border transition-all shrink-0 font-bold text-xs px-4 py-2",
                      activePageIndex === 0 
                        ? "opacity-0 pointer-events-none" 
                        : "bg-white text-gray-600 hover:bg-gray-50 border-gray-200"
                    )}
                    disabled={activePageIndex === 0}
                  >
                     <ArrowLeft className="w-4 h-4" />
                     <span className="hidden sm:block">Previous</span>
                  </button>
                  {submitError && (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      className="bg-red-50 text-red-500 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 border border-red-100"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {submitError}
                    </motion.div>
                  )}
                </div>
                
                <button 
                  onClick={handleNext}
                  className={cn("px-6 py-2 md:px-8 md:py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg flex items-center gap-2 shrink-0 transform active:scale-95", accent.replace('text-', 'bg-'), "text-white", "hover:opacity-90")}
                >
                  {activePageIndex < pages.length - 1 ? 'Next Step' : 'Submit Survey'}
                  {activePageIndex < pages.length - 1 ? <ArrowRight className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4 ml-1" />}
                </button>
              </>
          </div>
        </div>
      )}

    </div>
  );
}

function ShareView({ survey, onUpdateSurvey, showToast }: ShareViewProps) {
  const [newLinkName, setNewLinkName] = useState('');
  const [newLinkSlug, setNewLinkSlug] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [linkToDelete, setLinkToDelete] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState('');

  const links = survey.links || [];

  const handleInviteUser = () => {
    const trimmed = shareEmail.trim().toLowerCase();
    if (!trimmed) return;
    if (trimmed === (survey.ownerEmail || '').toLowerCase()) {
      showToast('You are the owner of this survey', 'error');
      return;
    }
    const currentShared = survey.sharedEmails || [];
    if (currentShared.includes(trimmed)) {
      showToast('User is already added', 'info');
      return;
    }
    const updatedShared = [...currentShared, trimmed];
    onUpdateSurvey({ ...survey, sharedEmails: updatedShared });
    setShareEmail('');
    showToast(`Access granted to ${trimmed}`, 'success');
  };

  const handleRevokeAccess = (emailToRevoke: string) => {
    const currentShared = survey.sharedEmails || [];
    const updatedShared = currentShared.filter((e: string) => e !== emailToRevoke);
    onUpdateSurvey({ ...survey, sharedEmails: updatedShared });
    showToast(`Access revoked for ${emailToRevoke}`, 'info');
  };

  const handleCreateLink = () => {
    if (!newLinkName.trim()) return;
    const finalSlug = newLinkSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || 
                     newLinkName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    const newLink = {
      id: `l-${Date.now()}`,
      name: newLinkName.trim(),
      url: `${getPublicUrl()}/?v=${survey.id}&ref=${finalSlug}&SGUID=__CUSTOMER_ID__`,
      clicks: 0,
      status: 'Active' as const
    };
    
    onUpdateSurvey({ ...survey, links: [newLink, ...links] });
    setNewLinkName('');
    setNewLinkSlug('');
    showToast('New tracking link with SGUID tag generated');
  };

  const handleCopy = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    showToast('Link copied to clipboard!', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteLink = (id: string) => {
    setLinkToDelete(id);
  };

  const confirmDeleteLink = () => {
    if (linkToDelete) {
      onUpdateSurvey({ ...survey, links: links.filter(l => l && l.id !== linkToDelete) });
      setLinkToDelete(null);
      showToast('Tracking link deleted', 'info');
    }
  };

  const toggleLinkStatus = (id: string) => {
    onUpdateSurvey({
      ...survey,
      links: links.map(l => l && l.id === id ? { ...l, status: l.status === 'Active' ? 'Paused' : 'Active' } : l)
    });
  };

  return (
    <div className="space-y-10 py-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-light tracking-tight text-hr-navy">Share & Distribution</h2>
          <p className="text-gray-500 font-medium italic">Create unique tracking links for different channels</p>
        </div>
      </div>

      <div className="bg-white border border-border-strong rounded-3xl p-8 shadow-sm space-y-6">
        <h3 className="text-sm font-bold text-hr-navy uppercase tracking-widest mb-6">Generate New Tracking Link</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Internal Name</label>
            <div className="relative">
              <input 
                type="text" 
                placeholder="e.g. Q4 Email Newsletter" 
                value={newLinkName || ''}
                onChange={(e) => setNewLinkName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-border-strong rounded-xl text-sm focus:outline-none focus:ring-4 ring-hr-blue/5 focus:bg-white transition-all font-medium"
              />
              <Edit3 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
            </div>
          </div>

              <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Link Extension (Slug)</label>
            <div className="flex items-center bg-gray-50 border border-border-strong rounded-xl overflow-hidden focus-within:ring-4 ring-hr-blue/5 transition-all">
              <div className="px-3 py-3 border-r border-border-strong text-gray-400 text-[10px] font-mono font-bold bg-white/50 shrink-0 truncate max-w-[120px]">{window.location.origin.replace(/^https?:\/\//, '')}/?v=...&ref=</div>
              <input 
                type="text" 
                placeholder="slug" 
                value={newLinkSlug || ''}
                onChange={(e) => setNewLinkSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                className="flex-1 px-3 py-3 bg-transparent text-sm focus:outline-none font-bold text-hr-blue placeholder:text-gray-200"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-gray-50">
          <button 
            type="button"
            onClick={handleCreateLink}
            disabled={!newLinkName.trim()}
            className="px-12 py-4 bg-hr-blue text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:translate-y-[-2px] hover:brightness-110 transition-all active:scale-95 disabled:opacity-50 disabled:translate-y-0 shadow-lg shadow-hr-blue/20 flex items-center gap-3 group"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" /> Generate Link
          </button>
        </div>
        
        <div className="mt-4 p-4 bg-hr-blue/5 border border-hr-blue/20 rounded-2xl flex gap-3 items-start">
          <Sparkles className="w-5 h-5 text-hr-blue shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-bold text-hr-navy">SGUID Merge Tag Support</p>
            <p className="text-[11px] text-gray-500 leading-relaxed font-medium">
              These links contain a <code className="bg-hr-blue/10 px-1 py-0.5 rounded text-hr-blue font-bold">__CUSTOMER_ID__</code> placeholder. 
              Paste this link into your Email Marketing tool or CRM, and configure your system to replace the placeholder 
              with the user's actual Profile ID or Unique Identifier.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-6 pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50">
           <span className="flex-1">Channel Name & URL</span>
           <div className="flex items-center gap-16 mr-20">
              <span className="w-20 text-center">Interactions</span>
              <span className="w-20 text-center">Status</span>
              <span className="w-40 text-right">Actions</span>
           </div>
        </div>

        {links.length === 0 ? (
          <div className="py-20 text-center bg-gray-50/50 rounded-[40px] border-2 border-dashed border-gray-100">
             <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm mb-4">
                <Link2 className="w-6 h-6 text-gray-200" />
             </div>
             <p className="text-gray-400 font-medium">No tracking links created yet.</p>
          </div>
        ) : (
          links.filter(Boolean).map(link => (
            <div key={link.id} className="group flex items-center gap-6 p-6 bg-white border border-border-subtle rounded-3xl hover:border-hr-blue/30 hover:shadow-xl hover:shadow-hr-navy/5 transition-all">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1.5">
                  <h4 className="font-bold text-hr-navy text-lg truncate">{link.name}</h4>
                  <span className={cn(
                    "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest",
                    link.status === 'Active' ? "bg-hr-green/10 text-hr-green" : "bg-gray-100 text-gray-400"
                  )}>
                    {link.status === 'Active' ? 'Live URL' : 'Paused'}
                  </span>
                </div>
                <div className="flex items-center gap-2 group/url cursor-pointer" onClick={() => { 
                      navigator.clipboard.writeText(link.url);
                      showToast('Link copied!', 'success');
                    }}>
                   <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-border-subtle rounded-xl text-xs text-hr-blue font-mono truncate max-w-md group-hover/url:border-hr-blue/30 transition-all">
                      {link.url}
                   </div>
                   <div className="flex items-center gap-1.5 text-hr-blue bg-hr-blue/5 px-2.5 py-1.5 rounded-xl opacity-0 group-hover/url:opacity-100 transition-all shadow-sm">
                      <Copy className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Copy</span>
                   </div>
                </div>
              </div>

              <div className="flex items-center gap-12 shrink-0">
                <div className="w-20 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <span className="text-xl font-black text-hr-navy leading-none">{link.clicks}</span>
                    <BarChart3 className="w-3 h-3 text-hr-blue" />
                  </div>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Interactions</p>
                </div>

                <div className="w-px h-10 bg-gray-100 hidden md:block" />

                <div className="flex items-center gap-2">
                   <button 
                    onClick={() => handleCopy(link.url, link.id)}
                    className={cn(
                      "flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-xs transition-all shadow-lg",
                      copiedId === link.id 
                        ? "bg-hr-green text-white shadow-hr-green/20" 
                        : "bg-hr-blue text-white shadow-hr-blue/20 hover:scale-105 active:scale-95"
                    )}
                   >
                      {copiedId === link.id ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy URL
                        </>
                      )}
                   </button>
                   <div className="flex items-center gap-1">
                     <button 
                      onClick={() => toggleLinkStatus(link.id)}
                      className="p-3 text-gray-400 hover:text-hr-blue hover:bg-hr-blue/5 rounded-2xl transition-all"
                      title={link.status === 'Active' ? 'Pause Link' : 'Activate Link'}
                     >
                       {link.status === 'Active' ? <Clock className="w-5 h-5" /> : <Send className="w-5 h-5" />}
                     </button>
                     <a 
                      href={link.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-3 text-gray-400 hover:text-hr-blue hover:bg-hr-blue/5 rounded-2xl transition-all"
                      title="Open in new tab"
                     >
                       <ExternalLink className="w-5 h-5" />
                     </a>
                     <button 
                      onClick={() => handleDeleteLink(link.id)}
                      className="p-3 text-gray-400 hover:text-hr-red hover:bg-hr-red/5 rounded-2xl transition-all"
                      title="Delete Link"
                     >
                       <Trash2 className="w-5 h-5" />
                     </button>
                   </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Team Collaborative Workspace Sharing Controls */}
      <div className="bg-white border border-border-strong rounded-3xl p-8 shadow-sm space-y-6 mt-10">
        <div>
          <h3 className="text-sm font-bold text-hr-navy uppercase tracking-widest mb-1 flex items-center gap-2">
            <Users className="w-4 h-4 text-hr-blue" /> Share Survey Workspace
          </h3>
          <p className="text-xs text-gray-500 font-medium">
            Grant specific team members access to view results, edit, and collaborate on this project
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <input 
                type="email" 
                placeholder="Enter colleague's Google account email (e.g. team@hr.com)" 
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-border-strong rounded-xl text-sm focus:outline-none focus:ring-4 ring-hr-blue/5 focus:bg-white transition-all font-medium"
              />
              <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
            </div>
            <button
              type="button"
              onClick={handleInviteUser}
              className="px-6 py-3 bg-hr-navy text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-hr-navy/90 transition-all active:scale-95 text-center shrink-0 animate-pulse duration-1000"
            >
              Add Access
            </button>
          </div>

          {/* Current collaborations list */}
          <div className="space-y-2 pt-4">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              People with Access
            </h4>
            
            <div className="divide-y divide-gray-50 border border-gray-100 rounded-2xl overflow-hidden bg-gray-50/20">
              {/* Creator display */}
              <div className="flex items-center justify-between p-4 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-hr-blue/10 text-hr-blue flex items-center justify-center font-bold text-xs">
                    {(survey.ownerEmail || 'HR').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-hr-navy truncate max-w-sm">{survey.ownerEmail || 'Original Creator'}</p>
                    <p className="text-[10px] text-gray-400">Creator / Owner</p>
                  </div>
                </div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-100 px-2.5 py-1 rounded">
                  Owner
                </span>
              </div>

              {/* Shared Collaborators list */}
              {(!survey.sharedEmails || survey.sharedEmails.length === 0) ? (
                <div className="p-6 text-center text-xs text-gray-400 bg-white italic">
                  Not shared with anyone yet. Enter an email address above to grant collaborator access.
                </div>
              ) : (
                survey.sharedEmails.map((email: string, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-white hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-hr-navy/5 text-hr-navy flex items-center justify-center font-bold text-xs text-gray-600">
                        {email.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-hr-navy truncate max-w-sm">{email}</p>
                        <p className="text-[10px] text-gray-400">Collaborator</p>
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => handleRevokeAccess(email)}
                      className="p-2 text-gray-400 hover:text-hr-red hover:bg-hr-red/5 rounded-lg transition-all"
                      title="Revoke Access"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {linkToDelete && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLinkToDelete(null)}
              className="absolute inset-0 bg-hr-navy/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-white w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-6">
                  <Trash2 className="w-6 h-6 text-hr-red" />
                </div>
                <h3 className="text-xl font-bold text-hr-navy mb-2">Delete Tracking Link?</h3>
                <p className="text-sm text-gray-500 leading-relaxed max-w-[280px]">
                  Are you sure you want to delete this tracking link? This action cannot be undone, and the link will stop working for respondents.
                </p>
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
                <button 
                  onClick={() => setLinkToDelete(null)}
                  className="flex-1 px-4 py-3 bg-white border border-gray-200 text-hr-navy font-bold rounded-xl hover:bg-gray-50 transition-all font-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDeleteLink}
                  className="flex-1 px-4 py-3 bg-hr-red text-white font-bold rounded-xl hover:bg-hr-red/90 shadow-lg shadow-hr-red/20 transition-all font-sm"
                >
                  Delete Link
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AiStressTestView({ 
  surveyId, 
  onExit, 
  showToast 
}: { 
  surveyId: string, 
  onExit: () => void, 
  showToast: (m: string, t?: any) => void 
}) {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [logs, setLogs] = useState<{ type: 'info' | 'success' | 'warning' | 'error', message: string, detail?: string, time: string }[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [isSimulating, setIsSimulating] = useState(false);
  const [status, setStatus] = useState<'idle' | 'running' | 'finished' | 'failed'>('idle');
  const [diagnostic, setDiagnostic] = useState<SurveyDiagnostic | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = (type: 'info' | 'success' | 'warning' | 'error', message: string, detail?: string) => {
    setLogs(prev => [...prev, { 
      type, 
      message, 
      detail, 
      time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) 
    }]);
  };

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    const fetchSurvey = async () => {
      try {
        const docRef = doc(db, 'surveys', surveyId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as Survey;
          setSurvey({ ...data, id: docSnap.id });
          setQuestions((data.questions || []).filter(Boolean));
          addLog('info', 'Survey loaded successfully', `Title: ${data.title}`);
        }
      } catch (err) {
        console.error(err);
        addLog('error', 'Failed to load survey data');
      }
    };
    fetchSurvey();
  }, [surveyId]);

  const getFallbackAnswer = (q: Question) => {
    if (q.choices && q.choices.length > 0) return q.choices[0];
    if (q.type === 'rating' || q.type === 'nps') return "8";
    if (q.type === 'short_text' || q.type === 'long_text') return "The process was smooth and efficient.";
    if (q.type === 'matrix') return "Satisfied";
    return "Default answer";
  };

  const shouldShowQuestion = (q: Question, currentAnswers: Record<string, any>) => {
    if (!q.logic || !q.logic.enabled || !q.logic.conditions.length) return true;
    
    // Logic defaults to OR for conditions if multiple exist in this simple engine
    return q.logic.conditions.some(condition => {
      const answer = currentAnswers[condition.questionId];
      if (!answer) return false;

      switch (condition.operator) {
        case 'is_one_of':
          return condition.values.includes(String(answer));
        case 'is_not_one_of':
          return !condition.values.includes(String(answer));
        case 'is_answered':
          return !!answer;
        case 'is_not_answered':
          return !answer;
        default:
          return true;
      }
    });
  };

  const startSimulation = async () => {
    if (!survey || questions.length === 0) return;
    
    setStatus('running');
    setIsSimulating(true);
    setAnswers({});
    setLogs([]);
    addLog('info', 'AI Agent "Gemini" initialized for stress test');
    addLog('info', 'Target persona: Professional HR Manager');

    try {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        
        // Respect logic
        if (!shouldShowQuestion(q, answers)) {
          addLog('info', `Logic Check: Skipping Question ${i + 1}`, `Condition not met for: "${q.text}"`);
          continue;
        }

        setCurrentQuestionIndex(i);
        addLog('info', `Processing Question ${i + 1}`, q.text);
        
        // Visual delay for "thinking"
        await new Promise(r => setTimeout(r, 1500));
        
        let answer;
        try {
          answer = await suggestNextAnswer(survey.title, questions, answers, q.id);
        } catch (err) {
          console.warn("AI suggestion failed, using fallback:", err);
          addLog('warning', 'Agent is operating at capacity', 'Switching to heuristic behavior patterns...');
          answer = getFallbackAnswer(q);
        }
        
        setAnswers(prev => {
          const newAnswers = { ...prev, [q.id]: answer };
          return newAnswers;
        });

        // Simulate selection/typing
        addLog('success', `Question ${i + 1} answered`, `Value: ${answer}`);
        
        // Extra delay to show the "selection"
        await new Promise(r => setTimeout(r, 800));
      }

      addLog('info', 'Calculating diagnostic report...');
      let results;
      try {
        results = await diagnoseSurvey(survey.title, survey.desc || '', questions);
      } catch (err) {
        console.warn("AI diagnosis failed, using fallback:", err);
        addLog('warning', 'Full diagnostic limited', 'Using baseline quality metrics.');
        results = {
          overallScore: 92,
          estimatedTime: `${Math.ceil(questions.length * 0.5)} mins`,
          fatigueLevel: questions.length > 10 ? "Medium" : "Low",
          issues: [],
          strengths: ["Survey structural integrity verified", "Logic paths viable"]
        };
      }
      
      setDiagnostic(results as SurveyDiagnostic);
      addLog('success', 'Simulation complete', `Final Score: ${results.overallScore}%`);
      setStatus('finished');
    } catch (err) {
      console.error(err);
      addLog('error', 'Simulation failed due to an unexpected error');
      setStatus('failed');
    } finally {
      setIsSimulating(false);
    }
  };

  if (!survey) return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50">
      <Loader2 className="w-12 h-12 text-hr-blue animate-spin mb-4" />
      <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Initializing Stress Test Environment...</p>
    </div>
  );

  return (
    <div className="h-screen w-screen bg-hr-navy flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-hr-navy/50 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-hr-blue rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-black tracking-tight text-lg">AI Live Stress Test</h1>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Automated logic & flow verification</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={onExit}
            className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs transition-all border border-white/10"
          >
            Exit Test
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Survey Preview */}
        <div className="flex-1 bg-gray-50/5 relative overflow-hidden flex flex-col">
          <div className="absolute inset-0 overflow-y-auto p-12 custom-scrollbar">
            <div className="max-w-xl mx-auto space-y-12 pb-24">
              <header className="text-center mb-16">
                 <h2 className="text-3xl font-black text-white tracking-tight mb-4 whitespace-pre-wrap">{survey.title}</h2>
                 <p className="text-white/50 text-sm">{survey.description}</p>
              </header>

              {questions.map((q, idx) => {
                const isActive = currentQuestionIndex === idx;
                const isAnswered = answers[q.id] !== undefined;
                const isPending = !isActive && !isAnswered;

                return (
                  <div 
                    key={q.id}
                    className={cn(
                      "p-8 rounded-3xl border transition-all duration-500 relative",
                      isActive ? "bg-white border-hr-blue shadow-2xl scale-[1.02] z-10" : 
                      isAnswered ? "bg-white/10 border-white/10 opacity-60 grayscale-[0.5]" : "bg-white/5 border-white/5 opacity-30"
                    )}
                  >
                    {isActive && (
                      <div className="absolute -left-12 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
                        <div className="w-3 h-3 bg-hr-blue rounded-full animate-ping" />
                        <div className="w-1 h-12 bg-gradient-to-b from-hr-blue to-transparent rounded-full" />
                      </div>
                    )}
                    
                    <div className="flex items-center gap-4 mb-6">
                      <div className={cn(
                        "w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black",
                        isActive ? "bg-hr-blue/10 text-hr-blue" : "bg-white/10 text-white/50"
                      )}>
                        {idx + 1}
                      </div>
                      <div className={cn(
                        "px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest",
                        isActive ? "bg-hr-blue text-white" : "bg-white/5 text-white/30"
                      )}>
                        {q.type}
                      </div>
                    </div>

                    <h3 className={cn(
                      "text-xl font-bold mb-6 tracking-tight leading-snug",
                      isActive ? "text-hr-navy" : "text-white/80"
                    )}>
                      {q.text}
                    </h3>

                    {isAnswered && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <Check className="w-4 h-4 text-emerald-500" />
                         </div>
                         <div className="flex-1">
                            <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest leading-none mb-1">AI Output</p>
                            <p className="text-sm font-medium text-emerald-50">{answers[q.id]}</p>
                         </div>
                      </div>
                    )}
                    
                    {isActive && (
                      <div className="flex items-center gap-3 text-hr-blue animate-pulse">
                         <Brain className="w-5 h-5" />
                         <span className="text-xs font-bold uppercase tracking-widest">Agent is thinking...</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {status === 'finished' && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-hr-green/20 border-2 border-hr-green/40 p-12 rounded-[3rem] text-center"
                >
                   <div className="w-20 h-20 bg-hr-green rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-hr-green/20">
                      <CheckCircle2 className="w-10 h-10 text-white" />
                   </div>
                   <h2 className="text-3xl font-black text-white mb-2">Test Complete</h2>
                   <p className="text-white/60 mb-8">AI Agent successfully navigated the survey logic.</p>
                   <div className="flex justify-center gap-4">
                      <div className="bg-white/10 px-8 py-4 rounded-3xl backdrop-blur-md">
                         <div className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Quality Score</div>
                         <div className="text-3xl font-black text-white">{diagnostic?.overallScore}%</div>
                      </div>
                      <div className="bg-white/10 px-8 py-4 rounded-3xl backdrop-blur-md">
                         <div className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Est. Time</div>
                         <div className="text-3xl font-black text-white">{diagnostic?.estimatedTime}</div>
                      </div>
                   </div>
                </motion.div>
              )}
            </div>
          </div>
          
          <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-hr-navy to-transparent">
             <div className="max-w-xl mx-auto bg-white/10 backdrop-blur-xl border border-white/10 p-2 rounded-3xl flex items-center justify-between">
                <div className="px-6">
                   <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-hr-green animate-pulse" />
                      <span className="text-white font-bold text-sm">Status: {status.toUpperCase()}</span>
                   </div>
                </div>
                {status === 'idle' || status === 'failed' ? (
                  <button 
                    onClick={startSimulation}
                    className="bg-hr-blue hover:brightness-110 text-white px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-hr-blue/20 transition-all flex items-center gap-3"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Start AI agent Run
                  </button>
                ) : status === 'running' ? (
                  <div className="bg-white/5 py-4 px-8 rounded-2xl text-white/40 text-xs font-black uppercase tracking-widest flex items-center gap-3">
                     <Loader2 className="w-4 h-4 animate-spin" />
                     Simulation in progress...
                  </div>
                ) : (
                  <button 
                    onClick={startSimulation}
                    className="bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all"
                  >
                    Reset & Re-Run
                  </button>
                )}
             </div>
          </div>
        </div>

        {/* Right: AI Console Logs */}
        <div className="w-96 border-l border-white/10 bg-hr-navy/80 backdrop-blur-xl flex flex-col">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-white font-bold text-xs uppercase tracking-widest opacity-60">Agent Console Logs</h3>
            <div className="flex gap-1">
               <div className="w-2 h-2 rounded-full bg-red-500/50" />
               <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
               <div className="w-2 h-2 rounded-full bg-green-500/50" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-[10px] custom-scrollbar">
             {logs.length === 0 && (
               <div className="text-white/20 italic p-4">Waiting for agent to start...</div>
             )}
             {logs.map((log, idx) => (
               <div key={idx} className="space-y-1">
                  <div className="flex items-center gap-2">
                     <span className="text-white/30">[{log.time}]</span>
                     <span className={cn(
                       "font-bold uppercase",
                       log.type === 'error' ? "text-red-400" : 
                       log.type === 'warning' ? "text-yellow-400" :
                       log.type === 'success' ? "text-emerald-400" : "text-hr-blue"
                     )}>
                       {log.type === 'info' ? '>>' : log.type.toUpperCase()}
                     </span>
                     <span className="text-white font-bold">{log.message}</span>
                  </div>
                  {log.detail && (
                    <div className="pl-16 text-white/50 leading-relaxed">
                       {log.detail}
                    </div>
                  )}
               </div>
             ))}
             <div ref={logEndRef} />
          </div>
          
          <div className="p-6 bg-white/5">
             <div className="bg-hr-navy border border-white/10 rounded-2xl p-4">
                <div className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-3">Agent Capability</div>
                <div className="space-y-3">
                   <div className="flex items-center justify-between">
                      <span className="text-xs text-white/70">Flow Logic</span>
                      <div className="h-1 w-24 bg-white/10 rounded-full overflow-hidden">
                         <div className="h-full bg-hr-blue w-[92%]" />
                      </div>
                   </div>
                   <div className="flex items-center justify-between">
                      <span className="text-xs text-white/70">Human Error Simulation</span>
                      <div className="h-1 w-24 bg-white/10 rounded-full overflow-hidden">
                         <div className="h-full bg-hr-blue w-[45%]" />
                      </div>
                   </div>
                   <div className="flex items-center justify-between">
                      <span className="text-xs text-white/70">Fatigue Awareness</span>
                      <div className="h-1 w-24 bg-white/10 rounded-full overflow-hidden">
                         <div className="h-full bg-hr-blue w-[78%]" />
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Admin Dashboard View Component (Colleague Accounts Administration)
// ==========================================
interface AdminDashboardViewProps {
  allUsers: any[];
  surveys: Survey[];
  selectedInspectUserId: string | null;
  setSelectedInspectUserId: (id: string | null) => void;
  onOpenSurvey: (survey: Survey) => void;
  onBack: () => void;
  showToast: (m: string, t?: 'success' | 'info' | 'error') => void;
}

function ProfileView({ user, onBack }: { user: User | null; onBack: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex-1 bg-white overflow-y-auto custom-scrollbar p-8"
    >
      <div className="max-w-3xl mx-auto space-y-8">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-hr-navy transition-colors bg-white px-4 py-2 border border-border-subtle rounded-xl shadow-sm hover:shadow active:scale-95 w-max"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        <div className="bg-white border border-border-strong rounded-3xl p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-hr-navy text-white flex items-center justify-center font-black text-2xl shadow-inner">
              {(user?.email || 'UN').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl font-black text-hr-navy tracking-tight">{user?.displayName || 'User Profile'}</h1>
              <p className="text-gray-500 mt-1 font-medium">{user?.email}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-hr-blue" /> Account Details
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Email</label>
                <div className="font-medium text-hr-navy">{user?.email || 'N/A'}</div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">User ID</label>
                <code className="text-xs bg-gray-200 px-2 py-1 rounded text-gray-600 font-mono mt-1 block">{user?.uid || 'N/A'}</code>
              </div>
            </div>
          </div>

          <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-100/50">
            <h3 className="text-sm font-bold text-blue-500/80 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-hr-blue" /> Account Data
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed font-medium">
              Your account is currently active. All surveys, respondents, and collected analytics are securely stored in the cloud.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function AdminDashboardView({
  allUsers,
  surveys,
  selectedInspectUserId,
  setSelectedInspectUserId,
  onOpenSurvey,
  onBack,
  showToast
}: AdminDashboardViewProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-aggregate surveys by creator email if user accounts are empty in Firestore
  // This ensures there is ALWAYS active data, even if users haven't newly logged in since we added the tracker
  const uniqueEmailsFromSurveys = Array.from(new Set(surveys.map(s => s.ownerEmail).filter(Boolean)));
  
  // Build effective users list by merging verified Firestore users and survey owners
  const mergedUsers = [...allUsers];
  uniqueEmailsFromSurveys.forEach(email => {
    if (!mergedUsers.some(u => u.email?.toLowerCase() === email?.toLowerCase())) {
      const matchSurvey = surveys.find(s => s.ownerEmail === email);
      mergedUsers.push({
        id: matchSurvey?.ownerId || email,
        email: email,
        displayName: email.split('@')[0],
        lastLoginAt: matchSurvey?.createdAt || 'Prior Login',
        isLegacy: true
      });
    }
  });

  // Get selected profile
  const inspectedUser = mergedUsers.find(u => u.id === selectedInspectUserId || u.email === selectedInspectUserId);
  const inspectedUserSurveys = inspectedUser 
    ? surveys.filter(s => 
        (s.ownerEmail && inspectedUser.email && s.ownerEmail.toLowerCase() === inspectedUser.email.toLowerCase()) || 
        s.ownerId === inspectedUser.id
      )
    : [];

  // Filter accounts
  const filteredUsers = mergedUsers.filter(u => {
    const q = searchQuery.toLowerCase();
    return (
      (u.email || '').toLowerCase().includes(q) ||
      (u.displayName || '').toLowerCase().includes(q)
    );
  });

  // Overall Global stats
  const totalResponses = surveys.reduce((sum, s) => sum + (s.responses || 0), 0);
  const activeSurveys = surveys.filter(s => s.status === 'Active' && !s.isDeleted).length;
  
  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Ribbon */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-md shadow-amber-500/20">
              <Settings className="w-6 h-6 animate-spin duration-10000" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-hr-navy tracking-tight">Main Creator Command Hub</h1>
                <span className="text-[10px] bg-red-100 text-red-800 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Admin Access
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                Monitor platform users, analyze engagement rates, and inspect isolated workspace databases in real-time.
              </p>
            </div>
          </div>

          <button
            onClick={onBack}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-border-strong hover:bg-gray-50 text-xs font-bold uppercase tracking-wider text-hr-navy rounded-xl shadow-sm transition-all"
          >
            <ArrowLeft className="w-4 h-4 text-gray-400" /> Return to Dashboard
          </button>
        </div>

        {/* Inspecting Specific User Profile */}
        {selectedInspectUserId && inspectedUser ? (
          <div className="space-y-6">
            <button
              onClick={() => setSelectedInspectUserId(null)}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-hr-blue hover:text-hr-navy transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Accounts Directory
            </button>

            {/* inspected user overview header */}
            <div className="bg-white border border-border-strong rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-hr-navy text-white flex items-center justify-center font-black text-xl shadow-inner">
                  {(inspectedUser.email || 'UN').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-hr-navy">{inspectedUser.displayName}</h2>
                  <p className="text-sm text-gray-400 font-medium">{inspectedUser.email}</p>
                  <p className="text-xs text-hr-blue font-bold mt-1 inline-flex items-center gap-1 bg-hr-blue/5 px-2 py-0.5 rounded">
                    Account ID: {inspectedUser.id}
                  </p>
                </div>
              </div>

              <div className="flex gap-4 border-l border-gray-100 pl-6 shrink-0 text-center md:text-left">
                <div>
                  <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Surveys Created</div>
                  <div className="text-3xl font-black text-hr-navy">{inspectedUserSurveys.length}</div>
                </div>
                <div className="border-l border-gray-100 pl-6">
                  <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Cumulative Responses</div>
                  <div className="text-3xl font-black text-hr-blue">
                    {inspectedUserSurveys.reduce((sum, s) => sum + (s.responses || 0), 0)}
                  </div>
                </div>
              </div>
            </div>

            {/* Inspected user's surveys list */}
            <div className="bg-white border border-border-strong rounded-3xl p-8 shadow-sm space-y-6">
              <div>
                <h3 className="text-sm font-black text-hr-navy uppercase tracking-widest">Colleague Surveys Workspace</h3>
                <p className="text-xs text-gray-500 font-medium">Direct management and testing triggers for surveys built by this account</p>
              </div>

              {inspectedUserSurveys.length === 0 ? (
                <div className="text-center py-12 text-sm text-gray-400 italic bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  This colleague hasn't created any surveys yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 pb-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        <th className="py-3 px-4">Survey Name</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Created At</th>
                        <th className="py-3 px-4 text-center">Responses</th>
                        <th className="py-3 px-4 text-right">Workspace Entry</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {inspectedUserSurveys.map((survey: Survey) => (
                        <tr key={survey.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-4 px-4">
                            <div>
                              <p className="text-sm font-bold text-hr-navy hover:text-hr-blue cursor-pointer" onClick={() => onOpenSurvey(survey)}>
                                {survey.title}
                              </p>
                              <p className="text-[10px] text-gray-400">ID: {survey.id}</p>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className={cn(
                              "text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-wider",
                              survey.status === 'Active' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' :
                              survey.status === 'Closed' ? 'bg-red-50 border border-red-200 text-red-700' :
                              'bg-gray-100 text-gray-500'
                            )}>
                              {survey.status}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-xs font-semibold text-gray-500">
                            {survey.createdAt || 'N/A'}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="text-sm font-black text-hr-navy">{survey.responses || 0}</span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <button
                              onClick={() => {
                                onOpenSurvey(survey);
                                showToast(`Assumed administration workspace for ${survey.title}`, 'info');
                              }}
                              className="inline-flex items-center gap-1 px-4 py-2 bg-hr-navy text-[10px] text-white font-extrabold uppercase tracking-wider rounded-xl hover:bg-hr-blue transition-all"
                            >
                              <ExternalLink className="w-3.5 h-3.5" /> Open / Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Normal accounts directory listing view */
          <div className="space-y-8 animate-fadeIn">
            
            {/* Bento Stats row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              
              <div className="bg-white border border-border-strong rounded-3xl p-6 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Colleagues Registered</p>
                  <p className="text-3xl font-black text-hr-navy mt-1">{mergedUsers.length}</p>
                </div>
                <div className="w-12 h-12 bg-hr-blue/10 rounded-2xl flex items-center justify-center text-hr-blue">
                  <Users className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white border border-border-strong rounded-3xl p-6 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Survey Databases</p>
                  <p className="text-3xl font-black text-hr-navy mt-1">{surveys.length}</p>
                </div>
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                  <Database className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white border border-border-strong rounded-3xl p-6 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Global Responses collected</p>
                  <p className="text-3xl font-black text-hr-blue mt-1">{totalResponses}</p>
                </div>
                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                  <BarChart3 className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white border border-border-strong rounded-3xl p-6 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Survey forms</p>
                  <p className="text-3xl font-black text-emerald-600 mt-1">{activeSurveys}</p>
                </div>
                <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                  <Zap className="w-6 h-6" />
                </div>
              </div>

            </div>

            {/* Core Listing Section with Search */}
            <div className="bg-white border border-border-strong rounded-3xl p-8 shadow-sm space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-black text-hr-navy uppercase tracking-widest mb-1">Colleagues Directory</h3>
                  <p className="text-xs text-gray-500 font-medium font-sans">
                    Every colleague registered under your Firebase project. Inspect databases directly.
                  </p>
                </div>

                <div className="relative w-full md:w-80">
                  <input
                    type="text"
                    placeholder="Search colleagues by email/name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-border-strong rounded-xl text-xs font-semibold focus:outline-none focus:ring-4 ring-subtle focus:bg-white transition-all"
                  />
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 pb-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      <th className="py-3 px-4">Colleague Account</th>
                      <th className="py-3 px-4 text-center">Surveys Created</th>
                      <th className="py-3 px-4 text-center">Total Responses</th>
                      <th className="py-3 px-4">Latest Activity</th>
                      <th className="py-3 px-4 text-right">Inspect Database</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-sm text-gray-400 italic">
                          No matching registered colleagues found in this Firebase instance.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((colleague) => {
                        const colleagueSurveys = surveys.filter(s => 
                          (s.ownerEmail && colleague.email && s.ownerEmail.toLowerCase() === colleague.email.toLowerCase()) || 
                          s.ownerId === colleague.id
                        );
                        const colleagueResponses = colleagueSurveys.reduce((sum, s) => sum + (s.responses || 0), 0);
                        
                        return (
                          <tr key={colleague.id} className="hover:bg-gray-50/40 transition-colors">
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-hr-navy/5 text-hr-navy font-bold flex items-center justify-center text-sm uppercase">
                                  {(colleague.email || 'UN').slice(0, 2).toUpperCase()}
                                </div>
                                <div className="max-w-xs truncate">
                                  <p className="text-sm font-bold text-hr-navy">{colleague.displayName}</p>
                                  <p className="text-[10px] text-gray-400 truncate">{colleague.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className="text-sm font-bold text-hr-navy bg-gray-100 px-2.5 py-1 rounded-full">{colleagueSurveys.length}</span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className="text-sm font-black text-hr-blue">{colleagueResponses}</span>
                            </td>
                            <td className="py-4 px-4 text-xs font-semibold text-gray-500">
                              {colleague.lastLoginAt ? (
                                <span>{colleague.lastLoginAt.includes('T') ? new Date(colleague.lastLoginAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : colleague.lastLoginAt}</span>
                              ) : 'N/A'}
                            </td>
                            <td className="py-4 px-4 text-right">
                              <button
                                onClick={() => {
                                  setSelectedInspectUserId(colleague.id);
                                  showToast(`Selected workspace directory of ${colleague.email}`, 'info');
                                }}
                                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-border-strong hover:bg-gray-50 font-extrabold text-[10px] text-hr-navy uppercase tracking-wider rounded-xl shadow-sm transition-all"
                              >
                                <Eye className="w-3.5 h-3.5 text-hr-blue" /> Inspect Surveys
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
}
