"use client";
import { User, LogOut, Plus, X, Trash2, MessageSquare, Bell } from "lucide-react";
import { FaFacebook, FaInstagram, FaLinkedin, FaYoutube, FaTiktok, FaXTwitter, FaReddit } from "react-icons/fa6";
import { SiThreads } from "react-icons/si";

export default function Sidebar({ 
  user, 
  isOpen, 
  setIsOpen, 
  activePlatform, 
  setActivePlatform, 
  watchlist, 
  onDeleteAccount, 
  onOpenModal, 
  onLogout,
  // Chat history props
  chats = [],
  activeChat,
  onNewChat,
  onSwitchChat,
  onDeleteChat
}) {
  
  const getUserName = () => user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Guest";

  return (
    <>
      {/* OVERLAY (Mobile Only) - Closes sidebar when clicked */}
      <div 
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={() => setIsOpen(false)}
      />

      {/* SIDEBAR CONTAINER */}
      <aside className={`
          fixed lg:static inset-y-0 left-0 z-40 w-[280px] lg:w-64 bg-gray-50/95 lg:bg-gray-50 border-r border-gray-200 flex flex-col p-5 shadow-2xl lg:shadow-none transform transition-transform duration-300 ease-out
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        {/* HEADER */}
        <div className="mb-6 flex items-center justify-between">
             <div className="flex items-center gap-2 text-xl font-bold tracking-tight text-gray-900">
                <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-blue-300 shadow-md">O</div>
                Orbit
             </div>
             <button onClick={() => setIsOpen(false)} className="lg:hidden p-2 text-gray-400 hover:text-gray-600">
                <X size={20} />
             </button>
        </div>

        {/* NEW CHAT BUTTON */}
        <button 
          onClick={() => { onNewChat?.(); setIsOpen(false); }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mb-4 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-500/20 text-sm"
        >
          <Plus size={16} />
          New Chat
        </button>

        {/* SCROLLABLE CONTENT */}
        <div className="space-y-4 overflow-y-auto no-scrollbar flex-1">
            
            {/* CHAT HISTORY */}
            {chats.length > 0 && (
              <div>
                <h3 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-2 px-2">Recent Chats</h3>
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {chats.map((chat) => (
                    <div
                      key={chat.id}
                      onClick={() => { onSwitchChat?.(chat.id); setIsOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all group cursor-pointer ${
                        activeChat === chat.id 
                          ? "bg-gray-200 text-gray-900" 
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <MessageSquare size={14} className="text-gray-400 shrink-0" />
                      <span className="flex-1 truncate text-left">{chat.title}</span>
                      {chats.length > 1 && (
                        <button
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            onDeleteChat?.(chat.id); 
                          }}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition p-1"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PLATFORM NAVIGATION */}
            <div>
                <h3 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-2 px-2">Platforms</h3>
                <div className="space-y-1">
                    <PlatformButton active={activePlatform === "X"} onClick={() => setActivePlatform("X")} icon={<FaXTwitter size={14} />} label="X (Twitter)" />
                    <PlatformButton active={activePlatform === "Reddit"} onClick={() => setActivePlatform("Reddit")} icon={<FaReddit size={14} />} label="Reddit" />
                    <PlatformButton active={activePlatform === "YouTube"} onClick={() => setActivePlatform("YouTube")} icon={<FaYoutube size={14} />} label="YouTube" />
                </div>
            </div>

            <div>
                <h3 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-2 px-2">Coming Soon</h3>
                <div className="space-y-1 opacity-50">
                    <PlatformButton active={false} onClick={() => {}} icon={<FaInstagram size={14} />} label="Instagram" />
                    <PlatformButton active={false} onClick={() => {}} icon={<FaTiktok size={14} />} label="TikTok" />
                </div>
            </div>
        </div>

        {/* MOBILE WATCHLIST (Tucked at Bottom) */}
        <div className="lg:hidden mt-4 pt-4 border-t border-gray-200">
            <h3 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-3 px-2">Your Watchlist</h3>
            <div className="space-y-2 max-h-[120px] overflow-y-auto">
                {watchlist.length === 0 ? (
                  <p className="px-2 text-xs text-gray-400 italic">No accounts tracked.</p>
                ) : (
                   watchlist.slice(0, 4).map((item) => (
                      <div key={item.id} className="flex items-center justify-between px-2 py-2 text-sm text-gray-600 group">
                          <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                             <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0"></span>
                             <span className="truncate">{item.display_name || item.handle}</span>
                          </div>
                          <button 
                             onClick={() => onDeleteAccount(item.id)} 
                             className="text-gray-400 hover:text-red-500 p-2 -mr-2 shrink-0 transition"
                          >
                             <X size={16}/>
                          </button>
                      </div>
                   ))
                )}
                <button 
                    onClick={() => { onOpenModal(true); setIsOpen(false); }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition mt-2"
                >
                    <Plus size={12}/> Add Account
                </button>
            </div>
        </div>

        {/* LOGOUT FOOTER */}
        <div className="mt-4 border-t border-gray-200 pt-4">
            <button onClick={onLogout} className="flex items-center gap-3 w-full p-2.5 hover:bg-white rounded-xl transition text-left group">
                <div className="w-9 h-9 bg-linear-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center text-gray-600 font-bold text-xs">
                    {getUserName()[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{getUserName()}</p>
                    <p className="text-[10px] text-gray-500 font-medium">Log out</p>
                </div>
                <LogOut size={16} className="text-gray-400 group-hover:text-red-500 transition"/>
            </button>
        </div>
      </aside>
    </>
  );
}

// Sub-component for buttons inside the sidebar
function PlatformButton({ active, icon, label, onClick }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${active ? "bg-gray-200 text-gray-900 shadow-sm" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"}`}>
      <div className={`${active ? "text-gray-900" : "text-gray-400"}`}>{icon}</div>
      {label}
    </button>
  );
}