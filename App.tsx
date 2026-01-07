
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
  Beef
} from 'lucide-react';
import { UserProfile, DailyStats, ActivityEntry, ChatMessage, DietaryPreference } from './types';
import { getAIResponse, getFixMyDaySuggestion, analyzeFoodImage, estimateCaloriesFromText } from './geminiService';

const STORAGE_KEY_PROFILE = 'burnfit_profile';
const STORAGE_KEY_ENTRIES = 'burnfit_entries';
const STORAGE_KEY_AUTH = 'burnfit_auth';

const MICRO_WORKOUTS = [
  { id: 1, title: '5-minute brisk walk', icon: '🚶' },
  { id: 2, title: '7-minute home stretching', icon: '🧘' },
  { id: 3, title: '10-minute core workout', icon: '💪' },
  { id: 4, title: '5-minute desk yoga', icon: '✨' },
];

export default function App() {
  const [isAuthSession, setIsAuthSession] = useState<boolean | null>(null);
  const [isGoogleAccount, setIsGoogleAccount] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'coach' | 'profile'>('dashboard');
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showCoach, setShowCoach] = useState(false);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [isScanningFood, setIsScanningFood] = useState(false);
  const [isEstimatingText, setIsEstimatingText] = useState(false);
  
  const [intakeCalories, setIntakeCalories] = useState<string>('');
  const [intakeDesc, setIntakeDesc] = useState<string>('');

  const [coachMessages, setCoachMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Hey there! I’m your BurnFit Coach. I’ve connected to your Google Health Memories. Ready to smash some goals today?' }
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const authStatus = localStorage.getItem(STORAGE_KEY_AUTH);
    if (authStatus) {
      setIsAuthSession(true);
      setIsGoogleAccount(authStatus === 'google');
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

  const handleLogin = (type: 'google' | 'guest') => {
    localStorage.setItem(STORAGE_KEY_AUTH, type);
    setIsGoogleAccount(type === 'google');
    setIsAuthSession(true);
  };

  const handleLogout = () => {
    if(confirm("Are you sure? This will disconnect your local sync.")) {
      localStorage.removeItem(STORAGE_KEY_AUTH);
      localStorage.removeItem(STORAGE_KEY_PROFILE);
      localStorage.removeItem(STORAGE_KEY_ENTRIES);
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
    
    const target = calculateTarget(age, height, weight, goal);
    const newProfile: UserProfile = { 
      age, 
      height, 
      weight, 
      goal, 
      dietaryPreference, 
      dailyTarget: target, 
      setupComplete: true 
    };
    setProfile(newProfile);

    // Initial message adjustment based on preference
    setCoachMessages([
      { role: 'model', text: `Profile Synced! I've noted your preference for a ${dietaryPreference} diet. Let's start your Google Health Journey today!` }
    ]);
  };

  const handleSendMessage = async (text: string) => {
    if (!profile) return;
    
    const userMessage: ChatMessage = { role: 'user', text };
    setCoachMessages(prev => [...prev, userMessage]);

    try {
      const response = await getAIResponse(
        profile,
        getTodayStats(),
        coachMessages,
        text
      );
      
      setCoachMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (error) {
      console.error("Coach response error:", error);
      setCoachMessages(prev => [...prev, { 
        role: 'model', 
        text: "I'm having a bit of trouble connecting to your memories right now. Let's try again in a second!" 
      }]);
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
    }
    if (type === 'exercise') setShowActivityModal(false);
  };

  const handleCameraClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanningFood(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = (reader.result as string).split(',')[1];
      const result = await analyzeFoodImage(base64Data, file.type);
      if (result) {
        setIntakeCalories(result.estimatedCalories.toString());
        setIntakeDesc(result.foodName);
      }
      setIsScanningFood(false);
    };
    reader.readAsDataURL(file);
  };

  const handleEstimateCalories = async () => {
    if (!intakeDesc.trim()) return;
    setIsEstimatingText(true);
    try {
      const result = await estimateCaloriesFromText(intakeDesc);
      if (result && result.estimatedCalories > 0) {
        setIntakeCalories(result.estimatedCalories.toString());
      }
    } finally {
      setIsEstimatingText(false);
    }
  };

  if (isAuthSession === false) {
    return (
      <div className="min-h-screen bg-white p-8 flex flex-col items-center justify-center text-center">
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
        </div>
        
        <p className="mt-8 text-xs text-gray-400 font-medium">
          No sign up required. Data stored in your Google Cloud or Local Memory.
        </p>
      </div>
    );
  }

  if (!profile || !profile.setupComplete) {
    return (
      <div className="min-h-screen bg-white p-6 flex flex-col items-center justify-center">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Your Profile</h1>
            <p className="text-gray-500">
              {isGoogleAccount ? "Welcome! We're fetching your data from Google." : "Let's get you set up locally."}
            </p>
          </div>

          <form onSubmit={handleSetup} className="space-y-6">
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

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Height (cm)</label>
              <input required name="height" type="number" placeholder="175" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Weight (kg)</label>
              <input required name="weight" type="number" placeholder="70" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-gray-900" />
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
      <header className="bg-white px-6 pt-12 pb-6 border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-orange-600 p-2 rounded-xl">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">BurnFit</h1>
            <div className="flex items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full ${isGoogleAccount ? 'bg-blue-500' : 'bg-green-500'}`} />
              <span className="text-[10px] uppercase font-black text-gray-400 tracking-widest">
                {isGoogleAccount ? "Google Sync ON" : "Local Only"}
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
            onClick={() => { setShowIntakeModal(true); setIntakeCalories(''); setIntakeDesc(''); }}
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
                <UserIcon className="w-8 h-8 text-orange-600" />
              </div>
              <div>
                <p className="font-black text-xl text-gray-900">{isGoogleAccount ? "Google User" : "Guest User"}</p>
                <p className="text-sm text-gray-500">{isGoogleAccount ? "Syncing to Cloud Memory" : "Stored on Device"}</p>
              </div>
            </div>

            <div className="space-y-4">
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

              <div className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl">
                <div className="flex items-center gap-3">
                  <Cloud className="w-5 h-5 text-blue-500" />
                  <span className="font-bold">Sync to Google</span>
                </div>
                <div className={`w-10 h-6 rounded-full p-1 transition-colors ${isGoogleAccount ? 'bg-green-500' : 'bg-gray-200'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${isGoogleAccount ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-purple-500" />
                  <span className="font-bold">Privacy Controls</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          </div>

          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-5 text-red-600 font-black uppercase text-sm tracking-widest"
          >
            <LogOut className="w-4 h-4" /> Disconnect & Delete Data
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
              addEntry('intake', parseInt(intakeCalories), intakeDesc || 'Meal');
            }} className="space-y-6">
              <div>
                <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-widest">Food Name</label>
                <div className="relative">
                  <input 
                    value={intakeDesc}
                    onChange={(e) => setIntakeDesc(e.target.value)}
                    type="text" 
                    placeholder="e.g. Greek Salad" 
                    className="w-full px-5 py-4 bg-gray-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 font-bold" 
                  />
                  {intakeDesc.length > 2 && (
                    <button 
                      type="button"
                      onClick={handleEstimateCalories}
                      className="absolute right-2 top-2 bottom-2 bg-gray-900 text-white px-4 rounded-xl font-bold text-xs"
                    >
                      {isEstimatingText ? "..." : "AI Guess"}
                    </button>
                  )}
                </div>
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
                disabled={!intakeCalories}
                className="w-full py-5 bg-orange-600 text-white font-black rounded-[2rem] text-lg shadow-xl"
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
              <button type="submit" className="w-full py-5 bg-green-600 text-white font-black rounded-[2rem] text-lg shadow-xl">Confirm Log</button>
            </form>
          </div>
        </div>
      )}

      {/* Coach Drawer */}
      {showCoach && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white overflow-hidden animate-in slide-in-from-right duration-300">
          <header className="px-6 pt-12 pb-6 border-b border-gray-100 flex items-center justify-between bg-white">
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
                  ? 'bg-orange-600 text-white rounded-tr-none' 
                  : 'bg-gray-100 text-gray-800 rounded-bl-none'
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
              <input name="msg" autoComplete="off" placeholder="Ask about your Google Health memories..." className="flex-1 bg-gray-50 border-none outline-none px-6 py-4 rounded-2xl focus:ring-2 focus:ring-orange-500 font-bold text-gray-900" />
              <button type="submit" className="bg-orange-600 text-white p-4 rounded-2xl shadow-lg">
                <ArrowRight className="w-6 h-6" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
