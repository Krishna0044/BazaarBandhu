import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getDashboardStats,
  getMonthlyDashboardStats,
  saveProfitAdjustment,
  transcribeAudio,
  parseVoiceSale,
  confirmSale,
} from '../services/api';

import { VoiceButton } from '../components/VoiceButton';
import { SaleConfirmationModal } from '../components/SaleConfirmationModal';

import {
  LANGUAGES,
  translations,
  type LanguageCode,
} from '../constants/translations';

const LANGUAGE_STORAGE_KEY = 'bazaar_language';

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const monthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const money = (value: any) => {
  const amount = Number(value ?? 0);
  return `₹${Number.isFinite(amount) ? amount.toFixed(2) : '0.00'}`;
};

export default function DashboardScreen() {
  const router = useRouter();
  const [language, setLanguage] = useState<LanguageCode>('en-IN');

  const [stats, setStats] = useState<any>(null);
  const [monthlyStats, setMonthlyStats] = useState<any>(null);

  const [dailyProfitInput, setDailyProfitInput] = useState('');
  const [monthlyProfitInput, setMonthlyProfitInput] = useState('');

  const [savingDaily, setSavingDaily] = useState(false);
  const [savingMonthly, setSavingMonthly] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [parsedSale, setParsedSale] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const t = translations[language];

  const loadLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem(
        LANGUAGE_STORAGE_KEY
      );

      if (
        savedLanguage &&
        LANGUAGES.some((item) => item.code === savedLanguage)
      ) {
        setLanguage(savedLanguage as LanguageCode);
      }
    } catch (error) {
      console.log('Could not load saved language:', error);
    }
  };

  const changeLanguage = async (code: string) => {
    const selectedLanguage = code as LanguageCode;

    setLanguage(selectedLanguage);

    try {
      await AsyncStorage.setItem(
        LANGUAGE_STORAGE_KEY,
        selectedLanguage
      );
    } catch (error) {
      console.log('Could not save language:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const [dailyData, monthlyData] = await Promise.all([
        getDashboardStats(),
        getMonthlyDashboardStats(),
      ]);

      setStats(dailyData);
      setMonthlyStats(monthlyData);

      setDailyProfitInput(
        dailyData?.manual_profit_adjustment != null
          ? String(dailyData.manual_profit_adjustment)
          : ''
      );

      setMonthlyProfitInput(
        monthlyData?.manual_profit_adjustment != null
          ? String(monthlyData.manual_profit_adjustment)
          : ''
      );
    } catch (error: any) {
      console.error('Dashboard error:', error);

      Alert.alert(
        t.dashboardError,
        error?.response?.data?.detail || t.refreshError
      );
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);

    try {
      await fetchStats();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLanguage();
    fetchStats();
  }, []);

  const handleSaveProfit = async (
    periodType: 'daily' | 'monthly'
  ) => {
    const input =
      periodType === 'daily'
        ? dailyProfitInput
        : monthlyProfitInput;

    const amount = Number(input);

    if (input.trim() === '' || !Number.isFinite(amount)) {
      Alert.alert(t.invalidAmount, t.validAmountMessage);
      return;
    }

    if (periodType === 'daily') {
      setSavingDaily(true);
    } else {
      setSavingMonthly(true);
    }

    try {
      await saveProfitAdjustment({
        period_type: periodType,
        period_start:
          periodType === 'daily' ? todayKey() : monthKey(),
        adjusted_profit: amount,
        note: `Manual ${periodType} profit entry`,
      });

      await fetchStats();

      Alert.alert(
        t.saved,
        periodType === 'daily'
          ? t.editDaily
          : t.editMonthly
      );
    } catch (error: any) {
      console.error('Profit save error:', error);

      Alert.alert(
        t.saleSaveError,
        error?.response?.data?.detail ||
          error?.message ||
          t.tryAgain
      );
    } finally {
      setSavingDaily(false);
      setSavingMonthly(false);
    }
  };

  const handleVoicePress = async () => {
    if (isProcessing) return;

    if (isRecording) {
      try {
        const currentRecording = recording;

        setIsRecording(false);
        setRecording(null);

        if (!currentRecording) {
          Alert.alert(t.recordingError, t.noRecording);
          return;
        }

        await currentRecording.stopAndUnloadAsync();

        const audioUri = currentRecording.getURI();

        if (!audioUri) {
          Alert.alert(t.recordingError, t.audioError);
          return;
        }

        setIsProcessing(true);

        const transcript = await transcribeAudio(
          audioUri,
          language
        );

        if (!transcript?.trim()) {
          Alert.alert(t.noSpeech, t.tryAgain);
          return;
        }

        console.log('Gnani transcript:', transcript);

        const parsed = await parseVoiceSale(transcript);

        console.log(
          'Parsed sale:',
          JSON.stringify(parsed, null, 2)
        );

        if (
          !parsed ||
          !parsed.matched_product_id ||
          Number(parsed.quantity) <= 0 ||
          Number(parsed.unit_price) <= 0
        ) {
          Alert.alert(
            t.saleUnderstandError,
            parsed?.error_message || `${transcript}`
          );
          return;
        }

        setParsedSale(parsed);
        setModalVisible(true);
      } catch (error: any) {
        console.error('Voice processing error:', error);

        Alert.alert(
          t.voiceError,
          error?.response?.data?.detail ||
            error?.message ||
            t.tryAgain
        );
      } finally {
        setIsProcessing(false);
      }

      return;
    }

    try {
      const permission = await Audio.requestPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          t.microphonePermission,
          t.allowMicrophone
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const result = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(result.recording);
      setIsRecording(true);
    } catch (error: any) {
      console.error('Recording error:', error);

      Alert.alert(
        t.recordingFailed,
        error?.message || t.tryAgain
      );
    }
  };

  const handleConfirmSale = async () => {
    if (!parsedSale?.matched_product_id) {
      Alert.alert(t.invalidSale, t.recordAgain);
      return;
    }

    const quantity = Number(parsedSale.quantity);
    const unitPrice = Number(parsedSale.unit_price);

    if (
      !Number.isFinite(quantity) ||
      !Number.isFinite(unitPrice) ||
      quantity <= 0 ||
      unitPrice <= 0
    ) {
      Alert.alert(
        t.invalidDetails,
        t.quantityPriceError
      );
      return;
    }

    try {
      const result = await confirmSale({
        vendor_id: 1,
        language,
        items: [
          {
            product_id: parsedSale.matched_product_id,
            quantity,
            unit_price: unitPrice,
          },
        ],
      });

      if (result?.success) {
        setModalVisible(false);
        setParsedSale(null);

        await fetchStats();

        Alert.alert(t.saleRecorded, t.saleSaved);
      } else {
        Alert.alert(t.saleSaveError, t.tryAgain);
      }
    } catch (error: any) {
      console.error('Sale confirmation error:', error);

      Alert.alert(
        t.saleSaveError,
        error?.response?.data?.detail ||
          error?.message ||
          t.tryAgain
      );
    }
  };

  const renderStatCard = (
    label: string,
    value: string,
    icon: string,
    color: string,
    background: string
  ) => (
    <View
      style={[
        styles.statCard,
        { backgroundColor: background },
      ]}
    >
      <View style={styles.statTop}>
        <Text style={styles.statIcon}>{icon}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>

      <Text style={[styles.statValue, { color }]}>
        {value}
      </Text>
    </View>
  );

  const renderProfitDetails = (
    title: string,
    data: any,
    input: string,
    setInput: (value: string) => void,
    periodType: 'daily' | 'monthly',
    saving: boolean
  ) => {
    const calculatedProfit = Number(
      data?.estimated_profit ?? 0
    );

    const manualProfit = data?.manual_profit_adjustment;

    const displayedProfit =
      data?.adjusted_profit ?? calculatedProfit;

    const revenue =
      data?.today_revenue ??
      data?.monthly_revenue ??
      0;

    const expenses =
      data?.today_expenses ??
      data?.monthly_expenses ??
      0;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>

        <View style={styles.profitCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>
              {t.totalSales}
            </Text>
            <Text style={styles.detailValue}>
              {money(revenue)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>
              {t.totalExpenses}
            </Text>
            <Text style={styles.detailValue}>
              {money(expenses)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>
              {t.calculatedProfit}
            </Text>
            <Text style={styles.calculatedValue}>
              {money(calculatedProfit)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>
              {t.manualProfit}
            </Text>
            <Text style={styles.manualValue}>
              {manualProfit != null
                ? money(manualProfit)
                : t.notEntered}
            </Text>
          </View>

          <View style={styles.profitResult}>
            <View>
              <Text style={styles.profitResultLabel}>
                {t.profitShown}
              </Text>

              <Text style={styles.profitResultHint}>
                {manualProfit != null
                  ? t.manualValue
                  : t.calculatedValue}
              </Text>
            </View>

            <Text style={styles.profitResultValue}>
              {money(displayedProfit)}
            </Text>
          </View>

          <Text style={styles.inputLabel}>
            {periodType === 'daily'
              ? t.editDaily
              : t.editMonthly}
          </Text>

          <TextInput
            style={styles.profitInput}
            value={input}
            onChangeText={setInput}
            placeholder={t.enterProfit}
            keyboardType="decimal-pad"
            placeholderTextColor="#94a3b8"
          />

          <TouchableOpacity
            style={[
              styles.saveButton,
              saving && styles.disabledButton,
            ]}
            onPress={() => handleSaveProfit(periodType)}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Text style={styles.saveButtonText}>
              {saving ? t.saving : t.saveProfit}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>BazaarBandhu</Text>
          <Text style={styles.tagline}>{t.tagline}</Text>
        </View>

        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>BB</Text>
        </View>
      </View>

      {/* Language selection */}
      <View style={styles.languageSection}>
        <Text style={styles.languageTitle}>
          {t.selectLanguage}
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.languageList}
        >
          {LANGUAGES.map((item) => {
            const selected = language === item.code;

            return (
              <TouchableOpacity
                key={item.code}
                style={[
                  styles.languageButton,
                  selected && styles.selectedLanguageButton,
                ]}
                onPress={() => changeLanguage(item.code)}
              >
                <Text
                  style={[
                    styles.languageButtonText,
                    selected &&
                      styles.selectedLanguageButtonText,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Welcome */}
      <View style={styles.welcome}>
        <Text style={styles.welcomeTitle}>
          {t.welcome} 👋
        </Text>

        <Text style={styles.welcomeSubtitle}>
          {t.welcomeSubtitle}
        </Text>
      </View>

      {/* Sales History Button */}
      <TouchableOpacity
        style={styles.salesHistoryButton}
        onPress={() => router.push('/sales')}
        activeOpacity={0.8}
      >
        <View>
          <Text style={styles.salesHistoryTitle}>Sales History</Text>
          <Text style={styles.salesHistorySubtitle}>
            View, edit and delete your sales
          </Text>
        </View>
        <Text style={styles.salesHistoryArrow}>›</Text>
      </TouchableOpacity>

      {/* Voice assistant */}
      <View style={styles.voiceCard}>
        <View style={styles.voiceTextArea}>
          <View style={styles.voiceTag}>
            <View style={styles.liveDot} />
            <Text style={styles.voiceTagText}>
              {t.voiceAssistant}
            </Text>
          </View>

          <Text style={styles.voiceTitle}>
            {t.recordSale}
          </Text>

          <Text style={styles.voiceSubtitle}>
            {t.voiceSubtitle}
          </Text>

          <Text style={styles.voiceStatus}>
            {isProcessing
              ? `⏳ ${t.processing}`
              : isRecording
                ? `🔴 ${t.recording}`
                : `🎙 ${t.ready}`}
          </Text>
        </View>

        <View style={styles.voiceButtonArea}>
          <VoiceButton
            isRecording={isRecording}
            onPress={handleVoicePress}
            label={
              isProcessing
                ? t.processing
                : isRecording
                  ? t.stopRecording
                  : t.startRecording
            }
          />
        </View>
      </View>

      {/* Today's overview */}
      <View style={styles.section}>
        <View style={styles.sectionHeadingRow}>
          <View>
            <Text style={styles.sectionTitle}>
              {t.todayOverview}
            </Text>

            <Text style={styles.sectionSubtitle}>
              {t.businessAtGlance}
            </Text>
          </View>

          <Text style={styles.periodBadge}>{t.today}</Text>
        </View>

        <View style={styles.statsGrid}>
          {renderStatCard(
            t.todaySales,
            money(stats?.today_revenue),
            '↗',
            '#15803d',
            '#e8f8ee'
          )}

          {renderStatCard(
            t.todayExpenses,
            money(stats?.today_expenses),
            '↘',
            '#dc4545',
            '#fff0ef'
          )}

          {renderStatCard(
            t.calculatedProfit,
            money(stats?.estimated_profit),
            '₹',
            '#1769aa',
            '#eaf4ff'
          )}
        </View>
      </View>

      {/* Monthly overview */}
      <View style={styles.section}>
        <View style={styles.sectionHeadingRow}>
          <View>
            <Text style={styles.sectionTitle}>
              {t.monthlyOverview}
            </Text>

            <Text style={styles.sectionSubtitle}>
              {t.monthlySubtitle}
            </Text>
          </View>

          <Text style={styles.periodBadge}>
            {t.thisMonth}
          </Text>
        </View>

        <View style={styles.monthCard}>
          <View style={styles.monthItem}>
            <Text style={styles.monthIcon}>↗</Text>
            <Text style={styles.monthLabel}>
              {t.sales}
            </Text>
            <Text style={styles.monthValue}>
              {money(monthlyStats?.monthly_revenue)}
            </Text>
          </View>

          <View style={styles.monthDivider} />

          <View style={styles.monthItem}>
            <Text style={styles.monthIcon}>↘</Text>
            <Text style={styles.monthLabel}>
              {t.expenses}
            </Text>
            <Text style={styles.monthValue}>
              {money(monthlyStats?.monthly_expenses)}
            </Text>
          </View>

          <View style={styles.monthDivider} />

          <View style={styles.monthItem}>
            <Text style={styles.monthIcon}>₹</Text>
            <Text style={styles.monthLabel}>
              {t.profit}
            </Text>
            <Text
              style={[styles.monthValue, styles.monthProfit]}
            >
              {money(monthlyStats?.adjusted_profit)}
            </Text>
          </View>
        </View>
      </View>

      {/* Daily profit editing */}
      {renderProfitDetails(
        t.todayProfitDetails,
        stats,
        dailyProfitInput,
        setDailyProfitInput,
        'daily',
        savingDaily
      )}

      {/* Monthly profit editing */}
      {renderProfitDetails(
        t.monthProfitDetails,
        monthlyStats,
        monthlyProfitInput,
        setMonthlyProfitInput,
        'monthly',
        savingMonthly
      )}

      {/* Profit note */}
      <View style={styles.noteCard}>
        <Text style={styles.noteIcon}>ⓘ</Text>

        <Text style={styles.footer}>
          {t.note}
        </Text>
      </View>

      <Text style={styles.bottomText}>
        {t.footer}
      </Text>

      {/* Multilingual sale confirmation */}
      <SaleConfirmationModal
        visible={modalVisible}
        item={parsedSale}
        language={language}
        onCancel={() => {
          setModalVisible(false);
          setParsedSale(null);
        }}
        onConfirm={handleConfirmSale}
        onUpdate={setParsedSale}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f7f5',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  brand: {
    fontSize: 27,
    fontWeight: '900',
    color: '#128344',
    letterSpacing: -0.8,
  },
  tagline: {
    color: '#718078',
    fontSize: 13,
    marginTop: 3,
  },
  headerBadge: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#dff5e7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: {
    color: '#128344',
    fontSize: 17,
    fontWeight: '900',
  },
  languageSection: {
    marginBottom: 22,
  },
  languageTitle: {
    color: '#34483b',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  languageList: {
    gap: 9,
    paddingRight: 10,
  },
  languageButton: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dce6de',
    backgroundColor: '#ffffff',
  },
  selectedLanguageButton: {
    backgroundColor: '#168148',
    borderColor: '#168148',
  },
  languageButtonText: {
    color: '#52645a',
    fontSize: 12,
    fontWeight: '700',
  },
  selectedLanguageButtonText: {
    color: '#ffffff',
  },
  welcome: {
    marginBottom: 18,
  },
  welcomeTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#172b21',
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: '#78857d',
    marginTop: 5,
  },
  salesHistoryButton: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#e3ebe5',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  salesHistoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#172b21',
  },
  salesHistorySubtitle: {
    fontSize: 12,
    color: '#78857d',
    marginTop: 4,
  },
  salesHistoryArrow: {
    fontSize: 22,
    color: '#218653',
  },

  voiceCard: {
    backgroundColor: '#126b3c',
    borderRadius: 20,
    padding: 22,
    marginBottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    elevation: 4,
    shadowColor: '#164c30',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  voiceTextArea: {
    flex: 1,
    minWidth: 210,
    paddingRight: 12,
  },
  voiceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 13,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 5,
    backgroundColor: '#8ef0ae',
    marginRight: 7,
  },
  voiceTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#b9f2ce',
    letterSpacing: 1.2,
  },
  voiceTitle: {
    color: '#ffffff',
    fontSize: 23,
    fontWeight: '900',
  },
  voiceSubtitle: {
    color: '#d8f3e2',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    maxWidth: 420,
  },
  voiceStatus: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 15,
  },
  voiceButtonArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 130,
    paddingTop: 8,
  },
  section: {
    marginBottom: 26,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#192b21',
    fontSize: 19,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: '#849088',
    fontSize: 12,
    marginTop: 4,
  },
  periodBadge: {
    overflow: 'hidden',
    backgroundColor: '#e5f4e9',
    color: '#237c48',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48.5%',
    minWidth: 145,
    flexGrow: 1,
    padding: 18,
    borderRadius: 16,
    marginBottom: 12,
    minHeight: 112,
    justifyContent: 'space-between',
  },
  statTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 17,
    fontWeight: '900',
    marginRight: 9,
    color: '#53675b',
  },
  statLabel: {
    color: '#59685e',
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  statValue: {
    fontSize: 23,
    fontWeight: '900',
    marginTop: 13,
  },
  monthCard: {
    backgroundColor: '#ffffff',
    borderRadius: 17,
    padding: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  monthItem: {
    flex: 1,
    alignItems: 'center',
  },
  monthIcon: {
    fontSize: 18,
    fontWeight: '900',
    color: '#19824b',
    marginBottom: 7,
  },
  monthLabel: {
    color: '#7b887f',
    fontSize: 11,
    fontWeight: '600',
  },
  monthValue: {
    color: '#26382d',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 6,
    textAlign: 'center',
  },
  monthProfit: {
    color: '#168148',
  },
  monthDivider: {
    width: 1,
    height: 55,
    backgroundColor: '#e8eee9',
  },
  profitCard: {
    backgroundColor: '#ffffff',
    borderRadius: 17,
    padding: 19,
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 13,
    color: '#748078',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#24352b',
    fontWeight: '800',
  },
  calculatedValue: {
    fontSize: 14,
    color: '#1769aa',
    fontWeight: '800',
  },
  manualValue: {
    fontSize: 14,
    color: '#b7791f',
    fontWeight: '800',
  },
  profitResult: {
    backgroundColor: '#e7f7ec',
    borderRadius: 13,
    padding: 16,
    marginTop: 2,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profitResultLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#176b3d',
  },
  profitResultHint: {
    fontSize: 11,
    color: '#648b72',
    marginTop: 4,
  },
  profitResultValue: {
    fontSize: 21,
    fontWeight: '900',
    color: '#128344',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#34483b',
    marginBottom: 9,
  },
  profitInput: {
    backgroundColor: '#f8faf8',
    borderWidth: 1,
    borderColor: '#dce6de',
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#172b21',
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: '#168148',
    padding: 14,
    borderRadius: 11,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff8e7',
    borderRadius: 12,
    padding: 13,
    marginTop: 4,
  },
  noteIcon: {
    color: '#a36b13',
    fontSize: 17,
    marginRight: 9,
    fontWeight: '800',
  },
  footer: {
    flex: 1,
    color: '#806d4d',
    fontSize: 11,
    lineHeight: 17,
  },
  bottomText: {
    textAlign: 'center',
    color: '#9aa69e',
    fontSize: 11,
    marginTop: 24,
  },
});

