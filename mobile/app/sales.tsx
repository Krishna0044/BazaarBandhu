
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';

import {
  getSales,
  updateSale,
  deleteSale,
} from '../services/api';

interface SaleItem {
  id?: number;
  product_id: number;
  product_name?: string;
  quantity: number;
  unit_price: number;
  total_amount?: number;
}

interface Sale {
  id: number;
  vendor_id: number;
  total_amount: number;
  language?: string;
  created_at: string;
  items: SaleItem[];
}

const VENDOR_ID = 1;

export default function SalesHistoryScreen() {
  const router = useRouter();

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [editVisible, setEditVisible] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [draftItems, setDraftItems] = useState<SaleItem[]>([]);
  const [saving, setSaving] = useState(false);

  const money = (value: number) => {
    const amount = Number(value ?? 0);
    return `₹${Number.isFinite(amount) ? amount.toFixed(2) : '0.00'}`;
  };

  const formatDate = (date: string) => {
    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    return parsed.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const loadSales = useCallback(async () => {
    try {
      const response = await getSales(VENDOR_ID);

      if (response?.success) {
        setSales(response.data || []);
      } else {
        Alert.alert('Error', 'Could not load sales history.');
      }
    } catch (error: any) {
      console.log('Sales loading error:', error?.message);
      Alert.alert(
        'Error',
        'Unable to load sales. Please check your internet connection.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const onRefresh = () => {
    setRefreshing(true);
    loadSales();
  };

  const openEdit = (sale: Sale) => {
    setSelectedSale(sale);
    setDraftItems(
      (sale.items || []).map((item) => ({
        ...item,
      }))
    );
    setEditVisible(true);
  };

  const updateDraftItem = (
    index: number,
    field: 'quantity' | 'unit_price',
    value: string
  ) => {
    setDraftItems((previous) =>
      previous.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        return {
          ...item,
          [field]: value,
        };
      })
    );
  };

  const saveChanges = async () => {
    if (!selectedSale) return;

    if (draftItems.length === 0) {
      Alert.alert('Invalid sale', 'This sale has no items to update.');
      return;
    }

    const itemsToSave = draftItems.map((item) => ({
      product_id: Number(item.product_id),
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
    }));

    const invalid = itemsToSave.some(
      (item) =>
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        !Number.isFinite(item.unit_price) ||
        item.unit_price < 0 ||
        !Number.isFinite(item.product_id)
    );

    if (invalid) {
      Alert.alert(
        'Invalid details',
        'Enter a valid quantity and unit price for every item.'
      );
      return;
    }

    try {
      setSaving(true);

      const response = await updateSale(selectedSale.id, {
        vendor_id: VENDOR_ID,
        language: selectedSale.language || 'en-IN',
        items: itemsToSave,
      });

      if (response?.success) {
        setEditVisible(false);
        setSelectedSale(null);
        await loadSales();
        Alert.alert('Success', 'Sale updated successfully.');
      } else {
        Alert.alert('Error', 'Could not update this sale.');
      }
    } catch (error: any) {
      console.log('Sale update error:', error?.response?.data || error);
      Alert.alert(
        'Update failed',
        error?.response?.data?.detail || 'Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (sale: Sale) => {
    Alert.alert(
      'Delete Sale',
      `Are you sure you want to delete sale #${sale.id}? This cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => performDelete(sale.id),
        },
      ]
    );
  };

  const performDelete = async (saleId: number) => {
    try {
      const response = await deleteSale(saleId, VENDOR_ID);

      if (response?.success) {
        setSales((previous) =>
          previous.filter((sale) => sale.id !== saleId)
        );
        Alert.alert('Deleted', 'Sale deleted successfully.');
      } else {
        Alert.alert('Error', 'Could not delete this sale.');
      }
    } catch (error: any) {
      console.log('Sale delete error:', error?.response?.data || error);
      Alert.alert(
        'Delete failed',
        error?.response?.data?.detail || 'Please try again.'
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#218653" />
        <Text style={styles.loadingText}>Loading sales...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>

        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Sales History</Text>
          <Text style={styles.headerSubtitle}>
            View and manage your transactions
          </Text>
        </View>

        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Text style={styles.refreshText}>↻</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total Transactions</Text>
        <Text style={styles.summaryNumber}>{sales.length}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#218653']}
          />
        }
        contentContainerStyle={styles.listContent}
      >
        {sales.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🧾</Text>
            <Text style={styles.emptyTitle}>No sales yet</Text>
            <Text style={styles.emptySubtitle}>
              Your recorded sales will appear here.
            </Text>
          </View>
        ) : (
          sales.map((sale) => (
            <View key={sale.id} style={styles.saleCard}>
              <View style={styles.saleTop}>
                <View>
                  <Text style={styles.saleNumber}>
                    Sale #{sale.id}
                  </Text>
                  <Text style={styles.saleDate}>
                    {formatDate(sale.created_at)}
                  </Text>
                </View>

                <Text style={styles.saleTotal}>
                  {money(sale.total_amount)}
                </Text>
              </View>

              <View style={styles.cardDivider} />

              {(sale.items || []).map((item, index) => (
                <View key={`${sale.id}-${index}`} style={styles.itemRow}>
                  <View style={styles.itemDetails}>
                    <Text style={styles.productName}>
                      {item.product_name || 'Product'}
                    </Text>
                    <Text style={styles.itemDescription}>
                      {item.quantity} × {money(item.unit_price)}
                    </Text>
                  </View>

                  <Text style={styles.itemTotal}>
                    {money(
                      Number(item.total_amount) ||
                      Number(item.quantity) * Number(item.unit_price)
                    )}
                  </Text>
                </View>
              ))}

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => openEdit(sale)}
                >
                  <Text style={styles.editButtonText}>✎ Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => confirmDelete(sale)}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={editVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Sale</Text>
            <Text style={styles.modalSubtitle}>
              Update the quantity or price below.
            </Text>

            <ScrollView style={styles.modalScroll}>
              {draftItems.map((item, index) => (
                <View key={index} style={styles.editItemCard}>
                  <Text style={styles.editProductName}>
                    {item.product_name || 'Product'}
                  </Text>

                  <Text style={styles.inputLabel}>Quantity</Text>
                  <TextInput
                    style={styles.input}
                    value={String(item.quantity)}
                    onChangeText={(value) =>
                      updateDraftItem(index, 'quantity', value)
                    }
                    keyboardType="decimal-pad"
                    placeholder="Enter quantity"
                  />

                  <Text style={styles.inputLabel}>Unit Price (₹)</Text>
                  <TextInput
                    style={styles.input}
                    value={String(item.unit_price)}
                    onChangeText={(value) =>
                      updateDraftItem(index, 'unit_price', value)
                    }
                    keyboardType="decimal-pad"
                    placeholder="Enter unit price"
                  />

                  <Text style={styles.previewTotal}>
                    Item total: {money(
                      Number(item.quantity) * Number(item.unit_price)
                    )}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setEditVisible(false)}
                disabled={saving}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveChanges}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.saveText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f8f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f8f5',
  },
  loadingText: {
    marginTop: 12,
    color: '#68766d',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 55,
    paddingBottom: 20,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#e6f2e9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 32,
    color: '#218653',
    lineHeight: 36,
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#172b21',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#78857d',
    marginTop: 3,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshText: {
    fontSize: 25,
    color: '#218653',
  },
  summaryCard: {
    backgroundColor: '#218653',
    marginHorizontal: 18,
    padding: 18,
    borderRadius: 16,
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#e1f2e6',
  },
  summaryNumber: {
    fontSize: 30,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 5,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 35,
  },
  saleCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: '#e7eee8',
  },
  saleTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  saleNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: '#172b21',
  },
  saleDate: {
    fontSize: 11,
    color: '#89958d',
    marginTop: 5,
  },
  saleTotal: {
    fontSize: 19,
    fontWeight: '800',
    color: '#218653',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#edf1ed',
    marginVertical: 13,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#26372d',
  },
  itemDescription: {
    fontSize: 12,
    color: '#87938b',
    marginTop: 4,
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#26372d',
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 10,
  },
  editButton: {
    flex: 1,
    padding: 11,
    borderRadius: 10,
    backgroundColor: '#eaf5ed',
    alignItems: 'center',
  },
  editButtonText: {
    color: '#218653',
    fontWeight: '700',
    fontSize: 13,
  },
  deleteButton: {
    flex: 1,
    padding: 11,
    borderRadius: 10,
    backgroundColor: '#fff0ef',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#d34840',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    padding: 35,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#172b21',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#87938b',
    marginTop: 7,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#172b21',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#87938b',
    marginTop: 5,
    marginBottom: 15,
  },
  modalScroll: {
    flexGrow: 0,
  },
  editItemCard: {
    backgroundColor: '#f6f9f6',
    padding: 14,
    borderRadius: 13,
    marginBottom: 12,
  },
  editProductName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#218653',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#526057',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dce6de',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#172b21',
    marginBottom: 12,
  },
  previewTotal: {
    fontSize: 13,
    color: '#218653',
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 13,
    borderRadius: 11,
    backgroundColor: '#edf1ed',
    alignItems: 'center',
  },
  cancelText: {
    color: '#526057',
    fontWeight: '700',
  },
  saveButton: {
    flex: 1,
    padding: 13,
    borderRadius: 11,
    backgroundColor: '#218653',
    alignItems: 'center',
  },
  saveText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
