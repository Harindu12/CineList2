import React, { useState } from 'react';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Clapperboard } from 'lucide-react';

export function AuthView() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter a username and password');
      return;
    }
    setError('');
    setLoading(true);

    const email = `${username.toLowerCase().trim()}@cinelist.local`;

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', username.toLowerCase().trim()), {
          username: username.toLowerCase().trim(),
          displayName: username.trim(),
        }, { merge: true });
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: username.trim() });
        await setDoc(doc(db, 'users', username.toLowerCase().trim()), {
          username: username.toLowerCase().trim(),
          displayName: username.trim(),
          createdAt: Date.now()
        }, { merge: true });
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password Auth is not enabled in Firebase Console. Please enable it.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
         setError('Invalid username or password');
      } else if (err.code === 'auth/email-already-in-use') {
         setError('Username already taken');
      } else if (err.code === 'auth/weak-password') {
         setError('Password must be at least 6 characters');
      } else if (err.code === 'auth/network-request-failed') {
         setError('Network error. Check your connection, or if you are using an ad-blocker or Brave Shields, please disable it for this site.');
      } else {
        setError(err.message || 'An error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#e8e5df] flex flex-col items-center justify-center z-[100] px-6 font-sans">
      <div className="w-16 h-16 bg-[#1a1917] rounded-full flex items-center justify-center text-white mb-6 shadow-lg">
        <Clapperboard size={32} strokeWidth={2.5} />
      </div>
      <h1 className="font-serif text-[36px] text-[#1a1917] mb-[8px] font-bold tracking-tight">
        {isLogin ? 'Welcome back' : 'Create account'}
      </h1>
      <p className="text-[#9b9890] text-[15px] mb-8 text-center max-w-[280px]">
        {isLogin ? 'Enter your simple name and password to access your watchlist.' : 'Pick a simple name and a password.'}
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-[320px] flex flex-col gap-4">
        <input
          type="text"
          placeholder="Name"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full bg-white px-4 py-4 rounded-[16px] border border-[#e0ddd6] text-[#1a1917] text-[15px] focus:outline-none focus:border-[#1a1917] transition-colors"
          readOnly={loading}
          autoComplete="username"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-white px-4 py-4 rounded-[16px] border border-[#e0ddd6] text-[#1a1917] text-[15px] focus:outline-none focus:border-[#1a1917] transition-colors"
          readOnly={loading}
          autoComplete="current-password"
        />
        
        {error && <div className="text-[#d32f2f] text-[13px] text-center font-medium">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 bg-[#1a1917] text-white font-semibold py-[16px] rounded-[16px] shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:opacity-90 disabled:opacity-50 text-[15px] transition-opacity"
        >
          {loading ? 'Please wait...' : (isLogin ? 'Log In' : 'Sign Up')}
        </button>
      </form>

      <button 
        onClick={() => { setIsLogin(!isLogin); setError(''); }}
        className="mt-6 text-[#1a1917] font-medium text-[14px] hover:underline"
        disabled={loading}
      >
        {isLogin ? 'Need an account? Sign up' : 'Already have an account? Log in'}
      </button>
    </div>
  );
}
