"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Mail, Lock, Loader2 } from "lucide-react";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState(""); 
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false); 
  const [message, setMessage] = useState(null);
  const router = useRouter();

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        if (error) throw error;
        setMessage("Account created! Logging you in...");
        router.push("/"); 
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/"); 
      }
    } catch (error) {
      setMessage("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans text-gray-900">
      
      {/* CARD CONTAINER */}
      <div className="w-full max-w-[420px] bg-white p-10 rounded-3xl shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)] border border-gray-200">
        
        {/* BRAND HEADER */}
        <div className="text-center mb-8">
            {/* Orbit Logo & Name */}
            <div className="flex items-center justify-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-blue-200 shadow-md">
                    O
                </div>
                <span className="text-3xl font-bold text-gray-900 tracking-tight">Orbit</span>
            </div>

            <h1 className="font-bold text-gray-500 uppercase tracking-wider text-xs mb-1">
              {isSignUp ? "Start your journey" : "Welcome back"}
            </h1>
            <p className="text-gray-400 text-sm">
              {isSignUp ? "Create an account to continue." : "Login to access your watchlist."}
            </p>
        </div>

        {/* MESSAGES */}
        {message && (
          <div className={`p-3 rounded-xl text-sm mb-6 text-center font-medium ${
            message.includes("Error") 
              ? "bg-red-50 text-red-600 border border-red-100" 
              : "bg-green-50 text-green-600 border border-green-100"
          }`}>
             {message}
          </div>
        )}

        {/* FORM */}
        <form onSubmit={handleAuth} className="space-y-5">
          
          {isSignUp && (
             <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700 uppercase">Full Name</label>
                <input 
                    type="text" 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 focus:border-blue-500 focus:outline-none transition-colors"
                    placeholder="John Doe"
                />
             </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700 uppercase">Email Address</label>
            <div className="relative">
               <Mail className="absolute left-3.5 top-3.5 text-gray-400" size={20} />
               <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 p-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 focus:border-blue-500 focus:outline-none transition-colors"
                  placeholder="name@example.com"
               />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700 uppercase">Password</label>
            <div className="relative">
               <Lock className="absolute left-3.5 top-3.5 text-gray-400" size={20} />
               <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 p-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 focus:border-blue-500 focus:outline-none transition-colors"
                  placeholder="••••••••"
                  minLength={6}
               />
            </div>
          </div>

          <button 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-4 shadow-lg shadow-blue-500/20"
          >
            {loading ? <Loader2 className="animate-spin" size={20}/> : (isSignUp ? "Create Account" : "Sign In")}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-gray-500">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button 
            onClick={() => {setIsSignUp(!isSignUp); setMessage(null);}} 
            className="text-blue-600 font-bold hover:underline"
          >
            {isSignUp ? "Log in" : "Sign up"}
          </button>
        </div>

      </div>
    </div>
  );
}