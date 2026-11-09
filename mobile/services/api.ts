
import axios from 'axios';
import { Platform } from 'react-native';

const BASE_URL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:8000'
    : 'http://localhost:8000';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

// Dashboard APIs
export const getDashboardStats = async () => {
  const res = await api.get('/api/dashboard/today');
  return res.data.data;
};

export const getMonthlyDashboardStats = async () => {
  const res = await api.get('/api/dashboard/month');
  return res.data.data;
};

// Profit adjustment APIs
export const saveProfitAdjustment = async (data: {
  period_type: 'daily' | 'monthly';
  period_start: string;
  adjusted_profit: number;
  note?: string;
}) => {
  const res = await api.put(
    '/api/dashboard/profit-adjustment',
    {
      vendor_id: 1,
      ...data,
    }
  );

  return res.data;
};

export const getProfitAdjustment = async (
  periodType: 'daily' | 'monthly',
  periodStart: string
) => {
  const res = await api.get(
    '/api/dashboard/profit-adjustment',
    {
      params: {
        period_type: periodType,
        period_start: periodStart,
      },
    }
  );

  return res.data.data;
};

// Products
export const getProducts = async () => {
  const res = await api.get('/api/products');
  return res.data;
};

// Convert browser audio to WAV
const audioBufferToWav = (audioBuffer: AudioBuffer): Blob => {
  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const frames = audioBuffer.length;

  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = frames * blockAlign;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;

  for (let i = 0; i < frames; i++) {
    for (let channel = 0; channel < channels; channel++) {
      const sample = audioBuffer.getChannelData(channel)[i];
      const clamped = Math.max(-1, Math.min(1, sample));

      const pcm =
        clamped < 0
          ? clamped * 0x8000
          : clamped * 0x7fff;

      view.setInt16(offset, pcm, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
};

// Convert browser-recorded audio into WAV
const convertBrowserAudioToWav = async (
  blob: Blob
): Promise<Blob> => {
  const AudioContextClass =
    window.AudioContext ||
    (window as any).webkitAudioContext;

  if (!AudioContextClass) {
    throw new Error(
      'Your browser does not support audio conversion.'
    );
  }

  const audioContext = new AudioContextClass();

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer =
      await audioContext.decodeAudioData(arrayBuffer);

    return audioBufferToWav(audioBuffer);
  } finally {
    await audioContext.close();
  }
};

// Gnani Prisma speech-to-text
export const transcribeAudio = async (
  uri: string,
  language = 'en-IN'
): Promise<string> => {
  const formData = new FormData();

  if (Platform.OS === 'web') {
    const response = await fetch(uri);

    if (!response.ok) {
      throw new Error('Could not read the recorded audio.');
    }

    const originalBlob = await response.blob();

    console.log(
      'Original browser audio:',
      originalBlob.type,
      'Size:',
      originalBlob.size
    );

    if (originalBlob.size === 0) {
      throw new Error('Recording is empty. Please record again.');
    }

    const wavBlob =
      await convertBrowserAudioToWav(originalBlob);

    console.log(
      'Converted audio:',
      wavBlob.type,
      'Size:',
      wavBlob.size
    );

    formData.append('audio', wavBlob, 'recording.wav');
  } else {
    formData.append(
      'audio',
      {
        uri,
        name: 'recording.m4a',
        type: 'audio/m4a',
      } as any
    );
  }

  formData.append('language', language);

  console.log('Sending audio to Gnani Prisma...');

  const res = await api.post(
    '/api/voice/transcribe',
    formData
  );

  const transcript = res.data?.transcript;

  if (
    typeof transcript !== 'string' ||
    transcript.trim().length === 0
  ) {
    throw new Error(
      'Gnani did not return any speech. Please try recording again.'
    );
  }

  return transcript.trim();
};

// Parse transcript into sale details
export const parseVoiceSale = async (transcript: string) => {
  if (!transcript || !transcript.trim()) {
    throw new Error('Transcript is empty. Cannot parse sale.');
  }

  const res = await api.post('/api/sales/parse', {
    transcript: transcript.trim(),
  });

  if (!res.data?.success || !res.data?.data) {
    throw new Error('Could not extract sale details from speech.');
  }

  return res.data.data;
};

// Save confirmed sale
export const confirmSale = async (saleData: any) => {
  const res = await api.post('/api/sales', saleData);
  return res.data;
};

// Gnani Timbre text-to-speech
export const speakText = async (
  text: string,
  language = 'en-IN'
) => {
  const res = await api.post(
    '/api/voice/speak',
    { text, language },
    { responseType: 'blob' }
  );

  return res.data;
};

// Get sales history
export const getSales = async (vendorId: number = 1) => {
  const res = await api.get('/api/sales', {
    params: { vendor_id: vendorId },
  });
  return res.data;
};

// Update an existing sale
export const updateSale = async (
  saleId: number,
  saleData: any
) => {
  const res = await api.put(`/api/sales/${saleId}`, saleData);
  return res.data;
};

// Delete a sale
export const deleteSale = async (
  saleId: number,
  vendorId: number = 1
) => {
  const res = await api.delete(`/api/sales/${saleId}`, {
    params: { vendor_id: vendorId },
  });
  return res.data;
};
