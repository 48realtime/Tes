import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  Users, 
  Send, 
  Settings, 
  X, 
  Radio, 
  Monitor, 
  List, 
  Plus, 
  Trash2,
  Lock,
  Eye,
  EyeOff,
  Star,
  Globe
} from 'lucide-react';
import ReactPlayer from 'react-player';
import Hls from 'hls.js';

// --- Types ---
interface Message {
  id: number;
  user: string;
  text: string;
  timestamp: string;
}

interface PlaylistItem {
  id: number;
  title: string;
  url: string;
}

interface AppState {
  live_status: string;
  stream_url: string;
  show_title: string;
  messages: Message[];
  playlist: PlaylistItem[];
}

// --- Background Components ---
const SpaceBackground = () => {
  const stars = useMemo(() => {
    return Array.from({ length: 100 }).map((_, i) => ({
      id: i,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      size: Math.random() * 2 + 1,
      duration: `${Math.random() * 3 + 2}s`,
      delay: `${Math.random() * 5}s`,
    }));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
      {stars.map((star) => (
        <div
          key={star.id}
          className="star"
          style={{
            top: star.top,
            left: star.left,
            width: `${star.size}px`,
            height: `${star.size}px`,
            // @ts-ignore
            '--duration': star.duration,
            animationDelay: star.delay,
          }}
        />
      ))}
      <motion.div
        animate={{
          x: [0, 50, 0],
          y: [0, 30, 0],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="planet w-64 h-64 bg-blue-900/20 top-[-10%] right-[-5%] blur-3xl"
      />
      <motion.div
        animate={{
          x: [0, -40, 0],
          y: [0, 60, 0],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="planet w-96 h-96 bg-indigo-900/10 bottom-[-10%] left-[-10%] blur-3xl"
      />
    </div>
  );
};

// --- Main App Component ---
export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [chatMessage, setChatMessage] = useState('');
  const [userName, setUserName] = useState(() => {
    const saved = localStorage.getItem('rt48_username');
    return saved || `User_${Math.floor(Math.random() * 1000)}`;
  });

  useEffect(() => {
    localStorage.setItem('rt48_username', userName);
  }, [userName]);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Admin Form State
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editLive, setEditLive] = useState(false);
  const [newPlaylistItem, setNewPlaylistItem] = useState({ title: '', url: '' });

  useEffect(() => {
    // Initial fetch
    fetch('/api/state')
      .then(res => res.json())
      .then(data => {
        setState(data);
        setEditTitle(data.show_title);
        setEditUrl(data.stream_url);
        setEditLive(data.live_status === 'true');
      });

    // WebSocket setup
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'VIEWER_COUNT') {
        setViewerCount(data.count);
      } else if (data.type === 'CHAT_MESSAGE') {
        setState(prev => prev ? { ...prev, messages: [...prev.messages, data] } : null);
      } else if (data.type === 'SETTINGS_UPDATED') {
        setState(prev => prev ? { 
          ...prev, 
          live_status: data.live_status.toString(),
          stream_url: data.stream_url,
          show_title: data.show_title
        } : null);
      } else if (data.type === 'PLAYLIST_UPDATED') {
        setState(prev => prev ? { ...prev, playlist: data.playlist } : null);
      }
    };

    setWs(socket);
    return () => socket.close();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state?.messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !ws) return;
    ws.send(JSON.stringify({
      type: 'CHAT_MESSAGE',
      user: userName,
      text: chatMessage
    }));
    setChatMessage('');
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === 'dhatul01') {
      setIsAdminAuthenticated(true);
    } else {
      alert('Password Salah!');
    }
  };

  const updateSettings = () => {
    if (!ws) return;
    ws.send(JSON.stringify({
      type: 'UPDATE_SETTINGS',
      password: adminPassword,
      live_status: editLive,
      stream_url: editUrl,
      show_title: editTitle
    }));
  };

  const addToPlaylist = () => {
    if (!ws || !newPlaylistItem.title || !newPlaylistItem.url) return;
    ws.send(JSON.stringify({
      type: 'PLAYLIST_ADD',
      password: adminPassword,
      ...newPlaylistItem
    }));
    setNewPlaylistItem({ title: '', url: '' });
  };

  const removeFromPlaylist = (id: number) => {
    if (!ws) return;
    ws.send(JSON.stringify({
      type: 'PLAYLIST_REMOVE',
      password: adminPassword,
      id
    }));
  };

  const isM3U8 = state?.stream_url?.includes('.m3u8');
  const isCloudflare = state?.stream_url?.includes('cloudflarestream.com');

  return (
    <div className="min-h-screen flex flex-col relative">
      <SpaceBackground />
      
      {/* Header */}
      <header className="p-4 bg-black/40 backdrop-blur-md border-b border-white/10 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Radio className="text-white" size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tighter bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            RealTime48
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
            <Users size={16} className="text-indigo-400" />
            <span className="text-sm font-medium">{viewerCount} Penonton</span>
          </div>
          <button 
            onClick={() => setIsAdminOpen(true)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <Settings size={20} className="text-gray-400" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row gap-6 p-4 lg:p-6 max-w-[1600px] mx-auto w-full">
        
        {/* Left: Player & Info */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative group">
            {state?.live_status === 'true' ? (
              <div className="w-full h-full">
                {isCloudflare ? (
                  <iframe
                    src={state.stream_url}
                    className="w-full h-full border-0"
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                    allowFullScreen
                  />
                ) : (
                  <ReactPlayer
                    key={state.stream_url}
                    {...({
                      url: state.stream_url,
                      width: "100%",
                      height: "100%",
                      controls: true,
                      playing: true,
                      muted: true,
                      config: {
                        file: {
                          forceHLS: isM3U8,
                        }
                      }
                    } as any)}
                  />
                )}
                <div className="absolute top-4 left-4 flex items-center gap-2">
                  <div className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded uppercase animate-pulse">
                    Live
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-gray-900 to-black">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                  <Monitor size={40} className="text-gray-600" />
                </div>
                <p className="text-gray-400 font-medium">Siaran sedang offline</p>
              </div>
            )}
          </div>

          <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10">
            <h2 className="text-xl font-bold mb-2">{state?.show_title || 'RealTime48 Live'}</h2>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Globe size={14} />
              <span>Streaming Global</span>
            </div>
          </div>

          {/* Playlist Section */}
          <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10">
            <div className="flex items-center gap-2 mb-4">
              <List size={18} className="text-indigo-400" />
              <h3 className="font-bold">Playlist Streaming</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {state?.playlist.map((item) => (
                <div 
                  key={item.id} 
                  className="p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors cursor-pointer flex justify-between items-center group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-500/20 rounded flex items-center justify-center">
                      <Play size={14} className="text-indigo-400" />
                    </div>
                    <span className="text-sm font-medium truncate max-w-[150px]">{item.title}</span>
                  </div>
                  <button 
                    onClick={() => {
                        if (isAdminAuthenticated) removeFromPlaylist(item.id);
                        else alert('Hanya admin yang bisa menghapus playlist');
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 rounded text-red-400 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {state?.playlist.length === 0 && (
                <p className="text-sm text-gray-500 italic col-span-2">Belum ada playlist.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Chat */}
        <div className="w-full lg:w-[400px] flex flex-col bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden h-[600px] lg:h-auto">
          <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
            <h3 className="font-bold flex items-center gap-2">
              <Send size={16} className="text-indigo-400 rotate-[-45deg]" />
              Obrolan Langsung
            </h3>
            <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Global</div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
            {state?.messages.map((msg) => (
              <div key={msg.id} className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  <span className={`text-xs font-bold ${msg.user === userName ? 'text-indigo-400' : 'text-gray-300'}`}>
                    {msg.user}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed bg-white/5 p-2 rounded-lg inline-block">
                  {msg.text}
                </p>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-4 bg-black/20 border-t border-white/10 space-y-3">
            <div className="flex gap-2">
              <div className="w-1/3 relative">
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Nama..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                  maxLength={15}
                />
              </div>
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="Tulis pesan..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button 
                  type="submit"
                  className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors shrink-0"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>

      {/* Admin Panel Modal */}
      <AnimatePresence>
        {isAdminOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdminOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-gray-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
            >
              {!isAdminAuthenticated ? (
                <div className="p-8">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Lock size={20} className="text-indigo-400" />
                      Admin Login
                    </h3>
                    <button onClick={() => setIsAdminOpen(false)} className="text-gray-500 hover:text-white">
                      <X size={24} />
                    </button>
                  </div>
                  <form onSubmit={handleAdminLogin} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Password</label>
                      <input
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
                        placeholder="Masukkan sandi..."
                      />
                    </div>
                    <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold transition-colors">
                      Masuk
                    </button>
                  </form>
                </div>
              ) : (
                <div className="p-8 max-h-[80vh] overflow-y-auto custom-scrollbar">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Settings size={20} className="text-indigo-400" />
                      Panel Kontrol
                    </h3>
                    <button onClick={() => setIsAdminOpen(false)} className="text-gray-500 hover:text-white">
                      <X size={24} />
                    </button>
                  </div>

                  <div className="space-y-6">
                    {/* Live Toggle */}
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                      <div>
                        <p className="font-bold">Status Live</p>
                        <p className="text-xs text-gray-500">Aktifkan untuk memulai siaran</p>
                      </div>
                      <button 
                        onClick={() => setEditLive(!editLive)}
                        className={`w-12 h-6 rounded-full relative transition-colors ${editLive ? 'bg-indigo-600' : 'bg-gray-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editLive ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>

                    {/* Basic Settings */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Judul Show</label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Link Embed (m3u8, YT, Cloudflare)</label>
                        <input
                          type="text"
                          value={editUrl}
                          onChange={(e) => setEditUrl(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <button 
                        onClick={updateSettings}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-bold"
                      >
                        Simpan Perubahan
                      </button>
                    </div>

                    {/* Playlist Manager */}
                    <div className="pt-6 border-t border-white/10">
                      <h4 className="font-bold mb-4 flex items-center gap-2">
                        <Plus size={16} />
                        Tambah ke Playlist
                      </h4>
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="Judul Video"
                          value={newPlaylistItem.title}
                          onChange={(e) => setNewPlaylistItem(prev => ({ ...prev, title: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm"
                        />
                        <input
                          type="text"
                          placeholder="URL Video"
                          value={newPlaylistItem.url}
                          onChange={(e) => setNewPlaylistItem(prev => ({ ...prev, url: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm"
                        />
                        <button 
                          onClick={addToPlaylist}
                          className="w-full py-2 border border-indigo-600 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-xl text-sm font-bold transition-all"
                        >
                          Tambah Playlist
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="p-6 text-center text-gray-600 text-xs border-t border-white/5 mt-auto">
        &copy; {new Date().getFullYear()} RealTime48. All rights reserved.
      </footer>
    </div>
  );
}
