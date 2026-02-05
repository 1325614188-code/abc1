
import React from 'react';
import { ModuleConfig, ModuleId } from './types';

export const MODULES: ModuleConfig[] = [
  {
    id: ModuleId.TryOnClothing,
    title: '试穿衣',
    icon: '👗',
    description: '上传照片，AI为您穿上心仪美衣',
    color: 'bg-pink-100 text-pink-600'
  },
  {
    id: ModuleId.TryOnEarrings,
    title: '试佩戴耳坠',
    icon: '💎',
    description: '预览不同耳饰的佩戴效果',
    color: 'bg-purple-100 text-purple-600'
  },
  {
    id: ModuleId.HairstyleRef,
    title: '发型参考',
    icon: '💇‍♀️',
    description: '生成10种适合您的风格发型',
    color: 'bg-rose-100 text-rose-600'
  },
  {
    id: ModuleId.BeautyScore,
    title: '颜值打分',
    icon: '✨',
    description: '深度美学分析及颜值评分',
    color: 'bg-amber-100 text-amber-600'
  },
  {
    id: ModuleId.CoupleMatch,
    title: '夫妻相',
    icon: '👩‍❤️‍👨',
    description: '分析五官契合度与缘分',
    color: 'bg-red-100 text-red-600'
  },
  {
    id: ModuleId.TongueDiag,
    title: '中医舌象',
    icon: '👅',
    description: '传统中医舌诊，了解身体健康',
    color: 'bg-green-100 text-green-600'
  },
  {
    id: ModuleId.FacialColor,
    title: '面色健康',
    icon: '😊',
    description: '根据面色提供健康调理建议',
    color: 'bg-teal-100 text-teal-600'
  },
  {
    id: ModuleId.Physiognomy,
    title: '面相分析',
    icon: '🔮',
    description: '解析性格、财运与人生际遇',
    color: 'bg-indigo-100 text-indigo-600'
  }
];
