
import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';

type LanguageCode = 'en-IN' | 'te-IN' | 'kn-IN' | 'hi-IN' | 'ta-IN';

interface ModalProps {
  visible: boolean;
  item: any;
  language: LanguageCode;
  onConfirm: () => void;
  onCancel: () => void;
  onUpdate: (updatedItem: any) => void;
}

const modalTranslations = {
  'en-IN': {
    title: 'Confirm Sale',
    product: 'Product',
    quantity: 'Quantity',
    unitPrice: 'Unit Price',
    total: 'Total Sale Amount',
    cancel: 'Cancel',
    confirm: 'Confirm & Save',
  },
  'te-IN': {
    title: 'అమ్మకాన్ని నిర్ధారించండి',
    product: 'ఉత్పత్తి',
    quantity: 'పరిమాణం',
    unitPrice: 'యూనిట్ ధర',
    total: 'మొత్తం అమ్మకం',
    cancel: 'రద్దు చేయండి',
    confirm: 'నిర్ధారించి సేవ్ చేయండి',
  },
  'kn-IN': {
    title: 'ಮಾರಾಟವನ್ನು ಖಚಿತಪಡಿಸಿ',
    product: 'ಉತ್ಪನ್ನ',
    quantity: 'ಪ್ರಮಾಣ',
    unitPrice: 'ಘಟಕದ ಬೆಲೆ',
    total: 'ಒಟ್ಟು ಮಾರಾಟದ ಮೊತ್ತ',
    cancel: 'ರದ್ದುಮಾಡಿ',
    confirm: 'ಖಚಿತಪಡಿಸಿ ಮತ್ತು ಉಳಿಸಿ',
  },
  'hi-IN': {
    title: 'बिक्री की पुष्टि करें',
    product: 'उत्पाद',
    quantity: 'मात्रा',
    unitPrice: 'प्रति यूनिट कीमत',
    total: 'कुल बिक्री राशि',
    cancel: 'रद्द करें',
    confirm: 'पुष्टि करें और सेव करें',
  },
  'ta-IN': {
    title: 'விற்பனையை உறுதிப்படுத்தவும்',
    product: 'பொருள்',
    quantity: 'அளவு',
    unitPrice: 'அலகு விலை',
    total: 'மொத்த விற்பனைத் தொகை',
    cancel: 'ரத்துசெய்',
    confirm: 'உறுதிசெய்து சேமிக்கவும்',
  },
};

export const SaleConfirmationModal = ({
  visible,
  item,
  language,
  onConfirm,
  onCancel,
  onUpdate,
}: ModalProps) => {
  if (!item) return null;

  const t = modalTranslations[language] || modalTranslations['en-IN'];

  const quantity = Number(item.quantity) || 0;
  const unitPrice = Number(item.unit_price) || 0;
  const total = quantity * unitPrice;

  const updateField = (field: string, value: string) => {
    onUpdate({
      ...item,
      [field]: value === '' ? '' : Number(value),
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>{t.title}</Text>

          <View style={styles.productBox}>
            <Text style={styles.label}>{t.product}</Text>
            <Text style={styles.productName}>
              {item.product_name || item.product || '-'}
            </Text>
          </View>

          <Text style={styles.label}>{t.quantity}</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={String(item.quantity ?? '')}
            onChangeText={(value) => updateField('quantity', value)}
            placeholder="0"
          />

          <Text style={styles.label}>{t.unitPrice} (₹)</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={String(item.unit_price ?? '')}
            onChangeText={(value) => updateField('unit_price', value)}
            placeholder="0.00"
          />

          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>{t.total}</Text>
            <Text style={styles.totalAmount}>
              ₹{total.toFixed(2)}
            </Text>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
            >
              <Text style={styles.cancelText}>{t.cancel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={onConfirm}
              disabled={quantity <= 0 || unitPrice <= 0}
            >
              <Text style={styles.confirmText}>{t.confirm}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    elevation: 8,
  },
  title: {
    fontSize: 21,
    fontWeight: 'bold',
    color: '#183B2B',
    textAlign: 'center',
    marginBottom: 22,
  },
  productBox: {
    backgroundColor: '#F0F7F2',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#647067',
    fontWeight: '600',
    marginBottom: 7,
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#183B2B',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DCE5DE',
    borderRadius: 10,
    padding: 12,
    fontSize: 17,
    color: '#183B2B',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  totalBox: {
    backgroundColor: '#EAF5ED',
    borderRadius: 12,
    padding: 16,
    marginTop: 3,
    marginBottom: 20,
  },
  totalLabel: {
    color: '#52675A',
    fontSize: 14,
    fontWeight: '600',
  },
  totalAmount: {
    color: '#176B3A',
    fontSize: 27,
    fontWeight: 'bold',
    marginTop: 5,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#EDF0ED',
    alignItems: 'center',
  },
  cancelText: {
    color: '#39483E',
    fontWeight: 'bold',
  },
  confirmButton: {
    flex: 1.5,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#197442',
    alignItems: 'center',
  },
  confirmText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
