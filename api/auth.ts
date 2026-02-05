
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
    runtime: 'nodejs',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    console.log("[Auth API] Triggered", req.method);

    // Add CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            console.error("[Auth API] Missing Env Vars");
            return res.status(500).json({ error: 'Server misconfiguration: Missing Env Vars' });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        const body = req.body;
        // 新增：接收 device_id 和 referrer_code 参数
        const { action, username, password, nickname, device_id, referrer_code } = body || {};

        console.log("[Auth API] Action:", action, "Username:", username, "DeviceID:", device_id);

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        if (action === 'register') {
            if (!nickname) {
                return res.status(400).json({ error: 'Nickname is required for registration' });
            }

            // 检查用户名是否已存在
            const { data: existingUser, error: findError } = await supabase
                .from('users')
                .select('id')
                .eq('username', username)
                .single();

            if (findError && findError.code !== 'PGRST116') {
                console.error("[Auth API] DB Error finding user:", findError);
                throw findError;
            }

            if (existingUser) {
                return res.status(400).json({ error: 'Username already taken' });
            }

            // 检查设备是否已获得注册奖励
            let initialCredits = 5;
            if (device_id) {
                const { data: deviceUsed } = await supabase
                    .from('device_usage')
                    .select('*')
                    .eq('device_id', device_id)
                    .single();

                if (deviceUsed) {
                    // 设备已被使用过，不赠送额度
                    initialCredits = 0;
                    console.log("[Auth API] Device already used, no bonus credits");
                } else {
                    // 首次使用该设备，记录并赠送额度
                    await supabase.from('device_usage').insert([{ device_id }]);
                    console.log("[Auth API] First device registration, granting bonus");
                }
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            // 创建新用户
            const { data: newUser, error } = await supabase
                .from('users')
                .insert([{
                    username,
                    password_hash: hashedPassword,
                    nickname,
                    credits: initialCredits,
                    device_id: device_id || null
                }])
                .select()
                .single();

            if (error) {
                console.error("[Auth API] Insert error:", error);
                throw error;
            }

            // 处理推荐逻辑：如果有推荐码，给推荐人增加1次额度
            if (referrer_code && referrer_code.length === 6 && device_id) {
                console.log("[Auth API] Processing referral code:", referrer_code);

                // 查找推荐人（设备ID后6位匹配）
                const { data: referrers } = await supabase
                    .from('users')
                    .select('id, credits, device_id');

                if (referrers) {
                    const referrer = referrers.find(u =>
                        u.device_id &&
                        u.device_id.slice(-6) === referrer_code &&
                        u.device_id !== device_id  // 不能是同一设备
                    );

                    if (referrer) {
                        // 给推荐人增加1次额度
                        await supabase
                            .from('users')
                            .update({ credits: referrer.credits + 1 })
                            .eq('id', referrer.id);
                        console.log("[Auth API] Referrer rewarded:", referrer.id);
                    }
                }
            }

            console.log("[Auth API] User created success with", initialCredits, "credits");
            return res.status(200).json({ user: newUser });

        } else if (action === 'login') {
            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .single();

            if (error || !user) {
                return res.status(401).json({ error: 'Invalid username or password' });
            }

            if (!user.password_hash) {
                return res.status(401).json({ error: 'User has no password set (legacy account?)' });
            }

            const isValid = await bcrypt.compare(password, user.password_hash);

            if (!isValid) {
                return res.status(401).json({ error: 'Invalid username or password' });
            }

            // 更新最后登录时间和设备ID
            await supabase
                .from('users')
                .update({
                    last_login: new Date(),
                    device_id: device_id || user.device_id
                })
                .eq('id', user.id);

            return res.status(200).json({ user: { ...user, device_id: device_id || user.device_id } });
        } else {
            return res.status(400).json({ error: 'Invalid action' });
        }

    } catch (error: any) {
        console.error('Auth API Error:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
