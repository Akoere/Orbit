"use client";
import { useState, useRef, useEffect } from "react"; 
import { useRouter } from "next/navigation"; 
import { supabase } from "@/lib/supabase"; 
import Sidebar from "@/app/components/Sidebar"; // IMPORT THE NEW COMPONENT

// --- UI ICONS ---
import { 
  Bell, 
  User, 
  Check, 
  Copy, 
  Plus,
  Send,
  Trash2,
  X,
  Mail,
  MessageCircle,
  Menu,
  RotateCcw
} from "lucide-react";

export default function Home() {
  // --- STATE MANAGEMENT ---
  const [user, setUser] = useState(null);
  const [watchlist, setWatchlist] = useState([]); 
  const [isModalOpen, setIsModalOpen] = useState(false); 
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  
  // Sidebar starts closed on mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activePlatform, setActivePlatform] = useState("Reddit"); 
  const [copiedState, setCopiedState] = useState(null);
  const [textInput, setTextInput] = useState("");
  const [alertEnabled, setAlertEnabled] = useState(false);
  
  // Chat history management
  const [chats, setChats] = useState([
    { id: 'default', title: 'New Chat', messages: [], createdAt: Date.now() }
  ]);
  const [activeChat, setActiveChat] = useState('default');

  const fileInputRef = useRef(null);
  const router = useRouter(); 

  // --- 1. AUTH & DATA FETCHING ---
  useEffect(() => {
    const initData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      setUser(session.user);

      const { data } = await supabase
        .from('watchlist')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (data) setWatchlist(data);
    };
    
    initData();
  }, [router]);

  // --- 2. WATCHLIST LOGIC ---
  const handleAddAccount = async (handle) => {
    if (!handle) return;

    let displayName = handle;
    
    // For YouTube, try to fetch the channel name from RSS
    if (activePlatform === 'YouTube' && handle.startsWith('UC')) {
      try {
        const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${handle}`);
        if (res.ok) {
          const xml = await res.text();
          const nameMatch = xml.match(/<author>.*?<name>(.*?)<\/name>/s);
          if (nameMatch) {
            displayName = nameMatch[1];
          }
        }
      } catch (e) {
        console.log('Could not fetch channel name, using ID');
      }
    }

    const { data, error } = await supabase
        .from('watchlist')
        .insert([{ 
            user_id: user.id, 
            handle: handle, // Store the actual channel ID for API calls
            display_name: displayName, // Store the friendly name for display
            platform: activePlatform 
        }])
        .select();

    if (error) {
        alert("Error: " + error.message);
    } else {
        setWatchlist([data[0], ...watchlist]); 
        setIsModalOpen(false); 
    }
  };

  const handleDeleteAccount = async (id) => {
    if(!confirm("Stop tracking this account?")) return;
    await supabase.from('watchlist').delete().eq('id', id);
    setWatchlist(watchlist.filter(item => item.id !== id));
  };

  // --- 3. CHAT MANAGEMENT ---
  const getCurrentChat = () => chats.find(c => c.id === activeChat) || chats[0];
  const messages = getCurrentChat()?.messages || [];

  const updateCurrentChatMessages = (newMessages) => {
    setChats(prev => prev.map(chat => 
      chat.id === activeChat 
        ? { ...chat, messages: newMessages }
        : chat
    ));
  };

  const handleNewChat = () => {
    const newChat = {
      id: `chat-${Date.now()}`,
      title: 'New Chat',
      messages: [],
      createdAt: Date.now()
    };
    setChats(prev => [newChat, ...prev]);
    setActiveChat(newChat.id);
    setFile(null);
    setPreview(null);
    setTextInput('');
  };

  const handleSwitchChat = (chatId) => {
    setActiveChat(chatId);
    setFile(null);
    setPreview(null);
    setTextInput('');
  };

  const handleDeleteChat = (chatId) => {
    if (chats.length === 1) {
      // Can't delete the last chat, just clear it
      handleNewChat();
      return;
    }
    setChats(prev => prev.filter(c => c.id !== chatId));
    if (activeChat === chatId) {
      setActiveChat(chats.find(c => c.id !== chatId)?.id || 'default');
    }
  };

  // --- 4. AI LOGIC ---
  const callOrbitAPI = async (imageFile, textData) => {
    if (!textData?.trim() && !imageFile) return;
    
    // Create user message
    const userMessage = {
      role: 'user',
      content: textData || '',
      preview: imageFile ? URL.createObjectURL(imageFile) : null,
      timestamp: Date.now()
    };
    
    // Add user message to current chat
    const updatedMessages = [...messages, userMessage];
    updateCurrentChatMessages(updatedMessages);
    
    // Update chat title if it's the first message
    if (messages.length === 0 && textData) {
      setChats(prev => prev.map(chat => 
        chat.id === activeChat 
          ? { ...chat, title: textData.substring(0, 30) + (textData.length > 30 ? '...' : '') }
          : chat
      ));
    }
    
    setLoading(true);
    setTextInput('');
    setFile(null);
    setPreview(null);

    const formData = new FormData();
    if (imageFile) formData.append("image", imageFile);
    if (textData) formData.append("text", textData);
    formData.append("history", JSON.stringify(updatedMessages.slice(-6)));

    try {
      const res = await fetch("/api/analyze", { method: "POST", body: formData });
      const data = await res.json();
      
      const assistantMessage = {
        role: 'assistant',
        replies: data,
        timestamp: Date.now()
      };
      
      updateCurrentChatMessages([...updatedMessages, assistantMessage]);
    } catch (error) {
      console.error("Analysis failed", error);
      const errorMessage = {
        role: 'assistant',
        replies: { witty: "Orbit is offline.", insightful: "Error.", question: "Error." },
        timestamp: Date.now()
      };
      updateCurrentChatMessages([...updatedMessages, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const handleTextGenerate = () => {
    if (!textInput.trim() && !file) return; 
    callOrbitAPI(file, textInput);
  };

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopiedState(type);
    setTimeout(() => setCopiedState(null), 2000);
  };

  const triggerUpload = () => fileInputRef.current.click();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const getUserName = () => {
    if (!user) return "Guest";
    return user.user_metadata?.full_name || user.email?.split('@')[0];
  };

  const handleRunWatcher = async () => {
    setLoading(true);
    try {
        const res = await fetch('/api/cron'); 
        const data = await res.json();
        
        if (data.actions && data.actions.length > 0) {
            alert(`Watcher Success! \n\n${data.actions.join("\n")}`);
        } else {
            alert("Watcher checked, but found no new posts (Simulation). Try again!");
        }
    } catch (error) {
        console.error("Watcher Error:", error);
        alert("Watcher Failed. Check console.");
    } finally {
        setLoading(false);
    }
  };

  if (!user) return null; 

  return (
    <div className="flex h-screen bg-white font-sans overflow-hidden text-gray-900 selection:bg-blue-100">
      
      {/* --- MOBILE HEADER --- */}
      <div className="lg:hidden absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20 bg-white/80 backdrop-blur-md">
         {/* Menu Button */}
         <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition">
            <Menu size={24} strokeWidth={2.5}/>
         </button>
         
         {/* Profile Pic */}
         <div className="w-8 h-8 bg-linear-to-tr from-blue-600 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md ring-2 ring-white">
            {getUserName()[0].toUpperCase()}
         </div>
      </div>

      {/* --- SIDEBAR COMPONENT --- */}
      <Sidebar 
        user={user}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        activePlatform={activePlatform}
        setActivePlatform={setActivePlatform}
        watchlist={watchlist}
        onDeleteAccount={handleDeleteAccount}
        onOpenModal={setIsModalOpen}
        onLogout={handleLogout}
        // Chat history props
        chats={chats}
        activeChat={activeChat}
        onNewChat={handleNewChat}
        onSwitchChat={handleSwitchChat}
        onDeleteChat={handleDeleteChat}
      />

      {/* --- CENTER PANEL --- */}
      <main className="flex-1 flex flex-col relative bg-white">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-32 scroll-smooth">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />

          {/* GREETING - Show when no messages */}
          {messages.length === 0 && !loading && !preview && (
            <div className="h-full flex flex-col items-center justify-center animate-fade-in px-4">
                <div className="text-left md:text-center w-full max-w-lg space-y-2">
                      <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-purple-500 tracking-tight pb-2">
                        Hello, {getUserName().split(' ')[0]}
                      </h1>
                      <h2 className="text-2xl md:text-3xl font-medium text-gray-300 tracking-tight">
                        Let's create something engaging.
                      </h2>
                </div>
            </div>
          )}

          {/* CONVERSATION HISTORY */}
          {(messages.length > 0 || loading || preview) && (
             <div className="max-w-2xl mx-auto space-y-6 mt-12 lg:mt-0 pb-10">
                {/* New Chat Button */}
                {messages.length > 0 && (
                  <div className="flex justify-center mb-4">
                    <button 
                      onClick={handleNewChat}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition"
                    >
                      <RotateCcw size={14} />
                      New Chat
                    </button>
                  </div>
                )}

                {/* Render all messages */}
                {messages.map((msg, index) => (
                  <div key={msg.timestamp || index}>
                    {msg.role === 'user' ? (
                      // User message
                      <div className="flex justify-end animate-fade-in">
                        <div className="bg-gray-50 p-3 rounded-2xl rounded-tr-sm inline-block border border-gray-100 shadow-xs max-w-[85%]">
                          {msg.preview && <img src={msg.preview} alt="Upload" className="max-h-[200px] rounded-xl mb-2" />}
                          {msg.content && <p className="text-sm text-gray-800 px-1 font-medium">{msg.content}</p>}
                        </div>
                      </div>
                    ) : (
                      // Assistant message with replies
                      <div className="space-y-4 animate-fade-in">
                        <div className="flex gap-4">
                          <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-white shrink-0 mt-1 font-bold text-xs shadow-lg shadow-blue-500/20">O</div>
                          <div className="flex-1 space-y-3">
                            <ReplyCard type={`witty-${index}`} title="🦄 Witty" text={msg.replies?.witty} color="border-purple-500" bg="bg-purple-50/50" copiedState={copiedState} onCopy={handleCopy} />
                            <ReplyCard type={`insightful-${index}`} title="💡 Insightful" text={msg.replies?.insightful} color="border-blue-500" bg="bg-blue-50/50" copiedState={copiedState} onCopy={handleCopy} />
                            <ReplyCard type={`question-${index}`} title="❓ Question" text={msg.replies?.question} color="border-green-500" bg="bg-green-50/50" copiedState={copiedState} onCopy={handleCopy} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Pending image preview (before sending) */}
                {preview && !loading && (
                  <div className="flex justify-end animate-fade-in">
                    <div className="bg-gray-50 p-3 rounded-2xl rounded-tr-sm inline-block border border-gray-100 shadow-sm max-w-[85%] relative">
                      <button 
                        onClick={() => { setFile(null); setPreview(null); }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition z-10"
                      >
                        <X size={12} />
                      </button>
                      <img src={preview} alt="Upload" className="max-h-[200px] rounded-xl" />
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        💡 Add context below, then hit send
                      </p>
                    </div>
                  </div>
                )}

                {/* Loading indicator */}
                {loading && (
                    <div className="flex gap-4 animate-fade-in">
                        <div className="w-8 h-8 rounded-full bg-linear-to-tr from-blue-500 to-purple-600 shrink-0 animate-pulse"></div>
                        <div className="space-y-3 flex-1">
                            <div className="h-4 bg-gray-100 rounded w-3/4 animate-pulse"></div>
                            <div className="h-4 bg-gray-100 rounded w-1/2 animate-pulse"></div>
                        </div>
                    </div>
                )}
             </div>
          )}
        </div>

        {/* INPUT BAR (Floating) */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-linear-to-t from-white via-white to-transparent">
            <div className="max-w-2xl mx-auto">
                <div className="bg-gray-100 rounded-[28px] p-2 pl-4 flex items-center gap-3 shadow-sm transition-all focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 focus-within:shadow-md">
                    <button onClick={triggerUpload} className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-300 transition shrink-0">
                        <Plus size={18} />
                    </button>
                    <input 
                        type="text" 
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleTextGenerate()}
                        placeholder={`Message Orbit (${activePlatform})...`}
                        className="flex-1 bg-transparent border-none outline-none text-gray-900 placeholder-gray-500 text-sm"
                    />
                    {(textInput.trim() || preview) && (
                         <button onClick={handleTextGenerate} className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center text-white hover:bg-black transition shadow-md animate-pop-in mr-1">
                            <Send size={16} />
                         </button>
                    )}
                </div>
                <p className="text-center text-[10px] text-gray-400 mt-3 font-medium">
                    Orbit can make mistakes. Check important info.
                </p>
            </div>
        </div>
      </main>

      {/* RIGHT PANEL: WATCHLIST (Desktop Only - Kept in main file for now) */}
      <aside className="w-80 bg-white border-l border-gray-200 p-6 flex-col overflow-y-auto hidden lg:flex">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-gray-800">Watchlist</h2>
          <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-full">
            {watchlist.length}/10
          </span>
        </div>
        
        <div className="space-y-1 mb-8 max-h-[400px] overflow-y-auto">
          {watchlist.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-8 border-2 border-dashed border-gray-100 rounded-xl">
                No accounts tracked.
            </div>
          ) : (
             watchlist.map((item) => (
                <WatchlistItem 
                    key={item.id} 
                    name={item.display_name || item.handle} 
                    platform={item.platform} 
                    onDelete={() => handleDeleteAccount(item.id)}
                />
             ))
          )}
        </div>

        <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 w-full py-2.5 border-2 border-dashed border-gray-300 text-gray-500 rounded-xl text-sm font-bold hover:border-gray-400 hover:text-gray-700 transition mb-8"
        >
          + Add Account
        </button>

        <button 
            onClick={handleRunWatcher}
            className="w-full py-2 text-xs text-gray-400 hover:text-blue-600 font-medium underline mb-2"
        >
            (Dev) Force Watcher Run
        </button>

        <div className="mt-auto bg-linear-to-b from-blue-50 to-white p-5 rounded-2xl border border-blue-100 text-center">
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <Bell size={20} /> 
          </div>
          <h4 className="font-bold text-blue-900 text-sm mb-1">Stay in Orbit</h4>
          <p className="text-xs text-blue-700/80 leading-relaxed mb-3">
             {alertEnabled ? "Alerts are active for your email." : "Get instant alerts via Email when your watchlist posts."}
          </p>
          <button 
            onClick={() => setIsNotificationModalOpen(true)}
            disabled={alertEnabled}
            className={`text-xs font-bold px-4 py-2 rounded-lg transition w-full ${alertEnabled ? "bg-green-100 text-green-700 cursor-default" : "bg-blue-600 text-white hover:bg-blue-700"}`}
          >
            {alertEnabled ? "✓ Active" : "Enable Alerts"}
          </button>
        </div>
      </aside>

      {/* --- MODALS --- */}
      {isModalOpen && (
        <AddAccountModal 
            onClose={() => setIsModalOpen(false)} 
            onAdd={handleAddAccount}
            platform={activePlatform}
        />
      )}
      {isNotificationModalOpen && (
        <NotificationModal 
            onClose={() => setIsNotificationModalOpen(false)} 
            user={user}
        />
      )}

    </div>
  );
}

// --- SUB-COMPONENTS (Watchlist, Cards, Modals) ---

function WatchlistItem({ name, platform, onDelete }) {
  return (
    <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl transition group">
      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 group-hover:bg-white group-hover:shadow-sm transition"><User size={16} /></div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-bold text-gray-800 truncate">{name}</h4>
      </div>
      <span className="text-[10px] font-bold text-gray-400 border border-gray-200 bg-gray-50 px-1.5 py-0.5 rounded mr-1">{platform}</span>
      <button onClick={onDelete} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><Trash2 size={14} /></button>
    </div>
  );
}

function ReplyCard({ type, title, text, color, bg, copiedState, onCopy }) {
  const isCopied = copiedState === type;
  return (
    <div className={`p-5 rounded-2xl shadow-sm border-l-4 ${color} ${bg} relative group transition hover:shadow-md border border-gray-100/50`}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-xs font-black text-gray-800 uppercase tracking-wide opacity-80">{title}</h3>
        <button onClick={() => onCopy(text, type)} className="text-gray-400 hover:text-gray-700 transition p-1 hover:bg-white/50 rounded">
          {isCopied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
        </button>
      </div>
      <p className="text-gray-800 text-base font-medium leading-relaxed font-sans">{text}</p>
    </div>
  );
}

function AddAccountModal({ onClose, onAdd, platform }) {
    const [handle, setHandle] = useState("");

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-900">Track {platform} Account</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Account Handle</label>
                        <input 
                            autoFocus
                            type="text" 
                            value={handle}
                            onChange={(e) => setHandle(e.target.value)}
                            placeholder={platform === "X" ? "@elonmusk" : "username"}
                            className="w-full p-4 rounded-xl border-2 border-gray-100 focus:border-blue-500 outline-none text-gray-900 bg-gray-50"
                            onKeyDown={(e) => e.key === 'Enter' && onAdd(handle)}
                        />
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                        <button onClick={onClose} className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-50 rounded-xl transition text-sm">Cancel</button>
                        <button onClick={() => onAdd(handle)} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-500/30 text-sm">
                            Add to List
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function NotificationModal({ onClose, user }) {
    const [phone, setPhone] = useState(user?.user_metadata?.phone || "");
    const [loading, setLoading] = useState(false);
    const TWILIO_NUMBER = "+1 415 523 8886"; 

    const handleSaveWhatsApp = async () => {
        setLoading(true);
        const { error } = await supabase.from('profiles').update({ phone: phone }).eq('id', user.id);
        if (error) { alert("Error: " + error.message); setLoading(false); return; }

        try {
            const res = await fetch("/api/test-whatsapp", { method: "POST", body: JSON.stringify({ phone: phone }) });
            if (res.ok) { alert("Success! Check WhatsApp."); onClose(); } 
            else { alert(`Saved! Now send 'join factory-ants' to ${TWILIO_NUMBER} on WhatsApp.`); onClose(); }
        } catch (err) { alert("Saved!"); onClose(); }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-900">Notification Channels</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                </div>
                
                <div className="space-y-6">
                    {/* EMAIL SECTION */}
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center"><Mail size={16}/></div>
                            <div>
                                <p className="text-sm font-bold text-gray-900">Email</p>
                                <p className="text-xs text-gray-500">{user?.email}</p>
                            </div>
                        </div>
                        <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">Active</span>
                    </div>

                    {/* WHATSAPP SECTION */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center"><MessageCircle size={16}/></div>
                            <span className="text-sm font-bold text-gray-900">WhatsApp</span>
                        </div>
                        
                        <div className="bg-blue-50 text-blue-900 p-4 rounded-xl text-xs leading-relaxed border border-blue-100">
                            <p className="font-bold mb-2 uppercase tracking-wide text-blue-700">One-time Verification:</p>
                            <ol className="list-decimal pl-4 space-y-2">
                                <li>Open WhatsApp on your phone.</li>
                                <li>Send: <strong className="font-mono bg-white px-1.5 py-0.5 rounded border border-blue-200 select-all">join factory-ants</strong></li>
                                <li>To: <strong className="font-mono bg-white px-1.5 py-0.5 rounded border border-blue-200 select-all">{TWILIO_NUMBER}</strong></li>
                            </ol>
                        </div>

                        <input 
                            type="text" 
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+1234567890"
                            className="w-full p-3 rounded-xl border-2 border-gray-200 focus:border-green-500 outline-none text-gray-900 text-sm font-mono mt-2"
                        />
                        
                        <button 
                            onClick={handleSaveWhatsApp} 
                            disabled={loading}
                            className="w-full py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-black transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-gray-200"
                        >
                            {loading ? "Activating..." : "Activate WhatsApp"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}