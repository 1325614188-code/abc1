
/**
 * Generate image using Serverless Function
 */
export const generateImageWithAI = async (prompt: string, images: { data: string, mimeType: string }[] = []) => {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      images,
      task: 'image'
    })
  });

  if (!response.ok) {
    throw new Error('AI Service Error');
  }

  return await response.json();
};

/**
 * Perform text analysis using Serverless Function
 */
export const analyzeWithAI = async (prompt: string, images: { data: string, mimeType: string }[] = []) => {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      images,
      task: 'analyze'
    })
  });

  if (!response.ok) {
    throw new Error('AI Service Error');
  }

  return await response.json();
};

/**
 * 验证图片内容（检测是否包含特定对象）
 * @param image 图片数据
 * @param checkType 'face' | 'tongue' 检测类型
 * @returns { valid: boolean, message: string }
 */
export const validateImageContent = async (
  image: { data: string, mimeType: string },
  checkType: 'face' | 'tongue'
): Promise<{ valid: boolean; message: string }> => {
  const prompt = checkType === 'face'
    ? '请检测这张图片中是否包含清晰的人脸。只返回JSON格式：{"hasFace": true/false}'
    : '请检测这张图片中是否包含舌头。只返回JSON格式：{"hasTongue": true/false}';

  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        images: [image],
        task: 'validate'
      })
    });

    if (!response.ok) {
      // 验证失败时默认通过，不阻止用户
      return { valid: true, message: '' };
    }

    const result = await response.json();

    if (checkType === 'face') {
      if (result.hasFace === false) {
        return { valid: false, message: '未检测到人脸，请上传包含清晰人脸的照片' };
      }
    } else {
      if (result.hasTongue === false) {
        return { valid: false, message: '未检测到舌头，请上传清晰的舌象照片' };
      }
    }

    return { valid: true, message: '' };
  } catch (error) {
    // 出错时默认通过
    console.error('Image validation error:', error);
    return { valid: true, message: '' };
  }
};
