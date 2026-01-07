
import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Flame, 
  Utensils, 
  Sparkles, 
  User as UserIcon, 
  ChevronRight, 
  MessageSquare, 
  X,
  TrendingDown,
  Activity,
  ArrowRight,
  Camera,
  Loader2,
  Zap,
  LogIn,
  LogOut,
  ShieldCheck,
  Cloud,
  Leaf,
  Beef,
  CheckCircle2,
  Settings,
  ShieldAlert,
  Search,
  Phone,
  Mail,
  History,
  Database
} from 'lucide-react';
import { UserProfile, DailyStats, ActivityEntry, ChatMessage, DietaryPreference } from './types';
import { getAIResponse, getFixMyDaySuggestion, analyzeFoodImage, estimateCaloriesFromText } from './geminiService';

const STORAGE_KEY_PROFILE = 'burnfit_profile';
const STORAGE_KEY_ENTRIES = 'burnfit_entries';
const STORAGE_KEY_AUTH = 'burnfit_auth';
const STORAGE_KEY_ADMIN = 'burnfit_is_admin';

const MICRO_WORKOUTS = [
  { id: 1, title: '5-minute brisk walk', icon: '🚶' },
  { id: 2, title: '7-minute home stretching', icon: '🧘' },
  { id: 3, title: '10-minute core workout', icon: '💪' },
  { id: 4, title: '5-minute desk yoga', icon: '✨' },
];

export default function App() {
  const [isAuthSession, setIsAuthSession] = useState<boolean | null>(null);
  const [isGoogleAccount, setIsGoogleAccount] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'coach' | 'profile'>('dashboard');
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showCoach, setShowCoach] = useState(false);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [isScanningFood, setIsScanningFood] = useState(false);
  const [isEstimatingText, setIsEstimatingText] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showAdminDetails, setShowAdminDetails] = useState(false);
  
  const [intakeCalories, setIntakeCalories] = useState<string>('');
  const [intakeDesc, setIntakeDesc] = useState<string>('');
  const [confirmedName, setConfirmedName] = useState<string>('');

  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [coachMessages, setCoachMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Hey there! I’m your BurnFit Coach. I’ve connected to your Google Health Memories. Ready to smash some goals today?' }
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const authStatus = localStorage.getItem(STORAGE_KEY_AUTH);
    const adminStatus = localStorage.getItem(STORAGE_KEY_ADMIN);
    
    if (authStatus) {
      setIsAuthSession(true);
      setIsGoogleAccount(authStatus === 'google');
      setIsAdmin(adminStatus === 'true');
    } else {
      setIsAuthSession(false);
    }

    const savedProfile = localStorage.getItem(STORAGE_KEY_PROFILE);
    const savedEntries = localStorage.getItem(STORAGE_KEY_ENTRIES);
    
    if (savedProfile) setProfile(JSON.parse(savedProfile));
    if (savedEntries) setEntries(JSON.parse(savedEntries));
  }, []);

  useEffect(() => {
    if (profile) localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(entries));
  }, [entries]);

  const handleLogin = (type: 'google' | 'guest' | 'admin') => {
    localStorage.setItem(STORAGE_KEY_AUTH, type === 'admin' ? 'google' : type);
    if (type === 'admin') {
      setIsAdmin(true);
      localStorage.setItem(STORAGE_KEY_ADMIN, 'true');
      setIsGoogleAccount(true);
    } else {
      setIsAdmin(false);
      localStorage.setItem(STORAGE_KEY_ADMIN, 'false');
      setIsGoogleAccount(type === 'google');
    }
    setIsAuthSession(true);
  };

  const handleAdminLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminUsername === 'lalit' && adminPassword === 'lalit@123') {
      handleLogin('admin');
      setShowAdminLogin(false);
    } else {
      alert("Invalid admin credentials");
    }
  };

  const handleLogout = () => {
    if(confirm("Are you sure? This will disconnect your local sync.")) {
      localStorage.removeItem(STORAGE_KEY_AUTH);
      localStorage.removeItem(STORAGE_KEY_PROFILE);
      localStorage.removeItem(STORAGE_KEY_ENTRIES);
      localStorage.removeItem(STORAGE_KEY_ADMIN);
      window.location.reload();
    }
  };

  const calculateTarget = (age: number, height: number, weight: number, goal: string) => {
    const base = (10 * weight) + (6.25 * height) - (5 * age) + 5;
    const target = goal === 'lose' ? base * 1.2 - 400 : base * 1.2;
    return Math.round(target);
  };

  const getTodayStats = (): DailyStats => {
    const today = new Date().toISOString().split('T')[0];
    const todayEntries = entries.filter(e => new Date(e.timestamp).toISOString().split('T')[0] === today);
    return {
      date: today,
      intake: todayEntries.filter(e => e.type === 'intake').reduce((sum, e) => sum + e.calories, 0),
      burned: todayEntries.filter(e => e.type === 'exercise').reduce((sum, e) => sum + e.calories, 0),
    };
  };

  const handleSetup = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const age = parseInt(formData.get('age') as string);
    const height = parseInt(formData.get('height') as string);
    const weight = parseInt(formData.get('weight') as string);
    const goal = formData.get('goal') as 'lose' | 'maintain';
    const dietaryPreference = formData.get('dietaryPreference') as DietaryPreference;
    const email = formData.get('email') as string;
    const phoneNumber = formData.get('phoneNumber') as string;
    
    const target = calculateTarget(age, height, weight, goal);
    const newProfile: UserProfile = { 
      age, 
      height, 
      weight, 
      goal, 
      dietaryPreference, 
      dailyTarget: target, 
      setupComplete: true,
      email,
      phoneNumber,
      searchHistory: []
    };
    setProfile(newProfile);

    setCoachMessages([
      { role: 'model', text: `Profile Synced! I've noted your preference for a ${dietaryPreference} diet. Let's start your Google Health Journey today!` }
    ]);
  };

  const handleSendMessage = async (text: string) => {
    if (!profile) return;
    
    // Add to search history (Admin visibility)
    const updatedProfile = { 
      ...profile, 
      searchHistory: [text, ...profile.searchHistory].slice(0, 50) 
    };
    setProfile(updatedProfile);

    const userMessage: ChatMessage = { role: 'user', text };
    setCoachMessages(prev => [...prev, userMessage]);
    try {
      const response = await getAIResponse(updatedProfile, getTodayStats(), coachMessages, text);
      setCoachMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (error) {
      setCoachMessages(prev => [...prev, { role: 'model', text: "I'm having a bit of trouble connecting right now. Try again soon!" }]);
    }
  };

  const addEntry = (type: 'intake' | 'exercise', calories: number, description: string) => {
    const newEntry: ActivityEntry = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      calories,
      timestamp: Date.now(),
      description,
    };
    setEntries([newEntry, ...entries]);
    if (type === 'intake') {
      setShowIntakeModal(false);
      setIntakeCalories('');
      setIntakeDesc('');
      setConfirmedName('');
    }
    if (type === 'exercise') setShowActivityModal(false);
  };

  const handleCameraClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setIsScanningFood(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = (reader.result as string).split(',')[1];
      const result = await analyzeFoodImage(base64Data, file.type, profile.dietaryPreference);
      if (result) {
        setIntakeCalories(result.estimatedCalories.toString());
        setIntakeDesc(result.foodName);
        setConfirmedName(result.foodName);
      }
      setIsScanningFood(false);
    };
    reader.readAsDataURL(file);
  };

  const handleEstimateCalories = async () => {
    if (!intakeDesc.trim() || !profile) return;
    setIsEstimatingText(true);
    try {
      const result = await estimateCaloriesFromText(intakeDesc, profile.dietaryPreference);
      if (result && result.estimatedCalories > 0) {
        setIntakeCalories(result.estimatedCalories.toString());
        setConfirmedName(result.confirmedFoodName);
      }
    } finally {
      setIsEstimatingText(false);
    }
  };

  if (isAuthSession === false) {
    return (
      <div className="min-h-screen bg-white p-8 flex flex-col items-center justify-center text-center">
        {showAdminLogin ? (
          <div className="w-full max-w-sm animate-in fade-in zoom-in duration-300">
             <div className="mb-8">
              <ShieldAlert className="w-16 h-16 text-slate-800 mx-auto mb-4" />
              <h2 className="text-2xl font-black text-slate-900">Admin Login</h2>
              <p className="text-slate-500">Secure access for superusers only.</p>
            </div>
            <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
              <input 
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                type="text" 
                placeholder="ID (e.g. lalit)" 
                className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-slate-800 transition-all font-bold"
              />
              <input 
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                type="password" 
                placeholder="Password" 
                className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-slate-800 transition-all font-bold"
              />
              <button 
                type="submit" 
                className="w-full py-5 bg-slate-900 text-white font-black rounded-3xl shadow-xl shadow-slate-200 active:scale-[0.98] transition-transform"
              >
                Access Dashboard
              </button>
              <button 
                type="button" 
                onClick={() => setShowAdminLogin(false)}
                className="w-full py-4 text-slate-400 font-bold uppercase text-xs tracking-widest"
              >
                Go Back
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className="mb-12">
              <div className="w-24 h-24 bg-orange-100 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-orange-100/50">
                <Flame className="w-12 h-12 text-orange-600" />
              </div>
              <h1 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">BurnFit</h1>
              <p className="text-gray-500 max-w-xs mx-auto text-lg leading-relaxed">
                Your simple AI companion for a healthier lifestyle.
              </p>
            </div>

            <div className="w-full max-w-sm space-y-4">
              <button 
                onClick={() => handleLogin('google')}
                className="w-full flex items-center justify-center gap-3 py-5 bg-white border-2 border-gray-100 rounded-3xl font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm"
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                Sign in with Google
              </button>
              
              <button 
                onClick={() => handleLogin('guest')}
                className="w-full py-5 bg-orange-600 text-white font-bold rounded-3xl hover:bg-orange-700 transition-all shadow-lg shadow-orange-200"
              >
                Continue as Guest
              </button>

              <button 
                onClick={() => setShowAdminLogin(true)}
                className="w-full py-4 text-gray-400 font-bold uppercase text-[10px] tracking-widest hover:text-gray-900 transition-colors"
              >
                Admin Access
              </button>
            </div>
            
            <p className="mt-8 text-xs text-gray-400 font-medium">
              No sign up required. Data stored in your Google Cloud or Local Memory.
            </p>
          </>
        )}
      </div>
    );
  }

  if (!profile || !profile.setupComplete) {
    return (
      <div className="min-h-screen bg-white p-6 flex flex-col items-center justify-center overflow-y-auto">
        <div className="w-full max-w-md py-12">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Your Profile</h1>
            <p className="text-gray-500">
              {isAdmin ? "Welcome back, Lalit! Initializing admin environment." : isGoogleAccount ? "Welcome! We're fetching your data from Google." : "Let's get you set up locally."}
            </p>
          </div>

          <form onSubmit={handleSetup} className="space-y-6">
            <div className="space-y-4 bg-gray-50 p-6 rounded-[2rem] border border-gray-100">
               <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest text-center">Contact Information</h3>
               <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                  <input required name="email" type="email" placeholder="example@gmail.com" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none text-gray-900" />
               </div>
               <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Mobile Number</label>
                  <input required name="phoneNumber" type="tel" placeholder="+91 98765 43210" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none text-gray-900" />
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Age</label>
                <input required name="age" type="number" placeholder="25" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Goal</label>
                <select name="goal" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-gray-900">
                  <option value="maintain">Maintain</option>
                  <option value="lose">Lose Weight</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3 text-center uppercase tracking-widest text-[10px]">Dietary Preference</label>
              <div className="grid grid-cols-2 gap-3">
                <label className="relative flex flex-col items-center p-4 border-2 border-gray-100 rounded-2xl cursor-pointer has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50 group transition-all">
                  <input type="radio" name="dietaryPreference" value="vegetarian" required className="absolute opacity-0" />
                  <Leaf className="w-6 h-6 mb-2 text-gray-400 group-has-[:checked]:text-orange-600" />
                  <span className="text-sm font-bold text-gray-600 group-has-[:checked]:text-orange-700">Vegetarian</span>
                </label>
                <label className="relative flex flex-col items-center p-4 border-2 border-gray-100 rounded-2xl cursor-pointer has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50 group transition-all">
                  <input type="radio" name="dietaryPreference" value="non-vegetarian" className="absolute opacity-0" />
                  <Beef className="w-6 h-6 mb-2 text-gray-400 group-has-[:checked]:text-orange-600" />
                  <span className="text-sm font-bold text-gray-600 group-has-[:checked]:text-orange-700">Non-Veg</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Height (cm)</label>
                <input required name="height" type="number" placeholder="175" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Weight (kg)</label>
                <input required name="weight" type="number" placeholder="70" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-gray-900" />
              </div>
            </div>

            <button type="submit" className="w-full py-4 bg-orange-600 text-white font-bold rounded-2xl hover:bg-orange-700 transition-colors shadow-lg">
              Finish Setup
            </button>
          </form>
        </div>
      </div>
    );
  }

  const todayStats = getTodayStats();
  const netCalories = todayStats.intake - todayStats.burned;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 ios-scroll">
      {/* Admin Bar */}
      {isAdmin && (
        <div className="sticky top-0 z-50 animate-in slide-in-from-top duration-500">
          <div className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-orange-500" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Admin: Lalit</span>
              </div>
              <div className="h-4 w-px bg-slate-700" />
              <div className="flex items-center gap-2">
                <Database className="w-3 h-3 text-blue-400" />
                <span className="text-[9px] font-bold text-slate-400">Live Customer Inspector</span>
              </div>
            </div>
            <button 
              onClick={() => setShowAdminDetails(!showAdminDetails)}
              className="flex items-center gap-2 bg-slate-800 px-3 py-1 rounded-full text-[9px] font-black hover:bg-slate-700 transition-colors"
            >
              {showAdminDetails ? <X className="w-3 h-3" /> : <Settings className="w-3 h-3" />}
              {showAdminDetails ? "Close Log" : "Inspect Data"}
            </button>
          </div>

          {/* Expanded Admin Data Inspector */}
          {showAdminDetails && (
            <div className="bg-slate-800 text-white border-t border-slate-700 shadow-2xl animate-in slide-in-from-top-4 duration-300">
              <div className="max-h-[60vh] overflow-y-auto p-6 space-y-8">
                {/* Customer Identity Section */}
                <section>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <UserIcon className="w-3 h-3" /> Customer Identity
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900 p-4 rounded-2xl border border-slate-700">
                      <div className="flex items-center gap-2 mb-1">
                        <Mail className="w-3 h-3 text-blue-400" />
                        <span className="text-[9px] text-slate-500 font-bold uppercase">Email</span>
                      </div>
                      <p className="text-xs font-black text-blue-100">{profile.email || "Not Provided"}</p>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-2xl border border-slate-700">
                      <div className="flex items-center gap-2 mb-1">
                        <Phone className="w-3 h-3 text-green-400" />
                        <span className="text-[9px] text-slate-500 font-bold uppercase">Mobile</span>
                      </div>
                      <p className="text-xs font-black text-green-100">{profile.phoneNumber || "Not Provided"}</p>
                    </div>
                  </div>
                </section>

                {/* Search / Query History Section */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <History className="w-3 h-3" /> Interaction & Search History
                    </h3>
                    <span className="bg-slate-900 px-2 py-0.5 rounded text-[8px] font-bold text-slate-500">
                      Total Queries: {profile.searchHistory.length}
                    </span>
                  </div>
                  <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
                    {profile.searchHistory.length > 0 ? (
                      <div className="divide-y divide-slate-800 max-h-48 overflow-y-auto">
                        {profile.searchHistory.map((query, i) => (
                          <div key={i} className="px-4 py-3 flex items-start gap-3 hover:bg-slate-800/50 transition-colors">
                            <Search className="w-3 h-3 text-slate-500 mt-1" />
                            <p className="text-[11px] font-medium text-slate-300 leading-relaxed">{query}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <p className="text-[10px] font-bold text-slate-600 uppercase italic">No active search history recorded</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Account Context Section */}
                <section>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Database className="w-3 h-3" /> Account Context
                  </h3>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries({
                      Age: profile.age,
                      Weight: profile.weight,
                      Height: profile.height,
                      Goal: profile.goal
                    }).map(([k, v]) => (
                      <div key={k} className="bg-slate-900 p-3 rounded-xl border border-slate-700 text-center">
                        <p className="text-[8px] text-slate-500 font-bold uppercase mb-1">{k}</p>
                        <p className="text-[10px] font-black uppercase text-slate-200">{v}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
              <div className="bg-slate-900 p-3 text-center border-t border-slate-700">
                 <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em]">Confidential - Lalit Deshmukh Admin Access Only</p>
              </div>
            </div>
          )}
        </div>
      )}

      <header className={`bg-white px-6 pt-12 pb-6 border-b border-gray-100 flex items-center justify-between sticky ${isAdmin ? 'top-[44px]' : 'top-0'} z-10 transition-all`}>
        <div className="flex items-center gap-3">
          <div className="bg-orange-600 p-2 rounded-xl">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">BurnFit</h1>
            <div className="flex items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full ${isGoogleAccount ? 'bg-blue-500' : 'bg-green-500'}`} />
              <span className="text-[10px] uppercase font-black text-gray-400 tracking-widest">
                {isAdmin ? "Superuser Lalit" : isGoogleAccount ? "Google Sync ON" : "Local Only"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className="bg-orange-50 px-3 py-1 rounded-full text-orange-600 text-xs font-bold">
            Burn Score: {Math.min(100, Math.round((todayStats.burned / 300) * 100))}
          </div>
        </div>
      </header>

      <main className="p-6 space-y-6">
        <section className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-bold mb-1 uppercase tracking-wider">Remaining Today</p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-5xl font-black text-gray-900">{profile.dailyTarget - netCalories}</h2>
            <span className="text-xl font-bold text-gray-400">kcal</span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-8">
            <div className="bg-gray-50 p-4 rounded-2xl">
              <div className="flex items-center gap-2 mb-1">
                <Utensils className="w-3 h-3 text-blue-500" />
                <p className="text-[10px] text-gray-400 font-black uppercase">Eaten</p>
              </div>
              <p className="text-lg font-black text-gray-900">{todayStats.intake}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-2xl">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-3 h-3 text-green-500" />
                <p className="text-[10px] text-gray-400 font-black uppercase">Burned</p>
              </div>
              <p className="text-lg font-black text-gray-900">{todayStats.burned}</p>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-gray-500">DAILY GOAL</span>
              <span className="text-xs font-bold text-gray-900">{Math.round((todayStats.intake / profile.dailyTarget) * 100)}%</span>
            </div>
            <div className="h-4 bg-gray-50 rounded-full overflow-hidden p-1">
              <div 
                className={`h-full rounded-full transition-all duration-700 ${todayStats.intake > profile.dailyTarget ? 'bg-red-500' : 'bg-orange-500'}`}
                style={{ width: `${Math.min(100, (todayStats.intake / profile.dailyTarget) * 100)}%` }}
              />
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => { setShowIntakeModal(true); setIntakeCalories(''); setIntakeDesc(''); setConfirmedName(''); }}
            className="bg-white border-2 border-gray-50 p-6 rounded-[2rem] flex flex-col items-center gap-2 hover:border-blue-100 transition-all shadow-sm group"
          >
            <div className="bg-blue-50 p-3 rounded-2xl group-hover:scale-110 transition-transform">
              <Utensils className="w-6 h-6 text-blue-600" />
            </div>
            <span className="font-bold text-gray-800">Log Meal</span>
          </button>
          <button 
            onClick={() => setShowActivityModal(true)}
            className="bg-white border-2 border-gray-50 p-6 rounded-[2rem] flex flex-col items-center gap-2 hover:border-green-100 transition-all shadow-sm group"
          >
            <div className="bg-green-50 p-3 rounded-2xl group-hover:scale-110 transition-transform">
              <Activity className="w-6 h-6 text-green-600" />
            </div>
            <span className="font-bold text-gray-800">Log Burn</span>
          </button>
        </div>

        <button 
          onClick={async () => {
            setLoadingSuggestion(true);
            try {
              const suggestion = await getFixMyDaySuggestion(profile, todayStats);
              setCoachMessages(prev => [...prev, { role: 'model', text: suggestion }]);
              setShowCoach(true);
            } finally {
              setLoadingSuggestion(false);
            }
          }}
          className="w-full bg-gray-900 p-6 rounded-[2rem] flex items-center justify-between shadow-xl relative overflow-hidden"
        >
          <div className="z-10 text-left">
            <h3 className="text-white font-bold text-lg">Fix My Day</h3>
            <p className="text-gray-400 text-sm">AI analysis of your Google Health data</p>
          </div>
          <div className="z-10 bg-orange-600 p-3 rounded-2xl shadow-lg shadow-orange-900/40">
            {loadingSuggestion ? <Loader2 className="animate-spin w-5 h-5 text-white" /> : <Sparkles className="w-5 h-5 text-white" />}
          </div>
        </button>

        <section className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
          <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Quick Burn</h3>
          <div className="space-y-4">
            {MICRO_WORKOUTS.map((w) => (
              <div key={w.id} className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-xl">{w.icon}</div>
                <div className="flex-1">
                  <p className="font-bold text-gray-800">{w.title}</p>
                </div>
                <button 
                  onClick={() => addEntry('exercise', w.id * 20 + 30, w.title)}
                  className="p-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>

      <nav className="fixed bottom-6 left-6 right-6 h-20 bg-white rounded-full flex items-center justify-around px-4 shadow-2xl border border-gray-100 z-40">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${activeTab === 'dashboard' ? 'text-orange-600 bg-orange-50' : 'text-gray-400'}`}
        >
          <Flame className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase">Today</span>
        </button>
        <button 
          onClick={() => setShowCoach(true)}
          className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${showCoach ? 'text-orange-600 bg-orange-50' : 'text-gray-400'}`}
        >
          <MessageSquare className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase">Coach</span>
        </button>
        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${activeTab === 'profile' ? 'text-orange-600 bg-orange-50' : 'text-gray-400'}`}
        >
          <UserIcon className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase">Account</span>
        </button>
      </nav>

      {/* Account Screen Overlay */}
      {activeTab === 'profile' && (
        <div className="fixed inset-0 z-50 bg-white p-8 flex flex-col">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-3xl font-black text-gray-900">Profile</h2>
            <button onClick={() => setActiveTab('dashboard')} className="p-2 bg-gray-50 rounded-full"><X className="w-6 h-6" /></button>
          </div>

          <div className="flex-1 space-y-8 overflow-y-auto pb-20">
            <div className="bg-gray-50 p-6 rounded-[2rem] flex items-center gap-4">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                {isAdmin ? <ShieldAlert className="w-8 h-8 text-slate-800" /> : <UserIcon className="w-8 h-8 text-orange-600" />}
              </div>
              <div>
                <p className="font-black text-xl text-gray-900">{isAdmin ? "lalit (Admin)" : isGoogleAccount ? "Google User" : "Guest User"}</p>
                <p className="text-sm text-gray-500">{isAdmin ? "Superuser Privileges" : isGoogleAccount ? "Syncing to Cloud Memory" : "Stored on Device"}</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Requested Sign In / Get Started Option */}
              {!isGoogleAccount && !isAdmin && (
                <button 
                  onClick={() => handleLogin('google')}
                  className="w-full bg-gradient-to-br from-gray-900 to-slate-800 p-6 rounded-[2rem] shadow-xl text-left relative overflow-hidden group"
                >
                   <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                      <Cloud className="w-20 h-20 text-white" />
                   </div>
                   <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-2">
                        <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Upgrade to Cloud</span>
                      </div>
                      <h3 className="text-white text-xl font-black mb-1">Sign In: Get Started</h3>
                      <p className="text-slate-400 text-xs font-bold leading-relaxed">
                        Power with google email to sync your health memories across all devices.
                      </p>
                   </div>
                </button>
              )}

              <div className="p-6 bg-white border border-gray-100 rounded-[2rem] shadow-sm">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Stats & Preferences</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-2xl">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Weight</span>
                    <p className="font-bold">{profile.weight} kg</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Diet</span>
                    <p className="font-bold flex items-center gap-1">
                      {profile.dietaryPreference === 'vegetarian' ? <Leaf className="w-3 h-3 text-green-600" /> : <Beef className="w-3 h-3 text-red-600" />}
                      {profile.dietaryPreference}
                    </p>
                  </div>
                </div>
              </div>

              {isAdmin && (
                <div className="p-6 bg-slate-900 text-white rounded-[2rem] shadow-xl">
                  <div className="flex items-center gap-2 mb-4">
                    <Settings className="w-4 h-4 text-orange-500" />
                    <span className="text-xs font-black uppercase tracking-widest">Admin Dashboard</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-bold">Total Entries</span>
                      <span className="font-black">{entries.length}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-bold">Account Level</span>
                      <span className="text-orange-500 font-black uppercase">Root</span>
                    </div>
                  </div>
                </div>
              )}

              {isGoogleAccount && !isAdmin && (
                <div className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <Cloud className="w-5 h-5 text-blue-500" />
                    <span className="font-bold">Google Cloud Sync</span>
                  </div>
                  <div className="px-3 py-1 bg-green-50 text-green-600 text-[10px] font-black rounded-full uppercase">
                    Connected
                  </div>
                </div>
              )}
            </div>
          </div>

          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-5 text-red-600 font-black uppercase text-sm tracking-widest"
          >
            <LogOut className="w-4 h-4" /> Disconnect & Logout
          </button>
        </div>
      )}

      {/* Intake Modal */}
      {showIntakeModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 pb-10 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Add Meal</h2>
              <button onClick={() => setShowIntakeModal(false)} className="bg-gray-100 p-2 rounded-full"><X className="w-6 h-6 text-gray-500" /></button>
            </div>
            
            <div className="mb-6 flex gap-4">
              <button 
                onClick={handleCameraClick}
                disabled={isScanningFood}
                className="flex-1 py-4 bg-blue-50 text-blue-700 font-bold rounded-2xl flex items-center justify-center gap-2 border border-blue-100"
              >
                {isScanningFood ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                Scan with Camera
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" capture="environment" />
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              addEntry('intake', parseInt(intakeCalories), confirmedName || intakeDesc || 'Meal');
            }} className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                   <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">What did you eat?</label>
                   <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-full">
                      {profile.dietaryPreference === 'vegetarian' ? <Leaf className="w-2.5 h-2.5 text-green-600" /> : <Beef className="w-2.5 h-2.5 text-red-600" />}
                      <span className="text-[9px] font-black text-gray-500 uppercase">{profile.dietaryPreference}</span>
                   </div>
                </div>
                <div className="relative">
                  <input 
                    value={intakeDesc}
                    onChange={(e) => setIntakeDesc(e.target.value)}
                    type="text" 
                    placeholder="e.g. Burger, Salad, Pasta" 
                    className="w-full px-5 py-4 bg-gray-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 font-bold" 
                  />
                  {intakeDesc.length > 2 && (
                    <button 
                      type="button"
                      onClick={handleEstimateCalories}
                      className="absolute right-2 top-2 bottom-2 bg-gray-900 text-white px-4 rounded-xl font-bold text-xs flex items-center gap-1 hover:bg-black transition-colors"
                    >
                      {isEstimatingText ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                      {isEstimatingText ? "Thinking..." : "AI Estimate"}
                    </button>
                  )}
                </div>
                {confirmedName && confirmedName !== intakeDesc && !isEstimatingText && (
                  <div className="mt-2 flex items-center gap-2 text-green-600 animate-in fade-in slide-in-from-top-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-xs font-bold italic">AI identified as: {confirmedName}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-widest">Estimated Calories</label>
                <div className="flex items-center gap-3 border-b-4 border-orange-50 focus-within:border-orange-500 transition-colors">
                  <input 
                    required 
                    value={intakeCalories}
                    onChange={(e) => setIntakeCalories(e.target.value)}
                    type="number" 
                    placeholder="0" 
                    className="flex-1 text-5xl font-black bg-transparent outline-none py-2 text-gray-900" 
                  />
                  <span className="text-xl font-black text-gray-400">kcal</span>
                </div>
              </div>
              
              <button 
                type="submit" 
                disabled={!intakeCalories || parseInt(intakeCalories) <= 0}
                className={`w-full py-5 text-white font-black rounded-[2rem] text-lg shadow-xl transition-all ${
                  (!intakeCalories || parseInt(intakeCalories) <= 0) 
                  ? 'bg-gray-300 cursor-not-allowed' 
                  : 'bg-orange-600 hover:bg-orange-700 active:scale-[0.98]'
                }`}
              >
                Add to Diary
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Activity Modal */}
      {showActivityModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 pb-10 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Log Burn</h2>
              <button onClick={() => setShowActivityModal(false)} className="bg-gray-100 p-2 rounded-full"><X className="w-6 h-6 text-gray-500" /></button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const mins = parseInt(formData.get('mins') as string);
              addEntry('exercise', mins * 7, (formData.get('desc') as string) || 'Activity');
            }} className="space-y-6">
              <div>
                <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-widest">Duration (mins)</label>
                <input required name="mins" type="number" placeholder="30" className="w-full text-5xl font-black bg-transparent border-b-4 border-green-50 outline-none py-2 text-gray-900 focus:border-green-500 transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-widest">What did you do?</label>
                <input name="desc" type="text" placeholder="Brisk walk" className="w-full px-5 py-4 bg-gray-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-green-500 text-gray-900 font-bold" />
              </div>
              <button type="submit" className="w-full py-5 bg-green-600 text-white font-black rounded-[2rem] text-lg shadow-xl hover:bg-green-700">Confirm Log</button>
            </form>
          </div>
        </div>
      )}

      {/* Coach Drawer */}
      {showCoach && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white overflow-hidden animate-in slide-in-from-right duration-300">
          <header className={`px-6 pt-12 pb-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0`}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center relative shadow-lg">
                <Sparkles className="w-6 h-6 text-white" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900">BurnFit AI</h2>
                <div className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-blue-500" />
                  <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Google Secured</span>
                </div>
              </div>
            </div>
            <button onClick={() => setShowCoach(false)} className="p-3 bg-gray-50 rounded-2xl"><X className="w-6 h-6 text-gray-400" /></button>
          </header>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {coachMessages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start items-end gap-3'}`}>
                {m.role === 'model' && (
                   <div className="w-8 h-8 bg-gray-900 rounded-lg flex-shrink-0 flex items-center justify-center">
                     <Flame className="w-4 h-4 text-white" />
                   </div>
                )}
                <div className={`max-w-[80%] px-5 py-4 rounded-[1.5rem] text-sm font-bold leading-relaxed ${
                  m.role === 'user' 
                  ? 'bg-orange-600 text-white rounded-tr-none shadow-sm' 
                  : 'bg-gray-100 text-gray-800 rounded-bl-none border border-gray-200 shadow-sm'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          <div className="p-6 bg-white border-t border-gray-100">
            <form onSubmit={async (e) => {
              e.preventDefault();
              const input = e.currentTarget.elements.namedItem('msg') as HTMLInputElement;
              const text = input.value.trim();
              if (text) {
                input.value = '';
                await handleSendMessage(text);
              }
            }} className="flex gap-3">
              <input name="msg" autoComplete="off" placeholder="Ask about your memories..." className="flex-1 bg-gray-50 border-none outline-none px-6 py-4 rounded-2xl focus:ring-2 focus:ring-orange-500 font-bold text-gray-900" />
              <button type="submit" className="bg-orange-600 text-white p-4 rounded-2xl shadow-lg hover:bg-orange-700 transition-colors">
                <ArrowRight className="w-6 h-6" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
