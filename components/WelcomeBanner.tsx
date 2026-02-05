
import React, { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const WelcomeBanner: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showInstall, setShowInstall] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isWechat, setIsWechat] = useState(false);

    useEffect(() => {
        const ua = navigator.userAgent;
        const isIOSDevice = /iPad|iPhone|iPod/.test(ua);
        const isWechatBrowser = /MicroMessenger/i.test(ua);

        setIsIOS(isIOSDevice);
        setIsWechat(isWechatBrowser);

        // 只检查是否已安装为独立应用
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

        if (isStandalone) {
            return; // 已安装，不显示提示
        }

        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setShowInstall(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // 非 standalone 模式下显示安装提示
        if (!isStandalone) {
            setShowInstall(true);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstall = async () => {
        if (deferredPrompt) {
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setShowInstall(false);
                localStorage.setItem('pwa_prompt_dismissed', 'true');
            }
            setDeferredPrompt(null);
        }
    };

    const handleDismiss = () => {
        setShowInstall(false);
        localStorage.setItem('pwa_prompt_dismissed', 'true');
    };

    return (
        <div className="bg-gradient-to-br from-pink-500 to-rose-400 rounded-3xl p-5 text-white shadow-xl shadow-pink-100 relative overflow-hidden">
            <div className="flex items-center justify-between relative z-10">
                {/* 左侧文字 */}
                <div className="flex-1">
                    <h2 className="text-xl font-bold mb-1">遇见更美的自己</h2>
                    <p className="opacity-90 text-xs">融合AI美学与东方传统智慧</p>
                </div>

                {/* 右侧安装提示 */}
                {showInstall && (
                    <div className="flex-shrink-0 ml-3 animate-in fade-in slide-in-from-right duration-500">
                        <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 border border-white/30">
                            <div className="flex items-center space-x-2 mb-2">
                                <span className="text-lg">📲</span>
                                <span className="text-xs font-bold">添加到桌面</span>
                            </div>

                            {isIOS ? (
                                <p className="text-[10px] opacity-90 leading-tight">
                                    Safari底部 <span className="font-bold">分享↑</span> → <span className="font-bold">添加到主屏幕</span>
                                </p>
                            ) : isWechat ? (
                                <p className="text-[10px] opacity-90 leading-tight">
                                    点击右上角 <span className="font-bold">⋯</span><br />
                                    选择 <span className="font-bold">在浏览器中打开</span>
                                </p>
                            ) : deferredPrompt ? (
                                <button
                                    onClick={handleInstall}
                                    className="w-full py-1.5 bg-white text-pink-500 rounded-lg text-[11px] font-bold active:scale-95 transition-transform"
                                >
                                    点击安装App
                                </button>
                            ) : (
                                <p className="text-[10px] opacity-90 leading-tight">
                                    在浏览器菜单中选择<br /><span className="font-bold">「添加到主屏幕」</span>
                                </p>
                            )}

                            <button
                                onClick={handleDismiss}
                                className="w-full mt-1 text-[10px] opacity-70 hover:opacity-100"
                            >
                                不再提示
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* 装饰圆 */}
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white opacity-10 rounded-full"></div>
            <div className="absolute right-16 top-2 w-8 h-8 bg-white opacity-5 rounded-full"></div>
        </div>
    );
};

export default WelcomeBanner;
