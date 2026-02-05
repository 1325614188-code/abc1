
import React, { useRef } from 'react';

interface ImagePickerProps {
  label: string;
  image: string | null;
  onImageChange: (base64: string) => void;
  className?: string;
}

const ImagePicker: React.FC<ImagePickerProps> = ({ label, image, onImageChange, className }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onImageChange(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className={`flex flex-col space-y-2 ${className}`}>
      <label className="text-sm font-medium text-slate-600">{label}</label>
      <div 
        onClick={() => fileInputRef.current?.click()}
        className="relative aspect-[3/4] rounded-2xl border-2 border-dashed border-pink-200 bg-white flex flex-col items-center justify-center cursor-pointer overflow-hidden hover:bg-pink-50 transition-colors"
      >
        {image ? (
          <img src={image} alt="Upload" className="w-full h-full object-cover" />
        ) : (
          <>
            <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <span className="text-xs text-pink-400">点击上传照片</span>
          </>
        )}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="image/*" 
          className="hidden" 
        />
      </div>
    </div>
  );
};

export default ImagePicker;
