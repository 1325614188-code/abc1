# 支付宝 H5 支付集成调试指南

本文档记录了在 Node.js/Vercel Serverless 环境中集成支付宝 H5 支付（手机网站支付）时遇到的问题和解决方案。

---

## 核心配置要求

### 1. 支付宝开放平台配置

| 配置项 | 说明 |
|-------|------|
| **APPID** | 16位数字，如 `2021006128685963` |
| **签名算法** | 必须选择 **RSA2(SHA256)**，不要选 RSA |
| **接口加签方式** | 选择 **公钥模式**（不是证书模式） |
| **应用状态** | 必须 **已上线**（开发中状态无法正常使用） |
| **产品能力** | 必须开通 **手机网站支付** |

### 2. 密钥配置

使用 [支付宝开放平台密钥工具](https://opendocs.alipay.com/common/02kipk) 生成密钥对：

```
┌─────────────────────────────────────────────────────────────┐
│  密钥工具生成          你的系统填写           支付宝平台      │
├─────────────────────────────────────────────────────────────┤
│  应用公钥.txt    ─────────────────────────→  上传到开放平台  │
│  应用私钥.txt    ────→  填入「应用私钥」字段                  │
│                        ←──── 复制「支付宝公钥」 ←──── 自动生成│
└─────────────────────────────────────────────────────────────┘
```

> [!CAUTION]
> **常见错误**：把「应用公钥」当成「支付宝公钥」填入系统。这两个是不同的！

---

## 遇到的问题及解决方案

### 问题 1：`invalid-signature` 签名验证失败

这是最常见的错误，可能由以下原因导致：

#### 原因 A：私钥格式不正确

**问题**：支付宝密钥工具生成的私钥是 **PKCS#8** 格式，而不是 PKCS#1 格式。

**解决方案**：根据私钥开头字符判断格式：

```typescript
function formatPrivateKey(privateKey: string): string {
    let key = privateKey.trim();
    
    if (key.includes('-----BEGIN')) {
        return key;
    }
    
    key = key.replace(/\s+/g, '');
    
    // 每64字符换行（PEM 标准格式）
    const lines = key.match(/.{1,64}/g) || [key];
    const formattedKey = lines.join('\n');
    
    // PKCS#8 格式特征：以 MIIEv 开头，且包含 ADAN
    const isPKCS8 = key.startsWith('MIIEv') && key.includes('ADAN');
    
    if (isPKCS8) {
        return `-----BEGIN PRIVATE KEY-----\n${formattedKey}\n-----END PRIVATE KEY-----`;
    } else {
        return `-----BEGIN RSA PRIVATE KEY-----\n${formattedKey}\n-----END RSA PRIVATE KEY-----`;
    }
}
```

#### 原因 B：charset 参数位置错误

**问题**：支付宝要求 `charset` 参数必须放在 URL 查询字符串中。

**解决方案**：在表单 action URL 中添加 charset 参数：

```typescript
// ❌ 错误
<form action="https://openapi.alipay.com/gateway.do" method="POST">

// ✅ 正确
<form action="https://openapi.alipay.com/gateway.do?charset=utf-8" method="POST">
```

#### 原因 C：时间戳使用 UTC 而非北京时间

**问题**：Vercel 服务器默认使用 UTC 时间，而支付宝要求北京时间（UTC+8）。

**解决方案**：

```typescript
// ❌ 错误 - UTC 时间
const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

// ✅ 正确 - 北京时间
const now = new Date();
const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
const timestamp = beijingTime.toISOString().replace('T', ' ').substring(0, 19);
```

#### 原因 D：私钥和公钥不匹配

**问题**：填写的私钥与上传到支付宝的公钥不是同一对。

**解决方案**：使用密钥工具重新生成密钥对，确保同时更新两边的配置。

---

## 完整的签名流程

```typescript
import crypto from 'crypto';

function signWithRSA2(params: Record<string, string>, privateKey: string): string {
    // 1. 按字母升序排序参数
    const sortedKeys = Object.keys(params).sort();
    
    // 2. 拼接待签名字符串（排除空值和 sign 参数）
    const signContent = sortedKeys
        .filter(key => params[key] !== '' && params[key] !== undefined && key !== 'sign')
        .map(key => `${key}=${params[key]}`)
        .join('&');
    
    // 3. 使用 RSA-SHA256 签名
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signContent, 'utf8');
    
    // 4. 格式化私钥并签名
    const formattedKey = formatPrivateKey(privateKey);
    return sign.sign(formattedKey, 'base64');
}
```

---

## 请求参数示例

```typescript
const params = {
    app_id: '2021006128685963',
    method: 'alipay.trade.wap.pay',
    format: 'JSON',
    return_url: 'https://your-site.com/payment/return',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: '2026-02-02 18:20:00',  // 北京时间
    version: '1.0',
    notify_url: 'https://your-site.com/api/alipay?action=notify',
    biz_content: JSON.stringify({
        out_trade_no: 'ORDER_20260202182000',
        total_amount: '9.90',
        subject: '商品名称',
        product_code: 'QUICK_WAP_WAY'
    })
};
```

---

## 调试技巧

### 1. 添加详细日志

```typescript
console.log('[Alipay] APPID:', appId);
console.log('[Alipay] Private key starts with:', privateKey?.substring(0, 20));
console.log('[Alipay] Timestamp:', timestamp);
console.log('[Alipay] Sign content:', signContent);
console.log('[Alipay] Signature:', signature);
```

### 2. 使用支付宝官方验签工具

[在线签名校验工具](https://opendocs.alipay.com/open/00n2dx) 可以验证签名是否正确。

### 3. 检查清单

- [ ] APPID 是 16 位数字
- [ ] 应用已上线（非开发中状态）
- [ ] 已开通「手机网站支付」产品
- [ ] 签名算法选择 RSA2(SHA256)
- [ ] 接口加签方式选择「公钥模式」
- [ ] 私钥是 PKCS#8 格式并正确格式化
- [ ] charset=utf-8 在 URL 查询参数中
- [ ] 时间戳使用北京时间

---

## 网关地址

| 环境 | 网关地址 |
|-----|---------|
| 正式环境 | `https://openapi.alipay.com/gateway.do` |
| 沙箱环境 | `https://openapi-sandbox.dl.alipaydev.com/gateway.do` |

---

## 异步通知（Notify）处理

### 验签失败问题

**问题**：支付成功但异步通知验签失败（`Invalid signature`）

**原因**：URL 编码时 `+` 号会被转换为空格，导致签名验证失败。

**解决方案**：在验签前将空格转回 `+` 号：

```typescript
function verifyAlipaySign(params: Record<string, string>, publicKey: string): boolean {
    let sign = params.sign;
    if (!sign) return false;

    // 处理签名中的空格（URL 编码时 + 会变成空格）
    sign = sign.replace(/ /g, '+');
    
    // ... 其余验签逻辑
}
```

### 积分不更新问题

**检查清单**：
- [ ] `payment_orders` 表是否已在 Supabase 中创建
- [ ] 查看 Vercel 日志中是否有 `[Alipay Notify]` 请求
- [ ] 验签是否成功
- [ ] 订单是否能正确查询到

---

## 参考资料

- [支付宝开放平台文档](https://opendocs.alipay.com/open/203/105288)
- [手机网站支付接入指南](https://opendocs.alipay.com/open/203/105285)
- [密钥工具下载](https://opendocs.alipay.com/common/02kipk)
- [签名与验签](https://opendocs.alipay.com/common/02kf5q)
