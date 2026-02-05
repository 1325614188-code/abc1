
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { User } from '../types';
import { getDeviceId } from '../services/deviceService';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    deviceId: string;
    login: (username: string, password?: string, nickname?: string, isRegister?: boolean, referrerCode?: string) => Promise<boolean | void>;
    logout: () => void;
    refreshUser: () => Promise<void>;
    deductCredit: () => Promise<boolean>;
    addCredits: (amount: number) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [deviceId] = useState<string>(() => getDeviceId());

    // Check for existing session on mount
    useEffect(() => {
        const checkSession = async () => {
            const storedId = localStorage.getItem('user_id');
            if (storedId) {
                await fetchUser(storedId);
            }
            setLoading(false);
        };
        checkSession();
    }, []);

    const fetchUser = async (id: string) => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', id)
                .single();

            if (error || !data) {
                console.error('Error fetching user:', error);
                localStorage.removeItem('user_id');
                setUser(null);
            } else {
                setUser(data as User);
            }
        } catch (err) {
            console.error('Fetch user exception:', err);
        }
    };

    const login = async (username: string, password?: string, nickname?: string, isRegister: boolean = false, referrerCode?: string) => {
        try {
            const body = isRegister
                ? { action: 'register', username, password, nickname, device_id: deviceId, referrer_code: referrerCode }
                : { action: 'login', username, password, device_id: deviceId };

            console.log("Sending auth request to /api/auth", body);
            const response = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            console.log("Auth response status:", response.status);
            const data = await response.json();
            console.log("Auth response data:", data);

            if (!response.ok) {
                throw new Error(data.error || 'Authentication failed');
            }

            if (data.user) {
                localStorage.setItem('user_id', data.user.id);
                setUser(data.user);
                return true;
            }
        } catch (err: any) {
            console.error('Auth error:', err);
            alert(err.message || '操作失败');
            return false;
        }
    };

    const logout = () => {
        localStorage.removeItem('user_id');
        setUser(null);
    };

    const refreshUser = async () => {
        if (user?.id) {
            await fetchUser(user.id);
        }
    };

    const deductCredit = async (): Promise<boolean> => {
        if (!user) return false;
        if (user.credits <= 0) return false;

        try {
            const { error } = await supabase
                .from('users')
                .update({ credits: user.credits - 1 })
                .eq('id', user.id);

            if (error) {
                console.error('Error deducting credit:', error);
                return false;
            }

            setUser({ ...user, credits: user.credits - 1 });
            return true;
        } catch (err) {
            console.error('Deduct credit exception:', err);
            return false;
        }
    };

    // 新增：添加积分方法（用于兑换码和充值）
    const addCredits = async (amount: number): Promise<boolean> => {
        if (!user) return false;

        try {
            const newCredits = user.credits + amount;
            const { error } = await supabase
                .from('users')
                .update({ credits: newCredits })
                .eq('id', user.id);

            if (error) {
                console.error('Error adding credits:', error);
                return false;
            }

            setUser({ ...user, credits: newCredits });
            return true;
        } catch (err) {
            console.error('Add credits exception:', err);
            return false;
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, deviceId, login, logout, refreshUser, deductCredit, addCredits }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
