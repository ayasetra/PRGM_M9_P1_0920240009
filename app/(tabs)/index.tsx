import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  StatusBar,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Atur bagaimana notifikasi ditangani saat aplikasi terbuka (Foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  } as any),
});

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // State Motor & Odometer
  const [motorName, setMotorName] = useState('Honda Vario 160 ABS');
  const [plateNumber, setPlateNumber] = useState('B 4021 SEG');
  const [odometer, setOdometer] = useState(14250);

  // Batas kilometer terakhir diservis/diganti
  const [lastOilChange, setLastOilChange] = useState(12000); // Batas pakai: 2.500 km
  const [lastSparkPlugChange, setLastSparkPlugChange] = useState(10000); // Batas pakai: 8.000 km
  const [lastBrakeChange, setLastBrakeChange] = useState(8000); // Batas pakai: 10.000 km
  const [lastBeltChange, setLastBeltChange] = useState(5000); // Batas pakai: 15.000 km

  // Token Notifikasi
  const [expoPushToken, setExpoPushToken] = useState('');
  
  // Modals & Inputs
  const [isEditProfileVisible, setIsEditProfileVisible] = useState(false);
  const [isScheduleModalVisible, setIsScheduleModalVisible] = useState(false);

  // Form Input Profile
  const [inputName, setInputName] = useState(motorName);
  const [inputPlate, setInputPlate] = useState(plateNumber);
  const [inputOdometer, setInputOdometer] = useState(odometer.toString());

  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  // Hitung persentase kesehatan komponen
  const oilLifespan = 2500;
  const sparkLifespan = 8000;
  const brakeLifespan = 10000;
  const beltLifespan = 15000;

  const oilUsed = odometer - lastOilChange;
  const sparkUsed = odometer - lastSparkPlugChange;
  const brakeUsed = odometer - lastBrakeChange;
  const beltUsed = odometer - lastBeltChange;

  const oilHealth = Math.max(0, Math.min(100, Math.round(((oilLifespan - oilUsed) / oilLifespan) * 100)));
  const sparkHealth = Math.max(0, Math.min(100, Math.round(((sparkLifespan - sparkUsed) / sparkLifespan) * 100)));
  const brakeHealth = Math.max(0, Math.min(100, Math.round(((brakeLifespan - brakeUsed) / brakeLifespan) * 100)));
  const beltHealth = Math.max(0, Math.min(100, Math.round(((beltLifespan - beltUsed) / beltLifespan) * 100)));

  // Target servis berikutnya (ditentukan berdasarkan oli mesin atau komponen terdekat yang kritis)
  const nextServiceKm = lastOilChange + oilLifespan;
  const kmRemaining = nextServiceKm - odometer;
  const isServiceNeeded = kmRemaining <= 0 || oilHealth <= 10 || sparkHealth <= 10 || brakeHealth <= 10 || beltHealth <= 10;

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        setExpoPushToken(token);
      }
    });

    notificationListener.current =
      Notifications.addNotificationReceivedListener(notification => {
        console.log('Notifikasi diterima saat aktif:', notification);
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(response => {
        console.log('Notifikasi diklik:', response);
      });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  // Update form inputs saat profil diubah
  useEffect(() => {
    setInputName(motorName);
    setInputPlate(plateNumber);
    setInputOdometer(odometer.toString());
  }, [motorName, plateNumber, odometer, isEditProfileVisible]);

  // Fungsi Kirim Notifikasi Pengingat Servis
  async function triggerServiceNotification(delaySeconds: number = 2) {
    // Bangun pesan notifikasi berbasis kondisi riil komponen motor
    let alertComponents = [];
    if (oilHealth <= 20) alertComponents.push('Oli Mesin (kritis!)');
    if (sparkHealth <= 20) alertComponents.push('Busi');
    if (brakeHealth <= 20) alertComponents.push('Kampas Rem');
    if (beltHealth <= 20) alertComponents.push('V-Belt/Rantai');

    let title = '🔧 Waktunya Servis Rutin MotoCare!';
    let body = `Motor ${motorName} Anda (${plateNumber}) sudah menempuh ${odometer.toLocaleString('id-ID')} km. Yuk servis sekarang!`;

    if (alertComponents.length > 0) {
      title = '⚠️ Perhatian: Servis Motor Diperlukan!';
      body = `Komponen kritis: ${alertComponents.join(', ')} pada motor ${motorName} Anda perlu diganti. Segera ke bengkel!`;
    } else if (kmRemaining <= 300 && kmRemaining > 0) {
      title = '🔧 Servis Rutin Segera Hadir';
      body = `Tinggal ${kmRemaining} km lagi sebelum target servis rutin ${motorName}. Jadwalkan kunjungan Anda lebih awal!`;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: title,
          body: body,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: delaySeconds,
          channelId: 'default',
        } as any,
      });

      if (delaySeconds === 2) {
        Alert.alert('Sukses', 'Notifikasi dikirim! Tunggu dalam 2 detik.');
      } else {
        Alert.alert('Terjadwal', `Pengingat berhasil dijadwalkan dalam ${delaySeconds} detik.`);
      }
      setIsScheduleModalVisible(false);
    } catch (error) {
      console.log('Error scheduling notification:', error);
    }
  }

  // Fungsi simulasi berkendara (tambah odometer)
  const simulateRide = (distance: number) => {
    setOdometer(prev => prev + distance);
  };

  // Reset kesehatan komponen tertentu secara manual
  const resetComponentHealth = (component: string) => {
    Alert.alert(
      'Reset Kondisi',
      `Apakah Anda sudah melakukan penggantian / servis pada ${component}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Sudah',
          onPress: () => {
            const currentOdo = odometer;
            if (component === 'Oli Mesin') setLastOilChange(currentOdo);
            if (component === 'Busi') setLastSparkPlugChange(currentOdo);
            if (component === 'Kampas Rem') setLastBrakeChange(currentOdo);
            if (component === 'V-Belt / Rantai') setLastBeltChange(currentOdo);

            Alert.alert('Sukses', `${component} berhasil di-reset ke kondisi 100%!`);
          },
        },
      ]
    );
  };

  // Simpan edit profil motor
  const saveProfile = () => {
    const parsedOdo = parseInt(inputOdometer);
    if (!inputName || !inputPlate || isNaN(parsedOdo)) {
      Alert.alert('Error', 'Mohon isi semua data dengan valid!');
      return;
    }
    setMotorName(inputName);
    setPlateNumber(inputPlate);
    setOdometer(parsedOdo);
    setIsEditProfileVisible(false);
    Alert.alert('Sukses', 'Profil motor berhasil diperbarui!');
  };

  // Helper untuk mewarnai kondisi komponen
  const getHealthColor = (health: number) => {
    if (health > 50) return '#10b981'; // Green
    if (health > 20) return '#f59e0b'; // Amber / Orange
    return '#ef4444'; // Red
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>MotoCare</Text>
          <Text style={styles.headerSubtitle}>Asisten Servis Rutin Motor</Text>
        </View>
        <TouchableOpacity 
          style={[styles.profileEditBtn, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }]}
          onPress={() => setIsEditProfileVisible(true)}
        >
          <Ionicons name="create-outline" size={20} color={isDark ? '#38bdf8' : '#0284c7'} />
          <Text style={[styles.profileEditBtnText, { color: isDark ? '#38bdf8' : '#0284c7' }]}>Edit Motor</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* CRITICAL ALERT BANNER */}
        {isServiceNeeded && (
          <View style={styles.alertBanner}>
            <MaterialCommunityIcons name="alert-decagram" size={24} color="#ffffff" style={styles.alertIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.alertBannerTitle}>Perhatian: Waktunya Servis!</Text>
              <Text style={styles.alertBannerText}>
                Beberapa komponen memerlukan penggantian atau Odometer Anda sudah melewati batas aman.
              </Text>
            </View>
          </View>
        )}

        {/* MOTOR PROFILE CARD (CARBON/STEEL LOOK) */}
        <View style={[styles.card, styles.motorCard, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
          <View style={styles.motorCardHeader}>
            <View style={styles.motorBadgeContainer}>
              <MaterialCommunityIcons name={"motorcycle" as any} size={32} color="#f59e0b" />
            </View>
            <View style={styles.motorInfo}>
              <Text style={[styles.motorNameText, { color: isDark ? '#f8fafc' : '#0f172a' }]}>{motorName}</Text>
              {/* Plat Nomor bergaya Indonesia */}
              <View style={styles.plateContainer}>
                <Text style={styles.plateText}>{plateNumber}</Text>
                <View style={styles.plateDivider} />
                <Text style={[styles.plateText, { fontSize: 9 }]}>05•31</Text>
              </View>
            </View>
          </View>

          {/* ODOMETER SECTION */}
          <View style={[styles.odometerSection, { borderTopColor: isDark ? '#334155' : '#f1f5f9' }]}>
            <View style={styles.odoBlock}>
              <Text style={styles.odoLabel}>Odometer Saat Ini</Text>
              <Text style={[styles.odoValue, { color: isDark ? '#38bdf8' : '#0284c7' }]}>
                {odometer.toLocaleString('id-ID')} <Text style={styles.odoUnit}>km</Text>
              </Text>
            </View>
            
            <View style={styles.odoBlock}>
              <Text style={styles.odoLabel}>Target Servis</Text>
              <Text style={[styles.odoValue, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                {nextServiceKm.toLocaleString('id-ID')} <Text style={styles.odoUnit}>km</Text>
              </Text>
            </View>
          </View>

          {/* REMAINING DISTANCE BAR */}
          <View style={styles.progressContainer}>
            <View style={styles.progressLabelRow}>
              <Text style={[styles.progressLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Sisa Jarak ke Servis Berikutnya</Text>
              <Text style={[styles.progressValText, { color: kmRemaining <= 200 ? '#ef4444' : '#10b981', fontWeight: 'bold' }]}>
                {kmRemaining <= 0 ? 'Segera Servis!' : `${kmRemaining.toLocaleString('id-ID')} km lagi`}
              </Text>
            </View>
            <View style={[styles.progressBarBg, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { 
                    width: `${Math.max(0, Math.min(100, (1 - (odometer - lastOilChange) / oilLifespan) * 100))}%`,
                    backgroundColor: kmRemaining <= 200 ? '#ef4444' : '#10b981'
                  }
                ]} 
              />
            </View>
          </View>

          {/* ODOMETER SIMULATOR CONTROLS */}
          <View style={[styles.simulatorSection, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
            <Text style={[styles.simTitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>🕹️ Simulasi Jarak Tempuh (Odometer):</Text>
            <View style={styles.simBtnRow}>
              <TouchableOpacity style={styles.simBtn} onPress={() => simulateRide(100)}>
                <Text style={styles.simBtnText}>+100 km</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.simBtn} onPress={() => simulateRide(500)}>
                <Text style={styles.simBtnText}>+500 km</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.simBtn, { backgroundColor: '#f59e0b' }]} onPress={() => simulateRide(1000)}>
                <Text style={[styles.simBtnText, { color: '#ffffff' }]}>+1000 km</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* SECTION: HEALTH OF COMPONENTS (GRID) */}
        <Text style={[styles.sectionTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>Kondisi Komponen</Text>
        <View style={styles.gridContainer}>
          
          {/* OLI MESIN */}
          <TouchableOpacity 
            style={[styles.gridCard, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]} 
            onPress={() => resetComponentHealth('Oli Mesin')}
          >
            <View style={styles.gridCardHeader}>
              <MaterialCommunityIcons name="oil" size={24} color="#f59e0b" />
              <Text style={[styles.gridTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>Oli Mesin</Text>
            </View>
            <Text style={[styles.gridPercentage, { color: getHealthColor(oilHealth) }]}>{oilHealth}%</Text>
            <Text style={styles.gridLifespanText}>{oilUsed.toLocaleString('id-ID')} / {oilLifespan} km</Text>
            <View style={[styles.gridBarBg, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}>
              <View style={[styles.gridBarFill, { width: `${oilHealth}%`, backgroundColor: getHealthColor(oilHealth) }]} />
            </View>
            <Text style={styles.gridActionHint}>Sentuh untuk Reset</Text>
          </TouchableOpacity>

          {/* BUSI */}
          <TouchableOpacity 
            style={[styles.gridCard, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]} 
            onPress={() => resetComponentHealth('Busi')}
          >
            <View style={styles.gridCardHeader}>
              <MaterialCommunityIcons name="lightning-bolt-outline" size={24} color="#38bdf8" />
              <Text style={[styles.gridTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>Busi</Text>
            </View>
            <Text style={[styles.gridPercentage, { color: getHealthColor(sparkHealth) }]}>{sparkHealth}%</Text>
            <Text style={styles.gridLifespanText}>{sparkUsed.toLocaleString('id-ID')} / {sparkLifespan} km</Text>
            <View style={[styles.gridBarBg, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}>
              <View style={[styles.gridBarFill, { width: `${sparkHealth}%`, backgroundColor: getHealthColor(sparkHealth) }]} />
            </View>
            <Text style={styles.gridActionHint}>Sentuh untuk Reset</Text>
          </TouchableOpacity>

          {/* KAMPAS REM */}
          <TouchableOpacity 
            style={[styles.gridCard, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]} 
            onPress={() => resetComponentHealth('Kampas Rem')}
          >
            <View style={styles.gridCardHeader}>
              <MaterialCommunityIcons name="car-brake-alert" size={24} color="#ef4444" />
              <Text style={[styles.gridTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>Kampas Rem</Text>
            </View>
            <Text style={[styles.gridPercentage, { color: getHealthColor(brakeHealth) }]}>{brakeHealth}%</Text>
            <Text style={styles.gridLifespanText}>{brakeUsed.toLocaleString('id-ID')} / {brakeLifespan} km</Text>
            <View style={[styles.gridBarBg, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}>
              <View style={[styles.gridBarFill, { width: `${brakeHealth}%`, backgroundColor: getHealthColor(brakeHealth) }]} />
            </View>
            <Text style={styles.gridActionHint}>Sentuh untuk Reset</Text>
          </TouchableOpacity>

          {/* V-BELT / RANTAI */}
          <TouchableOpacity 
            style={[styles.gridCard, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]} 
            onPress={() => resetComponentHealth('V-Belt / Rantai')}
          >
            <View style={styles.gridCardHeader}>
              <MaterialCommunityIcons name={"cog-outline" as any} size={24} color="#10b981" />
              <Text style={[styles.gridTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>V-Belt / Rantai</Text>
            </View>
            <Text style={[styles.gridPercentage, { color: getHealthColor(beltHealth) }]}>{beltHealth}%</Text>
            <Text style={styles.gridLifespanText}>{beltUsed.toLocaleString('id-ID')} / {beltLifespan} km</Text>
            <View style={[styles.gridBarBg, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}>
              <View style={[styles.gridBarFill, { width: `${beltHealth}%`, backgroundColor: getHealthColor(beltHealth) }]} />
            </View>
            <Text style={styles.gridActionHint}>Sentuh untuk Reset</Text>
          </TouchableOpacity>

        </View>

        {/* NOTIFICATION BUTTONS PANEL */}
        <View style={[styles.card, styles.notificationPanel, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
          <Text style={[styles.panelTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>Penguji Pengingat Servis</Text>
          <Text style={styles.panelDesc}>Picu notifikasi lokal secara instan atau simulasikan alarm terjadwal untuk menguji sistem pengingat servis motor.</Text>
          
          <TouchableOpacity 
            style={[styles.primaryNotificationBtn, isServiceNeeded && styles.dangerNotificationBtn]}
            onPress={() => triggerServiceNotification(2)}
          >
            <MaterialCommunityIcons name="bell-ring" size={22} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.primaryNotificationBtnText}>
              {isServiceNeeded ? 'Kirim Notifikasi Kritis (Instan)' : 'Kirim Notifikasi Servis (Instan)'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.secondaryNotificationBtn, { borderColor: isDark ? '#475569' : '#cbd5e1' }]}
            onPress={() => setIsScheduleModalVisible(true)}
          >
            <MaterialCommunityIcons name="clock-time-three-outline" size={20} color={isDark ? '#e2e8f0' : '#475569'} style={{ marginRight: 8 }} />
            <Text style={[styles.secondaryNotificationBtnText, { color: isDark ? '#e2e8f0' : '#475569' }]}>
              Simulasi Penjadwalan Pengingat...
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* MODAL 1: SCHEDULE SIMULATOR */}
      <Modal
        visible={isScheduleModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsScheduleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
            <Text style={[styles.modalTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>Simulasi Penjadwalan</Text>
            <Text style={[styles.modalDesc, { color: isDark ? '#94a3b8' : '#64748b' }]}>
              Pilih waktu simulasi di mana push notification pengingat servis motor akan dikirimkan secara otomatis:
            </Text>

            <TouchableOpacity style={styles.modalOptionBtn} onPress={() => triggerServiceNotification(5)}>
              <Text style={styles.modalOptionText}>⏰ Simulasikan dalam 5 detik (Instan)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalOptionBtn} onPress={() => triggerServiceNotification(15)}>
              <Text style={styles.modalOptionText}>⏳ Simulasikan dalam 15 detik</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalOptionBtn} onPress={() => triggerServiceNotification(30)}>
              <Text style={styles.modalOptionText}>🌙 Simulasikan dalam 30 detik (Latar Belakang)</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.modalCancelBtn, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]} 
              onPress={() => setIsScheduleModalVisible(false)}
            >
              <Text style={[styles.modalCancelBtnText, { color: isDark ? '#ffffff' : '#0f172a' }]}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: EDIT PROFILE */}
      <Modal
        visible={isEditProfileVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsEditProfileVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
            <Text style={[styles.modalTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>Edit Profil Motor</Text>
            
            <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Nama / Model Motor</Text>
            <TextInput
              style={[styles.textInput, { color: isDark ? '#ffffff' : '#000000', borderColor: isDark ? '#334155' : '#cbd5e1' }]}
              value={inputName}
              onChangeText={setInputName}
              placeholder="Contoh: Yamaha NMAX 155"
              placeholderTextColor="#94a3b8"
            />

            <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Nomor Plat Kendaraan</Text>
            <TextInput
              style={[styles.textInput, { color: isDark ? '#ffffff' : '#000000', borderColor: isDark ? '#334155' : '#cbd5e1' }]}
              value={inputPlate}
              onChangeText={setInputPlate}
              placeholder="Contoh: B 1234 ABC"
              placeholderTextColor="#94a3b8"
              autoCapitalize="characters"
            />

            <Text style={[styles.inputLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Odometer Saat Ini (km)</Text>
            <TextInput
              style={[styles.textInput, { color: isDark ? '#ffffff' : '#000000', borderColor: isDark ? '#334155' : '#cbd5e1' }]}
              value={inputOdometer}
              onChangeText={setInputOdometer}
              keyboardType="number-pad"
              placeholder="Contoh: 14250"
              placeholderTextColor="#94a3b8"
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity 
                style={[styles.modalActionBtn, { backgroundColor: '#64748b', flex: 1, marginRight: 8 }]} 
                onPress={() => setIsEditProfileVisible(false)}
              >
                <Text style={styles.modalActionBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalActionBtn, { backgroundColor: '#0284c7', flex: 1 }]} 
                onPress={saveProfile}
              >
                <Text style={styles.modalActionBtnText}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// Push Notification Helper
async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Permission push notification ditolak');
      return;
    }

    try {
      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId:
            Constants?.expoConfig?.extra?.eas?.projectId ??
            Constants?.easConfig?.projectId,
        })
      ).data;
      console.log('Push Token retrieved:', token);
    } catch (error) {
      console.log('Error getting push token:', error);
    }
  } else {
    console.log('Menggunakan simulator/emulator - Local notification tetap dapat dijadwalkan.');
  }

  return token;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  profileEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  profileEditBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  alertBanner: {
    backgroundColor: '#ef4444',
    flexDirection: 'row',
    padding: 16,
    borderRadius: 14,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  alertIcon: {
    marginRight: 12,
  },
  alertBannerTitle: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  alertBannerText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  card: {
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  motorCard: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  motorCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  motorBadgeContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  motorInfo: {
    flex: 1,
  },
  motorNameText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  plateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 6,
    gap: 6,
  },
  plateText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 10,
    letterSpacing: 1.5,
  },
  plateDivider: {
    width: 1,
    height: 10,
    backgroundColor: '#475569',
  },
  odometerSection: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 14,
    justifyContent: 'space-between',
  },
  odoBlock: {
    flex: 1,
  },
  odoLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
  },
  odoValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  odoUnit: {
    fontSize: 12,
    fontWeight: 'normal',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 11,
  },
  progressValText: {
    fontSize: 11,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  simulatorSection: {
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  simTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  simBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  simBtn: {
    flex: 1,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  simBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#38bdf8',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 14,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gridCard: {
    width: '48.5%',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  gridCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  gridTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    flex: 1,
  },
  gridPercentage: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 4,
  },
  gridLifespanText: {
    fontSize: 10,
    color: '#94a3b8',
    marginBottom: 8,
  },
  gridBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  gridBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  gridActionHint: {
    fontSize: 9,
    color: '#94a3b8',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  notificationPanel: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  panelDesc: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 16,
    marginBottom: 16,
  },
  primaryNotificationBtn: {
    backgroundColor: '#0284c7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  dangerNotificationBtn: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
  },
  primaryNotificationBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  secondaryNotificationBtn: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  secondaryNotificationBtnText: {
    fontWeight: 'bold',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalDesc: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalOptionBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  modalOptionText: {
    color: '#38bdf8',
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
  },
  modalCancelBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  modalCancelBtnText: {
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  modalBtnRow: {
    flexDirection: 'row',
    marginTop: 20,
  },
  modalActionBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalActionBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});