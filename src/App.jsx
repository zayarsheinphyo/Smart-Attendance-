import React, { useState, useEffect, useRef } from 'react';
import { Camera, UserPlus, Trash2, Mail, Users, ClipboardList, Clock, Calendar, CheckCircle, XCircle, AlertCircle, QrCode, ScanLine, ArrowLeft, Sparkles, Bot, CalendarOff, Settings, CalendarDays, Save, Lock, Unlock, BarChart3, Download, FileSpreadsheet, LayoutDashboard, TrendingUp, Edit2, AlertTriangle } from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

// --- Firebase Initialization ---
let db, auth, appId;
try {
  const firebaseConfig = {
    apiKey: "AIzaSyBxIviVLLdzgt0okkO66Iabri_dYOd9TCU",
    authDomain: "smart-attendance-3fb9c.firebaseapp.com",
    projectId: "smart-attendance-3fb9c",
    storageBucket: "smart-attendance-3fb9c.firebasestorage.app",
    messagingSenderId: "356575957874",
    appId: "1:356575957874:web:d671b425a697031f4a83eb",
    measurementId: "G-WSWXCWS66H"
  };
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  appId = firebaseConfig.projectId;
} catch (error) {
  console.error("Firebase init error:", error);
}

export default function App() {
  // --- Auth State ---
  const [user, setUser] = useState(null);

  // --- Admin Security States ---
  const DEFAULT_PASSWORD = "DIGITLIGHT";
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [pendingTab, setPendingTab] = useState(null);
  const [customAdminPassword, setCustomAdminPassword] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');

  const [selectedDashboardEmpId, setSelectedDashboardEmpId] = useState(null); 

  // --- App States ---
  const [activeTab, setActiveTab] = useState('attendance');
  const [dashboardFilter, setDashboardFilter] = useState('month'); 
  
  // New Month Picker State
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [offDaysLimit, setOffDaysLimit] = useState(2);
  const [startTime, setStartTime] = useState('08:00'); 
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);
  
  // New/Edit Employee Form
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpPosition, setNewEmpPosition] = useState('');
  const [editingEmpId, setEditingEmpId] = useState(null);

  // Camera & QR States
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [notification, setNotification] = useState(null);
  const isCapturingRef = useRef(false);

  const [isScanningQR, setIsScanningQR] = useState(false);
  const [scannedEmployee, setScannedEmployee] = useState(null);
  const [showQrModal, setShowQrModal] = useState(null);
  const qrVideoRef = useRef(null);
  const qrCanvasRef = useRef(null);
  const qrStreamRef = useRef(null);
  const scanIntervalRef = useRef(null);

  // Off Days Modal State
  const [editingOffDaysEmp, setEditingOffDaysEmp] = useState(null);
  const [tempOffDays, setTempOffDays] = useState([]);

  // Delete Old Records States
  const [deleteBeforeDate, setDeleteBeforeDate] = useState('');
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // AI States
  const [welcomeModal, setWelcomeModal] = useState(null);
  const [aiReport, setAiReport] = useState(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const apiKey = "AIzaSyACLR7KxwlwhQZ5urDgvn-5STILAGZPbs8";

  // --- Firebase Listeners ---
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const unsubEmp = onSnapshot(collection(db, 'artifacts', appId, 'users', "shared_company", 'employees'), (snap) => {
      const emps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      emps.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      setEmployees(emps);
    });
    const unsubRec = onSnapshot(collection(db, 'artifacts', appId, 'users', "shared_company", 'records'), (snap) => {
      const recs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      recs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setRecords(recs);
    });
    const unsubSet = onSnapshot(doc(db, 'artifacts', appId, 'users', "shared_company", 'settings', 'general'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setOffDaysLimit(data.offDaysLimit ?? 2);
        setCustomAdminPassword(data.customAdminPassword || "");
        setStartTime(data.startTime || "08:00");
      }
    });
    return () => { unsubEmp(); unsubRec(); unsubSet(); };
  }, [user]);

  // --- Admin Navigation Logic ---
  const handleTabChange = (tabName) => {
    if (tabName === 'attendance') {
      setActiveTab(tabName);
    } else {
      if (isAdminAuthenticated) {
        setActiveTab(tabName);
      } else {
        setPendingTab(tabName);
        setShowLoginModal(true);
      }
    }
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (passwordInput === DEFAULT_PASSWORD || (customAdminPassword && passwordInput === customAdminPassword)) {
      setIsAdminAuthenticated(true);
      setShowLoginModal(false);
      setPasswordInput('');
      if (pendingTab) setActiveTab(pendingTab);
      showNotification('Admin အဖြစ် အောင်မြင်စွာ ဝင်ရောက်ပါပြီရှင့်');
    } else {
      showNotification('စကားဝှက် မှားယွင်းနေပါသည်ရှင့်', 'error');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    setActiveTab('attendance');
    showNotification('Admin မှ ထွက်ပြီးပါပြီရှင့်');
  };

  const saveNewAdminPassword = async () => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', "shared_company", 'settings', 'general'), {
        customAdminPassword: newPasswordInput
      }, { merge: true });
      setNewPasswordInput('');
      showNotification('Admin Password အသစ် သတ်မှတ်ပြီးပါပြီရှင့်။');
    } catch (err) {
      console.error(err);
    }
  };

  // --- Delete Old Records Logic ---
  const executeDeleteOldRecords = async () => {
    if (!user || !deleteBeforeDate) return;
    setIsDeleting(true);
    try {
      const targetTime = new Date(deleteBeforeDate).getTime();
      const recordsToDelete = records.filter(r => r.createdAt && r.createdAt < targetTime);
      
      const promises = recordsToDelete.map(r => deleteDoc(doc(db, 'artifacts', appId, 'users', "shared_company", 'records', r.id)));
      await Promise.all(promises);
      
      showNotification(`မှတ်တမ်းဟောင်း ${recordsToDelete.length} ခုကို အောင်မြင်စွာ ဖျက်ပစ်ပြီးပါပြီရှင့်။`);
      setDeleteBeforeDate('');
      setShowDeleteConfirmModal(false);
    } catch (error) {
      showNotification('မှတ်တမ်းများ ဖျက်ရာတွင် အခက်အခဲရှိပါသည်ရှင့်။', 'error');
    }
    setIsDeleting(false);
  };

  // --- Helpers & Stats Calculation ---
  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const getStats = (period) => {
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-GB'); 
    const todayDateNum = now.getDate();
    const isPastNoon = now.getHours() >= 12;

    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const isCurrentMonthView = selectedMonth === currentMonthStr;

    let targetMonthSuffix = "";
    if (period === 'month') {
      const [year, month] = selectedMonth.split('-');
      targetMonthSuffix = `${month}/${year}`;
    }

    return employees.map(emp => {
      let empRecords = records.filter(r => r.employeeId === emp.id);
      
      if (period === 'today') {
        empRecords = empRecords.filter(r => r.date === todayStr);
      } else if (period === 'month') {
        empRecords = empRecords.filter(r => r.date && r.date.endsWith(targetMonthSuffix));
      }

      const totalLate = empRecords.reduce((sum, r) => {
        if (!r.date) return sum;
        const dNum = parseInt(r.date.split('/')[0], 10);
        return emp.offDays?.includes(dNum) ? sum : sum + (r.lateMinutes || 0);
      }, 0);
      let absences = empRecords.filter(r => {
        if (!r.date) return false;
        const dNum = parseInt(r.date.split('/')[0], 10);
        return r.isAbsent && !emp.offDays?.includes(dNum);
      }).length;

      const isTodayOffDay = emp.offDays?.includes(todayDateNum);
      const hasCheckedInToday = records.some(r => r.employeeId === emp.id && r.date === todayStr);
      const hasAbsentRecordToday = empRecords.some(r => r.date === todayStr && r.isAbsent);

      // Only add auto-absence for "today" if we are viewing the current month
      if ((period === 'today' || (period === 'month' && isCurrentMonthView)) && !isTodayOffDay && !hasCheckedInToday && isPastNoon && !hasAbsentRecordToday) {
        absences += 1;
      }

      return { ...emp, totalLate, absences, isTodayOffDay };
    });
  };

  const monthlyStats = getStats('month');
  const todayStats = getStats('today');
  
  const dashboardStats = dashboardFilter === 'today' ? todayStats : monthlyStats;
  const totalEmployees = employees.length;
  const totalAbsences = dashboardStats.reduce((sum, e) => sum + e.absences, 0);
  const totalLateMinutes = dashboardStats.reduce((sum, e) => sum + e.totalLate, 0);

  const problematicEmployees = dashboardStats.filter(e => e.totalLate > 0 || e.absences > 0);

  const getChartData = () => {
    const names = dashboardStats.map(s => s.name);
    const totals = dashboardStats.map(s => s.totalLate);
    const maxVal = Math.max(...totals, 60); 
    return { names, totals, maxVal };
  };

  const chartData = getChartData();

  // Get Formatted selected month (e.g. 05/2026)
  const [sYear, sMonth] = selectedMonth.split('-');
  const formattedSelectedMonth = `${sMonth}/${sYear}`;

  // --- Export Functions ---
  const exportToExcel = () => {
    const headers = ["အမည်", "ရာထူး", "ပျက်ရက် (ရက်)", "နောက်ကျချိန် (မိနစ်)", "မှတ်ချက်"];
    const rows = monthlyStats.map(emp => [
      `"${emp.name}"`, 
      `"${emp.position}"`, 
      emp.absences, 
      emp.totalLate, 
      `"${emp.absences > 0 ? 'ပျက်ရက်ရှိသည်' : emp.totalLate > 60 ? 'သတိပေးရန်' : 'ပုံမှန်'}"`
    ]);
    
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Attendance_Report_${formattedSelectedMonth.replace(/\//g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Excel/CSV ဖိုင် ဒေါင်းလုဒ်ဆွဲပြီးပါပြီရှင့်');
  };

  const printToPDF = () => {
    const element = document.getElementById('printable-report');
    if (window.html2pdf && element) {
      showNotification('PDF ဖိုင် ပြင်ဆင်နေပါသည်၊ ခဏစောင့်ပါရှင့်...');
      const opt = {
        margin:       10,
        filename:     `Attendance_Report_${formattedSelectedMonth.replace(/\//g, '-')}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      window.html2pdf().set(opt).from(element).save().then(() => {
         showNotification('PDF ဖိုင် ဒေါင်းလုဒ်ဆွဲပြီးပါပြီရှင့်');
      });
    } else {
      window.print();
    }
  };

  // --- Gemini API ---
  const callGemini = async (prompt, retries = 5) => {
    const delays = [1000, 2000, 4000, 8000, 16000];
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch('/api/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "တောင်းပန်ပါတယ်၊ AI မှ အဖြေမရရှိပါ။";
      } catch (err) {
        if (i === retries - 1) return "တောင်းပန်ပါတယ်၊ AI ဆာဗာ ချိတ်ဆက်၍ မရပါ။";
        await new Promise(res => setTimeout(res, delays[i]));
      }
    }
  };

  const generateAiReport = async () => {
    setIsGeneratingReport(true);
    const reportDataStr = monthlyStats.map(emp => 
      `${emp.name} (${emp.position}) - ပျက်ရက်: ${emp.absences} ရက်, နောက်ကျချိန်: ${emp.totalLate} မိနစ်`
    ).join('\n');

    const prompt = `You are an expert HR Manager. Here is the attendance summary for the month of ${formattedSelectedMonth}:
${reportDataStr}
Please write a short, encouraging performance review and HR advice in Burmese based on this data. Praise those with 0 late minutes and 0 absences. Suggest improvements for those who are late or absent. Note that missing check-in by 12 PM counts as a full absence. Use a professional yet friendly tone. Respond ONLY in Burmese. Format beautifully using markdown if appropriate.`;

    const response = await callGemini(prompt);
    setAiReport(response);
    setIsGeneratingReport(false);
  };

  // --- Handlers (CRUD, QR, Camera) ---
  useEffect(() => {
    if (!window.jsQR) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
      script.async = true;
      document.body.appendChild(script);
    }
    if (!window.html2pdf) {
      const scriptPDF = document.createElement('script');
      scriptPDF.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      scriptPDF.async = true;
      document.body.appendChild(scriptPDF);
    }
    return () => stopQrScanner();
  }, []);

  const handleAddOrEditEmployee = async (e) => {
    e.preventDefault();
    if (!newEmpName.trim() || !user) return;
    try {
      if (editingEmpId) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', "shared_company", 'employees', editingEmpId), {
          name: newEmpName, position: newEmpPosition || 'ဝန်ထမ်း'
        });
        setEditingEmpId(null);
        showNotification('ဝန်ထမ်းအချက်အလက် ပြင်ဆင်ပြီးပါပြီရှင့်။');
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', "shared_company", 'employees'), {
          name: newEmpName, position: newEmpPosition || 'ဝန်ထမ်း', offDays: [], createdAt: Date.now()
        });
        showNotification('ဝန်ထမ်းအသစ် ထည့်သွင်းပြီးပါပြီရှင့်။');
      }
      setNewEmpName(''); setNewEmpPosition('');
    } catch (err) {
      showNotification(editingEmpId ? 'ပြင်ဆင်ခြင်း မအောင်မြင်ပါရှင့်။' : 'ဝန်ထမ်းထည့်သွင်းခြင်း မအောင်မြင်ပါရှင့်။', 'error');
    }
  };

  const startEditEmployee = (emp) => {
    setEditingEmpId(emp.id);
    setNewEmpName(emp.name);
    setNewEmpPosition(emp.position);
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const cancelEdit = () => {
    setEditingEmpId(null);
    setNewEmpName('');
    setNewEmpPosition('');
  };

  const handleDeleteEmployee = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', "shared_company", 'employees', id));
      showNotification('ဝန်ထမ်းအား ဖျက်ပစ်ပြီးပါပြီရှင့်။', 'error');
    } catch (err) {}
  };

  const openOffDaysModal = (emp) => {
    setEditingOffDaysEmp(emp);
    setTempOffDays(Array.from({ length: offDaysLimit }, (_, i) => emp.offDays?.[i] || ''));
  };

  const saveOffDays = async () => {
    if (!user) return;
    const parsedDays = tempOffDays.map(d => parseInt(d, 10)).filter(d => !isNaN(d) && d >= 1 && d <= 31);
    parsedDays.sort((a, b) => a - b);
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', "shared_company", 'employees', editingOffDaysEmp.id), { offDays: parsedDays });
      setEditingOffDaysEmp(null);
      showNotification(`${editingOffDaysEmp.name} အတွက် နားရက် သတ်မှတ်ပြီးပါပြီရှင့်။`);
    } catch (err) {}
  };

  const updateSettings = async (updates) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', "shared_company", 'settings', 'general'), updates, { merge: true });
    } catch (err) {}
  };

  const downloadQR = async (emp) => {
    if (!emp) return;
    showNotification('ဝန်ထမ်းကတ် ပြင်ဆင်နေပါသည်ရှင့်...');
    
    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${emp.id}&margin=10`;
    
    const img = new Image();
    img.crossOrigin = "Anonymous"; 
    img.onload = () => {
      const cardCanvas = document.createElement('canvas');
      cardCanvas.width = 400;
      cardCanvas.height = 550;
      const ctx = cardCanvas.getContext('2d');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cardCanvas.width, cardCanvas.height);
      ctx.fillStyle = '#4f46e5'; 
      ctx.fillRect(0, 0, cardCanvas.width, 80);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('EMPLOYEE CARD', cardCanvas.width / 2, 50);
      ctx.drawImage(img, 50, 100, 300, 300);
      ctx.fillStyle = '#1e293b'; 
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText(emp.name, cardCanvas.width / 2, 450);
      ctx.fillStyle = '#64748b'; 
      ctx.font = '24px sans-serif';
      ctx.fillText(emp.position, cardCanvas.width / 2, 490);

      try {
        const dataUrl = cardCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `Employee_Card_${emp.name}.png`;
        link.href = dataUrl;
        link.click();
        showNotification('ဝန်ထမ်းကတ် ဒေါင်းလုဒ်ဆွဲပြီးပါပြီရှင့်။');
      } catch (e) {
        alert("ဘရောက်ဇာ လုံခြုံရေးအရ ပုံကို တိုက်ရိုက် Save လုပ်၍ မရပါ။ QR ပုံပေါ်တွင် Right Click နှိပ်၍ 'Save image as' ဖြင့် သိမ်းဆည်းပါရှင့်။");
      }
    };
    img.onerror = () => { showNotification('QR Code ပုံကို ဒေါင်းလုဒ်ဆွဲရာတွင် အခက်အခဲရှိနေပါသည်ရှင့်။', 'error'); };
    img.src = qrImgUrl;
  };

  const startQrScanner = async () => {
    setIsScanningQR(true); setScannedEmployee(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      qrStreamRef.current = mediaStream;
      if (qrVideoRef.current) {
        qrVideoRef.current.srcObject = mediaStream;
        qrVideoRef.current.setAttribute("playsinline", true);
        qrVideoRef.current.play();
        scanIntervalRef.current = setInterval(scanQrFrame, 500);
      }
    } catch (err) {
      alert("ကင်မရာ ဖွင့်၍မရပါရှင့်။ Browser Permission ကို စစ်ဆေးပေးပါ။");
      setIsScanningQR(false);
    }
  };

  const stopQrScanner = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (qrStreamRef.current) { qrStreamRef.current.getTracks().forEach(track => track.stop()); qrStreamRef.current = null; }
    setIsScanningQR(false);
  };

  const scanQrFrame = () => {
    if (qrVideoRef.current && qrVideoRef.current.readyState === qrVideoRef.current.HAVE_ENOUGH_DATA) {
      const canvas = qrCanvasRef.current;
      if (!canvas) return;
      canvas.width = qrVideoRef.current.videoWidth; canvas.height = qrVideoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(qrVideoRef.current, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      if (window.jsQR) {
        const code = window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "attemptBoth" });
        if (code && code.data) handleQrResult(code.data);
      }
    }
  };

  const handleQrResult = (qrData) => {
    const cleanData = qrData.trim();
    const emp = employees.find(e => e.id === cleanData);
    if (emp) {
      stopQrScanner(); setScannedEmployee(emp);
      showNotification(`${emp.name} ၏ အချက်အလက်များကို တွေ့ရှိပါသည်ရှင့်။`);
    }
  };

  const simulateScan = () => {
    if (employees.length > 0) {
      setScannedEmployee(employees[1] || employees[0]); 
      showNotification(`(Testing) ${employees[1]?.name || employees[0].name} ကို တွေ့ရှိပါသည်ရှင့်။`);
    }
  };

  const openCamera = async (employee) => {
    setSelectedEmployee(employee); setIsCameraOpen(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setStream(mediaStream);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
    } catch (err) {
      alert("ကင်မရာ ဖွင့်၍မရပါရှင့်။ Browser Permission စစ်ဆေးပေးပါ။"); closeCamera();
    }
  };

  const closeCamera = () => {
    if (stream) stream.getTracks().forEach(track => track.stop());
    setIsCameraOpen(false); setStream(null);
    isCapturingRef.current = false;
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !user || isCapturingRef.current) return;
    isCapturingRef.current = true;
    const video = videoRef.current; const canvas = canvasRef.current;
    const scale = Math.min(1, 320 / video.videoWidth);
    canvas.width = video.videoWidth * scale; canvas.height = video.videoHeight * scale;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.6);
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB');
    const timeStr = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });
    const currentHour = now.getHours();
    
    const targetTime = new Date(); 
    const [tHours, tMins] = startTime.split(':').map(Number);
    targetTime.setHours(tHours || 8, tMins || 0, 0, 0);

    let isLate = false, lateMinutes = 0, isAbsent = false;
    const isTodayOffDayForEmp = selectedEmployee.offDays?.includes(now.getDate());
    if (!isTodayOffDayForEmp) {
      if (currentHour >= 12) { 
        isAbsent = true; 
      } else {
        const diffMins = Math.floor((now - targetTime) / 60000);
        if (diffMins > 0) {
          isLate = true; 
          lateMinutes = diffMins;
        }
      }
    }

    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', "shared_company", 'records'), {
        employeeId: selectedEmployee.id, employeeName: selectedEmployee.name, date: dateStr,
        time: timeStr, isLate, lateMinutes, isAbsent, photo: photoDataUrl, createdAt: Date.now()
      });
      closeCamera();
      setWelcomeModal({ employee: selectedEmployee, isLate, isAbsent, lateMinutes, aiMsg: '', isLoading: true });
      
      let aiSystemPrompt = `You are a friendly HR AI assistant. Write a short, motivating welcome message (1-2 sentences max) in Burmese for employee "${selectedEmployee.name}". `;
      if (isAbsent) aiSystemPrompt += `They checked in after 12 PM, marked as ABSENT today. Remind gently.`;
      else if (isLate) aiSystemPrompt += `They are ${lateMinutes} mins late today. Remind gently.`;
      else aiSystemPrompt += `Arrived on time today. Praise warmly.`;
      aiSystemPrompt += ` Answer ONLY in Burmese.`;
      
      callGemini(aiSystemPrompt).then(msg => {
        setWelcomeModal(prev => prev ? { ...prev, aiMsg: msg, isLoading: false } : null);
      });
      setScannedEmployee(null); setSelectedEmployee(null);
    } catch (err) {
      showNotification('စာရင်းသွင်းခြင်း မအောင်မြင်ပါရှင့်', 'error');
      isCapturingRef.current = false;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mr-3"></div>
        အချက်အလက်များကို ရယူနေပါသည်ရှင့်...
      </div>
    );
  }

  const printStyles = `
    @media print {
      body * { visibility: hidden; }
      #printable-report, #printable-report * { visibility: visible; }
      #printable-report { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
      .no-print { display: none !important; }
    }
  `;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-24">
      <style>{printStyles}</style>

      {/* App Header */}
      <header className="bg-white shadow-sm px-6 py-4 sticky top-0 z-10 no-print">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">
              <Camera className="w-6 h-6" />
              Smart Attendance
            </h1>
            <p className="text-xs text-slate-500 mt-1">မျက်နှာဖတ် ရုံးတက်/ဆင်း မှတ်တမ်း</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-sm font-medium text-slate-600 hidden sm:block">
              {new Date().toLocaleDateString('en-GB')} <br/>
              {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </div>
            {isAdminAuthenticated && (
              <button onClick={handleAdminLogout} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors">
                <Unlock className="w-4 h-4 text-green-600" /> Lock ပြန်ချမည်
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Notifications */}
      {notification && (
        <div className={`fixed top-20 right-4 px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 transition-all transform duration-300 ${notification.type === 'error' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'}`}>
          {notification.type === 'error' ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          {notification.msg}
        </div>
      )}

      <main className="max-w-5xl mx-auto p-4 mt-4">
        
        {/* TAB 1: Attendance */}
        {activeTab === 'attendance' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 no-print">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-700">
                <ScanLine className="w-5 h-5 text-indigo-500" />
                QR ဖြင့် စာရင်းသွင်းရန်
              </h2>
              
              {!isScanningQR && !scannedEmployee && (
                <div className="text-center py-8 animate-in fade-in">
                  <QrCode className="w-24 h-24 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 mb-6 font-medium">ဝန်ထမ်းကတ်ရှိ QR Code ကို Scan ဖတ်ပါ</p>
                  <button onClick={startQrScanner} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-semibold flex items-center gap-2 mx-auto transition-transform active:scale-95 shadow-md">
                    <ScanLine className="w-5 h-5" /> QR ဖတ်မည်
                  </button>
                  {employees.length > 0 && (
                    <button onClick={simulateScan} className="mt-6 text-xs text-indigo-500 underline font-medium hover:text-indigo-700">
                      (စမ်းသပ်ရန် - QR မလိုဘဲ ဝန်ထမ်းဒေတာ ခေါ်မည်)
                    </button>
                  )}
                </div>
              )}

              {isScanningQR && (
                <div className="text-center animate-in zoom-in duration-200">
                  <div className="relative bg-black rounded-2xl overflow-hidden aspect-square sm:aspect-video w-full max-w-sm mx-auto mb-4 flex items-center justify-center shadow-inner">
                    <video ref={qrVideoRef} className="w-full h-full object-cover" />
                    <canvas ref={qrCanvasRef} className="hidden" />
                    <div className="absolute inset-0 border-[40px] border-black/50 pointer-events-none flex items-center justify-center">
                      <div className="w-48 h-48 border-2 border-green-500 border-dashed animate-pulse rounded-xl"></div>
                    </div>
                  </div>
                  <button onClick={stopQrScanner} className="text-slate-500 hover:text-slate-800 font-medium px-6 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
                    ပယ်ဖျက်မည်
                  </button>
                </div>
              )}

              {scannedEmployee && (
                <div className="max-w-sm mx-auto bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center animate-in zoom-in duration-300 shadow-sm">
                  <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-10 h-10 text-indigo-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800 mb-1">{scannedEmployee.name}</h3>
                  <p className="text-slate-500 font-medium mb-3">{scannedEmployee.position}</p>
                  <div className="flex gap-3 justify-center mt-6">
                    <button onClick={() => setScannedEmployee(null)} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 flex items-center gap-2 transition-colors">
                      <ArrowLeft className="w-4 h-4" /> နောက်သို့
                    </button>
                    <button onClick={() => openCamera(scannedEmployee)} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 flex items-center gap-2 shadow-md shadow-indigo-200 transition-transform active:scale-95">
                      <Camera className="w-5 h-5" /> Selfie ရိုက်မည်
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 no-print">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-700">
                <ClipboardList className="w-5 h-5 text-indigo-500" /> ယနေ့ မှတ်တမ်းများ
              </h2>
              <div className="space-y-3">
                {records.filter(r => r.date === new Date().toLocaleDateString('en-GB')).length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">ယနေ့အတွက် မှတ်တမ်း မရှိသေးပါရှင့်။</p>
                ) : (
                  records.filter(r => r.date === new Date().toLocaleDateString('en-GB')).slice(0, 5).map(rec => (
                    <div key={rec.id} className="flex items-center gap-4 p-3 rounded-xl border border-slate-100 bg-white">
                      <img src={rec.photo} alt="selfie" className="w-12 h-12 rounded-full object-cover border-2 border-slate-200" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm">{rec.employeeName}</h4>
                        <p className="text-xs text-slate-500">{rec.date} • {rec.time}</p>
                      </div>
                      <div className="text-right">
                        {rec.isAbsent ? (
                           <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full border border-red-100"><XCircle className="w-3 h-3" /> ပျက်ရက်</span>
                        ) : rec.isLate ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-full border border-orange-100"><AlertCircle className="w-3 h-3" /> နောက်ကျ ({rec.lateMinutes} မိနစ်)</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100"><CheckCircle className="w-3 h-3" /> အချိန်မှန်</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Admin Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <LayoutDashboard className="w-6 h-6 text-indigo-600" /> Admin Dashboard
              </h2>
              
              {/* Filter Toggle with Month Picker */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {dashboardFilter === 'month' && (
                  <input 
                    type="month" 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  />
                )}
                <div className="flex bg-slate-200 p-1 rounded-xl flex-1 sm:flex-none">
                  <button 
                    onClick={() => setDashboardFilter('today')}
                    className={`flex-1 sm:px-6 py-2 rounded-lg text-sm font-semibold transition-all ${dashboardFilter === 'today' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    ယနေ့
                  </button>
                  <button 
                    onClick={() => setDashboardFilter('month')}
                    className={`flex-1 sm:px-6 py-2 rounded-lg text-sm font-semibold transition-all ${dashboardFilter === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    လအလိုက်
                  </button>
                </div>
              </div>
            </div>
            
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-blue-500">
                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600"><Users className="w-6 h-6" /></div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">စုစုပေါင်း ဝန်ထမ်း</p>
                  <h3 className="text-2xl font-bold text-slate-800">{totalEmployees} <span className="text-sm font-normal text-slate-500">ဦး</span></h3>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-orange-500">
                <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center text-orange-600"><Clock className="w-6 h-6" /></div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">{dashboardFilter === 'today' ? 'ယနေ့ နောက်ကျချိန်' : `ရွေးချယ်ထားသောလ (${formattedSelectedMonth}) တွင်`}</p>
                  <h3 className="text-2xl font-bold text-slate-800">{totalLateMinutes} <span className="text-sm font-normal text-slate-500">မိနစ်</span></h3>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 border-l-4 border-l-red-500">
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-600"><CalendarOff className="w-6 h-6" /></div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">{dashboardFilter === 'today' ? 'ယနေ့ ပျက်ရက်' : 'လအလိုက် ပျက်ရက်စုစုပေါင်း'}</p>
                  <h3 className="text-2xl font-bold text-slate-800">{totalAbsences} <span className="text-sm font-normal text-slate-500">ရက်</span></h3>
                </div>
              </div>
            </div>

            {/* Graph */}
            {dashboardFilter === 'month' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-700">
                  <BarChart3 className="w-5 h-5 text-indigo-500" /> 
                  ရွေးချယ်ထားသောလ ဝန်ထမ်းအလိုက် နောက်ကျချိန် (မိနစ်)
                </h2>
                
                {chartData.names.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-slate-400 text-sm">ဝန်ထမ်းစာရင်း မရှိသေးပါရှင့်။</div>
                ) : (
                  <div className="overflow-x-auto pb-4">
                    <div className="h-64 flex items-end justify-start gap-4 mt-4 pt-4 border-b border-slate-200 relative min-w-max px-2">
                      {chartData.totals.map((val, idx) => {
                        const heightPercent = Math.max((val / chartData.maxVal) * 100, 2); 
                        return (
                          <div key={idx} className="w-16 flex flex-col items-center group relative">
                            <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-xs py-1 px-2 rounded font-bold pointer-events-none whitespace-nowrap z-10">
                              {val} မိနစ်
                            </div>
                            <div 
                              className={`w-full max-w-[40px] rounded-t-sm transition-all ${val > 0 ? 'bg-indigo-500 group-hover:bg-indigo-400' : 'bg-slate-200'}`}
                              style={{ height: `${heightPercent}%` }}
                            ></div>
                            <div className="absolute -bottom-8 text-[10px] sm:text-xs text-slate-600 font-medium text-center truncate w-full" title={chartData.names[idx]}>
                              {String(chartData.names[idx] || '').substring(0, 6)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Problematic Employees List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h2 className="text-lg font-bold flex items-center gap-2 text-slate-700">
                  <AlertCircle className="w-5 h-5 text-indigo-500" /> 
                  {dashboardFilter === 'today' ? 'ယနေ့ နောက်ကျ / ပျက်ကွက်သူများ' : 'လအလိုက် နောက်ကျ / ပျက်ကွက်သူများ'}
                </h2>
                <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full">
                  {problematicEmployees.length} ဦး
                </span>
              </div>
              
              <div className="p-4 sm:p-6">
                {problematicEmployees.length === 0 ? (
                  <div className="text-center py-12 flex flex-col items-center">
                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-3">
                      <CheckCircle className="w-8 h-8 text-green-500" />
                    </div>
                    <p className="text-slate-500 font-medium">
                      {dashboardFilter === 'today' ? 'ဒီနေ့ နောက်ကျသူ သို့မဟုတ် ပျက်သူ မရှိပါဘူးရှင့်။' : 'ရွေးချယ်ထားသောလအတွင်း နောက်ကျသူ သို့မဟုတ် ပျက်သူ မရှိပါဘူးရှင့်။'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {problematicEmployees.map(emp => {
                      const isExpanded = selectedDashboardEmpId === emp.id;
                      const tStats = todayStats.find(e => e.id === emp.id);
                      const mStats = monthlyStats.find(e => e.id === emp.id);
                      
                      return (
                        <div 
                          key={emp.id} 
                          onClick={() => setSelectedDashboardEmpId(isExpanded ? null : emp.id)}
                          className={`cursor-pointer rounded-xl border transition-all duration-300 ${isExpanded ? 'border-indigo-300 shadow-md bg-white' : 'border-slate-200 bg-slate-50 hover:border-indigo-200 hover:bg-white'}`}
                        >
                          <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 font-bold flex items-center justify-center">
                                {emp.name.charAt(0)}
                              </div>
                              <div>
                                <h3 className="font-bold text-slate-800">{emp.name}</h3>
                                <p className="text-xs text-slate-500">{emp.position}</p>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1 items-end">
                              {emp.absences > 0 && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-md font-bold">ပျက်ရက် {emp.absences} ရက်</span>}
                              {emp.totalLate > 0 && <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-md font-bold">နောက်ကျ {emp.totalLate} မိနစ်</span>}
                            </div>
                          </div>
                          
                          {isExpanded && (
                            <div className="px-4 pb-4 animate-in slide-in-from-top-2">
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                  <span className="font-semibold text-slate-600 flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-indigo-400" /> ယနေ့ အခြေအနေ:
                                  </span>
                                  <div className="text-right">
                                    {tStats?.absences > 0 ? (
                                      <span className="text-red-600 font-medium">ပျက်ရက်</span>
                                    ) : tStats?.totalLate > 0 ? (
                                      <span className="text-orange-600 font-medium">နောက်ကျ ({tStats.totalLate} မိနစ်)</span>
                                    ) : (
                                      <span className="text-green-600 font-medium">အချိန်မှန် / မရှိ</span>
                                    )}
                                  </div>
                                </div>
                                <div className="h-px bg-slate-200 w-full"></div>
                                <div className="flex justify-between items-center text-sm">
                                  <span className="font-semibold text-slate-600 flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-indigo-400" /> စုစုပေါင်း ({formattedSelectedMonth}):
                                  </span>
                                  <div className="text-right flex gap-2">
                                    <span className="text-red-600 font-medium">ပျက်: {mStats?.absences || 0}</span>
                                    <span className="text-slate-300">|</span>
                                    <span className="text-orange-600 font-medium">နောက်ကျ: {mStats?.totalLate || 0}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: Employee Management */}
        {activeTab === 'employees' && (
          <div className="space-y-6">
            <div className={`bg-white rounded-2xl shadow-sm border ${editingEmpId ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-slate-100'} p-6 transition-all`}>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-700">
                {editingEmpId ? <Edit2 className="w-5 h-5 text-indigo-500" /> : <UserPlus className="w-5 h-5 text-indigo-500" />}
                {editingEmpId ? 'ဝန်ထမ်းအချက်အလက် ပြင်ဆင်ရန်' : 'ဝန်ထမ်းအသစ် ထည့်ရန်'}
              </h2>
              <form onSubmit={handleAddOrEditEmployee} className="flex flex-col sm:flex-row gap-3">
                <input type="text" placeholder="ဝန်ထမ်းအမည် (ဥပမာ - ကိုကို)" value={newEmpName} onChange={(e) => setNewEmpName(e.target.value)} className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                <input type="text" placeholder="ရာထူး / ဌာန" value={newEmpPosition} onChange={(e) => setNewEmpPosition(e.target.value)} className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <div className="flex gap-2">
                  <button type="submit" className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 shadow-md whitespace-nowrap">
                    {editingEmpId ? 'သိမ်းမည်' : 'အသစ်ထည့်မည်'}
                  </button>
                  {editingEmpId && (
                    <button type="button" onClick={cancelEdit} className="bg-slate-100 text-slate-600 px-4 py-2.5 rounded-lg font-medium hover:bg-slate-200 whitespace-nowrap">
                      ပယ်ဖျက်
                    </button>
                  )}
                </div>
              </form>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2 text-slate-700"><Users className="w-5 h-5 text-indigo-500" /> ဝန်ထမ်းစာရင်း</h2>
                <span className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full border border-indigo-100 font-medium">တစ်လလျှင် နားရက် - {offDaysLimit} ရက်</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-3 font-semibold text-sm text-slate-600">အမည်</th>
                      <th className="p-3 font-semibold text-sm text-slate-600">ရာထူး</th>
                      <th className="p-3 font-semibold text-sm text-slate-600">လစဉ် နားရက်များ</th>
                      <th className="p-3 font-semibold text-sm text-slate-600 text-right">လုပ်ဆောင်ချက်</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => (
                      <tr key={emp.id} className={`border-b border-slate-100 hover:bg-slate-50 ${editingEmpId === emp.id ? 'bg-indigo-50' : ''}`}>
                        <td className="p-3 text-sm font-medium">{emp.name}</td>
                        <td className="p-3 text-sm text-slate-500">{emp.position}</td>
                        <td className="p-3 text-sm text-indigo-600 font-medium">
                          {emp.offDays && emp.offDays.length > 0 ? emp.offDays.map(d => `${d} ရက်`).join('၊ ') : <span className="text-slate-400 italic font-normal">မသတ်မှတ်ရသေးပါ</span>}
                        </td>
                        <td className="p-3 text-right flex justify-end gap-1 sm:gap-2">
                          <button onClick={() => openOffDaysModal(emp)} className="text-green-600 hover:text-green-800 p-2 rounded-lg hover:bg-green-50 transition-colors border border-transparent hover:border-green-100" title="နားရက် သတ်မှတ်မည်"><CalendarDays className="w-4 h-4" /></button>
                          <button onClick={() => setShowQrModal(emp)} className="text-indigo-600 hover:text-indigo-800 p-2 rounded-lg hover:bg-indigo-50 transition-colors border border-transparent hover:border-indigo-100" title="QR Code ကြည့်မည်"><QrCode className="w-4 h-4" /></button>
                          <button onClick={() => startEditEmployee(emp)} className="text-blue-500 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-colors border border-transparent hover:border-blue-100" title="ပြင်ဆင်မည်"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteEmployee(emp.id)} className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors border border-transparent hover:border-red-100" title="ဖျက်မည်"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                    {employees.length === 0 && <tr><td colSpan="4" className="text-center p-4 text-slate-400 text-sm">ဝန်ထမ်း မရှိသေးပါရှင့်။</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Reports */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div id="printable-report" className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
                  <h2 className="text-lg font-bold flex items-center gap-2 text-slate-700">
                    <ClipboardList className="w-5 h-5 text-indigo-500" /> အစီရင်ခံစာ
                    <span className="hidden print:inline text-sm font-normal text-slate-500">({formattedSelectedMonth})</span>
                  </h2>
                  <input 
                    type="month" 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm no-print w-full sm:w-auto"
                  />
                </div>
                <div className="flex gap-2 no-print w-full sm:w-auto justify-end">
                  <button onClick={exportToExcel} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                    <FileSpreadsheet className="w-4 h-4" /> Excel
                  </button>
                  <button onClick={printToPDF} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                    <Download className="w-4 h-4" /> PDF
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-3 font-semibold text-sm text-slate-600">အမည်</th>
                      <th className="p-3 font-semibold text-sm text-slate-600 text-center">ပျက်ရက်</th>
                      <th className="p-3 font-semibold text-sm text-slate-600 text-center">စုစုပေါင်း နောက်ကျချိန်</th>
                      <th className="p-3 font-semibold text-sm text-slate-600">မှတ်ချက်</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyStats.map(emp => (
                      <tr key={emp.id} className="border-b border-slate-100">
                        <td className="p-3 text-sm font-medium">
                          {emp.name} {emp.isTodayOffDay && dashboardFilter === 'month' && selectedMonth === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}` && <span className="ml-2 text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">ယနေ့နားရက်</span>}
                        </td>
                        <td className="p-3 text-sm text-red-600 font-bold text-center">{emp.absences} ရက်</td>
                        <td className="p-3 text-sm text-orange-600 font-medium text-center">{emp.totalLate} မိနစ်</td>
                        <td className="p-3 text-sm text-slate-500">
                          {emp.absences > 0 ? 'ပျက်ရက်ရှိသည်' : emp.totalLate > 60 ? 'သတိပေးရန်' : 'ပုံမှန်'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-xs text-slate-400 leading-relaxed">
                * နေ့လယ် ၁၂ နာရီအထိ Scan မဖတ်ပါက (သို့မဟုတ် ၁၂ နာရီကျော်မှ ဖတ်ပါက) ပျက်ရက်အဖြစ် သတ်မှတ်ပါမည်ရှင့်။
              </p>
            </div>

            {/* AI Report Section */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl shadow-sm border border-indigo-100 p-6 no-print">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2 text-indigo-900"><Sparkles className="w-5 h-5 text-indigo-500" /> AI ဖြင့် သုံးသပ်မည်</h2>
                <button onClick={generateAiReport} disabled={isGeneratingReport || employees.length === 0} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all">
                  {isGeneratingReport ? "စဉ်းစားနေသည်..." : "✨ အကြံပြုချက် ရယူမည်"}
                </button>
              </div>
              {aiReport && <div className="bg-white/80 p-5 rounded-xl text-sm whitespace-pre-wrap">{aiReport}</div>}
            </div>
          </div>
        )}

        {/* TAB 5: Settings */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-700"><Settings className="w-5 h-5 text-indigo-500" /> အထွေထွေ ဆက်တင်များ</h2>
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-slate-50 border border-slate-200 rounded-xl gap-4 mb-4">
                <div>
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Clock className="w-4 h-4 text-indigo-500" /> ရုံးတက်ချိန် (အလုပ်စမည့်အချိန်)</h3>
                  <p className="text-xs text-slate-500 mt-1">အလုပ်စတင်ရမည့် အချိန်ကို သတ်မှတ်ပါ။ (ဤအချိန်နောက်ပိုင်း ဝင်ပါက နောက်ကျစာရင်း ဝင်ပါမည်ရှင့်)</p>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="time" 
                    value={startTime} 
                    onChange={(e) => {
                      setStartTime(e.target.value);
                      updateSettings({ startTime: e.target.value });
                    }} 
                    className="px-3 py-2 text-center border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-700" 
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-slate-50 border border-slate-200 rounded-xl gap-4 mb-4">
                <div>
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-indigo-500" /> လစဉ် နားရက် အရေအတွက်</h3>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" max="31" value={offDaysLimit} onChange={(e) => updateSettings({ offDaysLimit: parseInt(e.target.value) || 0 })} className="w-20 px-3 py-2 text-center border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-700" />
                  <span className="text-sm font-medium text-slate-600">ရက်</span>
                </div>
              </div>

              {/* Delete Old Records Section */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-2"><Trash2 className="w-4 h-4 text-red-500" /> မှတ်တမ်းဟောင်းများ ဖျက်မည်</h3>
                <p className="text-xs text-slate-500 mb-4">ရွေးချယ်ထားသော ရက်စွဲမတိုင်ခင်က မှတ်တမ်းဟောင်းများကို Database မှ အပြီးတိုင် ဖျက်ပစ်ပါမည်။ (ဥပမာ - ၁ လပိုင်းမှ ၆ လပိုင်းအထိ ဖျက်ရန် ဇူလိုင် ၁ ရက် ကို ရွေးချယ်ပါ)</p>
                
                <div className="flex flex-col sm:flex-row gap-3">
                   <input 
                    type="date" 
                    value={deleteBeforeDate}
                    onChange={(e) => setDeleteBeforeDate(e.target.value)}
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <button 
                    onClick={() => {
                      if (deleteBeforeDate) setShowDeleteConfirmModal(true);
                      else showNotification('ဖျက်လိုသည့် ရက်စွဲကို အရင်ရွေးချယ်ပါရှင့်။', 'error');
                    }} 
                    className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                  >
                    ဖျက်မည်
                  </button>
                </div>
              </div>

              {/* Admin Password Change section */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-2"><Lock className="w-4 h-4 text-indigo-500" /> Admin Password အသစ်သတ်မှတ်ရန်</h3>
                <p className="text-xs text-slate-500 mb-4">ပုံမှန် Default Password ကတော့ <strong>DIGITLIGHT</strong> ဖြစ်ပါသည်ရှင့်။ သို့သော် လုံခြုံရေးအရ အခြားစကားဝှက်တစ်ခု ထပ်မံသတ်မှတ်နိုင်ပါသည်ရှင့်။</p>
                
                <div className="flex flex-col sm:flex-row gap-3">
                   <input 
                    type="text" 
                    placeholder="Password အသစ်ရိုက်ထည့်ပါ" 
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button onClick={saveNewAdminPassword} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-lg transition-colors">
                    သိမ်းဆည်းမည်
                  </button>
                </div>
                {customAdminPassword && (
                  <p className="text-xs text-green-600 mt-2 font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Password အသစ် သတ်မှတ်ထားပြီးပါပြီရှင့်။</p>
                )}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Admin Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in duration-200 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600"></div>
             <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600">
               <Lock className="w-8 h-8" />
             </div>
             <h3 className="text-xl font-bold text-center text-slate-800 mb-2">Admin သာ ဝင်ခွင့်ရှိသည်</h3>
             <p className="text-sm text-center text-slate-500 mb-6">ဤကဏ္ဍသို့ဝင်ရောက်ရန် Password ရိုက်ထည့်ပါ</p>
             
             <form onSubmit={handleAdminLogin} className="space-y-4">
               <input 
                 type="password" 
                 autoFocus
                 placeholder="Enter Admin Password" 
                 value={passwordInput}
                 onChange={(e) => setPasswordInput(e.target.value)}
                 className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center tracking-widest font-bold text-lg"
               />
               <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-indigo-200">
                 ဝင်မည်
               </button>
               <button type="button" onClick={() => { setShowLoginModal(false); setPasswordInput(''); setPendingTab(null); }} className="w-full text-slate-500 hover:text-slate-700 py-2 font-medium">
                 ပယ်ဖျက်မည်
               </button>
             </form>
          </div>
        </div>
      )}

      {/* Delete Old Records Confirm Modal */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in duration-200 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">သတိပေးချက်</h3>
            <p className="text-sm text-slate-500 mb-6">
              <span className="font-bold text-red-600">{deleteBeforeDate}</span> ရက်နေ့ မတိုင်ခင်က မှတ်တမ်းအားလုံးကို အပြီးတိုင် ဖျက်ပစ်မှာ သေချာပါသလား? (ဤလုပ်ဆောင်ချက်ကို ပြန်ပြင်၍မရပါရှင့်)
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteConfirmModal(false)} 
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition-colors"
                disabled={isDeleting}
              >
                ပယ်ဖျက်မည်
              </button>
              <button 
                onClick={executeDeleteOldRecords} 
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                disabled={isDeleting}
              >
                {isDeleting ? 'ဖျက်နေပါသည်...' : 'ဖျက်မည်'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="fixed bottom-0 w-full bg-white border-t border-slate-200 flex justify-around px-1 py-2 pb-safe z-10 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] no-print">
        {[
          { id: 'attendance', icon: Camera, label: 'စာရင်းသွင်း' },
          { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
          { id: 'employees', icon: Users, label: 'ဝန်ထမ်းများ' },
          { id: 'reports', icon: ClipboardList, label: 'အစီရင်ခံစာ' },
          { id: 'settings', icon: Settings, label: 'ဆက်တင်' }
        ].map(tab => (
          <button key={tab.id} onClick={() => handleTabChange(tab.id)} className={`flex flex-col items-center p-2 rounded-xl flex-1 transition-colors ${activeTab === tab.id ? 'text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600'}`}>
            <tab.icon className="w-5 h-5 mb-1" />
            <span className="text-[10px] sm:text-xs whitespace-nowrap">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Set Off Days Modal */}
      {editingOffDaysEmp && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm no-print">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6">
            <h3 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-indigo-500" /> နားရက် သတ်မှတ်ရန်</h3>
            <p className="text-sm text-slate-500 mb-6"><span className="font-semibold">{editingOffDaysEmp.name}</span> အတွက် နားရက်ထည့်ပါ</p>
            <div className="space-y-4 mb-6">
              {tempOffDays.map((val, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-500 w-16">ရက်စွဲ {index + 1}:</span>
                  <input type="number" min="1" max="31" value={val} onChange={(e) => { const newDays = [...tempOffDays]; newDays[index] = e.target.value; setTempOffDays(newDays); }} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none" />
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditingOffDaysEmp(null)} className="flex-1 bg-slate-100 py-2.5 rounded-xl font-semibold text-slate-700">ပယ်ဖျက်မည်</button>
              <button onClick={saveOffDays} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold"><Save className="w-4 h-4 inline mr-2" /> သိမ်းမည်</button>
            </div>
          </div>
        </div>
      )}

      {/* QR/Camera Welcome Modal */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm no-print">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 text-center p-6">
            <h3 className="text-xl font-bold text-slate-800 mb-1">{showQrModal.name}</h3>
            <p className="text-sm text-slate-500 mb-6">{showQrModal.position}</p>
            <div className="bg-white p-4 rounded-2xl inline-block border-2 border-slate-100 shadow-sm mb-6">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${showQrModal.id}`} alt={`QR for ${showQrModal.name}`} className="w-48 h-48" crossOrigin="anonymous" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowQrModal(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition-colors">ပိတ်မည်</button>
              <button onClick={() => downloadQR(showQrModal)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                <Download className="w-4 h-4" /> ဒေါင်းလုဒ်
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Welcome Modal */}
      {welcomeModal && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm no-print">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl text-center relative">
            <div className={`p-6 pb-8 ${welcomeModal.isAbsent ? 'bg-red-500' : welcomeModal.isLate ? 'bg-orange-500' : 'bg-green-500'} text-white`}>
              {welcomeModal.isAbsent ? <XCircle className="w-16 h-16 mx-auto mb-2 opacity-90" /> : welcomeModal.isLate ? <AlertCircle className="w-16 h-16 mx-auto mb-2 opacity-90" /> : <CheckCircle className="w-16 h-16 mx-auto mb-2 opacity-90" />}
              <h3 className="text-2xl font-bold mb-1">{welcomeModal.isAbsent ? 'ပျက်ရက်အဖြစ် သတ်မှတ်ပါသည်' : 'စာရင်းသွင်းပြီးပါပြီ'}</h3>
              <p className="text-white/80 font-medium">{welcomeModal.isAbsent ? 'နေ့လယ် ၁၂ နာရီကျော်မှ စာရင်းသွင်းသဖြင့် ပျက်ရက်ဖြစ်ပါသည်ရှင့်' : welcomeModal.isLate ? `နောက်ကျချိန်: ${welcomeModal.lateMinutes} မိနစ်` : 'အချိန်မှန် ရောက်ရှိပါတယ်ရှင့်။'}</p>
            </div>
            <div className="p-6 pt-8 bg-white relative">
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-20 h-20 bg-white rounded-full p-1 shadow-lg">
                <div className="w-full h-full bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xl">{welcomeModal.employee?.name?.charAt(0) || <Users />}</div>
              </div>
              <h4 className="font-bold text-slate-800 text-lg mt-4">{welcomeModal.employee?.name}</h4>
              <div className="mt-4 bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-sm text-indigo-900 relative">
                <div className="absolute -top-3 -left-3 bg-indigo-500 text-white p-1.5 rounded-full"><Sparkles className="w-3 h-3" /></div>
                {welcomeModal.isLoading ? "AI မှ နှုတ်ခွန်းဆက်နေပါသည်ရှင့်..." : welcomeModal.aiMsg}
              </div>
              <button onClick={() => setWelcomeModal(null)} className="mt-6 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition-colors">ပိတ်မည်</button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Open Interface */}
      {isCameraOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm no-print">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden">
            <div className="p-4 bg-indigo-600 text-white flex justify-between items-center">
              <h3 className="font-bold"><Camera className="w-5 h-5 inline mr-2" /> {selectedEmployee?.name}</h3>
              <button onClick={closeCamera} className="text-white/80"><XCircle className="w-6 h-6" /></button>
            </div>
            <div className="relative bg-black aspect-[3/4] sm:aspect-video flex justify-center">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover transform scale-x-[-1]" />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <div className="p-6 text-center bg-slate-50">
              <button onClick={capturePhoto} className="w-20 h-20 bg-indigo-600 rounded-full border-4 border-indigo-200 shadow-lg flex justify-center items-center mx-auto"><Camera className="w-8 h-8 text-white" /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
