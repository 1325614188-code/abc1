
import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { User } from '../types';
import Layout from './Layout';
import { useAuth } from '../contexts/AuthContext';

interface AdminDashboardProps {
    onBack?: () => void;
}

interface ConfigItem {
    value: string;
    is_enabled: boolean;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
    const { user } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'users' | 'config'>('users');

    // 配置状态
    const [configs, setConfigs] = useState<Record<string, ConfigItem>>({});
    const [configLoading, setConfigLoading] = useState(false);
    const [wechatId, setWechatId] = useState('');
    const [alipayEnabled, setAlipayEnabled] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching users:', error);
            alert('加载用户数据失败');
        } else {
            setUsers(data as User[]);
        }
        setLoading(false);
    };

    const fetchConfigs = async () => {
        setConfigLoading(true);
        try {
            const response = await fetch('/api/config');
            const data = await response.json();
            if (data.configs) {
                setConfigs(data.configs);
                setWechatId(data.configs.wechat_id?.value || 'sekesm');
                // 读取充值开关状态
                const alipayConfig = data.configs.alipay_enabled;
                setAlipayEnabled(
                    alipayConfig?.is_enabled === true ||
                    alipayConfig?.value === 'true' ||
                    alipayConfig?.value === '1'
                );
            }
        } catch (err) {
            console.error('Error fetching configs:', err);
        }
        setConfigLoading(false);
    };

    useEffect(() => {
        fetchUsers();
        fetchConfigs();
    }, []);

    const handleAddCredits = async (userId: string, currentCredits: number) => {
        const amount = prompt('请输入要增加的次数:', '5');
        if (!amount || isNaN(parseInt(amount))) return;

        const newCredits = currentCredits + parseInt(amount);

        const { error } = await supabase
            .from('users')
            .update({ credits: newCredits })
            .eq('id', userId);

        if (error) {
            console.error('Error updating credits:', error);
            alert('充值失败');
        } else {
            setUsers(users.map(u => u.id === userId ? { ...u, credits: newCredits } : u));
            alert('充值成功');
        }
    };

    const handleUpdateConfig = async (key: string, value?: string, is_enabled?: boolean) => {
        try {
            const response = await fetch('/api/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value, is_enabled, user_id: user?.id })
            });

            if (response.ok) {
                alert('配置更新成功');
                fetchConfigs();
            } else {
                const data = await response.json();
                alert(data.error || '更新失败');
            }
        } catch (err) {
            console.error('Update config error:', err);
            alert('更新失败');
        }
    };

    const handleSaveWechatId = () => {
        handleUpdateConfig('wechat_id', wechatId);
    };

    const handleToggleAlipay = () => {
        const newState = !alipayEnabled;
        setAlipayEnabled(newState);
        handleUpdateConfig('alipay_enabled', undefined, newState);
    };

    return (
        <Layout title="管理后台" onBack={onBack || (() => window.history.back())}>
            {/* 标签切换 */}
            <div className="flex space-x-2 mb-4">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'users'
                        ? 'bg-pink-500 text-white'
                        : 'bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                >
                    用户管理
                </button>
                <button
                    onClick={() => setActiveTab('config')}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'config'
                        ? 'bg-pink-500 text-white'
                        : 'bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                >
                    系统配置
                </button>
            </div>

            {/* 用户管理 */}
            {activeTab === 'users' && (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800">用户管理 ({users.length})</h3>
                        <button
                            onClick={fetchUsers}
                            className="text-sm text-pink-500 hover:text-pink-600"
                        >
                            刷新数据
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3">昵称</th>
                                    <th className="px-4 py-3">剩余次数</th>
                                    <th className="px-4 py-3">注册时间</th>
                                    <th className="px-4 py-3">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                                            加载中...
                                        </td>
                                    </tr>
                                ) : users.map((u) => (
                                    <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium text-slate-800">
                                            {u.nickname}
                                            {u.is_admin && <span className="ml-2 text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">ADMIN</span>}
                                        </td>
                                        <td className="px-4 py-3 text-pink-600 font-bold">{u.credits}</td>
                                        <td className="px-4 py-3 text-slate-400 text-xs">
                                            {new Date(u.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => handleAddCredits(u.id, u.credits)}
                                                className="text-xs bg-pink-50 text-pink-500 px-2 py-1 rounded hover:bg-pink-100 transition-colors"
                                            >
                                                + 充值
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {users.length === 0 && !loading && (
                        <div className="p-8 text-center text-slate-400">
                            暂无用户数据
                        </div>
                    )}
                </div>
            )}

            {/* 系统配置 */}
            {activeTab === 'config' && (
                <div className="space-y-4">
                    {/* 微信号配置 */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm">
                        <h4 className="font-bold text-slate-800 mb-3">兑换码微信号</h4>
                        <p className="text-xs text-slate-400 mb-3">用户在兑换码页面看到的联系微信号</p>
                        <div className="flex space-x-2">
                            <input
                                type="text"
                                value={wechatId}
                                onChange={(e) => setWechatId(e.target.value)}
                                placeholder="输入微信号"
                                className="flex-1 px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-200 text-sm"
                            />
                            <button
                                onClick={handleSaveWechatId}
                                className="px-4 py-2 bg-pink-500 text-white rounded-xl text-sm font-medium hover:bg-pink-600 transition-colors"
                            >
                                保存
                            </button>
                        </div>
                    </div>

                    {/* 支付宝开关 */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="font-bold text-slate-800">充值功能开关</h4>
                                <p className="text-xs text-slate-400 mt-1">
                                    {alipayEnabled ? '充值功能已开启，用户可见充值入口' : '充值功能已关闭，用户不可见充值入口'}
                                </p>
                            </div>
                            <button
                                onClick={handleToggleAlipay}
                                className={`w-14 h-7 rounded-full transition-colors relative ${alipayEnabled ? 'bg-green-500' : 'bg-slate-300'
                                    }`}
                            >
                                <span
                                    className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${alipayEnabled ? 'translate-x-7' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>
                    </div>

                    {/* 支付宝参数（仅当开启时显示） */}
                    {alipayEnabled && (
                        <div className="bg-white rounded-2xl p-4 shadow-sm">
                            <h4 className="font-bold text-slate-800 mb-3">支付宝配置</h4>
                            <p className="text-xs text-slate-400 mb-3">配置支付宝开放平台参数（敏感信息已脱敏显示）</p>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">APPID</label>
                                    <input
                                        type="text"
                                        placeholder="支付宝应用 APPID"
                                        defaultValue={configs.alipay_appid?.value}
                                        className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-200 text-sm"
                                        onBlur={(e) => handleUpdateConfig('alipay_appid', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">应用私钥</label>
                                    <textarea
                                        placeholder="应用私钥"
                                        defaultValue={configs.alipay_private_key?.value}
                                        rows={4}
                                        className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-200 text-sm font-mono text-xs"
                                        onBlur={(e) => handleUpdateConfig('alipay_private_key', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">支付宝公钥</label>
                                    <textarea
                                        placeholder="支付宝公钥"
                                        defaultValue={configs.alipay_public_key?.value}
                                        rows={4}
                                        className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-200 text-sm font-mono text-xs"
                                        onBlur={(e) => handleUpdateConfig('alipay_public_key', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {configLoading && (
                        <div className="text-center py-4 text-slate-400 text-sm">加载配置中...</div>
                    )}
                </div>
            )}
        </Layout>
    );
};

export default AdminDashboard;

