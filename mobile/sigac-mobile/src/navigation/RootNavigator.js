import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LoginScreen from '../screens/LoginScreen';
import TemporaryPasswordScreen from '../screens/TemporaryPasswordScreen';
import DashboardAlunoScreen from '../screens/DashboardAlunoScreen';
import AtividadesScreen from '../screens/AtividadesScreen';
import NovaAtividadeScreen from '../screens/NovaAtividadeScreen';
import CertificadosScreen from '../screens/CertificadosScreen';
import CertificadoPreviewScreen from '../screens/CertificadoPreviewScreen';
import StatusSolicitacoesScreen from '../screens/StatusSolicitacoesScreen';
import OportunidadesScreen from '../screens/OportunidadesScreen';
import PerfilScreen from '../screens/PerfilScreen';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const ActivityStack = createNativeStackNavigator();
const logo = require('../../assets/logo-sigac.png');

function BrandHeader() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.brandHeader}>
      <Image source={logo} style={styles.brandLogo} resizeMode="contain" />
      <View>
        <Text selectable style={styles.brandName}>SIGAC</Text>
        <Text selectable style={styles.brandSubtitle}>Sistema acadêmico</Text>
      </View>
    </View>
  );
}

function LoadingApp() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

function AtividadesStack() {
  const { colors } = useTheme();
  return (
    <ActivityStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: colors.white,
        headerTitle: () => <BrandHeader />,
        headerTitleStyle: { color: colors.heading, fontWeight: '900', fontSize: 22 },
        headerLargeTitle: false,
        headerShadowVisible: false,
      }}
    >
      <ActivityStack.Screen name="AtividadesLista" component={AtividadesScreen} options={{ title: 'Atividades complementares' }} />
      <ActivityStack.Screen name="EnviarAtividade" component={NovaAtividadeScreen} options={{ title: 'Enviar comprovante' }} />
      <ActivityStack.Screen name="EnviarCertificado" component={CertificadosScreen} options={{ title: 'Enviar certificado' }} />
      <ActivityStack.Screen name="HistoricoEnvios" component={CertificadosScreen} options={{ title: 'Historico de envios' }} />
      <ActivityStack.Screen name="VisualizarCertificado" component={CertificadoPreviewScreen} options={{ title: 'Visualizar certificado' }} />
    </ActivityStack.Navigator>
  );
}

function TabGlyph({ color, focused, variant, colors, styles }) {
  const activeColor = focused ? colors.accent : color;
  const iconMap = {
    dashboard: focused ? 'home-variant' : 'home-variant-outline',
    activities: focused ? 'clipboard-check' : 'clipboard-check-outline',
    status: focused ? 'file-document-check' : 'file-document-check-outline',
    opportunities: focused ? 'briefcase-variant' : 'briefcase-variant-outline',
    profile: focused ? 'account' : 'account-outline',
  };
  const shellStyle = [
    styles.iconShell,
    focused && styles.iconShellActive,
  ];

  return (
    <View style={shellStyle}>
      <MaterialCommunityIcons
        name={iconMap[variant] || iconMap.profile}
        size={focused ? 26 : 24}
        color={activeColor}
      />
    </View>
  );
}

function AlunoTabs() {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const inactiveTint = mode === 'dark' ? 'rgba(235,235,245,0.62)' : 'rgba(71,85,105,0.78)';
  const tabIcon = (variant) => ({ color, focused }) => <TabGlyph color={color} focused={focused} variant={variant} colors={colors} styles={styles} />;
  const tabLabel = (label) => ({ color, focused }) => {
    const displayLabel = label.startsWith('In') ? 'Inicio' : label;
    return (
      <View style={styles.labelWrap}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.tabLabelText, { color }, focused && styles.tabLabelActive]}>
          {displayLabel}
        </Text>
      </View>
    );
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: colors.white,
        headerShadowVisible: false,
        headerLargeTitle: false,
        headerTitle: () => <BrandHeader />,
        tabBarBackground: () => <TabBarGlass />,
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 1,
          borderTopColor: colors.borderSubtle,
          borderRadius: 0,
          height: 64 + insets.bottom,
          paddingTop: 7,
          paddingBottom: Math.max(insets.bottom, 7),
          paddingHorizontal: 4,
          overflow: 'hidden',
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -10 },
          shadowOpacity: mode === 'dark' ? 0.26 : 0.14,
          shadowRadius: 22,
          elevation: 12,
        },
        tabBarItemStyle: {
          paddingVertical: 0,
          minWidth: 0,
        },
        tabBarIconStyle: {
          width: 40,
          height: 32,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: inactiveTint,
        tabBarLabelStyle: { fontSize: 11, lineHeight: 13, fontWeight: '800', paddingBottom: 0 },
        headerTitleStyle: { color: colors.white, fontWeight: '900', fontSize: 22 },
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardAlunoScreen} options={{ title: 'Resumo', tabBarLabel: tabLabel('Início'), tabBarIcon: tabIcon('dashboard') }} />
      <Tab.Screen name="Atividades" component={AtividadesStack} options={{ title: 'Atividades complementares', headerShown: false, tabBarLabel: tabLabel('Ativ. compl.'), tabBarIcon: tabIcon('activities') }} />
      <Tab.Screen name="Status" component={StatusSolicitacoesScreen} options={{ title: 'Status das solicitações', tabBarLabel: tabLabel('Status'), tabBarIcon: tabIcon('status') }} />
      <Tab.Screen name="Oportunidades" component={OportunidadesScreen} options={{ title: 'Oportunidades', tabBarLabel: tabLabel('Oportunidades'), tabBarIcon: tabIcon('opportunities') }} />
      <Tab.Screen name="Perfil" component={PerfilScreen} options={{ title: 'Perfil', tabBarLabel: tabLabel('Perfil'), tabBarIcon: tabIcon('profile') }} />
    </Tab.Navigator>
  );
}

function TabBarGlass() {
  const { colors, mode } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  return (
    <BlurView
      pointerEvents="none"
      intensity={mode === 'dark' ? 50 : 40}
      tint={mode === 'dark' ? 'dark' : 'light'}
      experimentalBlurMethod="dimezisBlurView"
      style={styles.tabBarGlass}
    >
      <View style={styles.tabBarTint} />
      <View style={styles.tabBarLiquidWash} />
    </BlurView>
  );
}

export default function RootNavigator() {
  const { loading, signedIn, temporaryPasswordSession } = useAuth();

  if (loading) return <LoadingApp />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {temporaryPasswordSession ? (
        <Stack.Screen name="PrimeiroAcesso" component={TemporaryPasswordScreen} />
      ) : signedIn ? (
        <Stack.Screen name="Aluno" component={AlunoTabs} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

function createStyles(colors) {
  const isDark = colors.background !== '#F4F6F9';
  const barBackground = isDark ? 'rgba(12,12,14,0.42)' : 'rgba(255,255,255,0.22)';
  const liquidBorder = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.10)';
  const liquidWash = isDark ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.08)';
  return StyleSheet.create({
  iconShell: {
    width: 42,
    height: 32,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconShellActive: {
    transform: [{ translateY: -1 }],
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minWidth: 0,
  },
  brandLogo: {
    width: 32,
    height: 32,
  },
  brandName: {
    color: colors.white,
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '900',
    letterSpacing: 0,
  },
  brandSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  labelWrap: {
    minHeight: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 1,
  },
  tabLabelText: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  tabLabelActive: {
    fontWeight: '900',
  },
  tabBarGlass: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 0,
    overflow: 'hidden',
  },
  tabBarTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: barBackground,
  },
  tabBarLiquidWash: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: liquidBorder,
    borderRadius: 0,
    backgroundColor: liquidWash,
  },
  glyphGrid: {
    width: 21,
    height: 21,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  glyphSquare: {
    width: 9,
    height: 9,
    borderRadius: 2,
    borderWidth: 2,
  },
  glyphClipboard: {
    width: 21,
    height: 23,
    borderRadius: 6,
    borderWidth: 2,
    paddingHorizontal: 4,
    paddingTop: 6,
    gap: 3,
  },
  glyphClip: {
    position: 'absolute',
    top: -2,
    alignSelf: 'center',
    width: 10,
    height: 4,
    borderRadius: 3,
  },
  glyphLine: {
    height: 2,
    borderRadius: 999,
  },
  glyphLineShort: {
    width: 10,
    height: 2,
    borderRadius: 999,
  },
  glyphCap: {
    width: 24,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphCapTop: {
    width: 22,
    height: 13,
    borderWidth: 2,
    borderRadius: 3,
    transform: [{ rotate: '-18deg' }],
  },
  glyphCapBand: {
    width: 14,
    height: 2,
    borderRadius: 999,
    marginTop: -2,
  },
  glyphBriefcaseTab: {
    width: 24,
    height: 18,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphBriefcaseHandle: {
    position: 'absolute',
    top: -7,
    width: 12,
    height: 8,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderWidth: 2,
    borderBottomWidth: 0,
  },
  glyphBriefcaseLatch: {
    width: 6,
    height: 3,
    borderRadius: 2,
  },
  glyphStatus: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    padding: 4,
    justifyContent: 'center',
    gap: 3,
  },
  glyphStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  glyphStatusLine: {
    width: 12,
    height: 2,
    borderRadius: 999,
  },
  glyphStatusLineShort: {
    width: 8,
    height: 2,
    borderRadius: 999,
  },
  glyphUserHead: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
  },
  glyphUserBody: {
    width: 18,
    height: 9,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderWidth: 2,
    borderBottomWidth: 0,
    marginTop: 2,
  },
  });
}
