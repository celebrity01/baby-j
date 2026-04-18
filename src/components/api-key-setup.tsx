'use client';

import { useState } from 'react';
import { Zap, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { listSources } from '@/lib/jules-client';

interface ApiKeySetupProps {
  onApiValidated: (apiKey: string) => void;
}

export default function ApiKeySetup({ onApiValidated }: ApiKeySetupProps) {
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const keyType = key.startsWith('ya29.') ? 'Google OAuth Token' : key.length > 0 ? 'Jules API Key' : '';

  const handleInitialize = async () => {
    if (!key.trim()) {
      setError('Please enter an API key');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await listSources(key.trim());
      localStorage.setItem('jules-api-key', key.trim());
      onApiValidated(key.trim());
    } catch {
      setError('Invalid API key. Please check and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-card p-8 w-full max-w-md"
      >
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00E5FF]/20 to-[#B388FF]/20 flex items-center justify-center border border-[#00E5FF]/20 animate-glow-pulse">
              <Zap className="w-8 h-8 text-[#00E5FF]" />
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#00E676] animate-pulse" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#E0F7FA] mb-2">Jules Lite</h1>
          <p className="text-sm text-[#547B88]">
            Enter your Jules API key to initialize the agent
          </p>
        </div>

        {/* Input */}
        <div className="space-y-4">
          <div className="relative">
            <Input
              type={showKey ? 'text' : 'password'}
              placeholder="Enter Jules API key or OAuth token..."
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleInitialize()}
              className="glass-input pr-10 h-12 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#547B88] hover:text-[#E0F7FA] transition-colors"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Key type badge */}
          {keyType && (
            <div className="text-xs text-[#547B88] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00E676]" />
              Detected: {keyType}
            </div>
          )}

          {/* Error */}
          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-[#FF2A5F] bg-[#FF2A5F]/10 px-3 py-2 rounded-lg border border-[#FF2A5F]/20"
            >
              {error}
            </motion.p>
          )}

          {/* Button */}
          <Button
            onClick={handleInitialize}
            disabled={isLoading || !key.trim()}
            className="w-full h-12 bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-[#03080a] font-semibold text-sm rounded-xl transition-all duration-200 hover:shadow-[0_0_20px_rgba(0,229,255,0.3)]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Initializing...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Initialize Agent
              </>
            )}
          </Button>
        </div>

        {/* Footer */}
        <p className="text-xs text-[#547B88] text-center mt-6">
          Your API key is stored locally in your browser
        </p>
      </motion.div>
    </div>
  );
}
