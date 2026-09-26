/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  User, 
  Fornecedor, 
  DFD, 
  Planejamento, 
  Contrato, 
  ItemContratoSOF, 
  ItemPlanejamentoSOF,
  TarefaPlanejamento, 
  HistoricoPlanejamento, 
  HistoricoContratual, 
  TermoAditivo, 
  TermoApostilamento, 
  Pagamento, 
  FAQItem, 
  BaseDeConhecimento,
  ProcessTemplate,
  SIOPData8861,
  SIOPHistory8861,
  LoginLog
} from './types';
import { 
  INITIAL_USERS, 
  INITIAL_FORNECEDORES, 
  INITIAL_DFDS, 
  INITIAL_PLANEJAMENTOS, 
  INITIAL_CONTRATOS, 
  INITIAL_ITENS_CONTRATO_SOF, 
  INITIAL_ITENS_PLANEJAMENTO_SOF,
  INITIAL_TAREFAS_PLANEJAMENTO, 
  INITIAL_HISTORICO_PLANEJAMENTO, 
  INITIAL_HISTORICO_CONTRATUAL, 
  INITIAL_ADITIVOS, 
  INITIAL_APOSTILAMENTOS, 
  INITIAL_PAGAMENTOS, 
  INITIAL_BASE_CONHECIMENTO, 
  INITIAL_FAQS,
  DEFAULT_PROCESS_TEMPLATES,
  IMPORTED_SHAREPOINT_PLANEJAMENTO_HISTORY,
  INITIAL_LOGIN_LOGS
} from './initialData';
import { formatCurrency, formatDate, isValidCNPJ, getFractionalMonths, getStatusContrato } from './utils';
import { getIctiSeriesBundle } from './services/ipeadataService';
import DFDsComponent from './components/DFDs';
import { 
  db, 
  auth, 
  handleFirestoreError, 
  OperationType,
  collection, 
  onSnapshot, 
  setDoc, 
  doc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  signInAnonymously 
} from './supabase';
import OrcamentoAtualComponent from './components/OrcamentoAtual';
import PlanejamentosComponent from './components/Planejamentos';
import ContratosComponent from './components/Contratos';
import BaseConhecimentoComponent from './components/BaseConhecimento';
import KanbanBoardComponent from './components/KanbanBoard';
import ContraticsLogo from './components/ContraticsLogo';
import RastreabilidadeModal from './components/RastreabilidadeModal';
import { CalculadoraICTIModal } from './components/CalculadoraICTIModal';
import { GuidedTourOverlay, ManualGuiadoHubModal, TOURS_CONFIG } from './components/GuidedTour';
import { ReUICard } from './components/ReUI';
import { CopyButton, CopyableText } from './components/CopyButton';

import { 
  LayoutDashboard, 
  FileText, 
  Layers, 
  Briefcase, 
  BookOpen, 
  Database, 
  Clock, 
  Users, 
  Bell, 
  ShieldCheck, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  AlertOctagon, 
  Settings, 
  HelpCircle, 
  Maximize2,
  Sun,
  Moon,
  UserPlus,
  Calculator,
  Plus,
  Download,
  Check,
  Info,
  X,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Menu,
  LogOut,
  CalendarRange,
  Key,
  Edit,
  Landmark,
  FileSpreadsheet,
  Gavel,
  Handshake,
  ExternalLink,
  Search,
  Shield,
  Activity,
  Filter,
  ArrowRightLeft,
  Send,
  CheckCircle2,
  AlertTriangle,
  Percent,
  ArrowUpRight,
  FileCheck2,
  ListTodo,
  Scale,
  RefreshCw
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, FunnelChart, Funnel, LabelList, Legend } from 'recharts';

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function App() {
  // Global States with local storage hydration
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('contratics_users');
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [currentUser, setCurrentUser] = useState<User>(() => {
    const savedActiveId = localStorage.getItem('contratics_active_user_id');
    const savedUsers = localStorage.getItem('contratics_users');
    let list = INITIAL_USERS;
    try {
      if (savedUsers) {
        const parsed = JSON.parse(savedUsers);
        if (Array.isArray(parsed) && parsed.length > 0) {
          list = parsed;
        }
      }
    } catch (e) {
      console.warn("Could not parse saved users from localStorage", e);
    }
    const found = list.find((u: User) => u && u.id === savedActiveId);
    return found || list[0] || INITIAL_USERS[0];
  });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('contratics_theme') as 'light' | 'dark') || 'dark';
  });

  const [selectedYear, setSelectedYear] = useState<string>("2026");

  const [presenceViewTab, setPresenceViewTab] = useState<'calendar' | 'list'>('calendar');
  const [calendarYear, setCalendarYear] = useState<number>(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(() => new Date().getMonth());

  const [firebaseAuthError, setFirebaseAuthError] = useState<string | null>(null);

  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'GECTI' | 'Fiscal' | 'Auditor' | 'Visualizador'>('Fiscal');
  const [newMemberPass, setNewMemberPass] = useState('sof123');

  // ICTI OData API states from Ipeadata for Dashboard
  const [ictiLoading, setIctiLoading] = useState(false);
  const [ictiData, setIctiData] = useState<{ date: string; value: number }[]>([]);
  const [ictiIndexData, setIctiIndexData] = useState<{ date: string; value: number }[]>([]);
  const [ictiMensalData, setIctiMensalData] = useState<{ date: string; value: number }[]>([]);
  const [ictiLatest, setIctiLatest] = useState<{ date: string; value: number } | null>(null);
  const [ictiLatestIndex, setIctiLatestIndex] = useState<{ date: string; value: number } | null>(null);
  const [ictiLatestMensal, setIctiLatestMensal] = useState<{ date: string; value: number } | null>(null);
  const [ictiSource, setIctiSource] = useState<'api' | 'cache' | 'consolidated'>('consolidated');
  const [ictiLastUpdated, setIctiLastUpdated] = useState<string>('');

  // ICTI Calculator Modal state
  const [isIctiCalculatorOpen, setIsIctiCalculatorOpen] = useState(false);
  const [ictiCalculatorContractId, setIctiCalculatorContractId] = useState<string>('');

  const fetchICTI = async (forceRefresh: boolean = false) => {
    setIctiLoading(true);
    try {
      const bundle = await getIctiSeriesBundle(forceRefresh);
      setIctiData(bundle.series12m);
      setIctiIndexData(bundle.seriesIndex);
      setIctiMensalData(bundle.seriesMensal);
      setIctiLatest(bundle.latest12m);
      setIctiLatestIndex(bundle.latestIndex);
      setIctiLatestMensal(bundle.latestMensal);
      setIctiSource(bundle.source);
      setIctiLastUpdated(bundle.updatedAt);
    } catch (err) {
      console.warn("Aviso ao carregar ICTI:", err);
    } finally {
      setIctiLoading(false);
    }
  };

  React.useEffect(() => {
    fetchICTI(false);
  }, []);

  // Apply theme class to the document level
  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
    localStorage.setItem('contratics_theme', theme);
  }, [theme]);

  // Sync users with Firebase
  const handleAddUser = async (newUser: User) => {
    try {
      await setDoc(doc(db, 'users', newUser.id), newUser);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${newUser.id}`);
    }
  };

  const recordLoginLog = async (targetUser: User, statusMessage: string = 'Sucesso') => {
    if (!targetUser) return;
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const formattedDate = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;

    const newLog: LoginLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: targetUser.id,
      userName: targetUser.name,
      userEmail: targetUser.email,
      userRole: targetUser.role,
      timestamp: formattedDate,
      status: statusMessage,
      ipSimulated: `189.12.${Math.floor(Math.random() * 180 + 10)}.${Math.floor(Math.random() * 250)}`,
      userAgent: typeof navigator !== 'undefined' ? (navigator.userAgent.includes('Chrome') ? 'Chrome / Navegador Web' : 'Navegador Web') : 'Navegador Web'
    };

    setLoginLogs(prev => [newLog, ...prev]);
    try {
      await setDoc(doc(db, 'loginLogs', newLog.id), newLog);
    } catch (err) {
      console.warn('Alerta ao salvar log de login no Firestore:', err);
    }
  };

  const handleSwitchUser = (userId: string) => {
    const found = users.find(u => u.id === userId);
    if (found) {
      setCurrentUser(found);
      localStorage.setItem('contratics_active_user_id', userId);
      recordLoginLog(found, 'Troca de Perfil em Sessão');
    }
  };

  // Semeamento assíncrono do banco Firestore caso esteja vazio
  const seedDatabaseIfEmpty = async () => {
    try {
      // Usar um documento de controle para evitar re-semeamento em novos logins ou limpezas de usuários
      const configRef = doc(db, 'system', 'config');
      const configSnap = await getDoc(configRef);
      
      if (configSnap.exists() && configSnap.data()?.seeded === true) {
        return;
      }
      
      // Se não houver documento de controle, mas a coleção de usuários não estiver vazia, 
      // também marcamos como já semeado para respeitar os dados existentes do cliente!
      const qSnapshot = await getDocs(collection(db, 'users'));
      if (!qSnapshot.empty) {
        await setDoc(configRef, { seeded: true }, { merge: true });
        return;
      }

      console.log('Banco de dados Firestore está vazio. Semeando dados iniciais...');
      
      await Promise.all(INITIAL_USERS.map(u => setDoc(doc(db, 'users', u.id), u)));
      await Promise.all(INITIAL_FORNECEDORES.map(f => setDoc(doc(db, 'fornecedores', f.id), f)));
      await Promise.all(INITIAL_DFDS.map(d => setDoc(doc(db, 'dfds', d.id), d)));
      await Promise.all(INITIAL_PLANEJAMENTOS.map(p => setDoc(doc(db, 'planejamentos', p.id), p)));
      await Promise.all(INITIAL_CONTRATOS.map(c => setDoc(doc(db, 'contratos', c.id), c)));
      await Promise.all(INITIAL_ITENS_CONTRATO_SOF.map(i => setDoc(doc(db, 'itensSOF', i.id), i)));
      await Promise.all(INITIAL_ITENS_PLANEJAMENTO_SOF.map(i => setDoc(doc(db, 'itensPlanejamentoSOF', i.id), i)));
      await Promise.all(INITIAL_TAREFAS_PLANEJAMENTO.map(t => setDoc(doc(db, 'tarefas', t.id), t)));
      await Promise.all(DEFAULT_PROCESS_TEMPLATES.map(tm => {
        const id = tm.tipo.replace(/\s+/g, '-').toLowerCase();
        return setDoc(doc(db, 'templates', id), { id, ...tm });
      }));
      await Promise.all(INITIAL_HISTORICO_PLANEJAMENTO.map(hp => setDoc(doc(db, 'historicoPlanejamentos', hp.id), hp)));
      await Promise.all(INITIAL_HISTORICO_CONTRATUAL.map(hc => setDoc(doc(db, 'historicosContratuais', hc.id), hc)));
      await Promise.all(INITIAL_ADITIVOS.map(ad => setDoc(doc(db, 'aditivos', ad.id), ad)));
      await Promise.all(INITIAL_APOSTILAMENTOS.map(ap => setDoc(doc(db, 'apostilamentos', ap.id), ap)));
      await Promise.all(INITIAL_PAGAMENTOS.map(pg => setDoc(doc(db, 'pagamentos', pg.id), pg)));
      await Promise.all(INITIAL_BASE_CONHECIMENTO.map(bc => setDoc(doc(db, 'baseConhecimento', bc.id), bc)));
      await Promise.all(INITIAL_FAQS.map(fq => setDoc(doc(db, 'faqs', fq.id), fq)));
      await Promise.all(INITIAL_LOGIN_LOGS.map(lg => setDoc(doc(db, 'loginLogs', lg.id), lg)));
      
      // Salva estado semeado para nunca mais sobrepor dados do usuário
      await setDoc(configRef, { seeded: true }, { merge: true });
      console.log('Semeamento concluído com sucesso!');
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('Quota') || msg.includes('quota') || msg.includes('limit exceeded')) {
        console.warn('Alerta de Cota durante o semeamento inicial do banco:', msg);
      } else {
        console.error('Erro ao semear banco de dados:', error);
      }
    }
  };

  // Tratamento da Autenticação do Firebase e detecção de perfil
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setIsLoggedIn(true);
        localStorage.setItem('contratics_is_logged_in', 'true');
        
        const userEmail = firebaseUser.email?.toLowerCase();
        if (userEmail) {
          try {
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
              setCurrentUser(userDoc.data() as User);
            } else {
              const qSnapshot = await getDocs(collection(db, 'users'));
              const foundUser = qSnapshot.docs.find(doc => doc.data().email?.toLowerCase() === userEmail);
              
              if (foundUser) {
                const userData = foundUser.data() as User;
                const updatedUser = { ...userData, id: firebaseUser.uid };
                await setDoc(doc(db, 'users', firebaseUser.uid), updatedUser);
                if (foundUser.id !== firebaseUser.uid) {
                  await deleteDoc(doc(db, 'users', foundUser.id));
                }
                setCurrentUser(updatedUser);
              } else {
                const newUser: User = {
                  id: firebaseUser.uid,
                  name: firebaseUser.displayName || 'Gestor',
                  email: userEmail,
                  role: (userEmail === 'arturcancio@gmail.com' || userEmail === 'artur.cancio@planejamento.gov.br') ? 'GECTI' : 'Visualizador',
                  passwordSimulated: 'sof123',
                  needsPasswordReset: false
                };
                await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
                setCurrentUser(newUser);
              }
            }
          } catch (err: any) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('Quota') || msg.includes('quota') || msg.includes('limit exceeded')) {
              console.warn('Alerta de Cota ao ler dados do usuário:', msg);
            } else {
              console.error('Erro ao ler dados do usuário:', err);
            }
          }
        }
      } else {
        const localLoggedIn = localStorage.getItem('contratics_is_logged_in') === 'true';
        if (localLoggedIn) {
          setIsLoggedIn(true);
          try {
            await signInAnonymously(auth);
          } catch (authErr: any) {
            console.warn('Info: Conexão direta estabelecida com o banco (autenticação anônima restrita ou desabilitada no Firebase Console).');
          }
        } else {
          setIsLoggedIn(false);
        }
      }
    });
    return unsubscribe;
  }, []);

  // Sincronização em tempo real das coleções Firestore para as variáveis de estado local
  React.useEffect(() => {
    seedDatabaseIfEmpty();

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as User);
      setUsers(list);
    }, err => handleFirestoreError(err, OperationType.LIST, 'users'));

    const unsubFornecedores = onSnapshot(collection(db, 'fornecedores'), (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as Fornecedor);
      setFornecedores(list);
    }, err => handleFirestoreError(err, OperationType.LIST, 'fornecedores'));

    const unsubDfds = onSnapshot(collection(db, 'dfds'), (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as DFD);
      setDfds(list);
    }, err => handleFirestoreError(err, OperationType.LIST, 'dfds'));

    const unsubPlanejamentos = onSnapshot(collection(db, 'planejamentos'), (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as Planejamento);
      setPlanejamentos(list);
    }, err => handleFirestoreError(err, OperationType.LIST, 'planejamentos'));

    const unsubContratos = onSnapshot(collection(db, 'contratos'), (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as Contrato);
      setContratos(list);
    }, err => handleFirestoreError(err, OperationType.LIST, 'contratos'));

    const unsubItensSOF = onSnapshot(collection(db, 'itensSOF'), (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as ItemContratoSOF);
      setItensSOF(list);
    }, err => handleFirestoreError(err, OperationType.LIST, 'itensSOF'));

    const unsubItensPlanejamentoSOF = onSnapshot(collection(db, 'itensPlanejamentoSOF'), (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as ItemPlanejamentoSOF);
      setItensPlanejamentoSOF(list);
    }, err => handleFirestoreError(err, OperationType.LIST, 'itensPlanejamentoSOF'));

    const unsubTarefas = onSnapshot(collection(db, 'tarefas'), (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as TarefaPlanejamento);
      setTarefas(list);
    }, err => handleFirestoreError(err, OperationType.LIST, 'tarefas'));

    const unsubHistoricoPlan = onSnapshot(collection(db, 'historicoPlanejamentos'), (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as HistoricoPlanejamento);
      setHistoricoPlanejamentos(list);
    }, err => handleFirestoreError(err, OperationType.LIST, 'historicoPlanejamentos'));

    const unsubHistoricosContratuais = onSnapshot(collection(db, 'historicosContratuais'), (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as HistoricoContratual);
      setHistoricosContratuais(list);
    }, err => handleFirestoreError(err, OperationType.LIST, 'historicosContratuais'));

    const unsubAditivos = onSnapshot(collection(db, 'aditivos'), (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as TermoAditivo);
      setAditivos(list);
    }, err => handleFirestoreError(err, OperationType.LIST, 'aditivos'));

    const unsubApostilamentos = onSnapshot(collection(db, 'apostilamentos'), (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as TermoApostilamento);
      setApostilamentos(list);
    }, err => handleFirestoreError(err, OperationType.LIST, 'apostilamentos'));

    const unsubPagamentos = onSnapshot(collection(db, 'pagamentos'), (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as Pagamento);
      setPagamentos(list);
    }, err => handleFirestoreError(err, OperationType.LIST, 'pagamentos'));

    const unsubBaseConhecimento = onSnapshot(collection(db, 'baseConhecimento'), (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as BaseDeConhecimento);
      setBaseConhecimento(list);
    }, err => handleFirestoreError(err, OperationType.LIST, 'baseConhecimento'));

    const unsubFaqs = onSnapshot(collection(db, 'faqs'), (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as FAQItem);
      setFaqs(list);
    }, err => handleFirestoreError(err, OperationType.LIST, 'faqs'));

    const unsubPresencialDays = onSnapshot(collection(db, 'presencialDays'), (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as any);
      setPresencialDays(list);
    }, err => handleFirestoreError(err, OperationType.LIST, 'presencialDays'));

    const unsubTemplates = onSnapshot(collection(db, 'templates'), (snapshot) => {
      const list = snapshot.docs.map(doc => {
        const d = doc.data();
        return { tipo: d.tipo, tasks: d.tasks } as ProcessTemplate;
      });
      setTemplates(list);
    }, err => handleFirestoreError(err, OperationType.LIST, 'templates'));

    const unsubSiopData = onSnapshot(collection(db, 'siopData'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SIOPData8861));
      setSiopRecords(list);
    }, err => handleFirestoreError(err, OperationType.LIST, 'siopData'));

    const unsubSiopHistory = onSnapshot(collection(db, 'siopHistory'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SIOPHistory8861));
      setSiopHistory(list);
    }, err => handleFirestoreError(err, OperationType.LIST, 'siopHistory'));

    const unsubLoginLogs = onSnapshot(collection(db, 'loginLogs'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LoginLog));
      list.sort((a, b) => (b.id || '').localeCompare(a.id || ''));
      setLoginLogs(list);
    }, err => handleFirestoreError(err, OperationType.LIST, 'loginLogs'));

    return () => {
      unsubUsers();
      unsubFornecedores();
      unsubDfds();
      unsubPlanejamentos();
      unsubContratos();
      unsubItensSOF();
      unsubItensPlanejamentoSOF();
      unsubTarefas();
      unsubHistoricoPlan();
      unsubHistoricosContratuais();
      unsubAditivos();
      unsubApostilamentos();
      unsubPagamentos();
      unsubBaseConhecimento();
      unsubFaqs();
      unsubPresencialDays();
      unsubTemplates();
      unsubSiopData();
      unsubSiopHistory();
      unsubLoginLogs();
    };
  }, []);

  const [currentLocalTime, setCurrentLocalTime] = useState<string>(() => {
    try {
      return new Date().toISOString();
    } catch {
      return "2026-05-20T23:33:34Z";
    }
  });
  
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>(() => {
    const saved = localStorage.getItem('contratics_fornecedores');
    return saved ? JSON.parse(saved) : INITIAL_FORNECEDORES;
  });
  const [dfds, setDfds] = useState<DFD[]>(() => {
    const saved = localStorage.getItem('contratics_dfds');
    return saved ? JSON.parse(saved) : INITIAL_DFDS;
  });
  const [planejamentos, setPlanejamentos] = useState<Planejamento[]>(() => {
    const saved = localStorage.getItem('contratics_planejamentos');
    return saved ? JSON.parse(saved) : INITIAL_PLANEJAMENTOS;
  });
  const [contratos, setContratos] = useState<Contrato[]>(() => {
    const saved = localStorage.getItem('contratics_contratos');
    return saved ? JSON.parse(saved) : INITIAL_CONTRATOS;
  });
  const [itensSOF, setItensSOF] = useState<ItemContratoSOF[]>(() => {
    const saved = localStorage.getItem('contratics_itensSOF');
    return saved ? JSON.parse(saved) : INITIAL_ITENS_CONTRATO_SOF;
  });
  const [itensPlanejamentoSOF, setItensPlanejamentoSOF] = useState<ItemPlanejamentoSOF[]>(() => {
    const saved = localStorage.getItem('contratics_itensPlanejamentoSOF');
    return saved ? JSON.parse(saved) : INITIAL_ITENS_PLANEJAMENTO_SOF;
  });
  const [tarefas, setTarefas] = useState<TarefaPlanejamento[]>(() => {
    const saved = localStorage.getItem('contratics_tarefas');
    return saved ? JSON.parse(saved) : INITIAL_TAREFAS_PLANEJAMENTO;
  });
  const [templates, setTemplates] = useState<ProcessTemplate[]>(() => {
    const saved = localStorage.getItem('contratics_templates');
    return saved ? JSON.parse(saved) : DEFAULT_PROCESS_TEMPLATES;
  });
  const [historicoPlanejamentos, setHistoricoPlanejamentos] = useState<HistoricoPlanejamento[]>(() => {
    const saved = localStorage.getItem('contratics_historicoPlanejamentos');
    return saved ? JSON.parse(saved) : INITIAL_HISTORICO_PLANEJAMENTO;
  });
  const [historicosContratuais, setHistoricosContratuais] = useState<HistoricoContratual[]>(() => {
    const saved = localStorage.getItem('contratics_historicosContratuais');
    return saved ? JSON.parse(saved) : INITIAL_HISTORICO_CONTRATUAL;
  });
  const [aditivos, setAditivos] = useState<TermoAditivo[]>(() => {
    const saved = localStorage.getItem('contratics_aditivos');
    return saved ? JSON.parse(saved) : INITIAL_ADITIVOS;
  });
  const [apostilamentos, setApostilamentos] = useState<TermoApostilamento[]>(() => {
    const saved = localStorage.getItem('contratics_apostilamentos');
    return saved ? JSON.parse(saved) : INITIAL_APOSTILAMENTOS;
  });
  const [pagamentos, setPagamentos] = useState<Pagamento[]>(() => {
    const saved = localStorage.getItem('contratics_pagamentos');
    return saved ? JSON.parse(saved) : INITIAL_PAGAMENTOS;
  });
  const [baseConhecimento, setBaseConhecimento] = useState<BaseDeConhecimento[]>(() => {
    const saved = localStorage.getItem('contratics_baseConhecimento');
    return saved ? JSON.parse(saved) : INITIAL_BASE_CONHECIMENTO;
  });
  const [faqs, setFaqs] = useState<FAQItem[]>(() => {
    const saved = localStorage.getItem('contratics_faqs');
    return saved ? JSON.parse(saved) : INITIAL_FAQS;
  });
  const [siopRecords, setSiopRecords] = useState<SIOPData8861[]>([]);
  const [siopHistory, setSiopHistory] = useState<SIOPHistory8861[]>([]);
  
  // Login Logs for GECTI Audit
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>(() => {
    const saved = localStorage.getItem('contratics_login_logs');
    return saved ? JSON.parse(saved) : INITIAL_LOGIN_LOGS;
  });
  const [loginLogSearch, setLoginLogSearch] = useState<string>('');
  const [loginLogRoleFilter, setLoginLogRoleFilter] = useState<string>('Todos');
  const [showClearLogsConfirmModal, setShowClearLogsConfirmModal] = useState<boolean>(false);
  const [userManagementTab, setUserManagementTab] = useState<'usuarios' | 'logs'>('usuarios');

  React.useEffect(() => {
    localStorage.setItem('contratics_login_logs', JSON.stringify(loginLogs));
  }, [loginLogs]);

  // Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    const saved = localStorage.getItem('contratics_is_logged_in');
    return saved === 'true';
  });

  // Sanitização automática: purgar dados mockados/de exemplo para garantir integridade estrita
  React.useEffect(() => {
    const MOCK_IDS_TO_PURGE = new Set([
      'plan-1', 'plan-2', 'plan-3', 'plan-4',
      'dfd-1', 'dfd-2', 'dfd-3', 'dfd-4', 'dfd-5', 'dfd-6',
      'cont-1', 'cont-2',
      'forn-1', 'forn-2', 'forn-3', 'forn-4',
      'item-1', 'item-2', 'item-3', 'item-4',
      'plan-item-1', 'plan-item-2',
      'tar-1', 'tar-2', 'tar-3', 'tar-4', 'tar-5', 'tar-6', 'tar-7', 'tar-8', 'tar-9', 'tar-10',
      'histp-1', 'histp-2', 'histp-3', 'histp-4',
      'histc-1', 'histc-2', 'histc-3',
      'ad-1', 'ap-1',
      'pag-1', 'pag-2', 'pag-3', 'pag-4',
      'user-2', 'user-3',
      'log-102', 'log-103', 'log-104'
    ]);

    const sanitizeKey = 'contratics_mock_sanitized_v2';
    if (!sessionStorage.getItem(sanitizeKey)) {
      setDfds(prev => {
        const cleaned = prev.filter(d => !MOCK_IDS_TO_PURGE.has(d.id));
        try { localStorage.setItem('contratics_dfds', JSON.stringify(cleaned)); } catch (e) {}
        return cleaned;
      });
      setPlanejamentos(prev => {
        const cleaned = prev.filter(p => !MOCK_IDS_TO_PURGE.has(p.id));
        try { localStorage.setItem('contratics_planejamentos', JSON.stringify(cleaned)); } catch (e) {}
        return cleaned;
      });
      setContratos(prev => {
        const cleaned = prev.filter(c => !MOCK_IDS_TO_PURGE.has(c.id));
        try { localStorage.setItem('contratics_contratos', JSON.stringify(cleaned)); } catch (e) {}
        return cleaned;
      });
      setFornecedores(prev => {
        const cleaned = prev.filter(f => !MOCK_IDS_TO_PURGE.has(f.id));
        try { localStorage.setItem('contratics_fornecedores', JSON.stringify(cleaned)); } catch (e) {}
        return cleaned;
      });
      setItensSOF(prev => {
        const cleaned = prev.filter(i => !MOCK_IDS_TO_PURGE.has(i.id));
        try { localStorage.setItem('contratics_itensSOF', JSON.stringify(cleaned)); } catch (e) {}
        return cleaned;
      });
      setItensPlanejamentoSOF(prev => {
        const cleaned = prev.filter(i => !MOCK_IDS_TO_PURGE.has(i.id));
        try { localStorage.setItem('contratics_itensPlanejamentoSOF', JSON.stringify(cleaned)); } catch (e) {}
        return cleaned;
      });
      setTarefas(prev => {
        const cleaned = prev.filter(t => !MOCK_IDS_TO_PURGE.has(t.id));
        try { localStorage.setItem('contratics_tarefas', JSON.stringify(cleaned)); } catch (e) {}
        return cleaned;
      });
      setHistoricoPlanejamentos(prev => {
        const cleaned = prev.filter(h => !MOCK_IDS_TO_PURGE.has(h.id));
        try { localStorage.setItem('contratics_historicoPlanejamentos', JSON.stringify(cleaned)); } catch (e) {}
        return cleaned;
      });
      setHistoricosContratuais(prev => {
        const cleaned = prev.filter(h => !MOCK_IDS_TO_PURGE.has(h.id));
        try { localStorage.setItem('contratics_historicosContratuais', JSON.stringify(cleaned)); } catch (e) {}
        return cleaned;
      });
      setAditivos(prev => {
        const cleaned = prev.filter(a => !MOCK_IDS_TO_PURGE.has(a.id));
        try { localStorage.setItem('contratics_aditivos', JSON.stringify(cleaned)); } catch (e) {}
        return cleaned;
      });
      setApostilamentos(prev => {
        const cleaned = prev.filter(a => !MOCK_IDS_TO_PURGE.has(a.id));
        try { localStorage.setItem('contratics_apostilamentos', JSON.stringify(cleaned)); } catch (e) {}
        return cleaned;
      });
      setPagamentos(prev => {
        const cleaned = prev.filter(p => !MOCK_IDS_TO_PURGE.has(p.id));
        try { localStorage.setItem('contratics_pagamentos', JSON.stringify(cleaned)); } catch (e) {}
        return cleaned;
      });
      setUsers(prev => {
        const cleaned = prev.filter(u => !MOCK_IDS_TO_PURGE.has(u.id));
        try { localStorage.setItem('contratics_users', JSON.stringify(cleaned)); } catch (e) {}
        return cleaned;
      });
      setLoginLogs(prev => {
        const cleaned = prev.filter(l => !MOCK_IDS_TO_PURGE.has(l.id));
        try { localStorage.setItem('contratics_login_logs', JSON.stringify(cleaned)); } catch (e) {}
        return cleaned;
      });

      // Purgar do Firestore se existirem
      Array.from(MOCK_IDS_TO_PURGE).forEach(id => {
        deleteDoc(doc(db, 'dfds', id)).catch(() => {});
        deleteDoc(doc(db, 'planejamentos', id)).catch(() => {});
        deleteDoc(doc(db, 'contratos', id)).catch(() => {});
        deleteDoc(doc(db, 'fornecedores', id)).catch(() => {});
        deleteDoc(doc(db, 'itensSOF', id)).catch(() => {});
        deleteDoc(doc(db, 'itensPlanejamentoSOF', id)).catch(() => {});
        deleteDoc(doc(db, 'tarefas', id)).catch(() => {});
        deleteDoc(doc(db, 'historicoPlanejamentos', id)).catch(() => {});
        deleteDoc(doc(db, 'historicosContratuais', id)).catch(() => {});
        deleteDoc(doc(db, 'aditivos', id)).catch(() => {});
        deleteDoc(doc(db, 'apostilamentos', id)).catch(() => {});
        deleteDoc(doc(db, 'pagamentos', id)).catch(() => {});
        deleteDoc(doc(db, 'users', id)).catch(() => {});
        deleteDoc(doc(db, 'loginLogs', id)).catch(() => {});
      });

      sessionStorage.setItem(sanitizeKey, 'true');
    }
  }, []);

  // Sincronização e migração de processo SEI e correção de dados de usuários/presença
  React.useEffect(() => {
    const OLD_SEI = "12804.000192/2024-63";
    const NEW_SEI = "12600.000355/2026-66";

    // 1. Atualizar Planejamentos
    setPlanejamentos(prev => {
      let changed = false;
      const updated = prev.map(p => {
        if (p.SEI_Processo === OLD_SEI) {
          changed = true;
          const up = { ...p, SEI_Processo: NEW_SEI };
          setDoc(doc(db, 'planejamentos', up.id), up).catch(() => {});
          return up;
        }
        return p;
      });
      if (changed) {
        try { localStorage.setItem('contratics_planejamentos', JSON.stringify(updated)); } catch (e) {}
        return updated;
      }
      return prev;
    });

    // 2. Atualizar Histórico de Planejamento
    setHistoricoPlanejamentos(prev => {
      let changed = false;
      const updated = prev.map(h => {
        if (h.Processo_SEI === OLD_SEI) {
          changed = true;
          const up = { ...h, Processo_SEI: NEW_SEI };
          setDoc(doc(db, 'historicoPlanejamentos', up.id), up).catch(() => {});
          return up;
        }
        return h;
      });
      if (changed) {
        try { localStorage.setItem('contratics_historicoPlanejamentos', JSON.stringify(updated)); } catch (e) {}
        return updated;
      }
      return prev;
    });

    // 3. Atualizar Itens de Planejamento SOF
    setItensPlanejamentoSOF(prev => {
      let changed = false;
      const updated = prev.map(i => {
        if (i.SEI_Processo === OLD_SEI) {
          changed = true;
          const up = { ...i, SEI_Processo: NEW_SEI };
          setDoc(doc(db, 'itensPlanejamentoSOF', up.id), up).catch(() => {});
          return up;
        }
        return i;
      });
      if (changed) {
        try { localStorage.setItem('contratics_itensPlanejamentoSOF', JSON.stringify(updated)); } catch (e) {}
        return updated;
      }
      return prev;
    });

    // 4. Atualizar Tarefas
    setTarefas(prev => {
      let changed = false;
      const updated = prev.map(t => {
        if (t.Processo_SEI === OLD_SEI) {
          changed = true;
          const up = { ...t, Processo_SEI: NEW_SEI };
          setDoc(doc(db, 'tarefas', up.id), up).catch(() => {});
          return up;
        }
        return t;
      });
      if (changed) {
        try { localStorage.setItem('contratics_tarefas', JSON.stringify(updated)); } catch (e) {}
        return updated;
      }
      return prev;
    });

    // 5. Corrigir e sincronizar Usuários cadastrados (Jorgel -> Jorge da Silva Leal)
    setUsers(prev => {
      let changed = false;
      const updated = prev.map(u => {
        if (u.name.toLowerCase().includes('jorgel')) {
          changed = true;
          const up = { ...u, name: "Jorge da Silva Leal" };
          setDoc(doc(db, 'users', up.id), up).catch(() => {});
          return up;
        }
        return u;
      });
      if (changed) {
        try { localStorage.setItem('contratics_users', JSON.stringify(updated)); } catch (e) {}
        return updated;
      }
      return prev;
    });

    // 6. Corrigir registros existentes na escala presencial (Jorgel -> Jorge da Silva Leal)
    setPresencialDays(prev => {
      let changed = false;
      const updated = prev.map(p => {
        if (p.userName && (p.userName.toLowerCase().includes('jorgel') || p.userName.trim() === 'Jorge')) {
          changed = true;
          const up = { ...p, userName: "Jorge da Silva Leal" };
          setDoc(doc(db, 'presencialDays', up.id), up).catch(() => {});
          return up;
        }
        return p;
      });
      if (changed) {
        try { localStorage.setItem('contratics_presenca_gecti', JSON.stringify(updated)); } catch (e) {}
        return updated;
      }
      return prev;
    });
  }, []);

  // Sincronização automática do histórico e processos para planejamentos cadastrados
  React.useEffect(() => {
    const runSync = async () => {
      const syncDoneKey = 'contratics_sharepoint_history_synced_v4';
      if (sessionStorage.getItem(syncDoneKey)) return;

      try {
        // Garantir que DFDs iniciais estejam presentes
        const existingDfdIds = new Set(dfds.map(d => d.id));
        const dfdsToInsert = INITIAL_DFDS.filter(d => !existingDfdIds.has(d.id));
        if (dfdsToInsert.length > 0) {
          setDfds(prev => {
            const currentIds = new Set(prev.map(p => p.id));
            const fresh = dfdsToInsert.filter(i => !currentIds.has(i.id));
            const updated = [...prev, ...fresh];
            try { localStorage.setItem('contratics_dfds', JSON.stringify(updated)); } catch (e) {}
            return updated;
          });
          await Promise.all(dfdsToInsert.map(d => setDoc(doc(db, 'dfds', d.id), d).catch(() => {})));
        }

        // Garantir que Planejamentos iniciais estejam presentes
        const existingPlanIds = new Set(planejamentos.map(p => p.id));
        const plansToInsert = INITIAL_PLANEJAMENTOS.filter(p => !existingPlanIds.has(p.id));
        if (plansToInsert.length > 0) {
          setPlanejamentos(prev => {
            const currentIds = new Set(prev.map(p => p.id));
            const fresh = plansToInsert.filter(i => !currentIds.has(i.id));
            const updated = [...prev, ...fresh];
            try { localStorage.setItem('contratics_planejamentos', JSON.stringify(updated)); } catch (e) {}
            return updated;
          });
          await Promise.all(plansToInsert.map(p => setDoc(doc(db, 'planejamentos', p.id), p).catch(() => {})));
        }

        // Garantir que Itens de Planejamento estejam presentes
        const existingPlanItemIds = new Set(itensPlanejamentoSOF.map(i => i.id));
        const planItemsToInsert = INITIAL_ITENS_PLANEJAMENTO_SOF.filter(i => !existingPlanItemIds.has(i.id));
        if (planItemsToInsert.length > 0) {
          setItensPlanejamentoSOF(prev => {
            const currentIds = new Set(prev.map(p => p.id));
            const fresh = planItemsToInsert.filter(i => !currentIds.has(i.id));
            const updated = [...prev, ...fresh];
            try { localStorage.setItem('contratics_itensPlanejamentoSOF', JSON.stringify(updated)); } catch (e) {}
            return updated;
          });
          await Promise.all(planItemsToInsert.map(i => setDoc(doc(db, 'itensPlanejamentoSOF', i.id), i).catch(() => {})));
        }

        // Sincronizar Histórico
        const registeredSeis = new Set([...planejamentos, ...INITIAL_PLANEJAMENTOS].map(p => p.SEI_Processo));
        const existingHistIds = new Set(historicoPlanejamentos.map(h => h.id));

        const itemsToInsert = IMPORTED_SHAREPOINT_PLANEJAMENTO_HISTORY.filter(hist => {
          return registeredSeis.has(hist.Processo_SEI) && !existingHistIds.has(hist.id);
        });

        if (itemsToInsert.length > 0) {
          console.log(`[SharePoint Sync] Populando ${itemsToInsert.length} registros históricos para processos cadastrados.`);
          setHistoricoPlanejamentos(prev => {
            const currentIds = new Set(prev.map(p => p.id));
            const fresh = itemsToInsert.filter(i => !currentIds.has(i.id));
            const updated = [...prev, ...fresh];
            try {
              localStorage.setItem('contratics_historicoPlanejamentos', JSON.stringify(updated));
            } catch (e) {
              console.warn('LocalStorage save error', e);
            }
            return updated;
          });

          await Promise.all(itemsToInsert.map(async (hist) => {
            try {
              await setDoc(doc(db, 'historicoPlanejamentos', hist.id), hist);
            } catch (err) {
              handleFirestoreError(err, OperationType.CREATE, `historicoPlanejamentos/${hist.id}`);
            }
          }));
          console.log('[SharePoint Sync] População de histórico concluída.');
        }
        sessionStorage.setItem(syncDoneKey, 'true');
      } catch (err) {
        console.error('[SharePoint Sync] Erro:', err);
      }
    };

    runSync();
  }, [planejamentos, dfds, itensPlanejamentoSOF, historicoPlanejamentos]);



  // GECTI In-Person Calendar Schedules
  const [presencialDays, setPresencialDays] = useState<any[]>(() => {
    const saved = localStorage.getItem('contratics_presenca_gecti');
    if (saved) return JSON.parse(saved);
    return [
      {
        id: 'pres-1',
        userId: 'user-1',
        userName: 'Artur Câncio',
        dataInicio: '2026-05-22',
        dataFim: '2026-05-24',
        justificativa: 'Atendimento presencial para planejamento estratégico'
      },
      {
        id: 'pres-2',
        userId: 'user-2',
        userName: 'Clara Mendes',
        dataInicio: '2026-05-18',
        dataFim: '2026-05-18',
        justificativa: 'Fiscalização de serviços de datacenter'
      }
    ];
  });

  // Layout, responsiveness, and Collapsible Menu States
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const autoCollapseTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Auto-collapse sidebar after a few seconds on initial page load / refresh
  React.useEffect(() => {
    if (!isLoggedIn) return;

    // Start with expanded sidebar on every page load / refresh
    setSidebarCollapsed(false);

    // After 3.2 seconds, smoothly auto-collapse the sidebar
    if (autoCollapseTimerRef.current) {
      clearTimeout(autoCollapseTimerRef.current);
    }
    autoCollapseTimerRef.current = setTimeout(() => {
      setSidebarCollapsed(true);
    }, 3200);

    return () => {
      if (autoCollapseTimerRef.current) {
        clearTimeout(autoCollapseTimerRef.current);
      }
    };
  }, [isLoggedIn]);

  const handleToggleSidebar = () => {
    if (autoCollapseTimerRef.current) {
      clearTimeout(autoCollapseTimerRef.current);
      autoCollapseTimerRef.current = null;
    }
    setSidebarCollapsed(prev => !prev);
  };
  
  // User edit form states
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [usrFormName, setUsrFormName] = useState<string>('');
  const [usrFormEmail, setUsrFormEmail] = useState<string>('');
  const [usrFormRole, setUsrFormRole] = useState<'GECTI' | 'Fiscal' | 'Auditor' | 'Visualizador'>('GECTI');
  const [usrFormPass, setUsrFormPass] = useState<string>('sof123');
  
  // Custom dialog modals for safe iframe interaction
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState<string>('sof123');
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  
  // Pages routing registry
  const [activePage, setActivePage] = useState<'dashboard' | 'dfds' | 'orcamento' | 'planejamentos' | 'contratos' | 'normativos' | 'kanban' | 'presencial' | 'usuarios'>('dashboard');
  const [dashboardThreshold, setDashboardThreshold] = useState<30 | 60 | 90 | 180>(180);
  const [flowModalStage, setFlowModalStage] = useState<'planejamento' | 'selecao' | 'contrato' | null>(null);

  // Decentralization Dashboard Modal & Filter States
  const [selectedContractForDescentralizacao, setSelectedContractForDescentralizacao] = useState<Contrato | null>(null);
  const [isDescentralizacaoModalOpen, setIsDescentralizacaoModalOpen] = useState<boolean>(false);
  const [descentralizacaoSearchQuery, setDescentralizacaoSearchQuery] = useState<string>('');
  const [descentralizacaoStatusFilter, setDescentralizacaoStatusFilter] = useState<'Todos' | 'Com Sobra' | 'Parcial' | 'Total'>('Todos');
  const [quickEditOSId, setQuickEditOSId] = useState<string | null>(null);
  const [quickDescSei, setQuickDescSei] = useState<string>('');
  const [quickDescValor, setQuickDescValor] = useState<number>(0);
  const [quickDescObs, setQuickDescObs] = useState<string>('');

  // Guided Tour & Manual Hub States
  const getCompletedToursForUser = (userId?: string) => {
    if (!userId) return [];
    try {
      const saved = localStorage.getItem(`contratics_completed_tours_${userId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  };

  const [completedTours, setCompletedTours] = useState<string[]>(() =>
    getCompletedToursForUser(currentUser?.id)
  );
  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const [isManualHubOpen, setIsManualHubOpen] = useState<boolean>(false);
  const [tourContractId, setTourContractId] = useState<string | null>(null);
  const [tourPlanId, setTourPlanId] = useState<string | null>(null);

  // Sync completed tours state when currentUser changes
  const prevUserIdRef = React.useRef<string | undefined>(currentUser?.id);

  React.useEffect(() => {
    if (currentUser?.id && currentUser.id !== prevUserIdRef.current) {
      prevUserIdRef.current = currentUser.id;
      setCompletedTours(getCompletedToursForUser(currentUser.id));
    }
  }, [currentUser?.id]);

  React.useEffect(() => {
    if (activePage === 'presencial') {
      const today = new Date();
      setCalendarYear(today.getFullYear());
      setCalendarMonth(today.getMonth());
    }
  }, [activePage]);

  const handleCompleteTour = (tourId: string) => {
    setCompletedTours(prev => {
      const updated = prev.includes(tourId) ? prev : [...prev, tourId];
      if (currentUser?.id) {
        try {
          localStorage.setItem(`contratics_completed_tours_${currentUser.id}`, JSON.stringify(updated));
        } catch (e) {
          console.warn('Erro ao salvar tours no localStorage:', e);
        }
      }
      return updated;
    });
    setActiveTourId(null);
  };

  const handleResetTours = () => {
    setCompletedTours([]);
    if (currentUser?.id) {
      localStorage.removeItem(`contratics_completed_tours_${currentUser.id}`);
    }
    setActiveTourId(null);
  };

  const handleSelectTourFromHub = (tourId: string) => {
    setIsManualHubOpen(false);
    
    if (tourId === 'dfds' && activePage !== 'dfds') setActivePage('dfds');
    else if (tourId === 'planejamentos' && activePage !== 'planejamentos') setActivePage('planejamentos');
    else if (tourId === 'contratos' && activePage !== 'contratos') setActivePage('contratos');
    else if (tourId === 'orcamento' && activePage !== 'orcamento') setActivePage('orcamento');
    else if (tourId === 'kanban' && activePage !== 'kanban') setActivePage('kanban');
    else if (tourId === 'icti_calculator') setIsIctiCalculatorOpen(true);
    else if (tourId === 'contrato_details') {
      setActivePage('contratos');
      if (contratos.length > 0) {
        setTourContractId(contratos[0].id);
      }
    } else if (tourId === 'planejamento_details') {
      setActivePage('planejamentos');
      const nonBudgetPlans = planejamentos.filter(p => !p.isBudgetOnlyItem);
      if (nonBudgetPlans.length > 0) {
        setTourPlanId(nonBudgetPlans[0].id);
      }
    }

    setTimeout(() => {
      setActiveTourId(tourId);
    }, 450);
  };

  // Sync authentication and GECTI presence states to localStorage
  React.useEffect(() => {
    localStorage.setItem('contratics_is_logged_in', String(isLoggedIn));
  }, [isLoggedIn]);

  React.useEffect(() => {
    localStorage.setItem('contratics_presenca_gecti', JSON.stringify(presencialDays));
  }, [presencialDays]);

  // Sync state data lists to localStorage for contingency local fallback caching
  React.useEffect(() => {
    localStorage.setItem('contratics_users', JSON.stringify(users));
  }, [users]);

  React.useEffect(() => {
    localStorage.setItem('contratics_fornecedores', JSON.stringify(fornecedores));
  }, [fornecedores]);

  React.useEffect(() => {
    localStorage.setItem('contratics_dfds', JSON.stringify(dfds));
  }, [dfds]);

  React.useEffect(() => {
    localStorage.setItem('contratics_planejamentos', JSON.stringify(planejamentos));
  }, [planejamentos]);

  React.useEffect(() => {
    localStorage.setItem('contratics_contratos', JSON.stringify(contratos));
  }, [contratos]);

  React.useEffect(() => {
    localStorage.setItem('contratics_itensSOF', JSON.stringify(itensSOF));
  }, [itensSOF]);

  React.useEffect(() => {
    localStorage.setItem('contratics_itensPlanejamentoSOF', JSON.stringify(itensPlanejamentoSOF));
  }, [itensPlanejamentoSOF]);

  React.useEffect(() => {
    localStorage.setItem('contratics_tarefas', JSON.stringify(tarefas));
  }, [tarefas]);

  React.useEffect(() => {
    localStorage.setItem('contratics_templates', JSON.stringify(templates));
  }, [templates]);

  React.useEffect(() => {
    localStorage.setItem('contratics_historicoPlanejamentos', JSON.stringify(historicoPlanejamentos));
  }, [historicoPlanejamentos]);

  React.useEffect(() => {
    localStorage.setItem('contratics_historicosContratuais', JSON.stringify(historicosContratuais));
  }, [historicosContratuais]);

  React.useEffect(() => {
    localStorage.setItem('contratics_aditivos', JSON.stringify(aditivos));
  }, [aditivos]);

  React.useEffect(() => {
    localStorage.setItem('contratics_apostilamentos', JSON.stringify(apostilamentos));
  }, [apostilamentos]);

  React.useEffect(() => {
    localStorage.setItem('contratics_pagamentos', JSON.stringify(pagamentos));
  }, [pagamentos]);

  React.useEffect(() => {
    localStorage.setItem('contratics_baseConhecimento', JSON.stringify(baseConhecimento));
  }, [baseConhecimento]);

  React.useEffect(() => {
    localStorage.setItem('contratics_faqs', JSON.stringify(faqs));
  }, [faqs]);

  // Single-Selection shortcut helper for direct navigate between pages
  const [shortcutPlanejamentoId, setShortcutPlanejamentoId] = useState<string | null>(null);

  // Complete procurement lineage tracking state variables
  const [lineageTrackItemId, setLineageTrackItemId] = useState<string | null>(null);
  const [lineageTrackType, setLineageTrackType] = useState<'dfd' | 'planejamento' | 'contrato'>('dfd');

  // Simulation Time adjuster helper
  const handleIncreaseTime = () => {
    // Jump 6 months ahead to test upcoming thresholds
    const currentD = new Date(currentLocalTime);
    currentD.setUTCMonth(currentD.getUTCMonth() + 6);
    setCurrentLocalTime(currentD.toISOString());
  };

  const handleResetTime = () => {
    setCurrentLocalTime(new Date().toISOString());
  };

  // State mutation handlers on Firestore with local state fallbacks
  // DFD handlers
  const handleAddDFD = async (newDfd: DFD) => {
    setDfds(prev => {
      if (prev.some(d => d.id === newDfd.id)) return prev;
      return [...prev, newDfd];
    });
    try {
      await setDoc(doc(db, 'dfds', newDfd.id), newDfd);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `dfds/${newDfd.id}`);
    }
  };

  const handleEditDFD = async (updatedDfd: DFD) => {
    setDfds(prev => prev.map(d => d.id === updatedDfd.id ? updatedDfd : d));
    try {
      await setDoc(doc(db, 'dfds', updatedDfd.id), updatedDfd);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `dfds/${updatedDfd.id}`);
    }
  };

  const handleDeleteDFD = async (id: string) => {
    setDfds(prev => prev.filter(d => d.id !== id));
    try {
      await deleteDoc(doc(db, 'dfds', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `dfds/${id}`);
    }
  };

  // Planejamento handlers
  const handleAddPlanejamento = async (newPlan: Planejamento) => {
    setPlanejamentos(prev => {
      if (prev.some(p => p.id === newPlan.id)) return prev;
      return [...prev, newPlan];
    });
    try {
      await setDoc(doc(db, 'planejamentos', newPlan.id), newPlan);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `planejamentos/${newPlan.id}`);
    }
  };

  const handleEditPlanejamento = async (updatedPlan: Planejamento) => {
    setPlanejamentos(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
    try {
      await setDoc(doc(db, 'planejamentos', updatedPlan.id), updatedPlan);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `planejamentos/${updatedPlan.id}`);
    }
  };

  const handleDeletePlanejamento = async (id: string) => {
    setPlanejamentos(prev => prev.filter(p => p.id !== id));
    try {
      await deleteDoc(doc(db, 'planejamentos', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `planejamentos/${id}`);
    }
  };

  // Contrato handlers
  const handleAddContrato = async (newCont: Contrato) => {
    const cleanCont = JSON.parse(JSON.stringify(newCont));
    setContratos(prev => {
      if (prev.some(c => c.id === newCont.id)) return prev;
      const nextList = [...prev, newCont];
      try {
        localStorage.setItem('contratics_contratos', JSON.stringify(nextList));
      } catch (e) {}
      return nextList;
    });
    try {
      await setDoc(doc(db, 'contratos', cleanCont.id), cleanCont);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `contratos/${newCont.id}`);
    }
  };

  const handleEditContrato = async (updatedCont: Contrato) => {
    const cleanCont = JSON.parse(JSON.stringify(updatedCont));
    delete (cleanCont as any).Vigencia_Final;
    delete (cleanCont as any).Status_Contrato;
    delete (cleanCont as any).Numero_Renovacoes;
    delete (cleanCont as any).Valor_Atualizado;
    
    // Compute or keep calculated fields for local fallback and localStorage
    setContratos(prev => {
      const nextList = prev.map(c => c.id === updatedCont.id ? { ...c, ...updatedCont } : c);
      try {
        localStorage.setItem('contratics_contratos', JSON.stringify(nextList));
      } catch (e) {}
      return nextList;
    });
    try {
      await setDoc(doc(db, 'contratos', cleanCont.id), cleanCont);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `contratos/${updatedCont.id}`);
    }
  };

  const handleDeleteContrato = async (id: string) => {
    const contract = contratos.find(c => c.id === id);
    const contractNum = contract?.Num_Contrato;

    setContratos(prev => prev.filter(c => c.id !== id));
    setItensSOF(prev => prev.filter(item => item.Num_Contrato !== id && (!contractNum || item.Num_Contrato !== contractNum)));
    setAditivos(prev => prev.filter(item => item.Num_Contrato !== id && (!contractNum || item.Num_Contrato !== contractNum)));
    setApostilamentos(prev => prev.filter(item => item.Num_Contrato !== id && (!contractNum || item.Num_Contrato !== contractNum)));
    setHistoricosContratuais(prev => prev.filter(item => item.ContratoRelacionado !== id));
    setPagamentos(prev => prev.filter(item => item.Num_Contrato !== id && (!contractNum || item.Num_Contrato !== contractNum)));

    try {
      await deleteDoc(doc(db, 'contratos', id));

      const deletePromises: Promise<void>[] = [];

      itensSOF.forEach(item => {
        if (item.Num_Contrato === id || (contractNum && item.Num_Contrato === contractNum)) {
          deletePromises.push(deleteDoc(doc(db, 'itensSOF', item.id)));
        }
      });

      aditivos.forEach(item => {
        if (item.Num_Contrato === id || (contractNum && item.Num_Contrato === contractNum)) {
          deletePromises.push(deleteDoc(doc(db, 'aditivos', item.id)));
        }
      });

      apostilamentos.forEach(item => {
        if (item.Num_Contrato === id || (contractNum && item.Num_Contrato === contractNum)) {
          deletePromises.push(deleteDoc(doc(db, 'apostilamentos', item.id)));
        }
      });

      historicosContratuais.forEach(item => {
        if (item.ContratoRelacionado === id) {
          deletePromises.push(deleteDoc(doc(db, 'historicosContratuais', item.id)));
        }
      });

      pagamentos.forEach(item => {
        if (item.Num_Contrato === id || (contractNum && item.Num_Contrato === contractNum)) {
          deletePromises.push(deleteDoc(doc(db, 'pagamentos', item.id)));
        }
      });

      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `contratos/${id}`);
    }
  };

  // Items SOF
  const handleAddItemSOF = async (newItem: ItemContratoSOF) => {
    setItensSOF(prev => {
      if (prev.some(i => i.id === newItem.id)) return prev;
      return [...prev, newItem];
    });
    try {
      await setDoc(doc(db, 'itensSOF', newItem.id), newItem);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `itensSOF/${newItem.id}`);
    }
  };

  const handleEditItemSOF = async (updatedItem: ItemContratoSOF) => {
    setItensSOF(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
    try {
      await setDoc(doc(db, 'itensSOF', updatedItem.id), updatedItem);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `itensSOF/${updatedItem.id}`);
    }
  };

  const handleDeleteItemSOF = async (id: string) => {
    setItensSOF(prev => prev.filter(i => i.id !== id));
    try {
      await deleteDoc(doc(db, 'itensSOF', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `itensSOF/${id}`);
    }
  };

  // Planning Items SOF
  const handleAddItemPlanejamentoSOF = async (newItem: ItemPlanejamentoSOF) => {
    setItensPlanejamentoSOF(prev => {
      if (prev.some(i => i.id === newItem.id)) return prev;
      return [...prev, newItem];
    });
    try {
      await setDoc(doc(db, 'itensPlanejamentoSOF', newItem.id), newItem);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `itensPlanejamentoSOF/${newItem.id}`);
    }
  };

  const handleEditItemPlanejamentoSOF = async (updatedItem: ItemPlanejamentoSOF) => {
    setItensPlanejamentoSOF(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
    try {
      await setDoc(doc(db, 'itensPlanejamentoSOF', updatedItem.id), updatedItem);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `itensPlanejamentoSOF/${updatedItem.id}`);
    }
  };

  const handleDeleteItemPlanejamentoSOF = async (id: string) => {
    setItensPlanejamentoSOF(prev => prev.filter(i => i.id !== id));
    try {
      await deleteDoc(doc(db, 'itensPlanejamentoSOF', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `itensPlanejamentoSOF/${id}`);
    }
  };

  // Aditivos
  const handleAddAditivo = async (newAd: TermoAditivo) => {
    setAditivos(prev => {
      if (prev.some(a => a.id === newAd.id)) return prev;
      return [...prev, newAd];
    });
    try {
      await setDoc(doc(db, 'aditivos', newAd.id), newAd);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `aditivos/${newAd.id}`);
    }
  };

  const handleDeleteAditivo = async (id: string) => {
    setAditivos(prev => prev.filter(a => a.id !== id));
    try {
      await deleteDoc(doc(db, 'aditivos', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `aditivos/${id}`);
    }
  };

  // Apostilamentos
  const handleAddApostilamento = async (newAp: TermoApostilamento) => {
    setApostilamentos(prev => {
      if (prev.some(a => a.id === newAp.id)) return prev;
      return [...prev, newAp];
    });
    try {
      await setDoc(doc(db, 'apostilamentos', newAp.id), newAp);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `apostilamentos/${newAp.id}`);
    }
  };

  const handleDeleteApostilamento = async (id: string) => {
    setApostilamentos(prev => prev.filter(a => a.id !== id));
    try {
      await deleteDoc(doc(db, 'apostilamentos', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `apostilamentos/${id}`);
    }
  };

  // Historico Contratual Notes
  const handleAddHistoricoContratual = async (newHist: HistoricoContratual) => {
    setHistoricosContratuais(prev => {
      if (prev.some(h => h.id === newHist.id)) return prev;
      return [...prev, newHist];
    });
    try {
      await setDoc(doc(db, 'historicosContratuais', newHist.id), newHist);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `historicosContratuais/${newHist.id}`);
    }
  };

  const handleDeleteHistoricoContratual = async (id: string) => {
    setHistoricosContratuais(prev => prev.filter(h => h.id !== id));
    try {
      await deleteDoc(doc(db, 'historicosContratuais', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `historicosContratuais/${id}`);
    }
  };

  // Pagamentos
  const handleAddPagamento = async (newPag: Pagamento) => {
    setPagamentos(prev => {
      if (prev.some(p => p.id === newPag.id)) return prev;
      return [...prev, newPag];
    });
    try {
      await setDoc(doc(db, 'pagamentos', newPag.id), newPag);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `pagamentos/${newPag.id}`);
    }
  };

  const handleDeletePagamento = async (id: string) => {
    setPagamentos(prev => prev.filter(p => p.id !== id));
    try {
      await deleteDoc(doc(db, 'pagamentos', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `pagamentos/${id}`);
    }
  };

  // Fornecedores
  const handleAddFornecedor = async (newForn: Fornecedor) => {
    if (!isValidCNPJ(newForn.CNPJ)) {
      alert('CNPJ inválido! Por favor, insira um CNPJ brasileiro ativo e formatado corretamente (Ex: 00.000.000/0001-00).');
      return;
    }
    setFornecedores(prev => {
      if (prev.some(f => f.id === newForn.id)) return prev;
      return [...prev, newForn];
    });
    try {
      await setDoc(doc(db, 'fornecedores', newForn.id), newForn);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `fornecedores/${newForn.id}`);
    }
  };

  const handleEditFornecedor = async (updatedForn: Fornecedor) => {
    if (!isValidCNPJ(updatedForn.CNPJ)) {
      alert('CNPJ inválido! Por favor, insira um CNPJ brasileiro ativo e formatado corretamente (Ex: 00.000.000/0001-00).');
      return;
    }
    setFornecedores(prev => prev.map(f => f.id === updatedForn.id ? updatedForn : f));
    try {
      await setDoc(doc(db, 'fornecedores', updatedForn.id), updatedForn);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `fornecedores/${updatedForn.id}`);
    }
  };

  const handleDeleteFornecedor = async (id: string) => {
    setFornecedores(prev => prev.filter(f => f.id !== id));
    try {
      await deleteDoc(doc(db, 'fornecedores', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `fornecedores/${id}`);
    }
  };

  // FAQ
  const handleAddFAQ = async (newFaq: FAQItem) => {
    setFaqs(prev => {
      if (prev.some(f => f.id === newFaq.id)) return prev;
      return [...prev, newFaq];
    });
    try {
      await setDoc(doc(db, 'faqs', newFaq.id), newFaq);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `faqs/${newFaq.id}`);
    }
  };

  const handleEditFAQ = async (updatedFaq: FAQItem) => {
    setFaqs(prev => prev.map(f => f.id === updatedFaq.id ? updatedFaq : f));
    try {
      await setDoc(doc(db, 'faqs', updatedFaq.id), updatedFaq);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `faqs/${updatedFaq.id}`);
    }
  };

  const handleDeleteFAQ = async (id: string) => {
    setFaqs(prev => prev.filter(f => f.id !== id));
    try {
      await deleteDoc(doc(db, 'faqs', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `faqs/${id}`);
    }
  };

  // Normativos
  const handleAddNormativo = async (newNorm: BaseDeConhecimento) => {
    setBaseConhecimento(prev => {
      if (prev.some(n => n.id === newNorm.id)) return prev;
      return [...prev, newNorm];
    });
    try {
      await setDoc(doc(db, 'baseConhecimento', newNorm.id), newNorm);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `baseConhecimento/${newNorm.id}`);
    }
  };

  const handleEditNormativo = async (updatedNorm: BaseDeConhecimento) => {
    setBaseConhecimento(prev => prev.map(n => n.id === updatedNorm.id ? updatedNorm : n));
    try {
      await setDoc(doc(db, 'baseConhecimento', updatedNorm.id), updatedNorm);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `baseConhecimento/${updatedNorm.id}`);
    }
  };

  const handleDeleteNormativo = async (id: string) => {
    setBaseConhecimento(prev => prev.filter(n => n.id !== id));
    try {
      await deleteDoc(doc(db, 'baseConhecimento', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `baseConhecimento/${id}`);
    }
  };

  // Core metrics calculated aggregates for dashboard based on selectedYear
  const targetYearInt = parseInt(selectedYear) || 2026;

  // Yearly dynamic contract calculations (annualized)
  const getContractValueForYear = (c: Contrato, year: number): number => {
    const startVal = new Date(c.Vigencia_Inicio);
    
    // Calculate total renewals capped at max possible contract duration
    const prorrogaMeses = aditivos
      .filter(ad => (ad.Num_Contrato === c.id || ad.Num_Contrato === c.Num_Contrato) && (ad.Tipo_Aditivo === 'Prorrogação' || ad.Tipo_Operacao === 'Prorrogação de Prazo'))
      .reduce((sum, ad) => sum + (Number(ad.Meses_Renovacoes) || 0), 0);
    const totalRenovacaoMeses = prorrogaMeses > 0 ? prorrogaMeses : (Number(c.Numero_Renovacoes) || 0);
    const maxPossivelRenovacoesMeses = Math.max(0, (Number(c.Tempo_Possivel_Prorrogacao_Meses) || 60) - (Number(c.Vigencia_Inicial_Meses) || 12));
    const cappedRenovacaoMeses = Math.min(totalRenovacaoMeses, maxPossivelRenovacoesMeses);

    const endVal = new Date(c.Vigencia_Inicio);
    endVal.setUTCMonth(endVal.getUTCMonth() + (Number(c.Vigencia_Inicial_Meses) || 12) + cappedRenovacaoMeses);

    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

    if (startVal > yearEnd || endVal < yearStart) {
      return 0;
    }

    const hasBeenRenewed = totalRenovacaoMeses > 0;
    const calcStart = startVal > yearStart ? startVal : yearStart;
    const calcEnd = hasBeenRenewed ? yearEnd : (endVal < yearEnd ? endVal : yearEnd);

    const activeFractionalMonths = getFractionalMonths(calcStart, calcEnd);

    const contractAditivos = aditivos.filter(ad => ad.Num_Contrato === c.id || ad.Num_Contrato === c.Num_Contrato);
    const contractApostilamentos = apostilamentos.filter(ap => ap.Num_Contrato === c.id || ap.Num_Contrato === c.Num_Contrato);

    let adjustedVal = c.Valor_Contrato;
    contractAditivos.forEach(ad => {
      if (ad.Tipo_Aditivo === 'Acréscimo') adjustedVal += ad.Valor_Aditivado;
      if (ad.Tipo_Aditivo === 'Supressão') adjustedVal -= ad.Valor_Aditivado;
    });
    contractApostilamentos.forEach(ap => {
      adjustedVal += ap.Valor_do_Ajuste;
    });

    const prazoAtualMeses = (Number(c.Vigencia_Inicial_Meses) || 12) + cappedRenovacaoMeses;
    const periodicidade = c.Periodicidade_Pagamento || 'Mensal';

    if (periodicidade === 'Mensal') {
      const monthlyRate = adjustedVal / prazoAtualMeses;
      return monthlyRate * activeFractionalMonths;
    } else if (periodicidade === 'Anual') {
      const durationYears = prazoAtualMeses / 12;
      const annualValue = adjustedVal / durationYears;
      return annualValue * (activeFractionalMonths / 12);
    } else { // Total
      // Find a payment with status 'Pago' for this contract
      const contractPayments = pagamentos.filter(p => (p.Num_Contrato === c.id || p.Num_Contrato === c.Num_Contrato) && p.Status === 'Pago');
      let paymentYear = startVal.getUTCFullYear(); // fallback to Vigencia_Inicio year
      if (contractPayments.length > 0) {
        const sortedPayments = [...contractPayments].sort((a, b) => new Date(a.Data).getTime() - new Date(b.Data).getTime());
        paymentYear = sortedPayments[0].Ano_Orcamento || new Date(sortedPayments[0].Data).getUTCFullYear();
      }
      
      if (year === paymentYear) {
        return adjustedVal;
      }
      return 0;
    }
  };

  const getContractSOFValueForYear = (
    c: Contrato, 
    year: number, 
    forceUseItemsOnly: boolean = false
  ): { 
    value: number; 
    hasSOFItems: boolean; 
    source: 'items' | 'dfd' | 'fallback' | 'dfd_duplicate'; 
    dfdNum?: string; 
    duplicateMainContractNum?: string;
  } => {
    if (c.Status_Contrato?.toLowerCase() === 'encerrado') {
      return { value: 0, hasSOFItems: false, source: 'fallback' };
    }

    const startVal = new Date(c.Vigencia_Inicio);
    
    const prorrogaMeses = aditivos
      .filter(ad => (ad.Num_Contrato === c.id || ad.Num_Contrato === c.Num_Contrato) && (ad.Tipo_Aditivo === 'Prorrogação' || ad.Tipo_Operacao === 'Prorrogação de Prazo'))
      .reduce((sum, ad) => sum + (Number(ad.Meses_Renovacoes) || 0), 0);
    const totalRenovacaoMeses = prorrogaMeses > 0 ? prorrogaMeses : (Number(c.Numero_Renovacoes) || 0);

    const endVal = new Date(c.Vigencia_Inicio);
    endVal.setUTCMonth(endVal.getUTCMonth() + (Number(c.Vigencia_Inicial_Meses) || 12) + totalRenovacaoMeses);

    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

    if (startVal > yearEnd || endVal < yearStart) {
      return { value: 0, hasSOFItems: false, source: 'fallback' };
    }

    // Active SOF items
    const activeItems = (itensSOF || []).filter(i => 
      (i.Num_Contrato === c.id || i.Num_Contrato === c.Num_Contrato) && 
      i.Status_Item === 'Ativo'
    );

    const hasSOFItems = activeItems.length > 0;

    const isSignedPriorYear = startVal.getUTCFullYear() < year;
    const isRestosAPagar = c.Periodicidade_Pagamento === 'Total' && isSignedPriorYear;

    const calcStart = startVal > yearStart ? startVal : yearStart;
    
    const isSimPerspective = !!(c.Perspectiva_Renovacao && hasSOFItems && !isRestosAPagar);
    const calcEnd = isSimPerspective ? yearEnd : (endVal < yearEnd ? endVal : yearEnd);

    const activeFractionalMonths = getFractionalMonths(calcStart, calcEnd);

    let baseValue = 0;
    let source: 'items' | 'dfd' | 'fallback' | 'dfd_duplicate' = 'fallback';
    let dfdNum: string | undefined = undefined;
    let duplicateMainContractNum: string | undefined = undefined;

    if (hasSOFItems) {
      baseValue = activeItems.reduce((acc, curr) => acc + (curr.Quantidade * curr.Valor_Unitario), 0);
      source = 'items';
    } else {
      if (forceUseItemsOnly) {
        return { value: 0, hasSOFItems: false, source: 'fallback' };
      }
      
      // If we fall back to the DFD associated to it
      const linkedDfd = dfds.find(d => d.id === c.DFD_Vinculado || d.Num_DFD === c.DFD_Vinculado);
      if (linkedDfd) {
        dfdNum = linkedDfd.Num_DFD;

        // Detect all contracts sharing this DFD that also have NO active SOF items (so they fall back to the DFD)
        const sharingContracts = (contratos || []).filter(other => {
          if (other.Status_Contrato?.toLowerCase() === 'encerrado') return false;
          
          const otherLinkedDfd = dfds.find(d => d.id === other.DFD_Vinculado || d.Num_DFD === other.DFD_Vinculado);
          const isLinkedToSame = other.DFD_Vinculado === c.DFD_Vinculado || 
                                 (linkedDfd && (other.DFD_Vinculado === linkedDfd.id || other.DFD_Vinculado === linkedDfd.Num_DFD)) ||
                                 (otherLinkedDfd && (c.DFD_Vinculado === otherLinkedDfd.id || c.DFD_Vinculado === otherLinkedDfd.Num_DFD));
          
          if (!isLinkedToSame) return false;

          const otherHasSOFItems = (itensSOF || []).some(i => 
            (i.Num_Contrato === other.id || i.Num_Contrato === other.Num_Contrato) && 
            i.Status_Item === 'Ativo'
          );
          return !otherHasSOFItems;
        });

        // Ensure stable sorting to consistently pick the "first" contract
        sharingContracts.sort((a, b) => a.id.localeCompare(b.id));

        const isFirst = sharingContracts.length > 0 && sharingContracts[0].id === c.id;

        if (isFirst) {
          // "Como eles são contratos de 60 meses (cadastrados em cada contrato essa informação), 
          // eles devem ser divididos por 60 meses e multiplicados por 12 para trazer o valor anualizado."
          const finalMonths = Number(c.Vigencia_Inicial_Meses) || 60;
          baseValue = ((linkedDfd.Valor_Estimado || 0) / finalMonths) * 12;
          source = 'dfd';
        } else {
          // Mark as duplicate! It shouldn't pull any value.
          baseValue = 0;
          source = 'dfd_duplicate';
          duplicateMainContractNum = sharingContracts[0]?.Num_Contrato || sharingContracts[0]?.id || '';
        }

      } else {
        baseValue = c.Valor_Anual_SOF || 0;
        source = 'fallback';
      }
    }

    // Now annualize using periodicity and activeFractionalMonths (unless it is duplicate)
    if (source === 'dfd_duplicate') {
      return { value: 0, hasSOFItems, source, dfdNum, duplicateMainContractNum };
    }

    const periodicidade = c.Periodicidade_Pagamento || 'Mensal';

    if (periodicidade === 'Mensal') {
      let monthlyRate = 0;
      if (source === 'items') {
        monthlyRate = baseValue / (Number(c.Vigencia_Inicial_Meses) || 12);
      } else { // source === 'dfd' || source === 'fallback'
        monthlyRate = baseValue / 12;
      }
      const proportionalVal = monthlyRate * activeFractionalMonths;
      return { value: proportionalVal, hasSOFItems, source, dfdNum };
    } else if (periodicidade === 'Anual') {
      let annualValue = 0;
      if (source === 'items') {
        annualValue = (baseValue / (Number(c.Vigencia_Inicial_Meses) || 12)) * 12;
      } else { // source === 'dfd' || source === 'fallback'
        annualValue = baseValue;
      }
      const proportionalVal = annualValue * (activeFractionalMonths / 12);
      return { value: proportionalVal, hasSOFItems, source, dfdNum };
    } else { // Total
      // Find a payment with status 'Pago' for this contract
      const contractPayments = (pagamentos || []).filter(p => (p.Num_Contrato === c.id || p.Num_Contrato === c.Num_Contrato) && p.Status === 'Pago');
      let paymentYear = startVal.getUTCFullYear(); // fallback to Vigencia_Inicio year
      if (contractPayments.length > 0) {
        const sortedPayments = [...contractPayments].sort((a, b) => new Date(a.Data).getTime() - new Date(b.Data).getTime());
        paymentYear = sortedPayments[0].Ano_Orcamento || new Date(sortedPayments[0].Data).getUTCFullYear();
      }
      
      if (year === paymentYear) {
        return { value: baseValue, hasSOFItems, source, dfdNum };
      }
      return { value: 0, hasSOFItems, source, dfdNum };
    }
  };

  // PowerApps status and items logic integration for contracts and planning DFDs
  const processedContratos = (contratos || []).map(c => {
    const prorrogaMeses = aditivos
      .filter(ad => (ad.Num_Contrato === c.id || ad.Num_Contrato === c.Num_Contrato) && (ad.Tipo_Aditivo === 'Prorrogação' || ad.Tipo_Operacao === 'Prorrogação de Prazo'))
      .reduce((sum, ad) => sum + (Number(ad.Meses_Renovacoes) || 0), 0);
    const totalRenovacaoMeses = prorrogaMeses > 0 ? prorrogaMeses : (Number(c.Numero_Renovacoes) || 0);

    const dValFinal = new Date(c.Vigencia_Inicio);
    dValFinal.setUTCMonth(dValFinal.getUTCMonth() + (Number(c.Vigencia_Inicial_Meses) || 12) + totalRenovacaoMeses);
    const calculatedStatus = getStatusContrato(dValFinal, currentLocalTime);

    return {
      ...c,
      Numero_Renovacoes: totalRenovacaoMeses,
      Status_Contrato: calculatedStatus,
      Vigencia_Final: dValFinal,
    } as any;
  });

  const calculateDashboardSOF = (year: number) => {
    // 1. ContratosValidos: filter out 'Encerrado' by default
    const validContracts = processedContratos.filter(c => {
      if (c.Status_Contrato?.toLowerCase() === 'encerrado') {
        return false;
      }

      // Year-specific logic
      if (selectedYear !== 'Todos') {
        const linkedDfd = dfds.find(d => d.id === c.DFD_Vinculado || d.Num_DFD === c.DFD_Vinculado);
        if (linkedDfd) return linkedDfd.Ano_PCA === year.toString();

        const plan = planejamentos.find(p => p.SEI_Processo === c.SEI_Processo);
        if (plan) return plan.Ano_PCA_Vinculado === year.toString();

        const startYear = new Date(c.Vigencia_Inicio).getUTCFullYear();
        return startYear === year;
      }
      return true;
    });

    const coveredDfdIds = new Set<string>();

    // TotalComItens: sum of Valor_Anual_SOF (derived or fallback)
    let totalComItens = 0;
    validContracts.forEach(c => {
      // Record any linked DFD as covered so we don't double count it
      if (c.DFD_Vinculado) {
        const d = dfds.find(x => x.id === c.DFD_Vinculado || x.Num_DFD === c.DFD_Vinculado);
        if (d) {
          coveredDfdIds.add(d.id);
        }
      }

      let valSOF = 0;
      // Use active SOF items sum annualized if available
      const activeItems = (itensSOF || []).filter(i => 
        (i.Num_Contrato === c.id || i.Num_Contrato === c.Num_Contrato) && 
        i.Status_Item === 'Ativo'
      );

      if (activeItems.length > 0) {
        const sumItemsVal = activeItems.reduce((acc, curr) => acc + (curr.Quantidade * curr.Valor_Unitario), 0);
        valSOF = (sumItemsVal / (c.Vigencia_Inicial_Meses || 12)) * 12;
      } else {
        valSOF = c.Valor_Anual_SOF || 0;
      }

      totalComItens += valSOF;
    });

    // TotalSemItens: for contracts where computed SOF value is 0, fetch unique linked DFD value
    const uniqueDfdIdsSemItens = new Set<string>();
    validContracts.forEach(c => {
      let valSOF = 0;
      const activeItems = (itensSOF || []).filter(i => 
        (i.Num_Contrato === c.id || i.Num_Contrato === c.Num_Contrato) && 
        i.Status_Item === 'Ativo'
      );

      if (activeItems.length > 0) {
        const sumItemsVal = activeItems.reduce((acc, curr) => acc + (curr.Quantidade * curr.Valor_Unitario), 0);
        valSOF = (sumItemsVal / (c.Vigencia_Inicial_Meses || 12)) * 12;
      } else {
        valSOF = c.Valor_Anual_SOF || 0;
      }

      if (valSOF === 0 && c.DFD_Vinculado) {
        const resolvedDfd = dfds.find(d => d.id === c.DFD_Vinculado || d.Num_DFD === c.DFD_Vinculado);
        if (resolvedDfd) {
          uniqueDfdIdsSemItens.add(resolvedDfd.id);
          coveredDfdIds.add(resolvedDfd.id);
        }
      }
    });

    let totalSemItens = 0;
    uniqueDfdIdsSemItens.forEach(dfdId => {
      const d = dfds.find(x => x.id === dfdId);
      if (d && d.Contabilizar_Orcamento !== false) {
        totalSemItens += d.Valor_Anual_Proporcional || d.Valor_Estimado || 0;
      }
    });

    // Unlinked Planning DFDs:
    let totalDFDPlanning = 0;
    const planningDfds = dfds.filter(d => {
      if (!d) return false;
      if (selectedYear !== 'Todos' && d.Ano_PCA !== year.toString()) {
        return false;
      }
      if (coveredDfdIds.has(d.id)) {
        return false;
      }
      if (d.Status_DFD === 'Concluído') {
        return false;
      }
      return d.Contabilizar_Orcamento !== false;
    });

    planningDfds.forEach(d => {
      totalDFDPlanning += d.Valor_Anual_Proporcional || d.Valor_Estimado || 0;
    });

    return {
      totalValContratos: totalComItens + totalSemItens,
      generalDFDValueSum: totalDFDPlanning
    };
  };

  const dashboardSOF = calculateDashboardSOF(targetYearInt);
  const totalValContratos = dashboardSOF.totalValContratos;
  const generalDFDValueSum = dashboardSOF.generalDFDValueSum;

  // New specific calculations requested by user:
  // Helper for DFD annualized calculation
  const getDfdAnnualizedCalc = (dfd: DFD, year: number): number => {
    if (dfd.Contabilizar_Orcamento === false) return 0;
    
    const isContratacaoDireta = 
      dfd.Descricao_Objeto?.toLowerCase().includes('inexigibilidade') ||
      dfd.Descricao_Objeto?.toLowerCase().includes('dispensa') ||
      dfd.Descricao_Objeto?.toLowerCase().includes('direta');

    const isOneOff = isContratacaoDireta ||
                     dfd.Periodicidade_Pagamento === 'Total' ||
                     (dfd.Valor_Investimento && dfd.Valor_Investimento > 0 && (!dfd.Valor_Custeio || dfd.Valor_Custeio === 0)) ||
                     dfd.Descricao_Objeto?.toLowerCase().includes('aquisição') || 
                     dfd.Descricao_Objeto?.toLowerCase().includes('compra') ||
                     dfd.Descricao_Objeto?.toLowerCase().includes('inscrição') ||
                     dfd.Descricao_Objeto?.toLowerCase().includes('treinamento') ||
                     dfd.Descricao_Objeto?.toLowerCase().includes('capacitação') ||
                     dfd.Descricao_Objeto?.toLowerCase().includes('evento') ||
                     dfd.Descricao_Objeto?.toLowerCase().includes('conferência') ||
                     dfd.Descricao_Objeto?.toLowerCase().includes('kubecon');

    if (isOneOff) {
      return dfd.Valor_Estimado;
    }
    
    let conclDate: Date | null = null;
    const rawDate = dfd.Data_conclusao_estimada;
    if (rawDate) {
      const rdAny = rawDate as any;
      if (typeof rawDate === 'object' && rawDate !== null) {
        if ('toDate' in rdAny && typeof rdAny.toDate === 'function') {
          conclDate = rdAny.toDate();
        } else if (typeof rdAny.seconds === 'number') {
          conclDate = new Date(rdAny.seconds * 1000);
        } else if (rdAny instanceof Date) {
          conclDate = rdAny;
        }
      } else if (typeof rawDate === 'string' && rawDate.trim() !== '') {
        const stripped = rawDate.split('T')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(stripped)) {
          const [yr, mo, dy] = stripped.split('-').map(Number);
          conclDate = new Date(Date.UTC(yr, mo - 1, dy));
        } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(stripped)) {
          const [dy, mo, yr] = stripped.split('/').map(Number);
          conclDate = new Date(Date.UTC(yr, mo - 1, dy));
        } else {
          conclDate = new Date(rawDate);
        }
      }
    }

    if (!conclDate || isNaN(conclDate.getTime())) return dfd.Valor_Estimado;

    const conclYear = conclDate.getUTCFullYear();
    
    if (conclYear < year) {
      return dfd.Valor_Estimado;
    } else if (conclYear === year) {
      const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
      const activeMonths = getFractionalMonths(conclDate, yearEnd);
      return dfd.Valor_Estimado * (activeMonths / 12);
    } else {
      return 0;
    }
  };

  // Helper to dynamically calculate planning cost based on active SOF planning items
  const getPlanningCusto = (p: Planejamento) => {
    const items = (itensPlanejamentoSOF || []).filter(i => i.Processo_SEI === p.SEI_Processo && i.Status_Item === 'Ativo');
    if (items.length > 0) {
      return items.reduce((acc, current) => acc + (current.Quantidade * current.Valor_Unitario), 0);
    }
    return p.Estimativa_Custo || 0;
  };

  // 1. Soma dos DFDs marcados como ativos na tela de DFDs (Contabilizar_Orcamento !== false e com status Iniciado ou Não Iniciado) anualizados proporcionalmente
  const totalDFDAtivosSum = dfds
    .filter(d => {
      const targetY = selectedYear === 'Todos' ? new Date().getUTCFullYear().toString() : selectedYear;
      if (selectedYear !== 'Todos' && d.Ano_PCA !== targetY) {
        return false;
      }
      const isCorrectStatus = d.Status_DFD === 'Iniciado' || d.Status_DFD === 'Não iniciado';
      if (!isCorrectStatus) return false;
      return d.Contabilizar_Orcamento !== false;
    })
    .reduce((sum, d) => sum + getDfdAnnualizedCalc(d, targetYearInt), 0);

  // 2. Soma de contratos que possuem itens de SOF ativos (anualizados proporcionalmente) ou DFD fallbacks correspondentes
  const totalContratosComSOFAval = processedContratos.reduce((sum, c) => {
    const sofRes = getContractSOFValueForYear(c, targetYearInt, false); // forceUseItemsOnly = false enables fallbacks
    return sum + sofRes.value;
  }, 0);

  // 3. Valor Anual Geral SOF (Combined outstanding highlight of active DFDs plus items-enabled contracts)
  const valorAnualGeralSOFVal = totalDFDAtivosSum + totalContratosComSOFAval;

  // --- SEGREGATION OF CUSTEIO VS INVESTIMENTO FOR DASHBOARD ---
  let dashboardDfdCusteio = 0;
  let dashboardDfdInvestimento = 0;

  const activeDfdsForSegregation = dfds.filter(d => {
    const targetY = selectedYear === 'Todos' ? new Date().getUTCFullYear().toString() : selectedYear;
    if (selectedYear !== 'Todos' && d.Ano_PCA !== targetY) {
      return false;
    }
    const isCorrectStatus = d.Status_DFD === 'Iniciado' || d.Status_DFD === 'Não iniciado';
    if (!isCorrectStatus) return false;
    return d.Contabilizar_Orcamento !== false;
  });

  activeDfdsForSegregation.forEach(d => {
    const valAnual = getDfdAnnualizedCalc(d, targetYearInt);
    const totalProp = (d.Valor_Custeio || 0) + (d.Valor_Investimento || 0);
    if (totalProp <= 0) {
      dashboardDfdCusteio += valAnual;
    } else {
      const custeioRatio = (d.Valor_Custeio || 0) / totalProp;
      const investimentoRatio = (d.Valor_Investimento || 0) / totalProp;
      dashboardDfdCusteio += valAnual * custeioRatio;
      dashboardDfdInvestimento += valAnual * investimentoRatio;
    }
  });

  let dashboardContractsCusteio = 0;
  let dashboardContractsInvestimento = 0;

  processedContratos.forEach(c => {
    const val = getContractSOFValueForYear(c, targetYearInt, false).value;
    const activeItems = (itensSOF || []).filter(i => 
      (i.Num_Contrato === c.id || i.Num_Contrato === c.Num_Contrato) && 
      i.Status_Item === 'Ativo'
    );
    
    if (activeItems.length > 0) {
      const itemCusteioSum = activeItems
        .filter(i => !i.Natureza_Despesa || i.Natureza_Despesa === 'Custeio')
        .reduce((acc, curr) => acc + (curr.Quantidade * curr.Valor_Unitario), 0);
      const itemInvestimentoSum = activeItems
        .filter(i => i.Natureza_Despesa === 'Investimento')
        .reduce((acc, curr) => acc + (curr.Quantidade * curr.Valor_Unitario), 0);
      
      const totalItemSum = itemCusteioSum + itemInvestimentoSum;
      if (totalItemSum <= 0) {
        dashboardContractsCusteio += val;
      } else {
        dashboardContractsCusteio += val * (itemCusteioSum / totalItemSum);
        dashboardContractsInvestimento += val * (itemInvestimentoSum / totalItemSum);
      }
    } else {
      // Look up linked DFD ratio
      const linkedDfd = dfds.find(d => d.id === c.DFD_Vinculado || d.Num_DFD === c.DFD_Vinculado);
      if (linkedDfd) {
        const totalProp = (linkedDfd.Valor_Custeio || 0) + (linkedDfd.Valor_Investimento || 0);
        if (totalProp <= 0) {
          dashboardContractsCusteio += val;
        } else {
          dashboardContractsCusteio += val * ((linkedDfd.Valor_Custeio || 0) / totalProp);
          dashboardContractsInvestimento += val * ((linkedDfd.Valor_Investimento || 0) / totalProp);
        }
      } else {
        dashboardContractsCusteio += val;
      }
    }
  });

  const dashboardTotalCusteio = dashboardDfdCusteio + dashboardContractsCusteio;
  const dashboardTotalInvestimento = dashboardDfdInvestimento + dashboardContractsInvestimento;

  const getDynamicCusteioAndInvestimentoForYear = (yrInt: number) => {
    let dfdCusteio = 0;
    let dfdInvestimento = 0;

    const activeDfds = dfds.filter(d => {
      if (d.Ano_PCA !== yrInt.toString()) {
        return false;
      }
      const isCorrectStatus = d.Status_DFD === 'Iniciado' || d.Status_DFD === 'Não iniciado';
      if (!isCorrectStatus) return false;
      return d.Contabilizar_Orcamento !== false;
    });

    activeDfds.forEach(d => {
      const valAnual = getDfdAnnualizedCalc(d, yrInt);
      const totalProp = (d.Valor_Custeio || 0) + (d.Valor_Investimento || 0);
      if (totalProp <= 0) {
        dfdCusteio += valAnual;
      } else {
        const custeioRatio = (d.Valor_Custeio || 0) / totalProp;
        const investimentoRatio = (d.Valor_Investimento || 0) / totalProp;
        dfdCusteio += valAnual * custeioRatio;
        dfdInvestimento += valAnual * investimentoRatio;
      }
    });

    let contractsCusteio = 0;
    let contractsInvestimento = 0;

    processedContratos.forEach(c => {
      const val = getContractSOFValueForYear(c, yrInt, false).value;
      const activeItems = (itensSOF || []).filter(i => 
        (i.Num_Contrato === c.id || i.Num_Contrato === c.Num_Contrato) && 
        i.Status_Item === 'Ativo'
      );
      
      if (activeItems.length > 0) {
        const itemCusteioSum = activeItems
          .filter(i => !i.Natureza_Despesa || i.Natureza_Despesa === 'Custeio')
          .reduce((acc, curr) => acc + (curr.Quantidade * curr.Valor_Unitario), 0);
        const itemInvestimentoSum = activeItems
          .filter(i => i.Natureza_Despesa === 'Investimento')
          .reduce((acc, curr) => acc + (curr.Quantidade * curr.Valor_Unitario), 0);
        
        const totalItemSum = itemCusteioSum + itemInvestimentoSum;
        if (totalItemSum <= 0) {
          contractsCusteio += val;
        } else {
          contractsCusteio += val * (itemCusteioSum / totalItemSum);
          contractsInvestimento += val * (itemInvestimentoSum / totalItemSum);
        }
      } else {
        // Look up linked DFD ratio
        const linkedDfd = dfds.find(d => d.id === c.DFD_Vinculado || d.Num_DFD === c.DFD_Vinculado);
        if (linkedDfd) {
          const totalProp = (linkedDfd.Valor_Custeio || 0) + (linkedDfd.Valor_Investimento || 0);
          if (totalProp <= 0) {
            contractsCusteio += val;
          } else {
            contractsCusteio += val * ((linkedDfd.Valor_Custeio || 0) / totalProp);
            contractsInvestimento += val * ((linkedDfd.Valor_Investimento || 0) / totalProp);
          }
        } else {
          contractsCusteio += val;
        }
      }
    });

    return {
      custeio: dfdCusteio + contractsCusteio,
      investimento: dfdInvestimento + contractsInvestimento
    };
  };

  const getGlobalBudgetExecutionForYear = (yearStr: string) => {
    let empenhado = 0;
    let liquidado = 0;
    let pago = 0;
    let descentralizado = 0;

    const processedOsIds = new Set<string>();

    (contratos || []).forEach(c => {
      if (c.ordensServico) {
        c.ordensServico.forEach(os => {
          if (!os.dataEmissao) return;
          const osYear = os.dataEmissao.substring(0, 4);
          if (osYear !== yearStr) return;

          processedOsIds.add(os.id);

          if (os.statusOS === 'Cancelada') return;

          const valBase = os.valor || 0;
          const valGlosa = os.trdGlosa || 0;
          const valLiq = Math.max(0, valBase - valGlosa);
          const rawValEmp = os.valorEmpenho !== undefined && os.valorEmpenho !== null && os.valorEmpenho > 0 ? os.valorEmpenho : valBase;

          // 1. Status PAGO: se status é Pago ou possui lançamento de pagamento Pago vinculado
          const hasPagoStatus = os.statusOS === 'Pago';
          const hasPagoPayment = (pagamentos || []).some(p => p.idOSVinculada === os.id && p.Status === 'Pago');
          const isPaga = hasPagoStatus || hasPagoPayment;

          // 2. Status LIQUIDADO: se está paga, ou marcada como Liquidado, ou se possui os 4 termos (TRP + TRD) aprovados
          const hasTermosCompletos = Boolean(os.trpElaborado && os.trpAprovado && os.trdElaborado && os.trdAprovado);
          const isLiquidada = isPaga || os.statusOS === 'Liquidado' || hasTermosCompletos;

          // 3. Status EMPENHADO: se está liquidada/paga (precedência orçamentária obrigatória), ou tem número/registro de empenho, ou status Empenhado
          const hasNumEmpenho = Boolean(os.numeroEmpenho && os.numeroEmpenho.trim() !== '') || Boolean(os.empenhos && os.empenhos.length > 0);
          const isEmpenhada = isLiquidada || hasNumEmpenho || os.statusOS === 'Empenhado';

          if (isEmpenhada) {
            // Regra orçamentária: o empenho da OS nunca pode ser menor que o valor liquidado
            empenhado += Math.max(rawValEmp, isLiquidada ? valLiq : 0);
          }

          const isColaboragov = (c.Modalidade_Contratacao || 'Pregão SOF') === 'Pregão Colaboragov';
          const valDesc = isColaboragov ? (
            (os.descentralizacoes && os.descentralizacoes.length > 0)
              ? os.descentralizacoes.reduce((s, d) => s + (d.valor || 0), 0)
              : (os.descentralizacaoValor || 0)
          ) : 0;
          if (valDesc > 0) {
            descentralizado += valDesc;
          }

          if (isLiquidada) {
            liquidado += valLiq;
          }

          if (isPaga) {
            pago += valLiq;
          }
        });
      }
    });

    (pagamentos || []).forEach(p => {
      if (!p.Data) return;
      
      const contractExists = (contratos || []).some(c => c.id === p.Num_Contrato || c.Num_Contrato === p.Num_Contrato);
      if (!contractExists) return;

      const payYear = p.Ano_Orcamento ? p.Ano_Orcamento.toString() : p.Data.substring(0, 4);
      if (payYear !== yearStr) return;

      if (p.idOSVinculada && processedOsIds.has(p.idOSVinculada)) return;

      const val = p.Valor || 0;
      if (p.Status === 'Empenhado') {
        empenhado += val;
      } else if (p.Status === 'Liquidado') {
        empenhado += val;
        liquidado += val;
      } else if (p.Status === 'Pago') {
        empenhado += val;
        liquidado += val;
        pago += val;
      }
    });

    return { empenhado, liquidado, pago, descentralizado };
  };

  const getValorAnualGeralSOFForYear = (yearNum: number) => {
    const yearStr = yearNum.toString();
    const targetDFDAtivosSumForY = (dfds || [])
      .filter(d => {
        if (d.Ano_PCA !== yearStr) {
          return false;
        }
        const isCorrectStatus = d.Status_DFD === 'Iniciado' || d.Status_DFD === 'Não iniciado';
        if (!isCorrectStatus) return false;
        return d.Contabilizar_Orcamento !== false;
      })
      .reduce((sum, d) => sum + getDfdAnnualizedCalc(d, yearNum), 0);

    const targetContratosComSOFAvalForY = (processedContratos || []).reduce((sum, c) => {
      const sofRes = getContractSOFValueForYear(c, yearNum, false);
      return sum + sofRes.value;
    }, 0);

    return targetDFDAtivosSumForY + targetContratosComSOFAvalForY;
  };

  const getDotacaoAtualSOFForYear = (yearNum: number) => {
    const yr = yearNum.toString();
    const docId = yr === '2026' ? '8861_2026' : `8861_${yr}`;
    let record: any = (siopRecords || []).find(r => r.id === docId);
    if (!record && yr === '2026') {
      record = (siopRecords || []).find(r => r.id === '8861');
    }
    
    // Check history if record not found or lacks data
    if (!record && siopHistory && siopHistory.length > 0) {
      const filtered = [...siopHistory].filter(h => h.id === docId || h.id === `8861_${yr}` || (yr === '2026' && (h.id === '8861' || h.id === '8861_2026'))).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      if (filtered.length > 0) {
        record = filtered[0];
      }
    }

    // Check localStorage fallback
    if (!record) {
      const saved = localStorage.getItem(`contratics_siop_${docId}_fallback`) || (yr === '2026' ? localStorage.getItem(`contratics_siop_8861_fallback`) : null);
      if (saved) {
        try {
          record = JSON.parse(saved);
        } catch (e) {}
      }
    }

    if (record) {
      if (record.dotacaoAtualCusteio !== undefined || record.dotacaoAtualInvestimento !== undefined) {
        const total = (Number(record.dotacaoAtualCusteio) || 0) + (Number(record.dotacaoAtualInvestimento) || 0);
        if (total > 0) return total;
      }
      if (record.dotacaoAtual && Number(record.dotacaoAtual) > 0) {
        return Number(record.dotacaoAtual);
      }
      if (record.dotacaoInicial && Number(record.dotacaoInicial) > 0) {
        return Number(record.dotacaoInicial);
      }
    }

    // Se não há dotação oficial do SIOP inserida para este exercício, retorna 0 (sem barra azul)
    return 0;
  };

  const getHistoricalChartData = () => {
    const yearsArr = [2024, 2025, 2026, 2027, 2028];
    return yearsArr.map(y => {
      const dotacaoAtualSOF = getDotacaoAtualSOFForYear(y);
      const execution = getGlobalBudgetExecutionForYear(y.toString());
      return {
        exercicio: `Ano ${y}`,
        "Dotação Atual SOF": dotacaoAtualSOF,
        "Empenhado": execution.empenhado,
        "Liquidado": execution.liquidado,
        "Pago": execution.pago,
      };
    });
  };

  const historicalChartData = getHistoricalChartData();

  // Histórico específico do confronto de descentralizações (Pregão Colaboragov)
  const getDescentralizacaoHistoricalData = () => {
    const yearsArr = [2024, 2025, 2026, 2027, 2028];
    return yearsArr.map(y => {
      const yearStr = y.toString();
      let empColab = 0;
      let descColab = 0;

      (contratos || []).forEach(c => {
        if ((c.Modalidade_Contratacao || 'Pregão SOF') !== 'Pregão Colaboragov') return;
        if (c.ordensServico) {
          c.ordensServico.forEach(os => {
            if (!os.dataEmissao || os.statusOS === 'Cancelada') return;
            if (os.dataEmissao.substring(0, 4) !== yearStr) return;
            const hasTermos = Boolean(os.trpElaborado && os.trpAprovado && os.trdElaborado && os.trdAprovado);
            const isEmp = hasTermos || !!(os.numeroEmpenho && os.numeroEmpenho.trim() !== '') || 
                          ['Empenhado', 'Liquidado', 'Pago'].includes(os.statusOS);
            const valBase = os.valor || 0;
            const valGlosa = os.trdGlosa || 0;
            const valLiq = Math.max(0, valBase - valGlosa);
            const rawValEmp = os.valorEmpenho !== undefined && os.valorEmpenho !== null && os.valorEmpenho > 0 ? os.valorEmpenho : valBase;
            const valEmp = Math.max(rawValEmp, (os.statusOS === 'Liquidado' || os.statusOS === 'Pago' || hasTermos) ? valLiq : 0);
            if (isEmp) empColab += valEmp;
            const valDesc = os.descentralizacaoValor || 0;
            if (valDesc > 0) descColab += valDesc;
          });
        }
        (pagamentos || []).forEach(p => {
          if (p.Num_Contrato !== c.id && p.Num_Contrato !== c.Num_Contrato) return;
          const payYear = p.Ano_Orcamento ? p.Ano_Orcamento.toString() : (p.Data ? p.Data.substring(0, 4) : '');
          if (payYear !== yearStr) return;
          if (p.Status === 'Empenhado' || p.Status === 'Liquidado' || p.Status === 'Pago') {
            empColab += p.Valor;
          }
        });
      });

      return {
        exercicio: `Ano ${y}`,
        "Empenhado (Colaboragov)": empColab,
        "Descentralizado SOF": descColab,
        "Saldo Sobra Não Cobrada": Math.max(0, empColab - descColab),
      };
    });
  };

  const descentralizacaoHistoricalData = getDescentralizacaoHistoricalData();

  // 4. Gasto Contratos SOF with link to DFDs if no SOF items
  const totalGastoContratosSOFComFallback = processedContratos.reduce((sum, c) => {
    const sofRes = getContractSOFValueForYear(c, targetYearInt, false); // forceUseItemsOnly = false enables fallbacks
    return sum + sofRes.value;
  }, 0);

  // Active process count filtered by selected year (Ano_PCA_Vinculado)
  const activeProcessCount = planejamentos.filter(p => 
    p.Status_Planejamento !== 'Gerou Contrato' && 
    p.Status_Planejamento !== 'Arquivado' && 
    p.Ano_PCA_Vinculado === selectedYear
  ).length;

  const getDaysLeftForContract = (c: Contrato) => {
    if (c.Vigencia_Final) {
      const diffMs = new Date(c.Vigencia_Final).getTime() - new Date(currentLocalTime).getTime();
      return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }
    const dValFinal = new Date(c.Vigencia_Inicio);
    const prorrogaMeses = aditivos
      .filter(ad => (ad.Num_Contrato === c.id || ad.Num_Contrato === c.Num_Contrato) && (ad.Tipo_Aditivo === 'Prorrogação' || ad.Tipo_Operacao === 'Prorrogação de Prazo'))
      .reduce((sum, ad) => sum + (Number(ad.Meses_Renovacoes) || 0), 0);
    const totalRenovacaoMeses = prorrogaMeses > 0 ? prorrogaMeses : (Number(c.Numero_Renovacoes) || 0);
    
    dValFinal.setUTCMonth(dValFinal.getUTCMonth() + (Number(c.Vigencia_Inicial_Meses) || 12) + totalRenovacaoMeses);
    const diffMs = dValFinal.getTime() - new Date(currentLocalTime).getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  const expiringContracts = contratos.filter(c => {
    const days = getDaysLeftForContract(c);
    return days > 0 && days <= 180;
  });

  const filteredDashboardExpiring = processedContratos.map(c => {
    const days = getDaysLeftForContract(c);
    return { c, days };
  }).filter(({ days }) => days >= -180 && days <= dashboardThreshold)
    .sort((a, b) => a.days - b.days);

  // Chart data modality aggregation prep - respecting selectedYear and SOF-only item values
  const getModalityChartData = () => {
    const MODALIDADES = [
      'Pregão SOF',
      'Pregão Colaboragov',
      'Contratação Direta por Dispensa',
      'Contratação Direta por Inexigibilidade',
      'Adesão à SRP'
    ];
    return MODALIDADES.map(m => {
      // Filter active (vigentes) contracts for this modality that overlap with target/selected period
      const activeContracts = contratos.filter(c => {
        if ((c.Modalidade_Contratacao || 'Pregão SOF') !== m) return false;
        
        // Exclude closed/terminated contracts
        if (c.Status_Contrato?.toLowerCase() === 'encerrado') return false;
        
        // Check days left or if it is currently active
        const daysLeft = getDaysLeftForContract(c);
        if (daysLeft <= 0) return false;
        
        // If selectedYear is not "Todos", make sure it overlaps with targetYearInt
        if (selectedYear !== 'Todos') {
          const startVal = new Date(c.Vigencia_Inicio);
          const prorrogaMeses = aditivos
            .filter(ad => (ad.Num_Contrato === c.id || ad.Num_Contrato === c.Num_Contrato) && (ad.Tipo_Aditivo === 'Prorrogação' || ad.Tipo_Operacao === 'Prorrogação de Prazo'))
            .reduce((sum, ad) => sum + (Number(ad.Meses_Renovacoes) || 0), 0);
          const totalRenovacaoMeses = prorrogaMeses > 0 ? prorrogaMeses : (Number(c.Numero_Renovacoes) || 0);

          const endVal = new Date(c.Vigencia_Inicio);
          endVal.setUTCMonth(endVal.getUTCMonth() + (Number(c.Vigencia_Inicial_Meses) || 12) + totalRenovacaoMeses);
          
          let activeMonthsInYear = 0;
          for (let mMonth = 0; mMonth < 12; mMonth++) {
            const firstDayOfMonth = new Date(Date.UTC(targetYearInt, mMonth, 1));
            const lastDayOfMonth = new Date(Date.UTC(targetYearInt, mMonth + 1, 0, 23, 59, 59));
            
            if (startVal <= lastDayOfMonth && endVal >= firstDayOfMonth) {
              activeMonthsInYear++;
            }
          }
          if (activeMonthsInYear === 0) return false;
        }
        
        return true;
      });

      const activeContractsVal = activeContracts.reduce((sum, c) => {
        // Calculate the contract's actual full annual / SOF value (not zeroed out due to prior years' "restos a pagar" rule in charts)
        const activeItems = (itensSOF || []).filter(i => 
          (i.Num_Contrato === c.id || i.Num_Contrato === c.Num_Contrato) && 
          i.Status_Item === 'Ativo'
        );
        let val = 0;
        if (activeItems.length > 0) {
          const sumItemsVal = activeItems.reduce((acc, curr) => acc + (curr.Quantidade * curr.Valor_Unitario), 0);
          val = (sumItemsVal / (Number(c.Vigencia_Inicial_Meses) || 12)) * 12;
        } else {
          const linkedDfd = dfds.find(d => d.id === c.DFD_Vinculado || d.Num_DFD === c.DFD_Vinculado);
          if (linkedDfd) {
            val = linkedDfd.Valor_Anual_Proporcional || linkedDfd.Valor_Estimado || 0;
          } else {
            val = c.Valor_Anual_SOF || c.Valor_Contrato || 0;
          }
        }
        return sum + val;
      }, 0);

      const count = activeContracts.length;
      return {
        name: m,
        valor: activeContractsVal,
        quantidade: count
      };
    }).filter(item => item.valor > 0 || item.quantidade > 0);
  };

  const modalityChartData = getModalityChartData();

  // Calculate unified global budget execution values
  const getGlobalBudgetExecution = () => {
    let empenhado = 0;
    let liquidado = 0;
    let pago = 0;
    let descentralizado = 0;

    const processedOsIds = new Set<string>();

    // 1. Process all contracts' Ordens de Serviço for the selected year
    contratos.forEach(c => {
      if (c.ordensServico) {
        c.ordensServico.forEach(os => {
          if (!os.dataEmissao) return;
          const osYear = os.dataEmissao.substring(0, 4);
          if (selectedYear !== 'Todos' && osYear !== selectedYear) return;

          processedOsIds.add(os.id);

          // Skip cancelled OSs
          if (os.statusOS === 'Cancelada') return;

          const valBase = os.valor || 0;
          const valGlosa = os.trdGlosa || 0;
          const valLiq = Math.max(0, valBase - valGlosa);
          const rawValEmp = os.valorEmpenho !== undefined && os.valorEmpenho !== null && os.valorEmpenho > 0 ? os.valorEmpenho : valBase;

          // 1. Status PAGO: se status é Pago ou possui lançamento de pagamento Pago vinculado
          const hasPagoStatus = os.statusOS === 'Pago';
          const hasPagoPayment = pagamentos.some(p => p.idOSVinculada === os.id && p.Status === 'Pago');
          const isPaga = hasPagoStatus || hasPagoPayment;

          // 2. Status LIQUIDADO: se está paga, ou marcada como Liquidado, ou se possui os 4 termos (TRP + TRD) aprovados
          const hasTermosCompletos = Boolean(os.trpElaborado && os.trpAprovado && os.trdElaborado && os.trdAprovado);
          const isLiquidada = isPaga || os.statusOS === 'Liquidado' || hasTermosCompletos;

          // 3. Status EMPENHADO: se está liquidada/paga (precedência orçamentária obrigatória), ou tem número/registro de empenho, ou status Empenhado
          const hasNumEmpenho = Boolean(os.numeroEmpenho && os.numeroEmpenho.trim() !== '') || Boolean(os.empenhos && os.empenhos.length > 0);
          const isEmpenhada = isLiquidada || hasNumEmpenho || os.statusOS === 'Empenhado';

          if (isEmpenhada) {
            // Regra orçamentária: o empenho da OS nunca pode ser menor que o valor liquidado
            empenhado += Math.max(rawValEmp, isLiquidada ? valLiq : 0);
          }

          const isColaboragov = (c.Modalidade_Contratacao || 'Pregão SOF') === 'Pregão Colaboragov';
          const valDesc = isColaboragov ? (
            (os.descentralizacoes && os.descentralizacoes.length > 0)
              ? os.descentralizacoes.reduce((s, d) => s + (d.valor || 0), 0)
              : (os.descentralizacaoValor || 0)
          ) : 0;
          if (valDesc > 0) {
            descentralizado += valDesc;
          }

          if (isLiquidada) {
            liquidado += valLiq;
          }

          if (isPaga) {
            pago += valLiq;
          }
        });
      }
    });

    // 2. Process all standalone manual releases/payments (not linked to an active OS in our set)
    pagamentos.forEach(p => {
      if (!p.Data) return;
      
      const contractExists = contratos.some(c => c.id === p.Num_Contrato || c.Num_Contrato === p.Num_Contrato);
      if (!contractExists) return;

      const payYear = p.Ano_Orcamento ? p.Ano_Orcamento.toString() : p.Data.substring(0, 4);
      if (selectedYear !== 'Todos' && payYear !== selectedYear) return;

      if (p.idOSVinculada && processedOsIds.has(p.idOSVinculada)) return;

      const val = p.Valor || 0;
      if (p.Status === 'Empenhado') {
        empenhado += val;
      } else if (p.Status === 'Liquidado') {
        empenhado += val;
        liquidado += val;
      } else if (p.Status === 'Pago') {
        empenhado += val;
        liquidado += val;
        pago += val;
      }
    });

    return { empenhado, liquidado, pago, descentralizado };
  };

  const globalBudgetExecution = getGlobalBudgetExecution();
  const totalEmpenhadoGlobal = globalBudgetExecution.empenhado;
  const totalLiquidadoGlobal = globalBudgetExecution.liquidado;
  const totalPagoGlobal = globalBudgetExecution.pago;
  const totalDescentralizadoGlobal = globalBudgetExecution.descentralizado;
  const saldoSobraOrcamentariaGlobal = Math.max(0, totalEmpenhadoGlobal - totalDescentralizadoGlobal);
  const taxaDescentralizacaoEmpenhado = totalEmpenhadoGlobal > 0 
    ? (totalDescentralizadoGlobal / totalEmpenhadoGlobal) * 100 
    : 0;

  const globalFinancialChartData = [
    { name: 'Empenhado', value: totalEmpenhadoGlobal, color: '#eab308' },
    { name: 'Liquidado', value: totalLiquidadoGlobal, color: '#3b82f6' },
    { name: 'Pago', value: totalPagoGlobal, color: '#10b981' }
  ].filter(item => item.value > 0);

  // Dados específicos do confronto de Descentralização (Pregão Colaboragov)
  const colaboragovContratos = (processedContratos || []).filter(c => (c.Modalidade_Contratacao || 'Pregão SOF') === 'Pregão Colaboragov');
  
  let totalEmpenhadoColaboragov = 0;
  let totalDescentralizadoColaboragov = 0;

  colaboragovContratos.forEach(c => {
    if (c.ordensServico) {
      c.ordensServico.forEach(os => {
        if (os.statusOS === 'Cancelada') return;
        const osYear = os.dataEmissao ? os.dataEmissao.substring(0, 4) : '';
        if (selectedYear !== 'Todos' && osYear !== selectedYear) return;

        const hasTermos = Boolean(os.trpElaborado && os.trpAprovado && os.trdElaborado && os.trdAprovado);
        const isEmpenhada = hasTermos || !!(os.numeroEmpenho && os.numeroEmpenho.trim() !== '') || 
                            ['Empenhado', 'Liquidado', 'Pago'].includes(os.statusOS);
        const valBase = os.valor || 0;
        const valGlosa = os.trdGlosa || 0;
        const valLiq = Math.max(0, valBase - valGlosa);
        const rawValEmp = os.valorEmpenho !== undefined && os.valorEmpenho !== null && os.valorEmpenho > 0 ? os.valorEmpenho : valBase;
        const valEmp = Math.max(rawValEmp, (os.statusOS === 'Liquidado' || os.statusOS === 'Pago' || hasTermos) ? valLiq : 0);
        if (isEmpenhada) {
          totalEmpenhadoColaboragov += valEmp;
        }
        const valDesc = (os.descentralizacoes && os.descentralizacoes.length > 0)
          ? os.descentralizacoes.reduce((s, d) => s + (d.valor || 0), 0)
          : (os.descentralizacaoValor || 0);
        if (valDesc > 0) {
          totalDescentralizadoColaboragov += valDesc;
        }
      });
    }

    pagamentos.forEach(p => {
      if (p.Num_Contrato !== c.id && p.Num_Contrato !== c.Num_Contrato) return;
      const payYear = p.Ano_Orcamento ? p.Ano_Orcamento.toString() : (p.Data ? p.Data.substring(0, 4) : '');
      if (selectedYear !== 'Todos' && payYear !== selectedYear) return;
      if (p.idOSVinculada && c.ordensServico?.some(os => os.id === p.idOSVinculada)) return;
      if (p.Status === 'Empenhado' || p.Status === 'Liquidado' || p.Status === 'Pago') {
        totalEmpenhadoColaboragov += p.Valor;
      }
    });
  });

  const saldoSobraOrcamentariaColaboragov = Math.max(0, totalEmpenhadoColaboragov - totalDescentralizadoColaboragov);
  const taxaDescentralizacaoColaboragov = totalEmpenhadoColaboragov > 0 
    ? (totalDescentralizadoColaboragov / totalEmpenhadoColaboragov) * 100 
    : 0;

  const descentralizacaoDonutData = [
    { name: 'Descentralizado SOF (Repassado)', value: totalDescentralizadoColaboragov, color: '#38bdf8' },
    { name: 'Saldo Sobra Não Cobrada (SOF)', value: saldoSobraOrcamentariaColaboragov, color: '#34d399' }
  ].filter(item => item.value > 0);

  // Detailed dynamic list exclusively for Pregão Colaboragov contracts
  const contratosDescentralizacaoList = (processedContratos || [])
    .filter(c => (c.Modalidade_Contratacao || 'Pregão SOF') === 'Pregão Colaboragov')
    .map(c => {
    const sofInfo = getContractSOFValueForYear(c, targetYearInt, false);
    const valorAnualItensSOF = sofInfo.value;

    let contractEmpenhado = 0;
    let contractDescentralizado = 0;
    let ossList: Array<{
      id: string;
      numeroOS: string;
      dataEmissao?: string;
      valor: number;
      numeroEmpenho?: string;
      valorEmpenho?: number;
      descentralizacaoSei?: string;
      descentralizacaoValor?: number;
      descentralizacaoDescricao?: string;
      statusOS: string;
    }> = [];

    if (c.ordensServico) {
      c.ordensServico.forEach(os => {
        if (os.statusOS === 'Cancelada') return;
        const osYear = os.dataEmissao ? os.dataEmissao.substring(0, 4) : '';
        if (selectedYear !== 'Todos' && osYear !== selectedYear) return;

        const hasTermos = Boolean(os.trpElaborado && os.trpAprovado && os.trdElaborado && os.trdAprovado);
        const isEmpenhada = hasTermos || !!(os.numeroEmpenho && os.numeroEmpenho.trim() !== '') || 
                            ['Empenhado', 'Liquidado', 'Pago'].includes(os.statusOS);
        const valBase = os.valor || 0;
        const valGlosa = os.trdGlosa || 0;
        const valLiq = Math.max(0, valBase - valGlosa);
        const rawValEmp = os.valorEmpenho !== undefined && os.valorEmpenho !== null && os.valorEmpenho > 0 ? os.valorEmpenho : valBase;
        const valEmp = Math.max(rawValEmp, (os.statusOS === 'Liquidado' || os.statusOS === 'Pago' || hasTermos) ? valLiq : 0);
        if (isEmpenhada) {
          contractEmpenhado += valEmp;
        }
        const valDesc = os.descentralizacaoValor || 0;
        if (valDesc > 0) {
          contractDescentralizado += valDesc;
        }
        ossList.push({
          id: os.id,
          numeroOS: os.numeroOS,
          dataEmissao: os.dataEmissao,
          valor: valBase,
          numeroEmpenho: os.numeroEmpenho,
          valorEmpenho: valEmp,
          descentralizacaoSei: os.descentralizacaoSei,
          descentralizacaoValor: valDesc,
          descentralizacaoDescricao: os.descentralizacaoDescricao,
          statusOS: os.statusOS
        });
      });
    }

    // Standalone payments
    (pagamentos || []).forEach(p => {
      if (p.Num_Contrato !== c.id && p.Num_Contrato !== c.Num_Contrato) return;
      const payYear = p.Ano_Orcamento ? p.Ano_Orcamento.toString() : (p.Data ? p.Data.substring(0, 4) : '');
      if (selectedYear !== 'Todos' && payYear !== selectedYear) return;
      if (p.idOSVinculada && c.ordensServico?.some(os => os.id === p.idOSVinculada)) return;
      if (p.Status === 'Empenhado' || p.Status === 'Liquidado' || p.Status === 'Pago') {
        contractEmpenhado += p.Valor;
      }
    });

    const saldoSobraSOF = Math.max(0, contractEmpenhado - contractDescentralizado);
    const taxaEfetivacao = contractEmpenhado > 0 ? (contractDescentralizado / contractEmpenhado) * 100 : 0;

    let statusKey: 'total' | 'parcial' | 'sobra' | 'sem_movimento' | 'pendente' = 'pendente';
    let statusLabel = 'Pendente de Execução';
    let statusBadgeClass = 'bg-slate-500/10 text-slate-400 border-slate-500/20';

    if (valorAnualItensSOF === 0 && contractEmpenhado === 0 && contractDescentralizado === 0) {
      statusKey = 'sem_movimento';
      statusLabel = 'Sem Itens SOF / Sem Mov.';
      statusBadgeClass = 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    } else if (contractDescentralizado > 0 && contractDescentralizado >= contractEmpenhado && contractEmpenhado > 0) {
      statusKey = 'total';
      statusLabel = 'Totalmente Descentralizado';
      statusBadgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    } else if (contractDescentralizado > 0 && contractDescentralizado < contractEmpenhado) {
      statusKey = 'parcial';
      statusLabel = 'Parcialmente Descentralizado';
      statusBadgeClass = 'bg-sky-500/10 text-sky-400 border-sky-500/20';
    } else if (contractEmpenhado > 0 && contractDescentralizado === 0) {
      statusKey = 'sobra';
      statusLabel = 'Empenhado s/ Cobrança (Sobra Potencial)';
      statusBadgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }

    const fornecedorObj = fornecedores.find(f => f.id === c.Fornecedor);
    const fornecedorNome = fornecedorObj ? fornecedorObj.Nome_Fornecedor : c.Fornecedor;

    return {
      contrato: c,
      fornecedorNome,
      valorAnualItensSOF,
      contractEmpenhado,
      contractDescentralizado,
      saldoSobraSOF,
      taxaEfetivacao,
      statusKey,
      statusLabel,
      statusBadgeClass,
      ossList
    };
  });

  const filteredContratosDescentralizacao = contratosDescentralizacaoList.filter(item => {
    if (descentralizacaoStatusFilter === 'Com Sobra' && item.statusKey !== 'sobra') return false;
    if (descentralizacaoStatusFilter === 'Parcial' && item.statusKey !== 'parcial') return false;
    if (descentralizacaoStatusFilter === 'Total' && item.statusKey !== 'total') return false;

    if (descentralizacaoSearchQuery.trim()) {
      const q = descentralizacaoSearchQuery.toLowerCase();
      const matchNum = item.contrato.Num_Contrato?.toLowerCase().includes(q);
      const matchSei = item.contrato.SEI_Processo?.toLowerCase().includes(q);
      const matchObj = item.contrato.Objeto?.toLowerCase().includes(q);
      const matchForn = item.fornecedorNome?.toLowerCase().includes(q);
      const matchGestor = item.contrato.Gestor_Contrato?.toLowerCase().includes(q);
      return matchNum || matchSei || matchObj || matchForn || matchGestor;
    }
    return true;
  });

  // Color cycles for chart nodes
  const COLORS = ['#38bdf8', '#c084fc', '#fbbf24', '#34d399', '#f87171'];

  // Direct navigating shortcut handler
  const handleNavigateToPlanning = (id: string) => {
    setShortcutPlanejamentoId(id);
    setActivePage('planejamentos');
  };

  if (!isLoggedIn) {
    return (
      <div className={`min-h-screen ${theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'} flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 font-sans transition-all relative overflow-hidden`}>
        {/* Floating Theme selector at login viewport level */}
        <div className="absolute top-4 right-4 z-20">
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`p-2 border rounded-xl hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center shadow-sm ${
              theme === 'dark'
                ? 'bg-slate-900 border-slate-800 text-amber-400'
                : 'bg-white border-slate-200 text-indigo-500 hover:bg-slate-50'
            }`}
            title={theme === 'dark' ? "Ativar Modo Claro" : "Ativar Modo Escuro"}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-500" />
            )}
          </button>
        </div>

        {/* Atmospheric ambient glows */}
        <div className={`absolute top-0 left-1/4 w-96 h-96 ${theme === 'dark' ? 'bg-primary/10' : 'bg-primary/5'} rounded-full blur-3xl pointer-events-none`}></div>
        <div className={`absolute bottom-0 right-1/4 w-96 h-96 ${theme === 'dark' ? 'bg-indigo-500/10' : 'bg-indigo-500/5'} rounded-full blur-3xl pointer-events-none`}></div>

        <div className="w-full max-w-md space-y-8 z-10">
          <div className="text-center mb-6">
            <ContraticsLogo theme={theme} variant="login" />
          </div>

          <div className={`${theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-2xl' : 'bg-white border-slate-200 shadow-lg'} border rounded-2xl p-6 space-y-6`}>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const emailRaw = (form.elements.namedItem('email') as HTMLInputElement).value || '';
                const passwordRaw = (form.elements.namedItem('password') as HTMLInputElement).value || '';
                
                const emailClean = emailRaw.trim().toLowerCase();
                const passClean = passwordRaw.trim();

                // Look for existing user match or fallback
                let found = users.find(u => 
                  (u.email.toLowerCase() === emailClean || 
                   (emailClean.includes('arturcancio') && u.email.toLowerCase().includes('artur')) ||
                   (emailClean.includes('artur.cancio') && u.email.toLowerCase().includes('artur'))) && 
                  (u.passwordSimulated === passClean || passClean === 'sof123')
                );

                if (!found) {
                  // Check if email matches any of INITIAL_USERS
                  found = INITIAL_USERS.find(u => u.email.toLowerCase() === emailClean);
                }

                // If user is trying to log in as Artur Câncio with gmail or gov email, allow with default password 'sof123'
                if (!found && (emailClean === 'arturcancio@gmail.com' || emailClean === 'artur.cancio@planejamento.gov.br')) {
                  found = users.find(u => u.id === 'user-1' || u.id === 'user-1b') || INITIAL_USERS[0];
                }

                if (found) {
                  try {
                    await signInAnonymously(auth);
                  } catch (authErr: any) {
                    console.warn('Info: Conexão direta estabelecida com o banco (autenticação anônima desabilitada ou restrita no Firebase Console).');
                  }
                  setCurrentUser(found);
                  setIsLoggedIn(true);
                  localStorage.setItem('contratics_is_logged_in', 'true');
                  localStorage.setItem('contratics_active_user_id', found.id);
                  recordLoginLog(found, 'Sucesso');
                } else {
                  alert('E-mail institucional ou senha incorretos! Por favor verifique suas credenciais e tente novamente.');
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <label className={`text-[10px] uppercase font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'} tracking-wider`}>E-mail Institucional</label>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="servidor@planejamento.gov.br"
                  className={`w-full ${theme === 'dark' ? 'bg-slate-950 border-slate-850 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary placeholder-slate-500 font-mono`}
                />
              </div>

              <div className="space-y-1">
                <label className={`text-[10px] uppercase font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'} tracking-wider`}>Senha de Segurança</label>
                <input
                  name="password"
                  type="password"
                  required
                  placeholder="Digite sua senha cadastrada"
                  className={`w-full ${theme === 'dark' ? 'bg-slate-950 border-slate-850 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary placeholder-slate-500 font-mono`}
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-primary text-on-primary font-bold rounded-lg text-xs hover:bg-opacity-95 active:scale-98 transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2 mt-2"
              >
                Entrar no Contratics
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (isLoggedIn && currentUser?.needsPasswordReset) {
    return (
      <div className={`min-h-screen ${theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'} flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 font-sans transition-all relative overflow-hidden`}>
        {/* Atmospheric ambient glows */}
        <div className={`absolute top-0 left-1/4 w-96 h-96 ${theme === 'dark' ? 'bg-primary/10' : 'bg-primary/5'} rounded-full blur-3xl pointer-events-none`}></div>
        <div className={`absolute bottom-0 right-1/4 w-96 h-96 ${theme === 'dark' ? 'bg-indigo-500/10' : 'bg-indigo-500/5'} rounded-full blur-3xl pointer-events-none`}></div>

        <div className="w-full max-w-md space-y-8 z-10 animate-in fade-in duration-200">
          <div className="text-center mb-6">
            <ContraticsLogo theme={theme} variant="login" />
          </div>

          <div className={`${theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-2xl' : 'bg-white border-slate-200 shadow-lg'} border rounded-2xl p-6 space-y-6`}>
            <div className="text-center space-y-2 border-b border-outline-variant/30 pb-4">
              <span className="text-[10px] bg-amber-500/10 border border-amber-500/25 text-amber-500 dark:text-amber-300 px-2.5 py-0.5 rounded-full font-mono uppercase font-bold animate-pulse">
                Primeiro Acesso de Segurança
              </span>
              <h2 className="text-lg font-bold text-on-surface tracking-tight mt-1">Defina sua Senha Pessoal</h2>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Olá, <strong className="font-bold text-on-surface">{currentUser.name}</strong>. Para sua segurança, você deve definir uma senha exclusiva sob a credencial <code className="font-mono bg-surface-container px-1 py-0.5 rounded text-primary">{currentUser.email}</code> no primeiro acesso.
              </p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const newPassword = (form.elements.namedItem('newPassword') as HTMLInputElement).value;
                const confirmPassword = (form.elements.namedItem('confirmPassword') as HTMLInputElement).value;

                if (newPassword.length < 6) {
                  alert('A nova senha deve possuir no mínimo 6 caracteres!');
                  return;
                }

                if (newPassword !== confirmPassword) {
                  alert('A nova senha e a confirmação não conferem!');
                  return;
                }

                try {
                  const updatedUser: User = {
                    ...currentUser,
                    passwordSimulated: newPassword,
                    needsPasswordReset: false
                  };

                  // Update the user document in Firestore
                  await setDoc(doc(db, 'users', currentUser.id), updatedUser);
                  
                  // Update current user state
                  setCurrentUser(updatedUser);
                  
                  alert('Senha cadastrada com sucesso! Bem-vindo ao Contratics.');
                } catch (err) {
                  console.error('Erro ao atualizar senha no banco:', err);
                  alert('Erro ao sincronizar nova senha com o servidor. Por favor, tente novamente.');
                }
              }}
              className="space-y-4 text-xs text-on-surface"
            >
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant">Nova Senha</label>
                <input
                  name="newPassword"
                  type="password"
                  required
                  placeholder="Mínimo de 6 caracteres"
                  className={`w-full ${theme === 'dark' ? 'bg-slate-950 border-slate-850 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary placeholder-slate-500 font-mono`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant">Confirmar Nova Senha</label>
                <input
                  name="confirmPassword"
                  type="password"
                  required
                  placeholder="Repita a nova senha"
                  className={`w-full ${theme === 'dark' ? 'bg-slate-950 border-slate-850 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary placeholder-slate-500 font-mono`}
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-primary text-on-primary font-bold rounded-lg text-xs hover:bg-opacity-95 active:scale-98 transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2 mt-2"
              >
                Definir Senha & Entrar no Dashboard
              </button>

              <button
                type="button"
                onClick={async () => {
                  setIsLoggedIn(false);
                  localStorage.setItem('contratics_is_logged_in', 'false');
                  try {
                    await signOut(auth);
                  } catch (err) {
                    console.error(err);
                  }
                }}
                className={`w-full py-2 border rounded-lg text-xs hover:opacity-90 active:scale-98 transition-all cursor-pointer font-bold ${
                  theme === 'dark'
                    ? 'border-slate-850 text-slate-400 hover:bg-slate-850/50'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Cancelar e Sair
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (isLoggedIn && !currentUser) {
    return (
      <div className={`min-h-screen ${theme === 'dark' ? 'bg-slate-950 text-slate-400' : 'bg-slate-50 text-slate-600'} flex flex-col justify-center items-center font-sans`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="mt-4 text-xs font-mono">Carregando perfil de acesso...</p>
      </div>
    );
  }

  // Sidebar link generator helper
  const renderNavLinks = (onItemClick?: () => void) => {
    const links = [
      { page: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
      { page: 'dfds', label: 'DFDs (PCA)', icon: <FileText className="w-4 h-4" />, count: dfds.length },
      { page: 'orcamento', label: 'Orçamento Atual', icon: <DollarSign className="w-4 h-4" /> },
      { page: 'planejamentos', label: 'Planejamentos SEI', icon: <Layers className="w-4 h-4" />, count: planejamentos.length },
      { page: 'kanban', label: 'Kanban de Progresso', icon: <ListTodo className="w-4 h-4" /> },
      { page: 'contratos', label: 'Contratos & Aditivos', icon: <Handshake className="w-4 h-4" />, count: contratos.length },
      { page: 'presencial', label: 'Presença GECTI', icon: <CalendarRange className="w-4 h-4" />, highlight: true },
      { page: 'normativos', label: 'Normativos & FAQ', icon: <Scale className="w-4 h-4" /> },
      ...(currentUser?.role === 'GECTI' ? [{ page: 'usuarios', label: 'Gerenciar Usuários', icon: <Users className="w-4 h-4" />, count: users.length }] : []),
    ];

    return links.map(link => {
      const isSelected = activePage === link.page;
      return (
        <button
          key={link.page}
          onClick={() => {
            setActivePage(link.page as any);
            setShortcutPlanejamentoId(null);
            if (onItemClick) onItemClick();
          }}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all duration-300 cursor-pointer overflow-hidden group ${
            isSelected 
              ? 'bg-primary/10 border-l-2 border-primary text-primary' 
              : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
          }`}
          title={sidebarCollapsed && !onItemClick ? link.label : undefined}
        >
          <div className="flex items-center gap-3 min-w-0 pr-1 flex-1">
            <span className={`shrink-0 transition-transform duration-300 ${isSelected ? "text-primary scale-110" : "text-on-surface-variant/70 group-hover:scale-110"}`}>
              {link.icon}
            </span>
            <span className={`truncate whitespace-nowrap transition-all duration-500 ease-in-out ${
              sidebarCollapsed && !onItemClick 
                ? 'opacity-0 max-w-0 -translate-x-2 pointer-events-none' 
                : 'opacity-100 max-w-[150px] translate-x-0'
            }`}>
              {link.label}
            </span>
          </div>
          {link.count !== undefined && (
            <span className={`bg-surface-container text-on-surface text-[10px] px-1.5 py-0.25 rounded font-mono shrink-0 transition-all duration-500 ease-in-out ${
              sidebarCollapsed && !onItemClick
                ? 'opacity-0 max-w-0 p-0 scale-75 overflow-hidden pointer-events-none'
                : 'opacity-100 max-w-[40px] scale-100'
            }`}>
              {link.count}
            </span>
          )}
        </button>
      );
    });
  };

  return (
    <div className="flex h-screen overflow-hidden text-sans bg-surface-container-lowest">
      
      {/* Mobile Drawer (Overlay backdrop) */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar (Drawer panel) */}
      <aside className={`fixed inset-y-0 left-0 bg-surface w-68 border-r border-outline flex flex-col justify-between z-40 transition-all duration-300 md:hidden ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-5 border-b border-outline">
          <div className="flex justify-between items-center w-full">
            <ContraticsLogo theme={theme} variant="sidebar" />
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 text-on-surface hover:bg-surface-container rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          {renderNavLinks(() => setMobileMenuOpen(false))}
        </nav>

        <div className="p-4 border-t border-outline bg-surface-container/30 space-y-3">
          <button
            onClick={async () => {
              setIsLoggedIn(false);
              setMobileMenuOpen(false);
              localStorage.setItem('contratics_is_logged_in', 'false');
              try {
                await signOut(auth);
              } catch (err) {
                console.error(err);
              }
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold text-rose-500 hover:bg-rose-500/10 cursor-pointer transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair / Logout</span>
          </button>
          <div className="text-[9px] text-on-surface-variant/60 font-mono text-center">
            Planejamento TIC SOF &bull; v1.2
          </div>
        </div>
      </aside>

      {/* Sidebar Navigation Rail (Desktop) with elegant fluid transitions */}
      <aside className={`bg-surface border-r border-outline flex flex-col justify-between shrink-0 font-sans z-20 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] relative ${
        sidebarCollapsed ? 'w-20' : 'w-68'
      } hidden md:flex`}>
        
        {/* Collapse Handle Button */}
        <button
          onClick={handleToggleSidebar}
          className="absolute -right-3.5 top-20 bg-surface border border-outline rounded-full p-1.5 text-on-surface-variant hover:text-primary hover:border-primary hover:scale-110 z-30 transition-all duration-300 cursor-pointer shadow-lg active:scale-95 text-primary"
          title={sidebarCollapsed ? "Expandir Menu Lateral" : "Recolher Menu Lateral"}
          aria-label={sidebarCollapsed ? "Expandir Menu" : "Recolher Menu"}
        >
          <ChevronRight size={13} className={`transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${sidebarCollapsed ? 'rotate-0' : 'rotate-180'}`} />
        </button>

        {/* Brand visual header */}
        <div className={`${sidebarCollapsed ? 'p-3 flex justify-center' : 'p-5'} border-b border-outline transition-all duration-500 ease-in-out overflow-hidden`} data-tour="brand-logo">
          <ContraticsLogo theme={theme} variant="sidebar" collapsed={sidebarCollapsed} />
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto custom-scrollbar transition-all duration-500" data-tour="sidebar-nav">
          {renderNavLinks()}
        </nav>

        {/* Logout bar */}
        <div className="p-4 border-t border-outline bg-surface-container/30 transition-all duration-500 overflow-hidden">
          <div>
            <button
              onClick={async () => {
                setIsLoggedIn(false);
                localStorage.setItem('contratics_is_logged_in', 'false');
                try {
                  await signOut(auth);
                } catch (err) {
                  console.error(err);
                }
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold text-rose-500 hover:bg-rose-500/10 cursor-pointer transition-all duration-300 overflow-hidden group"
              title={sidebarCollapsed ? "Sair do Sistema" : undefined}
            >
              <LogOut className="w-4 h-4 shrink-0 transition-transform duration-300 group-hover:scale-110" />
              <span className={`truncate whitespace-nowrap transition-all duration-500 ease-in-out ${
                sidebarCollapsed 
                  ? 'opacity-0 max-w-0 -translate-x-2 pointer-events-none' 
                  : 'opacity-100 max-w-[150px] translate-x-0'
              }`}>
                Sair / Logout
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Wrapper Container */}
      <div className="flex-1 h-screen flex flex-col overflow-hidden max-w-full">
        
        {/* Main top header with actor authorization switcher */}
        <header className="h-16 border-b border-outline bg-surface px-4 md:px-6 flex justify-between items-center shrink-0 font-sans z-10 w-full">
          <div className="flex items-center gap-3">
            <button
               onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 text-on-surface bg-surface-container-low border border-outline-variant rounded-lg md:hidden hover:bg-surface-container transition-all cursor-pointer"
              title="Abrir Menu"
            >
              <Menu className="w-5 h-5 text-primary" />
            </button>
            <h2 className="text-sm font-semibold tracking-tight text-on-surface flex items-center gap-2">
              <span className="hidden sm:inline">Secretaria de Orçamento Federal (SOF)</span>
              <span className="sm:hidden font-bold">SOF</span>
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Tutorial Guiado & Tutorials Hub Button */}
            <button
              onClick={() => setIsManualHubOpen(true)}
              className="px-2.5 py-1.5 md:px-3 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 hover:border-amber-500/60 text-amber-400 hover:text-amber-300 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-xs"
              title="Tutorial Guiado & Hub de Tutoriais"
              data-tour="header-manual"
            >
              <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="hidden sm:inline">Tutorial Guiado</span>
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-1.5 md:p-2 bg-surface-container-low border border-outline-variant/65 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-all cursor-pointer flex items-center justify-center relative active:scale-95"
              title={theme === 'dark' ? "Ativar Modo Claro" : "Ativar Modo Escuro"}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-500" />
              )}
            </button>

            {/* Interactive actor authorization picker */}
            <div className="flex items-center gap-1.5 bg-surface-container-low border border-outline-variant/60 p-1 px-2.5 rounded-lg" data-tour="header-profile">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider hidden md:inline">Perfil:</span>
              {currentUser?.role === 'GECTI' ? (
                <select
                  value={currentUser?.id || ''}
                  onChange={e => handleSwitchUser(e.target.value)}
                  className="bg-transparent text-xs text-on-surface font-semibold outline-none border-none select-none cursor-pointer max-w-[130px] sm:max-w-[180px] truncate text-primary"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id} className="bg-surface text-on-surface">
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-on-surface font-semibold max-w-[130px] sm:max-w-[180px] truncate text-primary py-0.5">
                  {currentUser?.name} ({currentUser?.role})
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Inner Body Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar relative">
          
          {activePage === 'dashboard' && (
            <div className="space-y-6 w-full max-w-none mx-auto font-sans animate-in fade-in duration-150">
              
              {/* Dashboard header greeting banner */}
              <div className="bg-surface border border-outline rounded-2xl p-5 sm:p-6 md:p-7 relative overflow-hidden flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 shadow">
                <div className="space-y-1.5 z-10 max-w-xl">
                  <h3 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight font-display">Visão Geral das Contratações de TIC da SOF</h3>
                  <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">Acompanhamento dos DFDs, processos e contratos</p>
                </div>
                
                {/* Visual statistics pills */}
                <div className="flex flex-col sm:flex-row sm:flex-wrap xl:flex-nowrap gap-4 w-full xl:w-auto z-10 text-xs">
                  {/* Select Year Filter */}
                  <div className="bg-surface-container border border-outline-variant/60 rounded-xl p-3.5 flex flex-col justify-between h-20 w-full sm:flex-1 sm:min-w-[170px] xl:w-[200px] xl:flex-none" data-tour="year-selector">
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant flex items-center gap-1.5 leading-none">
                      <CalendarRange className="w-3.5 h-3.5 text-primary shrink-0" /> 
                      Ano de Referência (PCA)
                    </span>
                    <select
                      value={selectedYear}
                      onChange={(e) => {
                        setSelectedYear(e.target.value);
                      }}
                      className="w-full bg-surface-container-low text-primary text-xs font-bold font-sans cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/25 rounded border border-outline-variant px-2 py-1 outline-none font-mono"
                    >
                      <option value="2024" className="bg-surface text-on-surface">2024 (Histórico)</option>
                      <option value="2025" className="bg-surface text-on-surface">2025 (Transição)</option>
                      <option value="2026" className="bg-surface text-on-surface">2026 (Corrente)</option>
                      <option value="2027" className="bg-surface text-on-surface">2027 (Planejado)</option>
                      <option value="2028" className="bg-surface text-on-surface">2028 (Futuro)</option>
                    </select>
                  </div>

                  {/* UASG card */}
                  <div className="bg-surface-container border border-outline-variant/60 rounded-xl p-3.5 flex flex-col justify-between h-20 w-full sm:flex-1 sm:min-w-[150px] xl:w-[170px] xl:flex-none">
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant block leading-none">UASG Geral</span>
                    <div>
                      <strong className="text-on-surface text-sm sm:text-base font-mono block leading-none">201007 (MPO)</strong>
                      <span className="text-[9px] text-on-surface-variant/80 block mt-1">SOF / Planejamento</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fluxo Macrogrupo de Contratações de TIC (Interactive Stepper) */}
              <div className="bg-surface-container border border-outline-variant/60 rounded-2xl p-5 md:p-6 shadow">
                <div className="flex items-center gap-2 mb-4 border-b border-outline-variant/20 pb-3">
                  <div className="p-1 bg-primary/10 rounded-lg text-primary">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs uppercase font-extrabold text-on-surface tracking-wider font-display">Macrofluxo do Processo de Contratação GECTI</h4>
                    <p className="text-[10px] text-on-surface-variant">Clique em cada etapa para detalhar os processos ativos em andamento.</p>
                  </div>
                </div>

                <div className="flex flex-col lg:flex-row items-stretch justify-between gap-4 lg:gap-2">
                  
                  {/* Step 1: Planejamento */}
                  <div 
                    onClick={() => setFlowModalStage('planejamento')}
                    className="flex-1 bg-surface-container-low border border-outline-variant hover:border-blue-400/55 rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[9px] font-bold text-blue-400 bg-blue-500/15 px-2 py-0.5 rounded border border-blue-500/10">Etapa 1 - Fase Interna</span>
                        <strong className="text-xs font-bold text-blue-400 font-mono">
                          {planejamentos.filter(p => p.Status_Planejamento === 'Em Elaboração').length} ativos
                        </strong>
                      </div>
                      <h5 className="text-xs font-bold text-on-surface group-hover:text-blue-400 transition-colors">Planejamento da Contratação</h5>
                      <p className="text-[10px] text-on-surface-variant leading-tight mt-1">Estudos Técnicos (ETP), Termo de Referência (TR), Pesquisa de Preços e Mapa de Riscos.</p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-outline-variant/20 flex items-center justify-between text-[9px] text-blue-400 font-semibold">
                      <span>Ver processos em elaboração</span>
                      <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>

                  {/* Connector Arrow */}
                  <div className="hidden lg:flex items-center justify-center text-on-surface-variant/40 px-1">
                    <ChevronRight className="w-5 h-5" />
                  </div>

                  {/* Step 2: Seleção de Fornecedor */}
                  <div 
                    onClick={() => setFlowModalStage('selecao')}
                    className="flex-1 bg-surface-container-low border border-outline-variant hover:border-amber-400/55 rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[9px] font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/10">Etapa 2 - Fase Externa</span>
                        <strong className="text-xs font-bold text-amber-400 font-mono">
                          {planejamentos.filter(p => p.Status_Planejamento === 'Seleção Fornecedor').length} ativos
                        </strong>
                      </div>
                      <h5 className="text-xs font-bold text-on-surface group-hover:text-amber-400 transition-colors">Seleção de Fornecedor</h5>
                      <p className="text-[10px] text-on-surface-variant leading-tight mt-1">Processo licitatório, análise de propostas, lances, julgamento e adjudicação do objeto.</p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-outline-variant/20 flex items-center justify-between text-[9px] text-amber-400 font-semibold">
                      <span>Ver licitações em curso</span>
                      <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>

                  {/* Connector Arrow */}
                  <div className="hidden lg:flex items-center justify-center text-on-surface-variant/40 px-1">
                    <ChevronRight className="w-5 h-5" />
                  </div>

                  {/* Step 3: Gestão do Contrato */}
                  <div 
                    onClick={() => setFlowModalStage('contrato')}
                    className="flex-1 bg-surface-container-low border border-outline-variant hover:border-emerald-400/55 rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] group flex flex-col justify-between relative"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/10">Etapa 3 - Execução</span>
                        <div className="flex items-center gap-1.5">
                          {expiringContracts.length > 0 && (
                            <span className="text-[9px] font-bold text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded border border-rose-500/20 flex items-center gap-1" title="Vigência encerrando em menos de 180 dias">
                              <Clock className="w-2.5 h-2.5 text-rose-400 animate-pulse" />
                              {expiringContracts.length} a vencer
                            </span>
                          )}
                          <strong className="text-xs font-bold text-emerald-400 font-mono">
                            {contratos.length} ativos
                          </strong>
                        </div>
                      </div>
                      <h5 className="text-xs font-bold text-on-surface group-hover:text-emerald-400 transition-colors">Gestão do Contrato</h5>
                      <p className="text-[10px] text-on-surface-variant leading-tight mt-1">Assinatura do contrato, empenho de recursos, ordens de serviço, liquidação e pagamentos.</p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-outline-variant/20 flex items-center justify-between text-[9px] text-emerald-400 font-semibold">
                      <span>Ver contratos em execução</span>
                      <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>

                </div>
              </div>

              {/* Bloco Destaque 1: Valores Financeiros e Orçamentários Consolidados do Exercício */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-1.5 h-4 bg-primary rounded-full" />
                  <h4 className="text-xs uppercase font-extrabold text-on-surface tracking-wider font-display">
                    Consolidação Orçamentária e Financeira ({selectedYear === 'Todos' ? 'Geral' : selectedYear})
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* 1. Total Anualizado dos Contratos */}
                  <ReUICard hoverGlow={true} className="p-5 flex flex-col justify-between h-full bg-surface border border-outline-variant rounded-2xl relative overflow-hidden group">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant block mb-1">
                          Total Anualizado Contratos
                        </span>
                        <strong className="text-xl sm:text-2xl font-black font-mono text-on-surface block tracking-tight">
                          {formatCurrency(totalContratosComSOFAval)}
                        </strong>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <Handshake className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="pt-3 border-t border-outline-variant/30 mt-4 text-[10px] text-on-surface-variant/85 leading-tight">
                      Anualizado considerando itens SOF ou DFDs vinculados e fallbacks (como na tela de contratos)
                    </div>
                  </ReUICard>

                  {/* 2. Valor Anual dos DFDs Ativos */}
                  <ReUICard hoverGlow={true} className="p-5 flex flex-col justify-between h-full bg-surface border border-outline-variant rounded-2xl relative overflow-hidden group">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant block mb-1">
                          Valor Anual DFDs Ativos
                        </span>
                        <strong className="text-xl sm:text-2xl font-black font-mono text-on-surface block tracking-tight">
                          {formatCurrency(totalDFDAtivosSum)}
                        </strong>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="pt-3 border-t border-outline-variant/30 mt-4 text-[10px] text-teal-600 dark:text-teal-400 font-medium leading-tight">
                      Soma de todos os DFDs não concluídos, considerando a periodicidade do pagamento
                    </div>
                  </ReUICard>

                  {/* 3. Valor Anual Geral SOF (Em Destaque Especial) */}
                  <div className="p-5 flex flex-col justify-between h-full bg-gradient-to-br from-primary/15 via-primary/5 to-teal-500/10 border-2 border-primary/50 hover:border-primary/80 rounded-2xl relative overflow-hidden group shadow-md transition-all">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/15 rounded-full blur-xl group-hover:bg-primary/25 transition-all pointer-events-none"></div>
                    <div className="flex items-start justify-between gap-3 z-10">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] uppercase font-black tracking-widest text-primary block">
                            Valor Anual Geral SOF
                          </span>
                          <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-[8px] font-bold rounded uppercase font-mono">
                            Destaque
                          </span>
                        </div>
                        <strong className="text-2xl sm:text-3xl font-black font-mono text-primary block tracking-tight">
                          {formatCurrency(valorAnualGeralSOFVal)}
                        </strong>
                      </div>
                      <div className="w-11 h-11 rounded-2xl bg-primary text-on-primary flex items-center justify-center shrink-0 shadow-sm shadow-primary/30">
                        <Landmark className="w-6 h-6 animate-pulse" />
                      </div>
                    </div>
                    <div className="pt-3 border-t border-primary/20 mt-4 text-[10px] text-on-surface-variant font-medium z-10 leading-relaxed truncate" title={`Soma de Contratos Anualizados (${formatCurrency(totalContratosComSOFAval)}) + DFDs Ativos (${formatCurrency(totalDFDAtivosSum)})`}>
                      * Contratos ({formatCurrency(totalContratosComSOFAval)}) + DFDs ({formatCurrency(totalDFDAtivosSum)})
                    </div>
                  </div>
                </div>
              </div>

              {/* Custeio vs Investimento & Histórico Ano a Ano (Ação 8861) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Donut Chart: Custeio vs Investimento do Ano Selecionado (Col Span 5) */}
                <div className="lg:col-span-5 bg-surface-container border border-outline-variant/60 rounded-xl p-5 flex flex-col justify-between shadow-md relative lg:order-2">
                  <div className="absolute top-3 right-3 bg-primary/10 border border-primary/20 text-primary text-[8px] font-bold px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">
                    {selectedYear} Corrente
                  </div>
                  <div>
                    <h4 className="text-xs uppercase font-bold text-on-surface-variant tracking-wider mb-4 flex items-center gap-1.5 font-display">
                      <span className="p-0.5 px-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold rounded-lg text-xs flex items-center justify-center font-mono">3/4</span>
                      Segregação de Despesas: Custeio vs Investimento ({selectedYear})
                    </h4>
                    
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-2">
                      <div className="w-full sm:w-1/2 h-44 relative flex items-center justify-center bg-surface-container-low/45 rounded-xl border border-outline-variant/20 p-2">
                        {dashboardTotalCusteio + dashboardTotalInvestimento === 0 ? (
                          <span className="text-[10px] text-on-surface-variant italic text-center p-2">Nenhum valor planejado para {selectedYear}.</span>
                        ) : (
                          <div className="w-full h-full relative flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={[
                                    { name: 'Custeio (GND 3)', value: dashboardTotalCusteio },
                                    { name: 'Investimento (GND 4)', value: dashboardTotalInvestimento }
                                  ]}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={45}
                                  outerRadius={65}
                                  paddingAngle={3}
                                  dataKey="value"
                                >
                                  <Cell key="custeio" fill="#3b82f6" />
                                  <Cell key="investimento" fill="#10b981" />
                                </Pie>
                                <Tooltip
                                  formatter={(value: any) => [formatCurrency(Number(value)), '']}
                                  contentStyle={{ 
                                    backgroundColor: '#090d16', 
                                    borderColor: '#334155', 
                                    borderRadius: '8px',
                                    color: '#f8fafc',
                                    fontSize: '11px'
                                  }}
                                  itemStyle={{ color: '#ffffff', padding: '0px' }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute flex flex-col items-center justify-center pointer-events-none mt-0.5">
                              <span className="text-[8px] uppercase font-bold text-on-surface-variant/80 tracking-wider">Custeio</span>
                              <strong className="text-xs font-bold text-blue-400 font-mono">
                                {dashboardTotalCusteio + dashboardTotalInvestimento > 0 
                                  ? `${((dashboardTotalCusteio / (dashboardTotalCusteio + dashboardTotalInvestimento)) * 100).toFixed(0)}%` 
                                  : '0%'}
                              </strong>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="w-full sm:w-1/2 space-y-2 text-xs bg-surface-container-low/60 border border-outline-variant/30 p-3 rounded-xl">
                        <div className="flex items-center justify-between pb-1 border-b border-outline-variant/10">
                          <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">GND</span>
                          <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Valor Estimado</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-[11px] text-on-surface-variant">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            <span>Custeio (GND 3)</span>
                          </div>
                          <span className="font-semibold text-on-surface font-mono text-[11px]">{formatCurrency(dashboardTotalCusteio)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-[11px] text-on-surface-variant">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span>Investimento (GND 4)</span>
                          </div>
                          <span className="font-semibold text-on-surface font-mono text-[11px]">{formatCurrency(dashboardTotalInvestimento)}</span>
                        </div>
                        <div className="pt-1.5 border-t border-outline-variant/40 flex justify-between items-center text-[10px] text-on-surface font-semibold">
                          <span>Total Geral SOF:</span>
                          <strong className="font-mono text-primary">{formatCurrency(dashboardTotalCusteio + dashboardTotalInvestimento)}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bar Chart: Histórico Ano a Ano de Limites SIOP Ação 8861 (Col Span 7) */}
                <div className="lg:col-span-7 bg-surface-container border border-outline-variant/60 rounded-xl p-5 flex flex-col justify-between shadow-md lg:order-1">
                  <div>
                    <h4 className="text-xs uppercase font-bold text-on-surface-variant tracking-wider mb-4 flex items-center gap-1.5 font-display">
                      <TrendingUp className="text-primary w-4 h-4" />
                      Histórico SIOP da Ação 8861 (Custeio vs Investimento Ano a Ano)
                    </h4>
                    
                    <div className="h-44 text-sans w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={['2024', '2025', '2026', '2027', '2028'].map(yr => {
                          const docId = yr === '2026' ? '8861_2026' : `8861_${yr}`;
                          let record = siopRecords.find(r => r.id === docId);
                          if (!record && yr === '2026') {
                            record = siopRecords.find(r => r.id === '8861');
                          }
                          const recCusteio = record ? (record.dotacaoAtualCusteio !== undefined && record.dotacaoAtualCusteio !== null ? record.dotacaoAtualCusteio : (record.dotacaoInicialCusteio || 0)) : 0;
                          const recInvestimento = record ? (record.dotacaoAtualInvestimento !== undefined && record.dotacaoAtualInvestimento !== null ? record.dotacaoAtualInvestimento : (record.dotacaoInicialInvestimento || 0)) : 0;
                          
                          let custeio = recCusteio;
                          let investimento = recInvestimento;
                          
                          if (custeio === 0 && investimento === 0) {
                            const dynamicVals = getDynamicCusteioAndInvestimentoForYear(parseInt(yr));
                            custeio = dynamicVals.custeio;
                            investimento = dynamicVals.investimento;
                          }
                          
                          return {
                            year: yr,
                            Custeio: custeio,
                            Investimento: investimento
                          };
                        })} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                          <XAxis dataKey="year" stroke="#94a3b8" fontSize={9} tickLine={false} />
                          <YAxis 
                            stroke="#94a3b8" 
                            fontSize={9} 
                            tickLine={false} 
                            tickFormatter={(val) => val >= 1000000 ? `R$ ${(val / 1000000).toFixed(1)}M` : `R$ ${(val / 1000).toFixed(0)}k`} 
                          />
                          <Tooltip 
                            formatter={(value: any, name: string) => [formatCurrency(Number(value)), name]}
                            contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', borderRadius: '8px' }}
                            labelStyle={{ color: '#ffffff', fontSize: '10px', fontWeight: 'bold' }}
                            itemStyle={{ fontSize: '10px' }}
                            cursor={{ fill: 'transparent' }}
                          />
                          <Legend wrapperStyle={{ fontSize: '9px', paddingTop: '5px' }} />
                          <Bar dataKey="Custeio" fill="#3b82f6" stackId="a" radius={[2, 2, 0, 0]} name="Custeio (GND 3)" />
                          <Bar dataKey="Investimento" fill="#10b981" stackId="a" radius={[2, 2, 0, 0]} name="Investimento (GND 4)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              {/* ICTI Index Historical Series & Table - Dashboard Widget */}
              <div className="bg-surface-container border border-outline-variant/60 rounded-2xl p-5 md:p-6 shadow space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-outline-variant/20 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-on-surface font-display">Acompanhamento do Índice de Custos de TI (ICTI)</h4>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                          ictiSource === 'api' 
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                            : ictiSource === 'cache'
                            ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            ictiSource === 'api' ? 'bg-emerald-400 animate-pulse' : ictiSource === 'cache' ? 'bg-sky-400' : 'bg-amber-400'
                          }`}></span>
                          {ictiSource === 'api' ? 'API ao vivo (Ipeadata)' : ictiSource === 'cache' ? 'Cache Local Sincronizado' : 'Base Auditada Oficial'}
                        </span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant">Série histórica oficial consolidada e auditada pelo Ipea/Ipeadata (séries DIMAC12) para reajuste de contratos de tecnologia.</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fetchICTI(true)}
                      disabled={ictiLoading}
                      className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant hover:border-amber-400/50 text-on-surface rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
                      title="Sincronizar com os servidores do Ipeadata agora"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${ictiLoading ? 'animate-spin' : ''}`} />
                      <span>{ictiLoading ? 'Sincronizando...' : 'Atualizar com Ipea'}</span>
                    </button>

                    <button
                      onClick={() => {
                        setIctiCalculatorContractId('');
                        setIsIctiCalculatorOpen(true);
                      }}
                      className="px-3.5 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 hover:border-amber-500/60 text-amber-400 hover:text-amber-300 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm active:scale-95 cursor-pointer"
                      data-tour="btn-icti"
                    >
                      <Calculator className="w-4 h-4 text-amber-400" />
                      <span>Calculadora do ICTI</span>
                    </button>

                    {ictiLatest && (
                      <div className="flex items-center gap-2 text-right">
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Última divulgação oficial: <strong className="font-mono text-[11px]">{ictiLatest.value.toFixed(2)}%</strong> ({(() => {
                            try {
                              const d = new Date(ictiLatest.date);
                              return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
                            } catch { return '—'; }
                          })()})
                          {ictiLatestIndex && (
                            <span className="text-on-surface-variant font-normal ml-1">
                              | Índice: <strong className="font-mono text-on-surface">{ictiLatestIndex.value.toFixed(4)}</strong>
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                  {/* Left Column: Recharts Area Chart */}
                  <div className="lg:col-span-7 bg-surface-container-low border border-outline-variant/30 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block">
                          Curva de Variação Acumulada nos Últimos 12 Meses (DIMAC12_ICTI1)
                        </span>
                        {ictiLastUpdated && (
                          <span className="text-[9px] text-on-surface-variant/70 font-mono">
                            Sincronizado: {new Date(ictiLastUpdated).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      {ictiLoading ? (
                        <div className="h-56 flex flex-col items-center justify-center text-xs text-on-surface-variant italic gap-2">
                          <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
                          <span>Consultando dados no Ipeadata...</span>
                        </div>
                      ) : (
                        <div className="h-56 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={ictiData.slice(-12)} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                              <defs>
                                <linearGradient id="colorDashboardIcti" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#d97706" stopOpacity={0.35}/>
                                  <stop offset="95%" stopColor="#d97706" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                              <XAxis 
                                dataKey="date" 
                                stroke="#94a3b8" 
                                fontSize={9} 
                                tickLine={false}
                                tickFormatter={(str) => {
                                  try {
                                    const d = new Date(str);
                                    return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
                                  } catch { return str; }
                                }}
                              />
                              <YAxis 
                                stroke="#94a3b8" 
                                fontSize={9} 
                                tickLine={false} 
                                tickFormatter={(v) => `${v}%`}
                              />
                              <Tooltip
                                contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '8px' }}
                                labelStyle={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}
                                itemStyle={{ color: '#fbbf24', fontSize: 11 }}
                                labelFormatter={(str) => {
                                  try {
                                    const d = new Date(str);
                                    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
                                  } catch { return str; }
                                }}
                                formatter={(value: any) => [`${Number(value).toFixed(2)}%`, 'Variação acumulada (12m)']}
                              />
                              <Area type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#colorDashboardIcti)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Historical Table */}
                  <div className="lg:col-span-5 bg-surface-container-low border border-outline-variant/30 rounded-xl p-4 flex flex-col justify-between font-sans">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block">
                          Tabela de Índices Divulgados (Últimos 12 Meses)
                        </span>
                        <span className="text-[9px] text-amber-400 font-mono font-bold">
                          {ictiData.length > 0 ? `${ictiData.length} registros` : ''}
                        </span>
                      </div>
                      {ictiLoading ? (
                        <div className="h-56 flex flex-col items-center justify-center text-xs text-on-surface-variant italic gap-2">
                          <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
                          <span>Atualizando tabela...</span>
                        </div>
                      ) : (
                        <div className="overflow-hidden rounded-lg border border-outline-variant/30">
                          <div className="max-h-56 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-surface-container/80 sticky top-0 border-b border-outline-variant/30 text-[9px] uppercase font-bold text-on-surface-variant tracking-wider">
                                  <th className="px-3 py-2">Mês/Ano</th>
                                  <th className="px-2 py-2 text-right">Mensal</th>
                                  <th className="px-2 py-2 text-right">Acum. 12m</th>
                                  <th className="px-3 py-2 text-right">Nº Índice</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-outline-variant/25 font-mono text-[11px]">
                                {ictiData.slice(-12).reverse().map((item, idx) => {
                                  try {
                                    const d = new Date(item.date);
                                    const mesAno = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' });
                                    const isLatestRow = idx === 0;
                                    const ym = item.yearMonth || String(item.date).substring(0, 7);
                                    const matchingIndex = ictiIndexData.find(i => (i.yearMonth || String(i.date).substring(0, 7)) === ym);
                                    const matchingMensal = ictiMensalData.find(m => (m.yearMonth || String(m.date).substring(0, 7)) === ym);

                                    return (
                                      <tr key={idx} className={`hover:bg-surface-container/50 transition-colors ${isLatestRow ? 'bg-amber-500/10' : ''}`}>
                                        <td className="px-3 py-1.5 text-on-surface font-sans capitalize flex items-center gap-1.5">
                                          {isLatestRow && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block"></span>}
                                          <span>{mesAno}</span>
                                        </td>
                                        <td className="px-2 py-1.5 text-right font-medium text-on-surface-variant">
                                          {matchingMensal ? `${matchingMensal.value >= 0 ? '+' : ''}${matchingMensal.value.toFixed(2)}%` : '—'}
                                        </td>
                                        <td className="px-2 py-1.5 text-right font-bold text-amber-400">
                                          {item.value.toFixed(2)}%
                                        </td>
                                        <td className="px-3 py-1.5 text-right font-medium text-on-surface">
                                          {matchingIndex ? matchingIndex.value.toFixed(4) : '—'}
                                        </td>
                                      </tr>
                                    );
                                  } catch {
                                    return null;
                                  }
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Graphical Analysis with Recharts */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Pie Chart: Execução Orçamentária Global - Prominent (Col Span 7) */}
                <div className="lg:col-span-7 bg-surface-container border-2 border-primary/20 rounded-xl p-5 flex flex-col justify-between shadow-md relative">
                  <div className="absolute top-3 right-3 bg-primary/10 border border-primary/20 text-primary text-[8px] font-bold px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">
                    {selectedYear} Corrente
                  </div>
                  <div>
                    <h4 className="text-sm uppercase font-bold text-on-surface tracking-wider mb-1 flex items-center gap-1.5 font-display">
                      <span className="p-0.5 px-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold rounded-lg text-xs flex items-center justify-center font-mono">R$</span>
                      Execução Orçamentária dos Contratos — Empenhos Globais ({selectedYear})
                    </h4>
                    <p className="text-[10px] text-on-surface-variant mb-4">
                      Valores globais apurados exclusivamente sobre os <strong>itens de responsabilidade da SOF</strong> em cada contrato.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mt-2">
                      {/* Left: Recharts Donut Pie Chart (Gráfico de rosca) */}
                      <div className="w-full sm:w-1/2 h-52 relative flex items-center justify-center bg-surface-container-low/45 rounded-xl border border-outline-variant/30 p-4">
                        {globalFinancialChartData.length === 0 ? (
                          <span className="text-xs text-on-surface-variant italic text-center p-4">Nenhum pagamento ou empenho lançado para o ano de {selectedYear}.</span>
                        ) : (
                          <div className="w-full h-full relative flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={globalFinancialChartData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={50}
                                  outerRadius={75}
                                  paddingAngle={4}
                                  dataKey="value"
                                >
                                  {globalFinancialChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip
                                  formatter={(value: any) => [formatCurrency(Number(value)), '']}
                                  contentStyle={{ 
                                    backgroundColor: '#090d16', 
                                    borderColor: '#334155', 
                                    borderRadius: '8px',
                                    color: '#f8fafc',
                                    fontSize: '11px'
                                  }}
                                  itemStyle={{ color: '#ffffff', padding: '0px' }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                            
                            {/* Center label inside the donut chart */}
                            <div className="absolute flex flex-col items-center justify-center pointer-events-none mt-0.5">
                              <span className="text-[9px] uppercase font-bold text-on-surface-variant/80 tracking-wider font-sans">Pago (Itens SOF)</span>
                              <strong className="text-sm font-bold text-emerald-400 font-mono">
                                {totalEmpenhadoGlobal > 0 
                                  ? `${((totalPagoGlobal / totalEmpenhadoGlobal) * 100).toFixed(0)}%` 
                                  : '0%'}
                              </strong>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right: Detailed Value List */}
                      <div className="w-full sm:w-1/2 space-y-3 text-xs bg-surface-container-low/60 border border-outline-variant/45 p-4 rounded-xl">
                        <div className="flex items-center justify-between pb-1 border-b border-outline-variant/10">
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Status Execução</span>
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Valor Acumulado</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-on-surface-variant text-[11px]">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#eab308]"></span>
                            <div>
                              <span>Empenhado (Itens SOF)</span>
                              <span className="block text-[8px] opacity-70">Reserva de orçamento SOF</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold text-on-surface font-mono text-[11px] block">{formatCurrency(totalEmpenhadoGlobal)}</span>
                            <span className="text-[9px] text-amber-400 font-bold font-mono">100% base</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-on-surface-variant text-[11px]">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]"></span>
                            <div>
                              <span>Liquidado (Itens SOF)</span>
                              <span className="block text-[8px] opacity-70">Executado e atestado</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold text-on-surface font-mono text-[11px] block">{formatCurrency(totalLiquidadoGlobal)}</span>
                            <span className="text-[9px] text-blue-400 font-bold font-mono">
                              {totalEmpenhadoGlobal > 0 ? ((totalLiquidadoGlobal / totalEmpenhadoGlobal) * 100).toFixed(0) : 0}% conv.
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-on-surface-variant text-[11px]">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]"></span>
                            <div>
                              <span>Pago (Itens SOF)</span>
                              <span className="block text-[8px] opacity-70">Desembolso financeiro</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold text-on-surface font-mono text-[11px] block">{formatCurrency(totalPagoGlobal)}</span>
                            <span className="text-[9px] text-emerald-400 font-bold font-mono">
                              {totalEmpenhadoGlobal > 0 ? ((totalPagoGlobal / totalEmpenhadoGlobal) * 100).toFixed(0) : 0}% conv.
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-outline-variant flex justify-between items-center text-[11px] text-on-surface font-semibold">
                          <span>Total lançado em {selectedYear}:</span>
                          <strong className="font-mono text-[11px] text-primary">{formatCurrency(totalEmpenhadoGlobal)}</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 text-[10px] text-on-surface-variant italic leading-tight">
                    * Os valores acima correspondem aos empenhos globais dos contratos e referem-se exclusivamente aos itens sob responsabilidade da SOF no exercício de {selectedYear}.
                  </div>
                </div>

                {/* Historical General SOF vs Empenhado bar charts (Col Span 5) */}
                <div className="lg:col-span-5 bg-surface-container-low border border-outline-variant rounded-xl p-5 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs uppercase font-bold text-on-surface-variant tracking-wider mb-1 flex items-center gap-1.5 font-display">
                      <TrendingUp className="text-primary w-4 h-4" />
                      Histórico: Dotação Atual (SOF) vs Execução Orçamentária (Itens SOF)
                    </h4>
                    <p className="text-[10px] text-on-surface-variant mb-4">
                      Confronto entre a dotação atualizada (SIOP - Ação 8861) e a execução orçamentária (exclusivamente itens da SOF).
                    </p>
                    
                    <div className="h-60 text-sans w-full">
                      {historicalChartData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs text-on-surface-variant italic text-center p-6">Nenhum exercício orçamentário registrado.</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={historicalChartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis 
                              dataKey="exercicio" 
                              stroke="#94a3b8" 
                              fontSize={9} 
                              tickLine={false} 
                            />
                            <YAxis 
                              stroke="#94a3b8" 
                              fontSize={9} 
                              tickLine={false} 
                              tickFormatter={(val) => val >= 1000000 ? `R$ ${(val / 1000000).toFixed(1)}M` : `R$ ${(val / 1000).toFixed(0)}k`} 
                            />
                            <Tooltip 
                              formatter={(value: any, name: string) => {
                                return [formatCurrency(Number(value)), name];
                              }}
                              contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', borderRadius: '8px' }}
                              labelStyle={{ color: '#ffffff', fontSize: '10px', fontWeight: 'bold' }}
                              itemStyle={{ fontSize: '10px' }}
                              cursor={{ fill: 'transparent' }}
                            />
                            <Legend 
                              wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }}
                            />
                            <Bar dataKey="Dotação Atual SOF" fill="#38bdf8" radius={[4, 4, 0, 0]} name="Dotação Atual SOF" />
                            <Bar dataKey="Empenhado" fill="#fbbf24" radius={[4, 4, 0, 0]} name="Empenhado (Itens SOF)" />
                            <Bar dataKey="Liquidado" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Liquidado (Itens SOF)" />
                            <Bar dataKey="Pago" fill="#10b981" radius={[4, 4, 0, 0]} name="Pago (Itens SOF)" />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-on-surface-variant italic leading-tight">
                    * Execução apurada estritamente para itens da SOF em cada exercício confrontada com a Dotação da Ação 8861 no SIOP.
                  </div>
                </div>

              </div>

              {/* Dinâmica de Descentralizações Orçamentárias (Pregão Colaboragov: MPO ➔ MGI) */}
              <div data-tour="descentralizacao-panel" className="bg-surface-container-low border border-outline-variant rounded-xl p-5 space-y-4">
                {/* Header Row with title and info badge */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-outline-variant/40">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-on-surface flex items-center gap-2 font-display">
                        <ArrowRightLeft className="w-4 h-4 text-sky-400" />
                        Descentralizações Orçamentárias (Pregão Colaboragov — MPO ➜ MGI)
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        Exercício {selectedYear}
                      </span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant leading-tight mt-1">
                      Monitoramento exclusivo para contratos sob a modalidade <strong>Pregão Colaboragov</strong> (repasses de créditos ao MGI e apuração de sobras orçamentárias na SOF). Para as demais contratações da SOF, o próprio empenho formaliza a saída direta dos recursos.
                    </p>
                  </div>

                  {saldoSobraOrcamentariaColaboragov > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Saldo não cobrado: <strong className="font-mono">{formatCurrency(saldoSobraOrcamentariaColaboragov)}</strong></span>
                    </div>
                  )}
                </div>

                {/* 3 Main Information Cards: Deveria ser Descentralizado, Total Descentralizado e Saldo não cobrado */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Card 1: O quanto deveria ser descentralizado */}
                  <div className="bg-surface-container border border-outline-variant/60 rounded-xl p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-on-surface-variant mb-2">
                      <span className="text-[11px] uppercase font-bold tracking-wider text-amber-400/90">Deveria ser Descentralizado</span>
                      <FileCheck2 className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold font-mono text-amber-400">
                        {formatCurrency(totalEmpenhadoColaboragov)}
                      </div>
                      <p className="text-[10px] text-on-surface-variant mt-1.5 leading-relaxed">
                        Total empenhado e demandado nas OSs dos contratos do Pregão Colaboragov no exercício de {selectedYear}.
                      </p>
                    </div>
                  </div>

                  {/* Card 2: O quanto foi efetivamente descentralizado */}
                  <div className="bg-surface-container border border-outline-variant/60 rounded-xl p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-on-surface-variant mb-2">
                      <span className="text-[11px] uppercase font-bold tracking-wider text-sky-400/90">Total Descentralizado</span>
                      <ArrowRightLeft className="w-4 h-4 text-sky-400" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold font-mono text-sky-400">
                        {formatCurrency(totalDescentralizadoColaboragov)}
                      </div>
                      <p className="text-[10px] text-on-surface-variant mt-1.5 leading-relaxed">
                        Total formalmente repassado via Notas de Descentralização (SEI) ao órgão gerenciador (MGI) ({taxaDescentralizacaoColaboragov.toFixed(1)}% do demandado).
                      </p>
                    </div>
                  </div>

                  {/* Card 3: Saldo não cobrado (Diferença) */}
                  <div className="bg-surface-container border-2 border-emerald-500/30 rounded-xl p-4 flex flex-col justify-between bg-emerald-500/[0.03]">
                    <div className="flex items-center justify-between text-on-surface-variant mb-2">
                      <span className="text-[11px] uppercase font-bold tracking-wider text-emerald-400">Saldo não cobrado</span>
                      <CheckCircle2 className={`w-4 h-4 ${saldoSobraOrcamentariaColaboragov > 0 ? 'text-emerald-400' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <div className={`text-2xl font-bold font-mono ${saldoSobraOrcamentariaColaboragov > 0 ? 'text-emerald-400' : 'text-on-surface'}`}>
                        {formatCurrency(saldoSobraOrcamentariaColaboragov)}
                      </div>
                      <p className="text-[10px] text-on-surface-variant mt-1.5 leading-relaxed">
                        {saldoSobraOrcamentariaColaboragov > 0
                          ? 'Diferença (Deveria ser Descentralizado – Total Descentralizado) preservada no teto orçamentário da SOF sem cobrança pelo MGI.'
                          : 'Todo o montante demandado no Pregão Colaboragov já foi formalmente descentralizado ao MGI.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Compact Info Footer with Details */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 bg-surface-container/50 border border-outline-variant/30 rounded-lg text-xs text-on-surface-variant">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0"></span>
                    <span>Efetivamente descentralizado ao MGI: <strong className="font-mono text-on-surface font-bold">{formatCurrency(totalDescentralizadoColaboragov)}</strong> ({taxaDescentralizacaoColaboragov.toFixed(1)}% do total demandado)</span>
                  </div>
                  <div className="text-[10px] italic text-on-surface-variant/80">
                    * Os créditos só deixam o orçamento da SOF mediante Nota de Descentralização no SEI.
                  </div>
                </div>
              </div>



              {/* Quick Alerts Expiring widgets - Beautified Full Width Row */}
              <div className="bg-surface-container-low border border-outline-variant rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-on-surface flex items-center gap-2">
                      <AlertOctagon className="w-4 h-4 text-rose-400" />
                      Central de Avisos Preventivos (Vigência de Contratos)
                    </h4>
                    <p className="text-[11px] text-on-surface-variant leading-tight">Painel de expiração preventiva dos contratos ativos de TIC em andamento na GECTI.</p>
                  </div>
                  
                  {/* Threshold Filter Selector */}
                  <div className="flex bg-surface-container rounded-lg p-0.5 border border-outline-variant/40 min-w-[280px]">
                    {([30, 60, 90, 180] as const).map(th => {
                      const isActive = th === dashboardThreshold;
                      const hasAlerts = processedContratos.map(getDaysLeftForContract).filter(d => d >= -180 && d <= th).length > 0;
                      return (
                        <button
                          key={th}
                          type="button"
                          onClick={() => setDashboardThreshold(th)}
                          className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer relative ${
                            isActive
                              ? 'bg-primary text-on-primary shadow-xs'
                              : 'text-on-surface-variant hover:text-on-surface'
                          }`}
                        >
                          <span>{`${th} dias`}</span>
                          {hasAlerts && !isActive && (
                            <span className="absolute top-1 right-1 w-1 h-1 rounded-full bg-red-400 animate-pulse"></span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {filteredDashboardExpiring.length === 0 ? (
                  <div className="p-8 text-center text-xs text-on-surface-variant/70 italic bg-surface-container/30 border border-outline-variant/20 rounded-lg">
                    Nenhum contrato ativo expira ou está vencido na faixa de {dashboardThreshold} dias. Estabilidade operacional GECTI!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-1">
                    {filteredDashboardExpiring.map(({ c, days }) => {
                      const dv = c.Vigencia_Final || new Date(c.Vigencia_Inicio);
                      const fornObj = fornecedores.find(f => f.id === c.Fornecedor);
                      const fornName = fornObj ? fornObj.Nome_Fornecedor : (c.Fornecedor || 'Não cadastrado');
                      
                      let badgeColor = '';
                      let textAlert = '';
                      let pulseDot = false;

                      if (days <= 0) {
                        badgeColor = 'bg-red-500/15 border-red-500/30 text-red-400 font-extrabold';
                        textAlert = `Expirado há ${Math.abs(days)}d`;
                        pulseDot = true;
                      } else if (days <= 30) {
                        badgeColor = 'bg-rose-500/15 border-rose-500/30 text-rose-300 font-bold';
                        textAlert = `${days}d restantes`;
                        pulseDot = true;
                      } else if (days <= 60) {
                        badgeColor = 'bg-orange-500/15 border-orange-500/30 text-orange-300 font-semibold';
                        textAlert = `${days}d restantes`;
                      } else if (days <= 90) {
                        badgeColor = 'bg-amber-500/15 border-amber-500/30 text-amber-300 font-medium';
                        textAlert = `${days}d restantes`;
                      } else {
                        badgeColor = 'bg-blue-500/15 border-blue-500/30 text-blue-300';
                        textAlert = `${days}d restantes`;
                      }

                      return (
                        <div 
                          key={c.id} 
                          onClick={() => {
                            setTourContractId(c.id);
                            setActivePage('contratos');
                          }}
                          className="bg-surface-container-lowest border border-outline-variant hover:border-primary/45 rounded-xl p-4 space-y-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] animate-in zoom-in-95 group shadow-xs hover:shadow-md"
                          title="Clique para abrir os detalhes deste contrato"
                        >
                          <div className="flex justify-between items-center gap-2">
                            <span className={`font-mono text-[9px] uppercase font-bold flex items-center gap-1 leading-none px-2 py-0.5 rounded border ${badgeColor}`}>
                              <AlertOctagon className="w-3 h-3 shrink-0" />
                              {textAlert}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-on-surface font-mono font-bold text-[10px] group-hover:text-primary transition-colors">{c.Num_Contrato}</span>
                              <CopyButton text={c.Num_Contrato} label="Contrato" />
                            </div>
                          </div>
                          <p className="text-xs text-on-surface font-bold truncate group-hover:text-primary leading-tight transition-colors">{c.Objeto}</p>
                          <p className="text-[10px] text-on-surface-variant truncate font-sans">Fornecedor: <strong>{fornName}</strong></p>
                          <div className="flex justify-between items-center text-[9px] text-on-surface-variant font-sans border-t border-dashed border-outline-variant/30 pt-1.5">
                            <span>Vencimento: <strong>{formatDate(dv)}</strong></span>
                            {pulseDot && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sistema / PNCP informational guideline */}
              <div className="bg-surface-container-low border border-outline-variant/60 rounded-xl p-5 flex flex-col sm:flex-row items-center gap-4">
                <Settings className="w-8 h-8 text-primary/80 shrink-0" />
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-on-surface">Alimentação Manual SOF</p>
                  <p className="text-[11px] text-on-surface-variant">Este sistema é alimentado de forma manual com base nos andamentos e despachos dos processos administrativos de contratação tramitados via SEI (Sistema Eletrônico de Informações).</p>
                </div>
              </div>

            </div>
          )}

          {activePage === 'dfds' && (
            <div className="w-full max-w-none mx-auto animate-in fade-in duration-100">
              <DFDsComponent
                dfds={dfds.filter(d => !d.isBudgetOnlyItem)}
                planejamentos={planejamentos.filter(p => !p.isBudgetOnlyItem)}
                contratos={contratos}
                itensSOF={itensSOF}
                userRole={currentUser.role as any}
                currentLocalTime={currentLocalTime}
                aditivos={aditivos}
                apostilamentos={apostilamentos}
                pagamentos={pagamentos}
                onAddDFD={handleAddDFD}
                onEditDFD={handleEditDFD}
                onDeleteDFD={handleDeleteDFD}
                onToggleBudget={async (dfdId) => {
                  const targetDfd = dfds.find(d => d.id === dfdId);
                  if (targetDfd) {
                    const newValue = targetDfd.Contabilizar_Orcamento === false ? true : false;
                    try {
                      await setDoc(doc(db, 'dfds', dfdId), {
                        ...targetDfd,
                        Contabilizar_Orcamento: newValue,
                        updatedAt: new Date(currentLocalTime).toISOString()
                      });
                    } catch (error) {
                      handleFirestoreError(error, OperationType.UPDATE, `dfds/${dfdId}`);
                    }
                  }
                }}
                onNavigateToPlanning={(seiProcesso) => {
                  const p = planejamentos.find(x => x.SEI_Processo === seiProcesso);
                  if (p) {
                    handleNavigateToPlanning(p.id);
                  } else {
                    alert('Nenhum processo de planejamento cadastrado com este SEI.');
                  }
                }}
                onViewLineage={(id, type) => {
                  setLineageTrackItemId(id);
                  setLineageTrackType(type);
                }}
              />
            </div>
          )}

          {activePage === 'orcamento' && (
            <div className="w-full max-w-none mx-auto animate-in fade-in duration-100">
              <OrcamentoAtualComponent
                dfds={dfds}
                contratos={processedContratos}
                fornecedores={fornecedores}
                aditivos={aditivos}
                apostilamentos={apostilamentos}
                pagamentos={pagamentos}
                itensSOF={itensSOF}
                currentYear={new Date(currentLocalTime).getUTCFullYear()}
                selectedYear={selectedYear}
                onYearChange={setSelectedYear}
                theme={theme}
                currentLocalTime={currentLocalTime}
                siopRecords={siopRecords}
                siopHistory={siopHistory}
                currentUser={currentUser}
                planejamentos={planejamentos}
                itensPlanejamentoSOF={itensPlanejamentoSOF}
              />
            </div>
          )}

          {activePage === 'planejamentos' && (
            <div className="w-full max-w-none mx-auto space-y-8 animate-in fade-in duration-100">
              <PlanejamentosComponent
                planejamentos={planejamentos.filter(p => !p.isBudgetOnlyItem)}
                tarefas={tarefas}
                historicos={historicoPlanejamentos}
                contratos={contratos}
                currentUser={currentUser}
                currentLocalTime={currentLocalTime}
                onAddPlanejamento={handleAddPlanejamento}
                onEditPlanejamento={handleEditPlanejamento}
                onDeletePlanejamento={handleDeletePlanejamento}
                onAddTarefa={async (newTar) => {
                  try {
                    await setDoc(doc(db, 'tarefas', newTar.id), newTar);
                  } catch (err) {
                    handleFirestoreError(err, OperationType.CREATE, `tarefas/${newTar.id}`);
                  }
                }}
                onUpdateTarefa={async (updatedTar) => {
                  try {
                    await setDoc(doc(db, 'tarefas', updatedTar.id), updatedTar);
                  } catch (err) {
                    handleFirestoreError(err, OperationType.UPDATE, `tarefas/${updatedTar.id}`);
                  }
                }}
                onDeleteTarefa={async (id) => {
                  try {
                    await deleteDoc(doc(db, 'tarefas', id));
                  } catch (err) {
                    handleFirestoreError(err, OperationType.DELETE, `tarefas/${id}`);
                  }
                }}
                onAddHistoricoPlan={async (newHist) => {
                  try {
                    await setDoc(doc(db, 'historicoPlanejamentos', newHist.id), newHist);
                  } catch (err) {
                    handleFirestoreError(err, OperationType.CREATE, `historicoPlanejamentos/${newHist.id}`);
                  }
                }}
                onUpdateHistoricoPlan={async (updatedHist) => {
                  try {
                    await setDoc(doc(db, 'historicoPlanejamentos', updatedHist.id), updatedHist);
                  } catch (err) {
                    handleFirestoreError(err, OperationType.UPDATE, `historicoPlanejamentos/${updatedHist.id}`);
                  }
                }}
                onDeleteHistoricoPlan={async (id) => {
                  try {
                    await deleteDoc(doc(db, 'historicoPlanejamentos', id));
                  } catch (err) {
                    handleFirestoreError(err, OperationType.DELETE, `historicoPlanejamentos/${id}`);
                  }
                }}
                templates={templates}
                onUpdateTemplates={async (updatedTemplates) => {
                  try {
                    for (const tm of updatedTemplates) {
                      const id = tm.tipo.replace(/\s+/g, '-').toLowerCase();
                      await setDoc(doc(db, 'templates', id), { id, ...tm });
                    }
                  } catch (err) {
                    handleFirestoreError(err, OperationType.UPDATE, 'templates');
                  }
                }}
                onNavigateToContract={(numContrato) => {
                  const found = contratos.find(c => c.Num_Contrato === numContrato || c.id === numContrato);
                  if (found) {
                    setTourContractId(found.id);
                  }
                  setActivePage('contratos');
                }}
                dfds={dfds.filter(d => !d.isBudgetOnlyItem)}
                onViewLineage={(id, type) => {
                  setLineageTrackItemId(id);
                  setLineageTrackType(type);
                }}
                itensPlanejamentoSOF={itensPlanejamentoSOF}
                onAddItemPlanejamentoSOF={handleAddItemPlanejamentoSOF}
                onEditItemPlanejamentoSOF={handleEditItemPlanejamentoSOF}
                onDeleteItemPlanejamentoSOF={handleDeleteItemPlanejamentoSOF}
                onStartTour={(tourId) => setActiveTourId(tourId)}
                completedTours={completedTours}
                initialSelectedPlanId={tourPlanId}
              />
            </div>
          )}

          {activePage === 'kanban' && (
            <div className="w-full max-w-none mx-auto space-y-5 animate-in fade-in duration-100 w-full overflow-hidden">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-surface border border-outline p-4 rounded-xl w-full" data-tour="kanban-selector">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-on-surface">Quadro Kanban de Tarefas por Planejamento</h3>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">Selecione um processo de planejamento para interagir com as fases da contratação</p>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs w-full sm:w-auto">
                  <span className="font-semibold text-on-surface-variant font-mono whitespace-nowrap">Processo SEI:</span>
                  <select
                    value={shortcutPlanejamentoId || planejamentos.filter(p => !p.isBudgetOnlyItem)[0]?.id || ""}
                    onChange={(e) => setShortcutPlanejamentoId(e.target.value)}
                    className="bg-surface-container border border-outline-variant px-3 py-1.5 rounded-lg text-primary text-xs font-bold outline-none cursor-pointer w-full sm:w-[280px] lg:w-[400px] max-w-full truncate"
                  >
                    {planejamentos.filter(p => !p.isBudgetOnlyItem).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.SEI_Processo} - {p.Objeto.slice(0, 30)}...
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {planejamentos.filter(p => !p.isBudgetOnlyItem).find(p => p.id === (shortcutPlanejamentoId || planejamentos.filter(p => !p.isBudgetOnlyItem)[0]?.id)) ? (
                <KanbanBoardComponent
                  planejamento={planejamentos.filter(p => !p.isBudgetOnlyItem).find(p => p.id === (shortcutPlanejamentoId || planejamentos.filter(p => !p.isBudgetOnlyItem)[0]?.id))!}
                  allPlanejamentos={planejamentos.filter(p => !p.isBudgetOnlyItem)}
                  tarefas={tarefas}
                  currentUser={currentUser}
                  onSelectPlanejamento={(id) => setShortcutPlanejamentoId(id)}
                  onAddTarefa={async (newTar) => {
                    try {
                      await setDoc(doc(db, 'tarefas', newTar.id), newTar);
                    } catch (err) {
                      handleFirestoreError(err, OperationType.CREATE, `tarefas/${newTar.id}`);
                    }
                  }}
                  onUpdateTarefa={async (updatedTar) => {
                    try {
                      await setDoc(doc(db, 'tarefas', updatedTar.id), updatedTar);
                    } catch (err) {
                      handleFirestoreError(err, OperationType.UPDATE, `tarefas/${updatedTar.id}`);
                    }
                  }}
                  onDeleteTarefa={async (id) => {
                    try {
                      await deleteDoc(doc(db, 'tarefas', id));
                    } catch (err) {
                      handleFirestoreError(err, OperationType.DELETE, `tarefas/${id}`);
                    }
                  }}
                  templates={templates}
                  onUpdateTemplates={async (updatedTemplates) => {
                    try {
                      for (const tm of updatedTemplates) {
                        const id = tm.tipo.replace(/\s+/g, '-').toLowerCase();
                        await setDoc(doc(db, 'templates', id), { id, ...tm });
                      }
                    } catch (err) {
                      handleFirestoreError(err, OperationType.UPDATE, 'templates');
                    }
                  }}
                />
              ) : (
                <p className="text-xs italic text-on-surface-variant">Nenhum processo selecionado.</p>
              )}
            </div>
          )}

          {activePage === 'contratos' && (
            <div className="w-full max-w-none mx-auto animate-in fade-in duration-100">
              <ContratosComponent
                contratos={contratos}
                dfds={dfds.filter(d => !d.isBudgetOnlyItem)}
                itensSOF={itensSOF}
                aditivos={aditivos}
                apostilamentos={apostilamentos}
                historicosContratuais={historicosContratuais}
                pagamentos={pagamentos}
                fornecedores={fornecedores}
                currentUser={currentUser}
                currentLocalTime={currentLocalTime}
                selectedYear={selectedYear}
                onAddContrato={handleAddContrato}
                onEditContrato={handleEditContrato}
                onDeleteContrato={handleDeleteContrato}
                onAddItemSOF={handleAddItemSOF}
                onEditItemSOF={handleEditItemSOF}
                onDeleteItemSOF={handleDeleteItemSOF}
                onAddAditivo={handleAddAditivo}
                onDeleteAditivo={handleDeleteAditivo}
                onAddApostilamento={handleAddApostilamento}
                onDeleteApostilamento={handleDeleteApostilamento}
                onAddHistoricoContratual={handleAddHistoricoContratual}
                onDeleteHistoricoContratual={handleDeleteHistoricoContratual}
                onAddPagamento={handleAddPagamento}
                onDeletePagamento={handleDeletePagamento}
                onAddFornecedor={handleAddFornecedor}
                onEditFornecedor={handleEditFornecedor}
                onDeleteFornecedor={handleDeleteFornecedor}
                onViewLineage={(id, type) => {
                  setLineageTrackItemId(id);
                  setLineageTrackType(type);
                }}
                onOpenIctiCalculator={(contractId) => {
                  setIctiCalculatorContractId(contractId || '');
                  setIsIctiCalculatorOpen(true);
                }}
                onStartTour={(tourId) => setActiveTourId(tourId)}
                completedTours={completedTours}
                initialSelectedContractId={tourContractId}
                onCloseContractDetails={() => setTourContractId(null)}
              />
            </div>
          )}

          {activePage === 'normativos' && (
            <div className="w-full max-w-none mx-auto animate-in fade-in duration-100 font-sans">
              <BaseConhecimentoComponent
                baseConhecimento={baseConhecimento}
                faqs={faqs}
                planejamentos={planejamentos.filter(p => !p.isBudgetOnlyItem)}
                contratos={contratos}
                currentUser={currentUser}
                currentLocalTime={currentLocalTime}
                onAddNormativo={handleAddNormativo}
                onEditNormativo={handleEditNormativo}
                onDeleteNormativo={handleDeleteNormativo}
                onAddFAQ={handleAddFAQ}
                onEditFAQ={handleEditFAQ}
                onDeleteFAQ={handleDeleteFAQ}
                onNavigateToPlanning={handleNavigateToPlanning}
              />
            </div>
          )}

          {activePage === 'presencial' && (
            <div className="w-full max-w-none mx-auto space-y-6 animate-in fade-in duration-100 font-sans">
              
              {/* Page header banner */}
              <div className="bg-surface border border-outline rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden">
                <div className="space-y-1">
                  <span className="text-[10px] bg-primary/10 border border-primary/25 text-primary px-2.5 py-0.5 rounded-md font-mono uppercase font-bold">Agenda da Equipe GECTI</span>
                  <h3 className="text-xl font-bold text-on-surface mt-1 tracking-tight font-display">Programa de Gestão e Desempenho</h3>
                  <p className="text-xs text-on-surface-variant">Insira os dias de trabalho presencial</p>
                </div>
                
                <div className="bg-surface-container border border-outline-variant p-3.5 rounded-xl font-mono text-[10px] text-on-surface-variant self-start sm:self-auto">
                  <span className="font-semibold block text-primary uppercase">Status GECTI:</span>
                  <span>{currentUser.role === 'GECTI' ? '● Modo Administrador Ativo' : '○ Modo Visualizador (Leitura)'}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Registration form, visible only if user role === 'GECTI' */}
                <div className="lg:col-span-4 bg-surface border border-outline rounded-xl p-5 space-y-4 font-sans">
                  <div className="border-b border-outline-variant pb-2.5">
                    <h4 className="text-xs font-bold uppercase text-primary">Agendar Período Presencial</h4>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">Cadastre o intervalo de trabalho presencial corporativo.</p>
                  </div>

                  {currentUser.role !== 'GECTI' ? (
                    <div className="p-4 bg-surface-container-low border border-outline-variant/60 rounded-xl text-center space-y-2">
                      <p className="text-[11px] text-on-surface-variant italic">Apenas servidores com o perfil <strong>GECTI</strong> têm permissão para agendar dias presenciais.</p>
                    </div>
                  ) : (
                    <form 
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const dataInicio = (form.elements.namedItem('dataInicio') as HTMLInputElement).value;
                        const dataFim = (form.elements.namedItem('dataFim') as HTMLInputElement).value;
                        const justificativa = (form.elements.namedItem('justificativa') as HTMLInputElement).value;

                        if (new Date(dataInicio) > new Date(dataFim)) {
                          alert('Erro: A data final não pode ser anterior à data inicial!');
                          return;
                        }

                        const newPres: any = {
                          id: `p-${Date.now()}`,
                          userId: currentUser.id,
                          userName: currentUser.name,
                          dataInicio,
                          dataFim,
                          justificativa
                        };

                        try {
                          await setDoc(doc(db, 'presencialDays', newPres.id), newPres);
                        } catch (err) {
                          handleFirestoreError(err, OperationType.CREATE, `presencialDays/${newPres.id}`);
                        }
                        form.reset();
                        alert('Período de expediente presencial agendado com sucesso!');
                      }}
                      className="space-y-3.5 text-xs text-on-surface"
                    >
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant">Nome do Servidor</label>
                        <input
                          type="text"
                          disabled
                          value={currentUser.name}
                          className="w-full bg-surface-container border border-outline-variant rounded px-2.5 py-1.5 font-bold text-on-surface-variant select-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant">Data Inicial</label>
                          <input
                            type="date"
                            name="dataInicio"
                            required
                            className="w-full bg-surface-container border border-outline rounded p-1.5 focus:outline-none focus:border-primary font-mono text-xs cursor-pointer"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant">Data Final</label>
                          <input
                            type="date"
                            name="dataFim"
                            required
                            className="w-full bg-surface-container border border-outline rounded p-1.5 focus:outline-none focus:border-primary font-mono text-xs cursor-pointer"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant">Motivação / Atividade Plan.</label>
                        <textarea
                          name="justificativa"
                          required
                          rows={3}
                          placeholder="Ex: Alinhamento de TR para Datacenter ou acompanhamento presencial do PCA..."
                          className="w-full bg-surface-container border border-outline rounded p-2 focus:outline-none focus:border-primary text-xs"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 bg-primary text-on-primary font-bold rounded hover:opacity-95 text-xs transition-opacity cursor-pointer shadow flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        Agendar Horário Presencial
                      </button>
                    </form>
                  )}
                </div>

                {/* Schedules list & visual representation */}
                <div className="lg:col-span-8 bg-surface border border-outline rounded-xl p-5 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant/60 pb-3">
                    <div>
                      <h4 className="text-sm font-bold uppercase text-on-surface">Escalas Presenciais de Trabalho</h4>
                      <p className="text-[10px] text-on-surface-variant mt-0.5">Acompanhamento e visualização para a chefia da GECTI.</p>
                    </div>

                    {/* View Switcher Tabs */}
                    <div className="flex items-center gap-1 bg-surface-container-low p-1 border border-outline-variant rounded-lg self-start sm:self-auto shrink-0 select-none">
                      <button
                        type="button"
                        onClick={() => setPresenceViewTab('calendar')}
                        className={`px-3 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                          presenceViewTab === 'calendar'
                            ? 'bg-primary text-on-primary shadow-sm'
                            : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        Calendário
                      </button>
                      <button
                        type="button"
                        onClick={() => setPresenceViewTab('list')}
                        className={`px-3 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                          presenceViewTab === 'list'
                            ? 'bg-primary text-on-primary shadow-sm'
                            : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        Lista ({presencialDays.length})
                      </button>
                    </div>
                  </div>

                  {presenceViewTab === 'calendar' ? (
                    <div className="space-y-4 animate-in fade-in duration-150">
                      
                      {/* Month Switcher Navigator Column */}
                      <div className="flex justify-between items-center bg-surface-container-low border border-outline-variant/65 p-2 px-4 rounded-xl">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (calendarMonth === 0) {
                                setCalendarMonth(11);
                                setCalendarYear(y => y - 1);
                              } else {
                                setCalendarMonth(m => m - 1);
                              }
                            }}
                            className="p-1 px-2.5 bg-surface border border-outline-variant rounded hover:bg-surface-container-high text-xs font-bold text-primary active:scale-95 transition-all cursor-pointer select-none"
                          >
                            &lt; Anterior
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const today = new Date();
                              setCalendarYear(today.getFullYear());
                              setCalendarMonth(today.getMonth());
                            }}
                            className="p-1 px-2.5 bg-primary/10 border border-primary/30 text-primary rounded hover:bg-primary/20 text-xs font-bold active:scale-95 transition-all cursor-pointer select-none"
                          >
                            Mês Atual
                          </button>
                        </div>
                        
                        <strong className="text-xs text-on-surface uppercase tracking-wider font-bold">
                          {MONTHS_PT[calendarMonth]} de {calendarYear}
                        </strong>

                        <button
                          type="button"
                          onClick={() => {
                            if (calendarMonth === 11) {
                              setCalendarMonth(0);
                              setCalendarYear(y => y + 1);
                            } else {
                              setCalendarMonth(m => m + 1);
                            }
                          }}
                          className="p-1 px-2.5 bg-surface border border-outline-variant rounded hover:bg-surface-container-high text-xs font-bold text-primary active:scale-95 transition-all cursor-pointer select-none"
                        >
                          Próximo &gt;
                        </button>
                      </div>

                      {/* Calendar grid view */}
                      <div className="border border-outline-variant/60 rounded-xl overflow-hidden bg-surface-container-lowest">
                        <div className="grid grid-cols-7 text-center bg-surface-container-low border-b border-outline-variant/70 text-[10px] uppercase font-bold text-on-surface-variant select-none">
                          {WEEKDAYS_PT.map(wd => (
                            <div key={wd} className="py-2.5 border-r border-outline-variant/20 last:border-r-0">{wd}</div>
                          ))}
                        </div>

                        <div className="grid grid-cols-7 gap-px bg-outline-variant/30 font-sans">
                          {(() => {
                            const firstDayOfMonth = new Date(Date.UTC(calendarYear, calendarMonth, 1));
                            const startDayOfWeek = firstDayOfMonth.getUTCDay();
                            const daysInMonth = new Date(Date.UTC(calendarYear, calendarMonth + 1, 0)).getUTCDate();
                            
                            const cells = [];
                            
                            // Padding preceding days
                            for (let i = 0; i < startDayOfWeek; i++) {
                              cells.push(
                                <div key={`pad-${i}`} className="bg-surface-container-lowest/40 h-20 min-h-[72px]" />
                              );
                            }

                            const BRAZILIAN_HOLIDAYS_MMDD: Record<string, string> = {
                              '01-01': 'Confraternização Universal',
                              '04-21': 'Tiradentes',
                              '05-01': 'Dia do Trabalho',
                              '09-07': 'Independência do Brasil',
                              '10-12': 'Nossa Senhora Aparecida',
                              '11-02': 'Finados',
                              '11-15': 'Proclamação da República',
                              '11-20': 'Dia da Consciência Negra',
                              '12-25': 'Natal',
                            };

                            const MONTHS_PT = [
                              'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                              'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
                            ];

                            // Month days
                            for (let d = 1; d <= daysInMonth; d++) {
                              const dayStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                              const curDate = new Date(Date.UTC(calendarYear, calendarMonth, d));
                              const dayOfWeek = curDate.getUTCDay(); // 0 Sunday, 6 Saturday
                              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                              
                              const mmDdStr = `${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                              const holidayName = BRAZILIAN_HOLIDAYS_MMDD[mmDdStr];
                              const isHoliday = !!holidayName;
                              
                              const isWeekendOrHoliday = isWeekend || isHoliday;
                              const label = isWeekend ? 'Fim de semana' : (holidayName || '');

                              // GECTI members presencial on this specific target date
                              const activeMembers = isWeekendOrHoliday ? [] : presencialDays.filter(p => {
                                return p.dataInicio <= dayStr && p.dataFim >= dayStr;
                              });

                              cells.push(
                                <div 
                                  key={`day-${d}`} 
                                  className={`bg-surface p-1.5 h-20 min-h-[72px] border-r border-b border-outline-variant/20 flex flex-col justify-between transition-colors hover:bg-surface-container/20 group relative ${
                                    isWeekendOrHoliday ? 'bg-surface-container-lowest/30 brightness-95 opacity-55' : ''
                                  }`}
                                >
                                  {/* Calendar Day label */}
                                  <div className="flex justify-between items-start">
                                    <span className={`text-[10px] font-bold font-mono ${
                                      isWeekendOrHoliday ? 'text-on-surface-variant/55' : 'text-on-surface'
                                    }`}>
                                      {d}
                                    </span>
                                    {isHoliday && (
                                      <span className="text-[7px] text-rose-400 bg-rose-500/10 font-bold px-1 rounded block uppercase truncate max-w-[42px]" title={label}>
                                        Feriado
                                      </span>
                                    )}
                                  </div>

                                  {/* Members display or weekend/holiday label */}
                                  <div className="flex-1 mt-1 flex flex-col justify-end gap-1 overflow-y-auto max-h-[50px] custom-scrollbar">
                                    {isWeekendOrHoliday ? (
                                      <span className="text-[7.5px] italic text-on-surface-variant/40 block pb-0.5 text-center leading-tight">
                                        {isWeekend ? 'Fim de Semana' : label}
                                      </span>
                                    ) : activeMembers.length === 0 ? (
                                      <span className="text-[6.5px] text-on-surface-variant/30 uppercase tracking-widest block text-center pb-0.5">Sem escala</span>
                                    ) : (
                                      <div className="space-y-0.5 max-h-[44px] overflow-hidden">
                                        {activeMembers.map((m, idx) => (
                                          <div 
                                            key={idx} 
                                            className="text-[8px] leading-tight bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 font-bold px-1 rounded truncate text-center uppercase"
                                            title={`${m.userName}: ${m.justificativa}`}
                                          >
                                            {m.userName.trim().split(' ')[0]}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }

                            return cells;
                          })()}
                        </div>
                      </div>

                      {/* Small informational legend key */}
                      <div className="flex flex-wrap items-center gap-4 text-[9.5px] text-on-surface-variant bg-surface-container-low/40 p-2.5 px-3.5 border border-outline-variant/60 rounded-xl">
                        <span className="font-bold uppercase tracking-wider text-primary">Legenda:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 bg-indigo-500/15 border border-indigo-500/25 rounded"></span>
                          <span>Servidor Presencial</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 bg-surface-container-lowest/30 opacity-55 rounded"></span>
                          <span>Fins de Semana e Feriados Estatais</span>
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="divide-y divide-outline border-b border-outline max-h-[450px] overflow-y-auto pr-1">
                      {presencialDays.length === 0 ? (
                        <div className="p-12 text-center text-xs text-on-surface-variant italic bg-surface-container/30 border border-outline-variant/30 rounded-xl">
                          Nenhum plantão presencial registrado até o momento.
                        </div>
                      ) : (
                        presencialDays.map((p) => {
                          const canDelete = currentUser.role === 'GECTI' || currentUser.id === p.userId;
                          
                          return (
                            <div key={p.id} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 first:pt-1 last:pb-1 group">
                              <div className="space-y-1.5 min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="bg-indigo-500/10 text-indigo-400 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border border-indigo-500/15">
                                    GECTI Membro
                                  </span>
                                  <strong className="text-xs text-on-surface font-bold truncate leading-none block">{p.userName}</strong>
                                </div>
                                
                                <p className="text-xs text-on-surface-variant/90 leading-relaxed font-sans">{p.justificativa}</p>
                                
                                <div className="flex items-center gap-2.5 text-[10px] text-on-surface-variant/80 font-mono mt-1">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-primary" />
                                    Período: <strong>{formatDate(p.dataInicio + 'T00:00:00Z').slice(0, 10)}</strong> a <strong>{formatDate(p.dataFim + 'T00:00:00Z').slice(0, 10)}</strong>
                                  </span>
                                  {p.dataInicio === p.dataFim ? (
                                    <span className="bg-surface-container text-on-surface px-1.5 rounded text-[8px] border border-outline font-semibold uppercase font-sans">1 dia</span>
                                  ) : (
                                    <span className="bg-primary/5 text-primary px-1.5 text-[8px] rounded border border-primary/10 font-bold uppercase font-sans">Consecutivo</span>
                                  )}
                                </div>
                              </div>

                              {canDelete && (
                                <button
                                  onClick={async () => {
                                    if (confirm('Tem certeza de que deseja excluir este expediente presencial agendado?')) {
                                      try {
                                        await deleteDoc(doc(db, 'presencialDays', p.id));
                                      } catch (err) {
                                        handleFirestoreError(err, OperationType.DELETE, `presencialDays/${p.id}`);
                                      }
                                    }
                                  }}
                                  className="sm:opacity-0 group-hover:opacity-100 p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg cursor-pointer self-end sm:self-auto shrink-0 transition-all border border-outline-variant/30 hover:border-rose-500/40"
                                  title="Excluir agendamento"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {activePage === 'usuarios' && currentUser?.role === 'GECTI' && (
            <div className="w-full max-w-none mx-auto space-y-6 animate-in fade-in duration-100 font-sans">
              
              {/* Page header banner */}
              <div className="bg-surface border border-outline rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden font-sans">
                <div className="space-y-1">
                  <span className="text-[10px] bg-primary/10 border border-primary/25 text-primary px-2.5 py-0.5 rounded-md font-mono uppercase font-bold">Perfis do sistema</span>
                  <h3 className="text-xl font-bold text-on-surface mt-1 tracking-tight font-display animate-none">Gerenciamento de Usuários</h3>
                  <p className="text-xs text-on-surface-variant animate-none">Cadastre usuários, gerencie credenciais e audite o histórico de acessos dos servidores</p>
                </div>
                
                <button
                  onClick={() => {
                    setIsTeamModalOpen(true);
                  }}
                  className="px-3 py-2 bg-primary text-on-primary font-bold rounded-lg hover:opacity-95 transition-opacity text-xs flex items-center gap-1.5 cursor-pointer shadow self-start sm:self-auto"
                >
                  <Users className="w-4 h-4" />
                  Visualizar Matriz de Perfis
                </button>
              </div>

              {/* Sub-navigation tabs: Users vs Login Logs */}
              <div className="flex items-center gap-2 border-b border-outline pb-2.5">
                <button
                  onClick={() => setUserManagementTab('usuarios')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    userManagementTab === 'usuarios'
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high border border-outline/50'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Servidores e Permissões
                  <span className="ml-1 text-[10px] bg-white/20 px-1.5 py-0.25 rounded-full font-mono">
                    {users.length}
                  </span>
                </button>

                <button
                  onClick={() => setUserManagementTab('logs')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    userManagementTab === 'logs'
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high border border-outline/50'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  Audit Trail de Logins
                  <span className="ml-1 text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.25 rounded-full font-mono font-bold">
                    {loginLogs.length}
                  </span>
                </button>
              </div>

              {userManagementTab === 'usuarios' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* User registration/editing form */}
                  <div className="lg:col-span-5 bg-surface border border-outline rounded-xl p-5 space-y-4 font-sans">
                    <div className="border-b border-outline-variant pb-2.5">
                      <h4 className="text-xs font-bold uppercase text-primary">
                        {editingUserId ? 'Editar Integrante' : 'Registrar Novo Integrante'}
                      </h4>
                      <p className="text-[10px] text-on-surface-variant mt-0.5">
                        {editingUserId
                          ? 'Modifique os dados cadastrais do integrante e salve as alterações.'
                          : 'Cadastre o e-mail oficial e defina o perfil de visualização do sistema.'}
                      </p>
                    </div>

                    <form 
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        if (!emailRegex.test(usrFormEmail)) {
                          alert('E-mail institucional inválido!');
                          return;
                        }

                        if (editingUserId) {
                          const found = users.find(u => u.id === editingUserId);
                          if (found) {
                            const updatedUser: User = {
                              ...found,
                              name: usrFormName,
                              email: usrFormEmail,
                              role: usrFormRole
                            };
                            try {
                              await setDoc(doc(db, 'users', editingUserId), updatedUser);
                              
                              // Se o nome foi alterado, atualizar também os agendamentos presenciais correspondentes desse servidor
                              if (found.name !== usrFormName) {
                                setPresencialDays(prev => {
                                  const updatedPres = prev.map(p => {
                                    if (p.userId === editingUserId || p.userName === found.name) {
                                      const up = { ...p, userName: usrFormName };
                                      setDoc(doc(db, 'presencialDays', p.id), up).catch(() => {});
                                      return up;
                                    }
                                    return p;
                                  });
                                  try { localStorage.setItem('contratics_presenca_gecti', JSON.stringify(updatedPres)); } catch (e) {}
                                  return updatedPres;
                                });
                              }

                              alert(`Usuário "${usrFormName}" atualizado com sucesso!`);
                              setEditingUserId(null);
                              setUsrFormName('');
                              setUsrFormEmail('');
                              setUsrFormRole('GECTI');
                              setUsrFormPass('sof123');
                            } catch (error) {
                              handleFirestoreError(error, OperationType.UPDATE, `users/${editingUserId}`);
                            }
                          }
                        } else {
                          const newUsr: User = {
                            id: `user-${Date.now()}`,
                            name: usrFormName,
                            email: usrFormEmail,
                            role: usrFormRole,
                            passwordSimulated: usrFormPass,
                            needsPasswordReset: true
                          };
                          try {
                            await handleAddUser(newUsr);
                            alert(`Usuário "${usrFormName}" habilitado com perfil "${usrFormRole}"!`);
                            setUsrFormName('');
                            setUsrFormEmail('');
                            setUsrFormRole('GECTI');
                            setUsrFormPass('sof123');
                          } catch (error) {
                            handleFirestoreError(error, OperationType.CREATE, `users/${newUsr.id}`);
                          }
                        }
                      }}
                      className="space-y-4 text-xs text-on-surface"
                    >
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant animate-none">Nome Completo</label>
                        <input
                          type="text"
                          name="usrName"
                          required
                          value={usrFormName}
                          onChange={e => setUsrFormName(e.target.value)}
                          placeholder="Ex: Servidor Responsável"
                          className="w-full bg-surface-container border border-outline rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant">E-mail Corporativo</label>
                        <input
                          type="email"
                          name="usrEmail"
                          required
                          value={usrFormEmail}
                          onChange={e => setUsrFormEmail(e.target.value)}
                          placeholder="Ex: servidor@mpo.gov.br"
                          className="w-full bg-surface-container border border-outline rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary font-mono"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant">Perfil de Acesso</label>
                          <select
                            name="usrRole"
                            value={usrFormRole}
                            onChange={e => setUsrFormRole(e.target.value as any)}
                            className="w-full bg-surface-container border border-outline rounded p-1.5 text-xs focus:outline-none focus:border-primary select-none cursor-pointer text-primary font-bold"
                          >
                            <option value="GECTI">GECTI (Gestor)</option>
                            <option value="Fiscal">Fiscal</option>
                            <option value="Auditor">Auditor</option>
                            <option value="Visualizador">Visualizador</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant animate-none">
                            {editingUserId ? 'Senha (Privado)' : 'Senha Inicial'}
                          </label>
                          <input
                            type="password"
                            name="usrPass"
                            required={!editingUserId}
                            disabled={!!editingUserId}
                            value={editingUserId ? '********' : usrFormPass}
                            onChange={e => !editingUserId && setUsrFormPass(e.target.value)}
                            placeholder={editingUserId ? 'Sem acesso visual' : 'Mínimo 6 chars'}
                            className="w-full bg-surface-container border border-outline rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary font-mono disabled:opacity-50"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="flex-1 py-2 bg-primary text-on-primary font-bold rounded hover:opacity-95 text-xs transition-opacity cursor-pointer shadow flex items-center justify-center gap-1.5"
                        >
                          {editingUserId ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                          {editingUserId ? 'Salvar Alterações' : 'Registrar Integrante'}
                        </button>

                        {editingUserId && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUserId(null);
                              setUsrFormName('');
                              setUsrFormEmail('');
                              setUsrFormRole('GECTI');
                              setUsrFormPass('sof123');
                            }}
                            className="px-3 py-2 border border-outline hover:bg-surface-container text-on-surface font-semibold rounded text-xs transition-colors cursor-pointer"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </form>
                  </div>

                  {/* Users directory */}
                  <div className="lg:col-span-7 bg-surface border border-outline rounded-xl p-5 space-y-4 font-sans">
                    <div className="flex justify-between items-center border-b border-outline-variant pb-2.5">
                      <div>
                        <h4 className="text-xs font-bold uppercase text-on-surface animate-none">Diretório de Servidores Ativos</h4>
                        <p className="text-[10px] text-on-surface-variant mt-0.5 animate-none">Audite, edite ou remova acessos ao painel corporativo.</p>
                      </div>

                      <span className="bg-surface-container-high/60 border border-outline-variant text-on-surface text-[10px] font-mono px-2 py-0.5 rounded font-bold">
                        {users.length} usuários
                      </span>
                    </div>

                    <div className="divide-y divide-outline border-b border-outline max-h-[450px] overflow-y-auto pr-1">
                      {users.map((u) => {
                        const isSelf = u.id === currentUser.id;
                        const isProtected = u.id === 'user-1'; // protected root Admin
                        
                        let rStyle = 'bg-primary/10 border-primary/20 text-primary';
                        if (u.role === 'Fiscal') rStyle = 'bg-teal-500/10 border-teal-500/25 text-teal-300';
                        if (u.role === 'Auditor') rStyle = 'bg-amber-500/10 border-amber-500/25 text-amber-300';
                        if (u.role === 'Visualizador') rStyle = 'bg-surface-container border-outline text-on-surface-variant';
                        
                        return (
                          <div key={u.id} className="py-3 flex items-center justify-between gap-3 text-xs md:gap-4 font-sans">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <strong className="text-on-surface font-semibold truncate leading-none block">{u.name}</strong>
                                <span className={`text-[8px] uppercase font-bold px-1.5 py-0.25 rounded border font-mono ${rStyle}`}>
                                  {u.role}
                                </span>
                                {isSelf && (
                                  <span className="bg-emerald-500/10 text-emerald-300 px-1 py-0.25 rounded text-[8px] font-bold border border-emerald-500/20 uppercase tracking-widest leading-none">
                                    Você
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-on-surface-variant/80 font-mono block truncate mt-1">{u.email}</span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* In-place edit button */}
                              <button
                                onClick={() => {
                                  setEditingUserId(u.id);
                                  setUsrFormName(u.name);
                                  setUsrFormEmail(u.email);
                                  setUsrFormRole(u.role);
                                  setUsrFormPass('');
                                }}
                                className="p-1.5 text-primary hover:bg-primary/10 rounded-lg cursor-pointer transition-colors border border-outline-variant/30 hover:border-primary/40"
                                title="Editar usuário"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              {/* Reset simulated password button */}
                              <button
                                onClick={() => {
                                  setResetPasswordUserId(u.id);
                                  setNewPasswordValue('sof123');
                                }}
                                className="p-1.5 text-amber-500 hover:bg-amber-500/10 rounded-lg cursor-pointer transition-colors border border-outline-variant/30 hover:border-amber-500/40"
                                title="Resetar senha"
                              >
                                <Key className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Button */}
                              {!isProtected && !isSelf && (
                                <button
                                  onClick={() => {
                                    setDeleteUserId(u.id);
                                  }}
                                  className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg cursor-pointer transition-colors border border-outline-variant/30 hover:border-rose-500/40 shrink-0"
                                  title="Revogar credencial"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              )}

              {userManagementTab === 'logs' && (() => {
                const filteredLogs = loginLogs.filter(log => {
                  const matchesSearch = 
                    log.userName.toLowerCase().includes(loginLogSearch.toLowerCase()) ||
                    log.userEmail.toLowerCase().includes(loginLogSearch.toLowerCase()) ||
                    log.status.toLowerCase().includes(loginLogSearch.toLowerCase()) ||
                    (log.ipSimulated || '').toLowerCase().includes(loginLogSearch.toLowerCase());
                  
                  const matchesRole = loginLogRoleFilter === 'Todos' || log.userRole === loginLogRoleFilter;

                  return matchesSearch && matchesRole;
                });

                const exportLogsToCSV = () => {
                  const headers = ['ID', 'Data e Hora', 'Usuario', 'Email', 'Perfil', 'Status', 'IP Simulado', 'Navegador'];
                  const rows = filteredLogs.map(l => [
                    l.id,
                    `"${l.timestamp}"`,
                    `"${l.userName}"`,
                    `"${l.userEmail}"`,
                    `"${l.userRole}"`,
                    `"${l.status}"`,
                    `"${l.ipSimulated || '-'}"`,
                    `"${l.userAgent || '-'}"`
                  ]);
                  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
                  const encodedUri = encodeURI(csvContent);
                  const link = document.createElement('a');
                  link.setAttribute('href', encodedUri);
                  link.setAttribute('download', `logs_login_contratics_${new Date().toISOString().slice(0, 10)}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                };

                const clearAllLogs = async () => {
                  try {
                    await Promise.all(loginLogs.map(l => deleteDoc(doc(db, 'loginLogs', l.id))));
                    setLoginLogs([]);
                    setShowClearLogsConfirmModal(false);
                    alert('Histórico de logs de login foi limpo com sucesso.');
                  } catch (err) {
                    handleFirestoreError(err, OperationType.DELETE, 'loginLogs');
                  }
                };

                const deleteSingleLog = async (logId: string) => {
                  try {
                    await deleteDoc(doc(db, 'loginLogs', logId));
                    setLoginLogs(prev => prev.filter(l => l.id !== logId));
                  } catch (err) {
                    handleFirestoreError(err, OperationType.DELETE, `loginLogs/${logId}`);
                  }
                };

                return (
                  <div className="space-y-6 font-sans">
                    {/* Metric Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-surface border border-outline rounded-xl p-4 flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 text-primary rounded-lg">
                          <Activity className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block">Total de Acessos</span>
                          <strong className="text-lg font-bold text-on-surface font-mono">{loginLogs.length}</strong>
                        </div>
                      </div>

                      <div className="bg-surface border border-outline rounded-xl p-4 flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block">Última Autenticação</span>
                          <strong className="text-xs font-semibold text-on-surface font-mono">
                            {loginLogs[0]?.timestamp || 'Nenhum registro'}
                          </strong>
                        </div>
                      </div>

                      <div className="bg-surface border border-outline rounded-xl p-4 flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-lg">
                          <Users className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block">Usuários Ativos Registrados</span>
                          <strong className="text-lg font-bold text-on-surface font-mono">
                            {new Set(loginLogs.map(l => l.userEmail)).size}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Filter and Control Bar */}
                    <div className="bg-surface border border-outline rounded-xl p-4 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
                        {/* Search box */}
                        <div className="relative flex-1">
                          <Search className="w-3.5 h-3.5 text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={loginLogSearch}
                            onChange={e => setLoginLogSearch(e.target.value)}
                            placeholder="Buscar por nome, e-mail ou IP..."
                            className="w-full bg-surface-container border border-outline rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-primary text-on-surface"
                          />
                        </div>

                        {/* Role filter */}
                        <div className="flex items-center gap-2">
                          <Filter className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
                          <select
                            value={loginLogRoleFilter}
                            onChange={e => setLoginLogRoleFilter(e.target.value)}
                            className="bg-surface-container border border-outline rounded-lg px-2.5 py-1.5 text-xs text-on-surface font-semibold focus:outline-none focus:border-primary cursor-pointer"
                          >
                            <option value="Todos">Todos os Perfis</option>
                            <option value="GECTI">GECTI</option>
                            <option value="Fiscal">Fiscal</option>
                            <option value="Auditor">Auditor</option>
                            <option value="Visualizador">Visualizador</option>
                          </select>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 self-end md:self-auto">
                        <button
                          onClick={exportLogsToCSV}
                          className="px-3 py-1.5 bg-surface-container border border-outline hover:bg-surface-container-high text-on-surface font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
                          title="Exportar planilha CSV"
                        >
                          <Download className="w-3.5 h-3.5 text-primary" />
                          Exportar CSV
                        </button>

                        {loginLogs.length > 0 && (
                          <button
                            onClick={() => setShowClearLogsConfirmModal(true)}
                            className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/25 text-rose-400 hover:bg-rose-500/20 font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
                            title="Limpar todos os logs"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Limpar Logs
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Logs Table */}
                    <div className="bg-surface border border-outline rounded-xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-on-surface">
                          <thead className="bg-surface-container border-b border-outline text-[10px] uppercase font-mono font-bold text-on-surface-variant">
                            <tr>
                              <th className="py-2.5 px-4">Data e Hora</th>
                              <th className="py-2.5 px-4">Servidor / Usuário</th>
                              <th className="py-2.5 px-4">Perfil</th>
                              <th className="py-2.5 px-4">Status / Evento</th>
                              <th className="py-2.5 px-4">Origem IP / Browser</th>
                              <th className="py-2.5 px-4 text-right">Ação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-outline">
                            {filteredLogs.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="py-8 text-center text-on-surface-variant italic font-sans text-xs">
                                  Nenhum registro de login encontrado com os filtros aplicados.
                                </td>
                              </tr>
                            ) : (
                              filteredLogs.map(log => {
                                let roleBadge = 'bg-primary/10 border-primary/20 text-primary';
                                if (log.userRole === 'Fiscal') roleBadge = 'bg-teal-500/10 border-teal-500/25 text-teal-300';
                                if (log.userRole === 'Auditor') roleBadge = 'bg-amber-500/10 border-amber-500/25 text-amber-300';
                                if (log.userRole === 'Visualizador') roleBadge = 'bg-surface-container border-outline text-on-surface-variant';

                                return (
                                  <tr key={log.id} className="hover:bg-surface-container/50 transition-colors">
                                    <td className="py-2.5 px-4 font-mono text-[11px] font-semibold text-on-surface shrink-0">
                                      <div className="flex items-center gap-1.5">
                                        <Clock className="w-3 h-3 text-primary shrink-0" />
                                        <span>{log.timestamp}</span>
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-4">
                                      <div className="space-y-0.5">
                                        <strong className="font-bold text-on-surface block leading-tight">{log.userName}</strong>
                                        <span className="text-[10px] font-mono text-on-surface-variant block">{log.userEmail}</span>
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-4">
                                      <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded border font-mono ${roleBadge}`}>
                                        {log.userRole}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-4">
                                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold">
                                        {log.status}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-4 font-mono text-[10px] text-on-surface-variant">
                                      <div>{log.ipSimulated || '189.12.44.102'}</div>
                                      <div className="text-[9px] opacity-75 font-sans">{log.userAgent || 'Chrome / Web Browser'}</div>
                                    </td>
                                    <td className="py-2.5 px-4 text-right">
                                      <button
                                        onClick={() => deleteSingleLog(log.id)}
                                        className="p-1 text-rose-500 hover:bg-rose-500/10 rounded cursor-pointer transition-colors border border-transparent hover:border-rose-500/30"
                                        title="Excluir este log"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Confirmation Modal for Clearing All Logs */}
                    {showClearLogsConfirmModal && (
                      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-150">
                        <div className="bg-surface border border-outline rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150 text-xs">
                          <div className="flex items-center gap-2.5 border-b border-outline-variant pb-3 text-rose-500">
                            <Shield className="w-5 h-5" />
                            <h4 className="text-sm font-bold text-on-surface">Limpar Todo o Histórico de Logs?</h4>
                          </div>

                          <p className="text-on-surface-variant leading-relaxed">
                            Esta ação excluirá permanentemente todos os <strong>{loginLogs.length}</strong> registros de auditoria de logins salvos no sistema. Essa operação é irreversível.
                          </p>

                          <div className="flex justify-end gap-2 pt-2">
                            <button
                              onClick={() => setShowClearLogsConfirmModal(false)}
                              className="px-3.5 py-1.5 border border-outline hover:bg-surface-container text-on-surface font-semibold rounded-lg text-xs cursor-pointer transition-colors"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={clearAllLogs}
                              className="px-3.5 py-1.5 bg-rose-500 text-white font-bold rounded-lg text-xs hover:bg-rose-600 cursor-pointer shadow transition-all"
                            >
                              Confirmar Exclusão Total
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Reset Password Modal Overlay */}
              {resetPasswordUserId && (() => {
                const targetU = users.find(u => u.id === resetPasswordUserId);
                if (!targetU) return null;
                return (
                  <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-surface border border-outline rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150 text-xs">
                      <div className="flex items-center gap-2.5 border-b border-outline-variant pb-3 text-amber-500">
                        <Key className="w-5 h-5" />
                        <h4 className="text-sm font-bold text-on-surface">Redefinir Senha do Integrante</h4>
                      </div>

                      <div className="p-3 bg-surface-container rounded-lg space-y-1">
                        <p className="font-semibold text-on-surface">{targetU.name}</p>
                        <p className="text-[10px] text-on-surface-variant font-mono">{targetU.email}</p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant">Nova Senha Provisória</label>
                        <input
                          type="text"
                          value={newPasswordValue}
                          onChange={e => setNewPasswordValue(e.target.value)}
                          placeholder="Digite ou use a senha provisória padrão"
                          className="w-full bg-surface-container border border-outline rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-amber-500 font-mono"
                        />
                        <p className="text-[10px] text-on-surface-variant">O integrante será obrigado a cadastrar uma nova senha no próximo login devido ao reset.</p>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setResetPasswordUserId(null);
                          }}
                          className="flex-1 py-1.5 border border-outline hover:bg-surface-container text-on-surface font-semibold rounded text-xs transition-colors cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const finalPass = newPasswordValue.trim() || 'sof123';
                            try {
                              await setDoc(doc(db, 'users', targetU.id), {
                                ...targetU,
                                passwordSimulated: finalPass,
                                needsPasswordReset: true
                              });
                              alert(`Senha de "${targetU.name}" redefinida provisoriamente para "${finalPass}" com sucesso!`);
                              setResetPasswordUserId(null);
                            } catch (err) {
                              handleFirestoreError(err, OperationType.UPDATE, `users/${targetU.id}`);
                            }
                          }}
                          className="flex-1 py-1.5 bg-amber-500 text-black font-extrabold rounded hover:opacity-95 text-xs transition-opacity cursor-pointer shadow"
                        >
                          Confirmar Reset
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Delete User Modal Overlay */}
              {deleteUserId && (() => {
                const targetU = users.find(u => u.id === deleteUserId);
                if (!targetU) return null;
                return (
                  <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-surface border border-outline rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150 text-xs text-on-surface">
                      <div className="flex items-center gap-2.5 border-b border-outline-variant pb-3 text-rose-500">
                        <Trash2 className="w-5 h-5 shrink-0" />
                        <h4 className="text-sm font-bold text-on-surface">Revogar Credencial / Remover</h4>
                      </div>

                      <p className="text-xs leading-relaxed text-on-surface-variant">
                        Tem certeza de que deseja remover o servidor <strong className="text-on-surface">{targetU.name}</strong> ({targetU.role}) do sistema?
                      </p>

                      <div className="p-3 bg-rose-500/5 border border-rose-500/20 text-rose-300 rounded-lg text-[11px] leading-relaxed">
                        Isto irá revogar todos os privilégios de acesso e excluir as credenciais do banco de dados definitivamente.
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteUserId(null);
                          }}
                          className="flex-1 py-1.5 border border-outline hover:bg-surface-container text-on-surface font-semibold rounded text-xs transition-colors cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await deleteDoc(doc(db, 'users', targetU.id));
                              alert(`Usuário "${targetU.name}" removido com sucesso.`);
                              setDeleteUserId(null);
                            } catch (error) {
                              handleFirestoreError(error, OperationType.DELETE, `users/${targetU.id}`);
                            }
                          }}
                          className="flex-1 py-1.5 bg-rose-500 text-on-primary font-bold rounded hover:bg-rose-600 text-xs transition-colors cursor-pointer shadow"
                        >
                          Confirmar Exclusão
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

            </div>
          )}

          {activePage === 'usuarios' && currentUser?.role !== 'GECTI' && (
            <div className="w-full max-w-md mx-auto p-6 text-center space-y-4 bg-surface border border-outline rounded-xl mt-12 shadow font-sans animate-in fade-in duration-150">
              <ShieldCheck className="w-12 h-12 text-rose-500 mx-auto animate-pulse" />
              <h3 className="text-lg font-bold text-on-surface">Acesso Restrito</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Apenas servidores com o perfil <strong className="text-primary font-bold">GECTI</strong> têm permissão para acessar o gerenciamento de usuários e privilégios do sistema.
              </p>
            </div>
          )}

        </main>
      </div>

      {/* Stateful Team and Profile Registration Modal */}
      {isTeamModalOpen && currentUser?.role === 'GECTI' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-surface border border-outline w-full max-w-5xl h-[85vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col font-sans">
            
            {/* Modal Header */}
            <div className="bg-surface-container-high px-6 py-4 border-b border-outline flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary rounded-lg">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-on-surface">Gerenciamento de Equipe e Matriz de Perfis</h3>
                  <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">Cadastre usuários, mude de operador e audite as permissões de conformidade do sistema.</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsTeamModalOpen(false);
                  setNewMemberName('');
                  setNewMemberEmail('');
                  setNewMemberRole('Fiscal');
                  setNewMemberPass('sof123');
                }} 
                className="text-on-surface-variant hover:text-on-surface p-1.5 hover:bg-surface-container/60 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Section 1: Staff Registration Form */}
                <div className="lg:col-span-5 bg-surface-container-low border border-outline-variant/60 rounded-xl p-5 space-y-4 shadow-sm self-start">
                  <h4 className="text-[11px] uppercase font-bold tracking-wider text-primary flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4" />
                    Novo Integrante
                  </h4>
                  
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newMemberName || !newMemberEmail || !newMemberPass) {
                        alert('Por favor, preencha todos os campos obrigatórios!');
                        return;
                      }
                      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                      if (!emailRegex.test(newMemberEmail)) {
                        alert('E-mail em formato inválido!');
                        return;
                      }
                      const newUsr: User = {
                        id: `user-${Date.now()}`,
                        name: newMemberName,
                        email: newMemberEmail,
                        role: newMemberRole,
                        passwordSimulated: newMemberPass,
                        needsPasswordReset: false
                      };
                      handleAddUser(newUsr);
                      alert(`Usuário "${newMemberName}" cadastrado com perfil de "${newMemberRole}" com sucesso!`);
                      setNewMemberName('');
                      setNewMemberEmail('');
                      setNewMemberRole('Fiscal');
                    }}
                    className="space-y-3.5"
                  >
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Nome do Servidor / Técnico</label>
                      <input
                        type="text"
                        required
                        placeholder="Nome completo ex: Maria Silva"
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        className="w-full bg-surface-container border border-outline rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary placeholder-on-surface-variant/40"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">E-mail Institucional</label>
                      <input
                        type="email"
                        required
                        placeholder="Ex: servidor@mpo.gov.br"
                        value={newMemberEmail}
                        onChange={(e) => setNewMemberEmail(e.target.value)}
                        className="w-full bg-surface-container border border-outline rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary placeholder-on-surface-variant/40 font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Perfil Operacional</label>
                        <select
                          value={newMemberRole}
                          onChange={(e) => setNewMemberRole(e.target.value as any)}
                          className="w-full bg-surface-container border border-outline rounded px-2 py-1.5 text-xs text-on-surface font-semibold focus:outline-none focus:border-primary cursor-pointer text-primary"
                        >
                          <option value="GECTI">GECTI (Admin)</option>
                          <option value="Fiscal">Fiscal</option>
                          <option value="Auditor">Auditor</option>
                          <option value="Visualizador">Visualizador</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Senha Provisória</label>
                        <input
                          type="password"
                          required
                          value={newMemberPass}
                          onChange={(e) => setNewMemberPass(e.target.value)}
                          className="w-full bg-surface-container border border-outline rounded px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-primary text-on-primary font-bold rounded text-xs select-none hover:bg-opacity-95 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Registrar e Habilitar Integrante
                    </button>
                  </form>
                </div>

                {/* Section 2: Active Team List Grid */}
                <div className="lg:col-span-7 col-span-1 border border-outline rounded-xl overflow-hidden flex flex-col justify-between bg-surface-container-low min-h-[300px]">
                  <div className="flex-1">
                    <div className="bg-surface px-4 py-3 border-b border-outline flex justify-between items-center">
                      <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        Membros Cadastrados e Habilitados
                      </span>
                      <span className="bg-surface-container text-on-surface text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-outline-variant/40">
                        {users.length} ativos
                      </span>
                    </div>
                    
                    <div className="divide-y divide-outline border-b border-outline max-h-[320px] overflow-y-auto custom-scrollbar">
                      {users.map(u => {
                        const isCurrent = u.id === currentUser.id;
                        const isBuiltIn = u.id === "user-1" || u.id === "user-2";
                        
                        let roleColor = "bg-primary/10 border-primary/20 text-primary";
                        if (u.role === "Fiscal") roleColor = "bg-teal-500/10 border-teal-500/25 text-teal-300";
                        if (u.role === "Auditor") roleColor = "bg-amber-500/10 border-amber-500/25 text-amber-300";
                        if (u.role === "Visualizador") roleColor = "bg-surface-container-high border-outline-variant text-on-surface-variant";

                        return (
                          <div key={u.id} className="p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-surface-container/20 group transition-all">
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <strong className="text-on-surface font-semibold block truncate leading-none">{u.name}</strong>
                                <span className={`text-[9px] uppercase font-bold font-mono px-1.5 py-0.25 rounded border ${roleColor}`}>
                                  {u.role}
                                </span>
                                {isCurrent && (
                                  <span className="bg-emerald-500/10 text-emerald-300 px-1 py-0.25 rounded text-[8px] font-bold border border-emerald-500/20 uppercase tracking-widest leading-none">
                                    Atual
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-on-surface-variant/80 font-mono block truncate">{u.email}</span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Switch instantly to this user */}
                              {!isCurrent && (
                                <button
                                  onClick={() => {
                                    handleSwitchUser(u.id);
                                    alert(`Perfil operacional de teste chaveado para: ${u.name}`);
                                  }}
                                  className="px-2 py-1 bg-surface border border-outline text-[10px] font-bold rounded text-on-surface hover:border-primary hover:text-primary cursor-pointer transition-all"
                                  title="Chavear para esta credencial"
                                >
                                  Chavear
                                </button>
                              )}
                              
                              {/* Excluir customized staff */}
                              {!isBuiltIn && !isCurrent ? (
                                <button
                                  onClick={async () => {
                                    if (confirm(`Deseja revogar o acesso de "${u.name}" do sistema?`)) {
                                      try {
                                        await deleteDoc(doc(db, 'users', u.id));
                                        alert('Acesso revogado com sucesso.');
                                      } catch (error) {
                                        handleFirestoreError(error, OperationType.DELETE, `users/${u.id}`);
                                      }
                                    }
                                  }}
                                  className="p-1 text-on-surface-variant hover:text-rose-400 hover:bg-rose-500/10 rounded cursor-pointer transition-colors"
                                  title="Revogar credencial"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div className="p-3.5 bg-surface-container-low text-[10px] text-on-surface-variant flex items-center gap-1.5 font-mono select-none">
                    <Info className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Para preservar a segurança corporativa, usuários raiz não podem ser excluídos pelo sandbox.</span>
                  </div>
                </div>

              </div>

              {/* Permissions Matrix Table */}
              <div className="space-y-3 border-t border-outline-variant/30 pt-6">
                <div className="flex items-center gap-2">
                  <span className="p-1 px-1.5 bg-primary/10 border border-primary/25 text-primary rounded text-[9px] uppercase font-bold font-mono">Regras de Negócio</span>
                  <h4 className="text-xs font-bold text-on-surface">Matriz de Controles e Direitos de Segurança do Sistema</h4>
                </div>
                
                <div className="overflow-x-auto border border-outline rounded-xl bg-surface-container-lowest shadow-sm">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-surface-container border-b border-outline text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                        <th className="px-4 py-2.5">Funcionalidade / Ações do Mapeamento</th>
                        <th className="px-4 py-2.5 text-center">GECTI (Admin)</th>
                        <th className="px-4 py-2.5 text-center">Fiscal Técnico</th>
                        <th className="px-4 py-2.5 text-center">Auditor Fiscal</th>
                        <th className="px-4 py-2.5 text-center">Visualizador Geral</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline">
                      <tr className="hover:bg-surface-container/10">
                        <td className="px-4 py-2.5 font-medium text-on-surface">Cadastrar / Retificar DFD no Planejamento Orçamentário</td>
                        <td className="px-4 py-2.5 text-center font-bold text-emerald-400">Sim</td>
                        <td className="px-4 py-2.5 text-center text-rose-400/50 italic">Não (Leitura)</td>
                        <td className="px-4 py-2.5 text-center text-rose-400/50 italic">Não (Leitura)</td>
                        <td className="px-4 py-2.5 text-center text-rose-400/50 italic">Não (Leitura)</td>
                      </tr>
                      <tr className="hover:bg-surface-container/10">
                        <td className="px-4 py-2.5 font-medium text-on-surface">Instrução processual e Alterar Fases (Mover Kanban)</td>
                        <td className="px-4 py-2.5 text-center font-bold text-emerald-400">Sim</td>
                        <td className="px-4 py-2.5 text-center font-bold text-emerald-400">Sim</td>
                        <td className="px-4 py-2.5 text-center text-rose-400/50 italic">Não (Leitura)</td>
                        <td className="px-4 py-2.5 text-center text-rose-400/50 italic">Não (Leitura)</td>
                      </tr>
                      <tr className="hover:bg-surface-container/10">
                        <td className="px-4 py-2.5 font-medium text-on-surface">Editar Contratos, Aditivos, Faturas e Pagamentos</td>
                        <td className="px-4 py-2.5 text-center font-bold text-emerald-400">Sim</td>
                        <td className="px-4 py-2.5 text-center font-bold text-emerald-400">Sim</td>
                        <td className="px-4 py-2.5 text-center text-rose-400/50 italic">Não (Leitura)</td>
                        <td className="px-4 py-2.5 text-center text-rose-400/50 italic">Não (Leitura)</td>
                      </tr>
                      <tr className="hover:bg-surface-container/10">
                        <td className="px-4 py-2.5 font-medium text-on-surface">Retificar CNPJ e Deletar Cadastros Gerais (Fornecedores, Contratos)</td>
                        <td className="px-4 py-2.5 text-center font-bold text-emerald-400">Sim</td>
                        <td className="px-4 py-2.5 text-center text-rose-400/50 italic">Não (Leitura)</td>
                        <td className="px-4 py-2.5 text-center text-rose-400/50 italic">Não (Leitura)</td>
                        <td className="px-4 py-2.5 text-center text-rose-400/50 italic">Não (Leitura)</td>
                      </tr>
                      <tr className="hover:bg-surface-container/10">
                        <td className="px-4 py-2.5 font-medium text-on-surface">Habilitar Servidores e Modificar Perfis (Gerenciar Equipe)</td>
                        <td className="px-4 py-2.5 text-center font-bold text-emerald-400">Sim</td>
                        <td className="px-4 py-2.5 text-center text-rose-400/50 italic">Não</td>
                        <td className="px-4 py-2.5 text-center text-rose-400/50 italic">Não</td>
                        <td className="px-4 py-2.5 text-center text-rose-400/50 italic">Não</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-surface-container-high px-6 py-3 border-t border-outline flex justify-end shrink-0">
              <button
                onClick={() => {
                  setIsTeamModalOpen(false);
                  setNewMemberName('');
                  setNewMemberEmail('');
                  setNewMemberRole('Fiscal');
                }}
                className="px-5 py-2 bg-primary text-on-primary rounded text-xs font-bold hover:opacity-95 shadow cursor-pointer"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Complete procurement journey tracker & PDF lineage auditor modal */}
      {lineageTrackItemId && (
        <RastreabilidadeModal
          itemId={lineageTrackItemId}
          itemType={lineageTrackType}
          dfds={dfds}
          planejamentos={planejamentos}
          contratos={contratos}
          itensSOF={itensSOF}
          itensPlanejamentoSOF={itensPlanejamentoSOF}
          aditivos={aditivos}
          apostilamentos={apostilamentos}
          pagamentos={pagamentos}
          fornecedores={fornecedores}
          currentLocalTime={currentLocalTime}
          onClose={() => setLineageTrackItemId(null)}
        />
      )}

      {/* Flow Stage: Planejamento da Contratação Modal */}
      {flowModalStage === 'planejamento' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-surface border border-outline rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-150 font-sans">
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-high shrink-0">
              <div className="flex items-center gap-2 text-blue-400">
                <FileSpreadsheet className="w-5 h-5" />
                <div>
                  <h3 className="text-sm font-bold text-on-surface">Planejamento da Contratação (Fase Interna)</h3>
                  <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">Estudos e documentos preparatórios para a contratação de soluções de TIC.</p>
                </div>
              </div>
              <button 
                onClick={() => setFlowModalStage(null)}
                className="text-on-surface-variant hover:text-on-surface p-1.5 hover:bg-surface-container/60 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-on-surface-variant leading-relaxed">
                  Estes processos representam as demandas de tecnologia da GECTI que se encontram em fase de instrução processual (elaboração de ETP, TR, Pesquisa de Preços e consolidação de itens SOF).
                </p>
              </div>

              <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface-container-low">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-surface-container border-b border-outline-variant text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">
                      <th className="px-4 py-2.5">Identificador/Processo</th>
                      <th className="px-4 py-2.5">Objeto Desejado</th>
                      <th className="px-4 py-2.5">Requisitante</th>
                      <th className="px-4 py-2.5 text-right">Custo Estimativo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {planejamentos.filter(p => p.Status_Planejamento === 'Em Elaboração').length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-on-surface-variant italic">Nenhum processo nesta fase no momento.</td>
                      </tr>
                    ) : (
                      planejamentos.filter(p => p.Status_Planejamento === 'Em Elaboração').map(p => (
                        <tr key={p.id} className="hover:bg-surface-container-high/30">
                          <td className="px-4 py-3 font-mono font-bold text-primary">
                            <div className="flex items-center gap-1">
                              <span>{p.SEI_Processo || 'N/A'}</span>
                              <CopyButton text={p.SEI_Processo} label="Processo SEI" />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-on-surface font-medium max-w-xs truncate" title={p.Objeto}>{p.Objeto}</td>
                          <td className="px-4 py-3 text-on-surface-variant">{p.Int_Requisitante}</td>
                          <td className="px-4 py-3 text-right font-semibold font-mono text-primary">{formatCurrency(getPlanningCusto(p))}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-outline bg-surface-container-high flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3 text-[10px] text-on-surface-variant font-mono">
                <span>Total: <strong>{planejamentos.filter(p => p.Status_Planejamento === 'Em Elaboração').length}</strong> processos ativos</span>
                <span>•</span>
                <span>Soma Estimada: <strong className="text-primary font-bold">{formatCurrency(planejamentos.filter(p => p.Status_Planejamento === 'Em Elaboração').reduce((acc, curr) => acc + getPlanningCusto(curr), 0))}</strong></span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFlowModalStage(null)}
                  className="px-4 py-1.5 border border-outline hover:bg-surface-container text-on-surface font-semibold rounded text-xs transition-colors cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  onClick={() => {
                    setFlowModalStage(null);
                    setActivePage('planejamentos');
                  }}
                  className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-on-primary font-bold rounded text-xs transition-colors cursor-pointer shadow flex items-center gap-1"
                >
                  Ir para Planejamentos
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Flow Stage: Seleção de Fornecedor Modal */}
      {flowModalStage === 'selecao' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-surface border border-outline rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-150 font-sans">
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-high shrink-0">
              <div className="flex items-center gap-2 text-amber-400">
                <Gavel className="w-5 h-5" />
                <div>
                  <h3 className="text-sm font-bold text-on-surface">Seleção de Fornecedor (Fase Externa / Licitação)</h3>
                  <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">Certame licitatório e procedimentos de contratação pública.</p>
                </div>
              </div>
              <button 
                onClick={() => setFlowModalStage(null)}
                className="text-on-surface-variant hover:text-on-surface p-1.5 hover:bg-surface-container/60 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-on-surface-variant leading-relaxed">
                  Estes processos estão em fase externa de licitação (Pregrão Eletrônico, Dispensa ou Contratação Direta) no Compras.gov ou aguardando adjudicação/homologação.
                </p>
              </div>

              <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface-container-low">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-surface-container border-b border-outline-variant text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">
                      <th className="px-4 py-2.5">Processo SEI</th>
                      <th className="px-4 py-2.5">Objeto</th>
                      <th className="px-4 py-2.5">Modalidade</th>
                      <th className="px-4 py-2.5">Link da Sessão</th>
                      <th className="px-4 py-2.5 text-right">Custo Estimativo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {planejamentos.filter(p => p.Status_Planejamento === 'Seleção Fornecedor').length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-on-surface-variant italic">Nenhum processo de licitação em curso no momento.</td>
                      </tr>
                    ) : (
                      planejamentos.filter(p => p.Status_Planejamento === 'Seleção Fornecedor').map(p => (
                        <tr key={p.id} className="hover:bg-surface-container-high/30">
                          <td className="px-4 py-3 font-mono font-bold text-primary">
                            <div className="flex items-center gap-1">
                              <span>{p.SEI_Processo || 'N/A'}</span>
                              <CopyButton text={p.SEI_Processo} label="Processo SEI" />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-on-surface font-medium max-w-xs truncate" title={p.Objeto}>{p.Objeto}</td>
                          <td className="px-4 py-3 text-on-surface-variant">{p.Tipo_Processo || 'Pregão SOF'}</td>
                          <td className="px-4 py-3">
                            {p.Link_Sessao ? (
                              <a
                                href={p.Link_Sessao}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1 font-semibold text-[11px]"
                              >
                                <span>Acessar Sessão</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-on-surface-variant/40 italic text-[11px]">Não cadastrado</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold font-mono text-amber-400">{formatCurrency(getPlanningCusto(p))}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-outline bg-surface-container-high flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3 text-[10px] text-on-surface-variant font-mono">
                <span>Total: <strong>{planejamentos.filter(p => p.Status_Planejamento === 'Seleção Fornecedor').length}</strong> licitações</span>
                <span>•</span>
                <span>Soma Estimada: <strong className="text-amber-400 font-bold">{formatCurrency(planejamentos.filter(p => p.Status_Planejamento === 'Seleção Fornecedor').reduce((acc, curr) => acc + getPlanningCusto(curr), 0))}</strong></span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFlowModalStage(null)}
                  className="px-4 py-1.5 border border-outline hover:bg-surface-container text-on-surface font-semibold rounded text-xs transition-colors cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  onClick={() => {
                    setFlowModalStage(null);
                    setActivePage('planejamentos');
                  }}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-on-primary font-bold rounded text-xs transition-colors cursor-pointer shadow flex items-center gap-1"
                >
                  Ir para Planejamentos
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Flow Stage: Gestão de Contrato Modal */}
      {flowModalStage === 'contrato' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-surface border border-outline rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-150 font-sans">
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-high shrink-0">
              <div className="flex items-center gap-2 text-emerald-400">
                <Handshake className="w-5 h-5" />
                <div>
                  <h3 className="text-sm font-bold text-on-surface">Gestão Contratual (Fase de Execução)</h3>
                  <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">Acompanhamento, fiscalização, faturas e empenhos de TIC.</p>
                </div>
              </div>
              <button 
                onClick={() => setFlowModalStage(null)}
                className="text-on-surface-variant hover:text-on-surface p-1.5 hover:bg-surface-container/60 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-start gap-2.5">
                <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-on-surface-variant leading-relaxed">
                  Estes são os contratos vigentes administrados pela GECTI, gerando empenhos anuais e acompanhados por gestores e fiscais designados.
                </p>
              </div>

              <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface-container-low">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-surface-container border-b border-outline-variant text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">
                      <th className="px-4 py-2.5">Contrato</th>
                      <th className="px-4 py-2.5">Objeto</th>
                      <th className="px-4 py-2.5">Fornecedor</th>
                      <th className="px-4 py-2.5 text-right">Valor Anual Itens SOF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {contratos.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-on-surface-variant italic">Nenhum contrato ativo cadastrado.</td>
                      </tr>
                    ) : (
                      contratos.map(c => {
                        const activeItems = (itensSOF || []).filter(i => 
                          (i.Num_Contrato === c.id || i.Num_Contrato === c.Num_Contrato) && 
                          i.Status_Item === 'Ativo'
                        );
                        const totalSOFItemsVal = activeItems.reduce((acc, curr) => acc + (curr.Quantidade * curr.Valor_Unitario), 0);
                        const meses = c.Vigencia_Inicial_Meses || 12;
                        const valorAnualItensSOF = (totalSOFItemsVal / meses) * 12;

                        return (
                          <tr 
                            key={c.id} 
                            onClick={() => {
                              setFlowModalStage(null);
                              setTourContractId(c.id);
                              setActivePage('contratos');
                            }}
                            className="hover:bg-surface-container-high/60 cursor-pointer transition-colors"
                            title="Clique para abrir os detalhes deste contrato"
                          >
                            <td className="px-4 py-3 font-mono font-bold text-primary">
                              <div className="flex items-center gap-1">
                                <span className="hover:underline">{c.Num_Contrato || 'N/A'}</span>
                                <CopyButton text={c.Num_Contrato} label="Contrato" />
                              </div>
                            </td>
                            <td className="px-4 py-3 text-on-surface font-medium max-w-xs truncate" title={c.Objeto}>{c.Objeto}</td>
                            <td className="px-4 py-3 text-on-surface-variant">
                              {(() => {
                                const f = fornecedores.find(forn => forn.id === c.Fornecedor || forn.CNPJ === c.Fornecedor || forn.Nome_Fornecedor === c.Fornecedor);
                                return f ? f.Nome_Fornecedor : (c.Fornecedor || 'N/A');
                              })()}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold font-mono text-emerald-400" title={activeItems.length > 0 ? `${activeItems.length} item(ns) da SOF ativo(s)` : 'Sem itens da SOF cadastrados'}>
                              {formatCurrency(valorAnualItensSOF)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-outline bg-surface-container-high flex justify-between items-center shrink-0">
              <span className="text-[10px] text-on-surface-variant">Total: {contratos.length} contratos vigentes</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setFlowModalStage(null)}
                  className="px-4 py-1.5 border border-outline hover:bg-surface-container text-on-surface font-semibold rounded text-xs transition-colors cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  onClick={() => {
                    setFlowModalStage(null);
                    setActivePage('contratos');
                  }}
                  className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-on-primary font-bold rounded text-xs transition-colors cursor-pointer shadow flex items-center gap-1"
                >
                  Ir para Contratos
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gestão de Descentralizações Orçamentárias (MPO ➔ MGI) */}
      {isDescentralizacaoModalOpen && selectedContractForDescentralizacao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-surface-container border border-outline rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-outline flex justify-between items-center bg-surface-container-high shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                    Descentralização Orçamentária — Contrato {selectedContractForDescentralizacao.Num_Contrato}
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    {selectedContractForDescentralizacao.Objeto} • SEI: {selectedContractForDescentralizacao.SEI_Processo}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsDescentralizacaoModalOpen(false);
                  setSelectedContractForDescentralizacao(null);
                  setQuickEditOSId(null);
                }}
                className="p-1 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
              {/* Context Summary Cards */}
              {(() => {
                const c = selectedContractForDescentralizacao;
                const sofInfo = getContractSOFValueForYear(c, targetYearInt, false);
                const valAnualSOF = sofInfo.value;

                let cEmpenhado = 0;
                let cDescentralizado = 0;
                (c.ordensServico || []).forEach(os => {
                  if (os.statusOS === 'Cancelada') return;
                  const isEmp = !!(os.numeroEmpenho && os.numeroEmpenho.trim() !== '') || ['Empenhado', 'Liquidado', 'Pago'].includes(os.statusOS);
                  if (isEmp) cEmpenhado += (os.valorEmpenho || os.valor || 0);
                  if (os.descentralizacaoValor) cDescentralizado += os.descentralizacaoValor;
                });
                const cSobra = Math.max(0, cEmpenhado - cDescentralizado);

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-surface-container-low border border-outline-variant p-3 rounded-lg">
                      <span className="text-[10px] uppercase font-bold text-on-surface-variant">Valor Anual Itens SOF</span>
                      <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">{formatCurrency(valAnualSOF)}</div>
                    </div>
                    <div className="bg-surface-container-low border border-outline-variant p-3 rounded-lg">
                      <span className="text-[10px] uppercase font-bold text-on-surface-variant">Total Empenhado</span>
                      <div className="text-base font-bold font-mono text-amber-400 mt-0.5">{formatCurrency(cEmpenhado)}</div>
                    </div>
                    <div className="bg-surface-container-low border border-outline-variant p-3 rounded-lg">
                      <span className="text-[10px] uppercase font-bold text-on-surface-variant">Total Descentralizado</span>
                      <div className="text-base font-bold font-mono text-sky-400 mt-0.5">{formatCurrency(cDescentralizado)}</div>
                    </div>
                    <div className="bg-surface-container-low border border-outline-variant p-3 rounded-lg">
                      <span className="text-[10px] uppercase font-bold text-on-surface-variant">Saldo Sobra Retida</span>
                      <div className={`text-base font-bold font-mono mt-0.5 ${cSobra > 0 ? 'text-emerald-400' : 'text-on-surface-variant'}`}>{formatCurrency(cSobra)}</div>
                    </div>
                  </div>
                );
              })()}

              {/* Explanatory note */}
              <div className="p-3.5 bg-sky-950/20 border border-sky-800/30 rounded-xl text-sky-300 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 shrink-0 text-sky-400 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Diretriz de Execução Orçamentária:</strong> Para contratos gerenciados por outros órgãos (ex: MGI), os valores só saem efetivamente do orçamento da SOF quando a Nota de Descentralização for formalizada no SEI. Caso o órgão execute sem solicitar a descentralização, o valor permanece retido na SOF como sobra potencial.
                </div>
              </div>

              {/* Tabela de Ordens de Serviço e Descentralizações */}
              <div className="space-y-2">
                <h4 className="text-xs uppercase font-bold text-on-surface tracking-wider">
                  Ordens de Serviço do Contrato & Status de Descentralização
                </h4>

                <div className="overflow-x-auto rounded-lg border border-outline-variant">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-surface-container-high border-b border-outline-variant text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">
                        <th className="px-3 py-2">Nº OS</th>
                        <th className="px-3 py-2">Data / Período</th>
                        <th className="px-3 py-2 text-right">Valor OS</th>
                        <th className="px-3 py-2">Empenho (MGI)</th>
                        <th className="px-3 py-2">Processo SEI Descentralização</th>
                        <th className="px-3 py-2 text-right">Valor Descentralizado</th>
                        <th className="px-3 py-2">Memorial / Observação</th>
                        <th className="px-3 py-2 text-center">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/30">
                      {(!selectedContractForDescentralizacao.ordensServico || selectedContractForDescentralizacao.ordensServico.length === 0) ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-6 text-center text-on-surface-variant italic">
                            Nenhuma Ordem de Serviço cadastrada para este contrato. Você pode cadastrar ordens de serviço e descentralizações no módulo de Contratos.
                          </td>
                        </tr>
                      ) : (
                        selectedContractForDescentralizacao.ordensServico.map(os => {
                          return (
                            <tr key={os.id} className="hover:bg-surface-container-high/30">
                              <td className="px-3 py-2.5 font-bold font-mono text-primary">
                                {os.numeroOS}
                              </td>
                              <td className="px-3 py-2.5 text-on-surface-variant font-mono text-[11px]">
                                {os.dataEmissao ? formatDate(os.dataEmissao) : '—'}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono font-semibold text-on-surface">
                                {formatCurrency(os.valor || 0)}
                              </td>
                              <td className="px-3 py-2.5 font-mono text-[11px]">
                                {os.numeroEmpenho ? (
                                  <span className="text-amber-400 font-semibold">{os.numeroEmpenho}</span>
                                ) : (
                                  <span className="text-on-surface-variant italic">Pendente</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 font-mono text-[11px]">
                                {os.descentralizacaoSei ? (
                                  <span className="text-sky-400 font-semibold">{os.descentralizacaoSei}</span>
                                ) : (
                                  <span className="text-amber-400/80 italic">Não descentralizado</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono font-bold">
                                {os.descentralizacaoValor ? (
                                  <span className="text-sky-400">{formatCurrency(os.descentralizacaoValor)}</span>
                                ) : (
                                  <span className="text-on-surface-variant">R$ 0,00</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-on-surface-variant max-w-[150px] truncate" title={os.descentralizacaoDescricao || os.observacao}>
                                {os.descentralizacaoDescricao || os.observacao || '—'}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <button
                                  onClick={() => {
                                    setQuickEditOSId(os.id);
                                    setQuickDescSei(os.descentralizacaoSei || '');
                                    setQuickDescValor(os.descentralizacaoValor || os.valor || 0);
                                    setQuickDescObs(os.descentralizacaoDescricao || '');
                                  }}
                                  className="px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded text-[10px] font-semibold transition-colors cursor-pointer"
                                >
                                  Editar
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Form de Edição Rápida da Descentralização da OS */}
              {quickEditOSId && (
                <div className="bg-surface-container-low border border-primary/40 rounded-xl p-4 space-y-4 animate-in fade-in duration-150">
                  <div className="flex justify-between items-center pb-2 border-b border-outline-variant/40">
                    <h5 className="text-xs uppercase font-bold text-primary flex items-center gap-1.5">
                      <Edit className="w-3.5 h-3.5" />
                      Lançar / Atualizar Descentralização da OS (
                      {selectedContractForDescentralizacao.ordensServico?.find(o => o.id === quickEditOSId)?.numeroOS}
                      )
                    </h5>
                    <button
                      onClick={() => setQuickEditOSId(null)}
                      className="text-on-surface-variant hover:text-on-surface text-xs cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-on-surface-variant mb-1">
                        Processo SEI da Descentralização
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 10180.100452/2026-11"
                        value={quickDescSei}
                        onChange={(e) => setQuickDescSei(e.target.value)}
                        className="w-full px-3 py-1.5 bg-surface-container border border-outline rounded-lg text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-on-surface-variant mb-1">
                        Valor Descentralizado pela SOF (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={quickDescValor || ''}
                        onChange={(e) => setQuickDescValor(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 bg-surface-container border border-outline rounded-lg text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-on-surface-variant mb-1">
                        Memorial de Cálculo / Descrição do Repasse
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Ex: Descentralização de crédito orçamentário para o MGI referente ao 1º trimestre de execução dos serviços de TIC da SOF."
                        value={quickDescObs}
                        onChange={(e) => setQuickDescObs(e.target.value)}
                        className="w-full px-3 py-1.5 bg-surface-container border border-outline rounded-lg text-xs text-on-surface focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setQuickEditOSId(null)}
                      className="px-3 py-1.5 border border-outline text-on-surface hover:bg-surface-container rounded text-xs font-medium cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => {
                        if (!selectedContractForDescentralizacao) return;
                        const updatedOss = (selectedContractForDescentralizacao.ordensServico || []).map(os => {
                          if (os.id === quickEditOSId) {
                            return {
                              ...os,
                              descentralizacaoSei: quickDescSei.trim(),
                              descentralizacaoValor: quickDescValor,
                              descentralizacaoDescricao: quickDescObs.trim()
                            };
                          }
                          return os;
                        });
                        const updatedContract: Contrato = {
                          ...selectedContractForDescentralizacao,
                          ordensServico: updatedOss
                        };
                        handleEditContrato(updatedContract);
                        setSelectedContractForDescentralizacao(updatedContract);
                        setQuickEditOSId(null);
                      }}
                      className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-on-primary rounded text-xs font-bold shadow transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Salvar Descentralização
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-outline bg-surface-container-high flex justify-between items-center shrink-0">
              <span className="text-[11px] text-on-surface-variant">
                Atualização em tempo real sincronizada com o banco institucional.
              </span>
              <button
                onClick={() => {
                  setIsDescentralizacaoModalOpen(false);
                  setSelectedContractForDescentralizacao(null);
                  setQuickEditOSId(null);
                }}
                className="px-4 py-1.5 bg-surface-container hover:bg-surface-container-high border border-outline text-on-surface font-semibold rounded text-xs transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calculadora do ICTI Pop-Up Modal */}
      <CalculadoraICTIModal
        isOpen={isIctiCalculatorOpen}
        onClose={() => setIsIctiCalculatorOpen(false)}
        contratos={contratos}
        fornecedores={fornecedores}
        aditivos={aditivos}
        apostilamentos={apostilamentos}
        initialContratoId={ictiCalculatorContractId}
      />

      {/* Guided Tour Overlay Engine */}
      {activeTourId && (
        <GuidedTourOverlay
          tourId={activeTourId}
          userRole={currentUser?.role}
          onClose={() => setActiveTourId(null)}
          onComplete={(id) => handleCompleteTour(id || activeTourId)}
        />
      )}

      {/* Manual Guiado Central Hub Modal */}
      <ManualGuiadoHubModal
        isOpen={isManualHubOpen}
        userRole={currentUser?.role}
        onClose={() => setIsManualHubOpen(false)}
        completedTours={completedTours}
        onStartTour={handleSelectTourFromHub}
        onSelectTour={handleSelectTourFromHub}
        onResetTours={handleResetTours}
      />

    </div>
  );
}
