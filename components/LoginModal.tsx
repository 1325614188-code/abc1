
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface LoginModalProps {
    onClose?: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onClose }) => {
    const { login } = useAuth();
    const [nickname, setNickname] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isRegister, setIsRegister] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [referrerCode, setReferrerCode] = useState<string | null>(null);

    // 从 URL 中提取推荐码
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const ref = urlParams.get('ref');
        if (ref && ref.length === 6) {
            setReferrerCode(ref);
            console.log('Detected referrer code:', ref);
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!username || !password) {
            alert("请输入用户名和密码");
            return;
        }

        if (isRegister && !nickname) {
            alert("注册时请填写昵称");
            return;
        }

        setIsSubmitting(true);
        // 注册时传递推荐码
        const success = await login(username, password, nickname, isRegister, referrerCode || undefined);
        setIsSubmitting(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-300 relative">
                {onClose && (
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-slate-300 hover:text-slate-500 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-pink-100 text-pink-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                        ✨
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">欢迎加入</h2>
                    <p className="text-slate-500 text-sm mt-2">输入昵称即可开启 AI 美学之旅</p>
                    <p className="text-pink-500 text-xs font-bold mt-1">🎁 新用户获赠 5 次免费分析</p>
                    {referrerCode && (
                        <p className="text-green-500 text-xs mt-1">🎊 已识别推荐链接</p>
                    )}
                </div>

                <div className="flex justify-center mb-6 border-b border-slate-100">
                    <button
                        className={`pb-2 px-4 font-bold text-sm transition-colors ${!isRegister ? 'text-pink-500 border-b-2 border-pink-500' : 'text-slate-400'}`}
                        onClick={() => setIsRegister(false)}
                    >
                        登录
                    </button>
                    <button
                        className={`pb-2 px-4 font-bold text-sm transition-colors ${isRegister ? 'text-pink-500 border-b-2 border-pink-500' : 'text-slate-400'}`}
                        onClick={() => setIsRegister(true)}
                    >
                        注册
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {isRegister && (
                        <div>
                            <input
                                type="text"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                placeholder="怎么称呼您？(昵称)"
                                className="w-full px-6 py-4 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-400 transition-all text-center text-lg placeholder:text-slate-300"
                            />
                        </div>
                    )}

                    <div>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="请输入用户名"
                            className="w-full px-6 py-4 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-400 transition-all text-center text-lg placeholder:text-slate-300"
                        />
                    </div>

                    <div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="请输入密码"
                            className="w-full px-6 py-4 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-400 transition-all text-center text-lg placeholder:text-slate-300"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={!username.trim() || !password.trim() || (isRegister && !nickname.trim()) || isSubmitting}
                        className="w-full py-4 bg-gradient-to-r from-pink-500 to-rose-400 text-white rounded-xl font-bold shadow-lg shadow-pink-200 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                    >
                        {isSubmitting ? '处理中...' : (isRegister ? '立即体验' : '登录')}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginModal;

