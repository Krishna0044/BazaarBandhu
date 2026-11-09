import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface VoiceButtonProps {
  isRecording: boolean;
  onPress: () => void;
  label?: string;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({ isRecording, onPress, label }) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, isRecording && styles.recordingButton]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Ionicons name={isRecording ? "stop" : "mic"} size={48} color="#FFFFFF" />
      </TouchableOpacity>
      <Text style={styles.label}>{isRecording ? "Listening... Tap to Stop" : (label || "Tap to Speak")}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginVertical: 20 },
  button: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  recordingButton: { backgroundColor: '#dc2626' },
  label: { marginTop: 12, fontSize: 16, fontWeight: '600', color: '#374151' },
});
