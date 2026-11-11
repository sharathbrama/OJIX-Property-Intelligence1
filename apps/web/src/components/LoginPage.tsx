import { useState, useEffect, useRef } from 'react';
import { ShieldCheck, ShieldAlert, UserCheck, Key, Lock, ArrowRight, Building2, CheckCircle2, AlertCircle, Eye, EyeOff, MapPinned, FileSearch, Landmark, X, RotateCcw, Crown, Settings2, Scale, SearchCheck, Files, BriefcaseBusiness, Headphones, Database, Mail, Smartphone } from 'lucide-react';
import { PropertyIntelligenceHero } from './PropertyIntelligenceHero';
import { PropertyIntelligenceLanding } from './PropertyIntelligenceLanding';
import type { UserAccount, UserRole } from '../types';

interface LoginPageProps {
  apiUrl: string;
  onLoginSuccess: (token: string, user: UserAccount, requestedRole?: string) => void;
  expectedRole?: string;
}

async function readApiJson(response: Response): Promise<Record<string, any>> {
  const body = await response.text();
  if (!body.trim()) {
    throw new Error(`The API returned an empty response (HTTP ${response.status}).`);
  }
  try {
    const data: unknown = JSON.parse(body);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid response shape');
    return data as Record<string, any>;
  } catch {
    throw new Error(`The API returned an invalid JSON response (HTTP ${response.status}).`);
  }
}

const roleLoginCopy:Record<string,{label:string;description:string}>={
  'super-admin':{label:'Super Admin',description:'Authorized platform administrators only.'},owner:{label:'Workspace Owner',description:'Manage workspace operations and property matters.'},admin:{label:'Organization Admin',description:'Manage organization members, workflows and records.'},lawyer:{label:'Legal Reviewer',description:'Review title evidence and due-diligence findings.'},analyst:{label:'Evidence Analyst',description:'Analyze property records and prepare assigned matters.'},operations:{label:'Document Operations',description:'Manage document intake and processing queues.'},consultant:{label:'Consultant',description:'Review assigned client dossiers and evidence.'},support:{label:'Support',description:'Access authorized workspace diagnostics.'},data_steward:{label:'Data Steward',description:'Maintain source data and reference records.'},viewer:{label:'Viewer',description:'Access approved read-only workspace records.'}
};
const loginRoleOrder = ['owner','super-admin','admin','lawyer','analyst','operations','consultant','support','data_steward','viewer'] as const;
const loginRoleIcons = {
  owner:Crown,'super-admin':ShieldCheck,admin:Settings2,lawyer:Scale,analyst:SearchCheck,
  operations:Files,consultant:BriefcaseBusiness,support:Headphones,data_steward:Database,viewer:Eye,
};
const isValidRegistrationPhone = (countryCode: string, digits: string) => {
  const formats: Record<string, RegExp> = {
    '+91': /^[6-9]\d{9}$/,
    '+1': /^[2-9]\d{2}[2-9]\d{6}$/,
    '+44': /^7\d{9}$/,
    '+61': /^4\d{8}$/,
    '+971': /^5[024568]\d{7}$/,
    '+65': /^[89]\d{7}$/,
  };
  return Boolean(formats[countryCode]?.test(digits)) && !/^(\d)\1+$/.test(digits);
};
const validPersonName=(value:string,optional=false)=>{const normalized=value.trim().replace(/\s+/g,' ');if(optional&&!normalized)return true;return normalized.length>=2&&normalized.length<=50&&/^[\p{L}]+(?:[ '\-][\p{L}]+)*$/u.test(normalized);};
const sanitizePersonNameInput=(value:string)=>value.replace(/[^\p{L} '\-]/gu,'').replace(/\s{2,}/g,' ').slice(0,50);
const formatRegistrationPhone=(countryCode:string,value:string)=>{const digits=value.replace(/\D/g,'').slice(0,countryCode==='+91'||countryCode==='+1'?10:15);if(countryCode==='+91')return digits.replace(/(\d{5})(?=\d)/,'$1 ');if(countryCode==='+1')return digits.replace(/(\d{3})(\d{0,3})(\d{0,4})/,(_,a,b,c)=>[a,b,c].filter(Boolean).join(' '));return digits.replace(/(\d{3})(?=\d)/g,'$1 ').trim();};

export function LoginPage({ apiUrl, onLoginSuccess, expectedRole }: LoginPageProps) {
  const [mode, setMode] = useState<'landing'|'login'|'login-otp'|'register'|'otp'|'verified'>(() => {
    const path = window.location.pathname.replace(/\/$/, '');
    return path === '/register' ? 'register' : expectedRole ? 'login' : 'landing';
  });
  const [loginCardOpen, setLoginCardOpen] = useState(() => Boolean(expectedRole) || window.location.pathname.startsWith('/login'));
  const [loginModalClosing, setLoginModalClosing] = useState(false);
  const loginModalCloseRef = useRef<HTMLButtonElement>(null);
  const [dummyAccounts, setDummyAccounts] = useState<UserAccount[]>([]);
  const [selectedUid, setSelectedUid] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [registerName, setRegisterName] = useState('');
  const [registerFirstName, setRegisterFirstName] = useState('');
  const [registerMiddleName, setRegisterMiddleName] = useState('');
  const [registerLastName, setRegisterLastName] = useState('');
  const [registerGender, setRegisterGender] = useState('');
  const [registerCountryCode, setRegisterCountryCode] = useState('+91');
  const [registerMobile, setRegisterMobile] = useState('');
  const [registerSecurityQuestion, setRegisterSecurityQuestion] = useState('');
  const [registerSecurityAnswer, setRegisterSecurityAnswer] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registrationSubmitted, setRegistrationSubmitted] = useState(false);
  const [registrationTouched, setRegistrationTouched] = useState<Record<string, boolean>>({});
  const registrationFormRef=useRef<HTMLFormElement>(null);
  const [showRegisterPassword,setShowRegisterPassword]=useState(false);
  const [showRegisterConfirmPassword,setShowRegisterConfirmPassword]=useState(false);
  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [challengeRole, setChallengeRole] = useState('');
  const [selectedRole, setSelectedRole] = useState(expectedRole || 'owner');
  const [otpDeliveryTarget, setOtpDeliveryTarget] = useState('');
  const [otpDeliveryMode,setOtpDeliveryMode]=useState<'email'|'sms'>('email');
  const [developmentOtpAutofilled,setDevelopmentOtpAutofilled]=useState(false);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(600);
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const [serviceStatus, setServiceStatus] = useState<'checking'|'ready'|'unavailable'>('checking');
  const [serviceMessage, setServiceMessage] = useState('Checking API and database…');
  const [recoveryStep,setRecoveryStep]=useState<'request'|'reset'|'success'|null>(null);
  const [recoveryChallengeId,setRecoveryChallengeId]=useState('');
  const [recoveryOtp,setRecoveryOtp]=useState('');
  const [recoveryPassword,setRecoveryPassword]=useState('');
  const [recoveryConfirmPassword,setRecoveryConfirmPassword]=useState('');
  const [recoveryExpiresAt,setRecoveryExpiresAt]=useState<number|null>(null);
  const [recoveryTimeLeft,setRecoveryTimeLeft]=useState(600);
  const [recoveryPasswordCopied,setRecoveryPasswordCopied]=useState(false);

  const registrationErrorFor = (field: string) => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
    switch (field) {
      case 'firstName': return validPersonName(registerFirstName) ? '' : 'Use 2–50 letters; spaces, hyphens and apostrophes are allowed.';
      case 'middleName': return validPersonName(registerMiddleName,true) ? '' : 'Use 2–50 letters; spaces, hyphens and apostrophes are allowed.';
      case 'lastName': return validPersonName(registerLastName) ? '' : 'Use 2–50 letters; spaces, hyphens and apostrophes are allowed.';
      case 'gender': return registerGender ? '' : 'Select a gender option.';
      case 'mobileNumber': {
        const digits = registerMobile.replace(/\D/g, '');
        if (!digits) return 'Enter your mobile number.';
        if (/^(\d)\1+$/.test(digits)) return 'Repeated-digit mobile numbers are not valid.';
        if (isValidRegistrationPhone(registerCountryCode, digits)) return '';
        return registerCountryCode === '+91'
          ? 'Enter 10 digits. Indian mobile numbers start with 6, 7, 8, or 9.'
          : 'Enter a valid mobile number for the selected country.';
      }
      case 'email':
        if (!registerEmail.trim()) return 'Enter your work email.';
        return emailPattern.test(registerEmail.trim()) ? '' : 'Use a complete email such as name@company.com.';
      case 'securityQuestion': return registerSecurityQuestion ? '' : 'Choose a security question.';
      case 'securityAnswer':
        if (!registerSecurityAnswer.trim()) return 'Enter an answer.';
        if(registerSecurityAnswer.trim().length<3)return 'Answer must contain at least 3 characters.';
        return registerSecurityAnswer.trim().length<=120?'':'Answer must be 120 characters or fewer.';
      case 'password':
        if (registerPassword.length < 8) return 'Use at least 8 characters.';
        if (!/[A-Z]/.test(registerPassword)) return 'Add at least one uppercase letter.';
        if (!/[a-z]/.test(registerPassword)) return 'Add at least one lowercase letter.';
        if(!/[0-9]/.test(registerPassword))return 'Add at least one number.';
        return /[^A-Za-z0-9]/.test(registerPassword)?'':'Add at least one special character.';
      case 'confirmPassword':
        if (!confirmPassword) return 'Confirm your password.';
        return confirmPassword === registerPassword ? '' : 'Passwords do not match.';
      default: return '';
    }
  };
  const registrationFieldError = (field: string) =>
    registrationSubmitted || registrationTouched[field] ? registrationErrorFor(field) : '';
  const registrationValidationProps = (field: string) => {
    const message = registrationFieldError(field);
    return {
      onBlur: () => setRegistrationTouched(current => ({ ...current, [field]: true })),
      'aria-invalid': Boolean(message),
      'data-valid': registrationTouched[field]&&!message?'true':undefined,
      'aria-describedby': message ? `registration-${field}-error` : undefined,
    };
  };
  const registrationErrorMessage = (field: string) => {
    const message = registrationFieldError(field);
    return message ? <small id={`registration-${field}-error`} className="registration-field-error" role="alert">{message}</small> : null;
  };

  useEffect(() => {
    if ((mode !== 'login-otp' && mode !== 'otp') || otpExpiresAt === null) return;
    const updateTimeLeft = () => {
      const now = Date.now();
      setTimeLeft(Math.max(0, Math.ceil((otpExpiresAt - now) / 1000)));
      setResendSecondsLeft(resendAvailableAt === null ? 0 : Math.max(0, Math.ceil((resendAvailableAt - now) / 1000)));
    };
    updateTimeLeft();
    const interval = window.setInterval(updateTimeLeft, 1000);
    return () => window.clearInterval(interval);
  }, [mode, otpExpiresAt, resendAvailableAt]);

  useEffect(()=>{
    if(recoveryStep!=='reset'||recoveryExpiresAt===null)return;
    const update=()=>setRecoveryTimeLeft(Math.max(0,Math.ceil((recoveryExpiresAt-Date.now())/1000)));
    update();
    const interval=window.setInterval(update,1000);
    return()=>window.clearInterval(interval);
  },[recoveryStep,recoveryExpiresAt]);

  const navigateAuth = (next: 'landing'|'login'|'register') => {
    const nextMode = next === 'login' ? (expectedRole ? 'login' : 'landing') : next;
    setMode(nextMode);
    setLoginCardOpen(next === 'login');
    setError('');
    setOtp('');
    const path = next === 'register' ? '/register' : next === 'login' ? '/login' : '/';
    if (next === 'login') {
      if (!expectedRole && window.location.pathname !== '/') window.history.pushState({ auth: 'landing' }, '', '/');
    } else if (window.location.pathname !== path) window.history.pushState({ auth: next }, '', path);
  };

  useEffect(() => {
    if (expectedRole) setSelectedRole(expectedRole);
  }, [expectedRole]);

  useEffect(() => {
    const path = window.location.pathname.replace(/\/$/, '');
    const isDashboardPath = /^\/(super-admin|owner|admin|lawyer|analyst|operations|consultant|support|data-steward|viewer)\/dashboard$/.test(path);
    if (expectedRole && isDashboardPath && window.location.hash) {
      window.history.replaceState(window.history.state, '', `${path}${window.location.search}`);
    }
  }, [expectedRole]);

  useEffect(() => {
    const syncRoute = () => {
      const path = window.location.pathname.replace(/\/$/, '');
      const isRoleLogin = Boolean(expectedRole) && (/^\/login\/(super-admin|owner|admin|lawyer|analyst|operations|consultant|support|data-steward|viewer)$/.test(path)
        || /^\/(super-admin|owner|admin|lawyer|analyst|operations|consultant|support|data-steward|viewer)\/dashboard$/.test(path));
      const next = path === '/register' ? 'register' : isRoleLogin ? 'login' : 'landing';
      setLoginCardOpen(Boolean(path.startsWith('/login/')) || isRoleLogin);
      setMode(current => current === 'login-otp' || current === 'otp' || current === 'verified' ? current : next);
    };
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, [expectedRole]);

  useEffect(() => {
    if (mode !== 'landing' || !loginCardOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    loginModalCloseRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeLandingLogin();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [mode, loginCardOpen]);

  const closeLandingLogin = () => {
    if (expectedRole) {
      setMode('login');
      setLoginCardOpen(false);
      setError('');
      setRecoveryStep(null);
      return;
    }
    setLoginModalClosing(true);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => {
      setLoginCardOpen(false);
      setLoginModalClosing(false);
      setError('');
      setRecoveryStep(null);
      setRecoveryOtp('');
      setRecoveryPassword('');
      setRecoveryConfirmPassword('');
    }, reducedMotion ? 0 : 180);
  };

  useEffect(() => {
    if (mode !== 'landing') return;
    const targets = document.querySelectorAll<HTMLElement>('.reveal-on-scroll');
    if (!('IntersectionObserver' in window)) {
      targets.forEach(target => target.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -36px 0px' });
    targets.forEach(target => observer.observe(target));
    return () => observer.disconnect();
  }, [mode]);

  useEffect(() => {
    fetch(`${apiUrl}/health`)
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.database !== 'connected') {
          const reason = data.database === 'not_configured'
            ? 'The API has no DATABASE_URL configured.'
            : data.database === 'disconnected'
              ? 'The API is running but cannot connect to its database.'
              : `${data.error || `Health check failed (HTTP ${res.status}).`}${data.errorCode ? ` (${data.errorCode})` : ''}`;
          throw new Error(reason);
        }
        setServiceStatus('ready');
        setServiceMessage(`API ready • ${data.databaseEngine || 'Database'} connected`);
      })
      .catch(error => {
        setServiceStatus('unavailable');
        const detail = error instanceof Error ? error.message : 'Request failed.';
        setServiceMessage(`API health check failed: ${detail} Start the local API and database, then retry.`);
      });

    // The API exposes this list only when it is itself running in local
    // development mode. This runtime check also works for the production Vite
    // build served by the local Docker stack; production APIs return 404.
    fetch(`${apiUrl}/api/auth/dummy-accounts`)
      .then(res => res.json())
      .then(data => {
        if (data.accounts) {
          setDummyAccounts(data.accounts);
        }
      })
      .catch(() => setDummyAccounts([]));
  }, [apiUrl]);

  const selectAccount = (acc: UserAccount) => {
    setSelectedUid(acc.uid);
    setSelectedRole(acc.isSuperAdmin ? 'super-admin' : acc.role);
    setEmail(acc.email);
    setPassword('');
    setError('');
  };

  const requestLoginOtp = async (deliveryChannel:'email'|'sms',e?:React.SyntheticEvent) => {
    e?.preventDefault();
    setLoading(true);
    setError('');

    try {
      const requestedRole = selectedRole;
      const res = await fetch(`${apiUrl}/api/auth/login/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, expectedRole:requestedRole, deliveryChannel })
      });
      const data = await readApiJson(res);
      if (!res.ok) {
        const error = new Error(data.error || 'Failed to authenticate') as Error & { retryAfterSeconds?: number; code?: string };
        error.retryAfterSeconds = Number(data.retryAfterSeconds) || undefined;
        error.code = typeof data.code === 'string' ? data.code : undefined;
        throw error;
      }

      setChallengeId(data.challengeId);
      setChallengeRole(requestedRole);
      setOtpDeliveryTarget(data.deliveryTarget || email);
      setOtpDeliveryMode(data.deliveryMode==='sms'?'sms':'email');
      setOtpExpiresAt(data.expiresAt ? new Date(data.expiresAt).getTime() : Date.now() + 10 * 60 * 1000);
      setResendAvailableAt(Date.now() + Math.max(0, Number(data.resendAfterSeconds || 30)) * 1000);
      setOtp(data.developmentOtp||'');
      setDevelopmentOtpAutofilled(Boolean(data.developmentOtp));
      setMode('login-otp');
    } catch (err: any) {
      if (Number(err?.retryAfterSeconds) > 0) setResendAvailableAt(Date.now() + Number(err.retryAfterSeconds) * 1000);
      const message = err.message || 'Login failed. Please check credentials.';
      setError(err.code ? `${message} (${err.code})` : message);
    } finally {
      setLoading(false);
    }
  };
  const handleLogin=(e:React.FormEvent)=>requestLoginOtp('email',e);

  const openPasswordRecovery=()=>{setMode('landing');setLoginCardOpen(true);if(!expectedRole&&window.location.pathname!=='/')window.history.pushState({auth:'landing'},'','/');setRecoveryStep('request');setRecoveryOtp('');setRecoveryPassword('');setRecoveryConfirmPassword('');setError('');};
  const requestPasswordRecovery=async(e?:React.FormEvent)=>{
    e?.preventDefault();setLoading(true);setError('');
    try{
      const res=await fetch(`${apiUrl}/api/auth/forgot-password/request-otp`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,expectedRole:selectedRole})});
      const data=await readApiJson(res);
      if(!res.ok){const failure=new Error(data.error||'Unable to send a recovery code.') as Error&{retryAfterSeconds?:number};failure.retryAfterSeconds=Number(data.retryAfterSeconds)||undefined;throw failure;}
      setRecoveryChallengeId(data.challengeId);setRecoveryExpiresAt(data.expiresAt?new Date(data.expiresAt).getTime():Date.now()+600000);setRecoveryOtp('');setRecoveryStep('reset');
    }catch(err){setError(err instanceof Error?err.message:'Unable to send a recovery code.');}
    finally{setLoading(false);}
  };
  const resetForgottenPassword=async(e:React.FormEvent)=>{
    e.preventDefault();setError('');
    if(recoveryPassword!==recoveryConfirmPassword)return setError('New passwords do not match.');
    if(selectedRole==='super-admin'&&(recoveryPassword.length<12||!/[A-Z]/.test(recoveryPassword)||!/[a-z]/.test(recoveryPassword)||!/[0-9]/.test(recoveryPassword)||!/[^A-Za-z0-9]/.test(recoveryPassword)))return setError('Super Admin passwords need 12+ characters with uppercase, lowercase, a number and a special character.');
    setLoading(true);
    try{
      const res=await fetch(`${apiUrl}/api/auth/forgot-password/reset`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({challengeId:recoveryChallengeId,email,expectedRole:selectedRole,otp:recoveryOtp,newPassword:recoveryPassword})});
      const data=await readApiJson(res);if(!res.ok)throw new Error(data.error||'Unable to reset the password.');
      setPassword('');setRecoveryPasswordCopied(false);setRecoveryConfirmPassword('');setRecoveryOtp('');setRecoveryStep('success');
    }catch(err){setError(err instanceof Error?err.message:'Unable to reset the password.');}
    finally{setLoading(false);}
  };

  const verifyLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();setLoading(true);setError('');
    try {
      const requestedRole=challengeRole||selectedRole;
      const res=await fetch(`${apiUrl}/api/auth/login/verify-otp`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({challengeId,email,otp,expectedRole:requestedRole})});
      const data=await readApiJson(res);
      if(!res.ok)throw new Error(data.error||'Unable to verify the sign-in code.');
      if(!matchesRequestedRole(data.user,requestedRole))throw new Error(`This account cannot access the ${roleLoginCopy[requestedRole]?.label||'selected'} sign-in page.`);
      onLoginSuccess(data.token,data.user,requestedRole);
    } catch(err){setError(err instanceof Error?err.message:'OTP verification failed.');}
    finally{setLoading(false);}
  };

  function matchesRequestedRole(user:UserAccount,requestedRole=selectedRole){
    if(!requestedRole)return true;
    if(requestedRole==='super-admin')return Boolean(user.isSuperAdmin);
    return user.role===requestedRole;
  }

  const requestOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    setRegistrationSubmitted(true);
    const requiredRegistrationFields = ['firstName','middleName','lastName','gender','mobileNumber','email','securityQuestion','securityAnswer','password','confirmPassword'];
    if(requiredRegistrationFields.some(field=>registrationErrorFor(field))){setError('Please correct the highlighted registration fields.');window.requestAnimationFrame(()=>{const first=registrationFormRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');first?.focus();first?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});});return;}
    const mobileDigits = registerMobile.replace(/\D/g, '');
    const fullName = [registerFirstName, registerMiddleName, registerLastName].filter(Boolean).join(' ').trim();
    if (fullName.length > 160) return setError('The combined name must be 160 characters or fewer.');
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/auth/register/request-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: registerFirstName,
          middleName: registerMiddleName,
          lastName: registerLastName,
          gender: registerGender,
          countryCode: registerCountryCode,
          mobileNumber: mobileDigits,
          securityQuestion: registerSecurityQuestion,
          securityAnswer: registerSecurityAnswer,
          name: fullName,
          email: registerEmail,
          password: registerPassword,
        })
      });
      const data = await readApiJson(res);
      if (!res.ok) {
        const failure = new Error(data.error || 'Unable to create registration.') as Error & { retryAfterSeconds?: number };
        failure.retryAfterSeconds = Number(data.retryAfterSeconds) || undefined;
        throw failure;
      }
      setChallengeId(data.challengeId);
      setRegisterName(fullName);
      setRegisterEmail(data.email);
      setOtpExpiresAt(data.expiresAt ? new Date(data.expiresAt).getTime() : Date.now() + 10 * 60 * 1000);
      setResendAvailableAt(Date.now() + Math.max(0, Number(data.resendAfterSeconds || 30)) * 1000);
      setOtp('');
      setMode('otp');
    } catch (err: any) {
      if (Number(err?.retryAfterSeconds) > 0) setResendAvailableAt(Date.now() + Number(err.retryAfterSeconds) * 1000);
      setError(err instanceof Error ? err.message : 'Registration failed.');
    }
    finally { setLoading(false); }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/auth/register/verify-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId, email: registerEmail, otp })
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || 'OTP verification failed.');
      setEmail(registerEmail);
      setPassword(registerPassword);
      setSelectedUid('');
      setMode('verified');
    } catch (err) { setError(err instanceof Error ? err.message : 'OTP verification failed.'); }
    finally { setLoading(false); }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'owner': return { bg: '#ede9fe', text: '#6d28d9', border: '#c4b5fd' };
      case 'admin': return { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' };
      case 'lawyer': return { bg: '#e0e7ff', text: '#3730a3', border: '#c7d2fe' };
      case 'analyst': return { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' };
      case 'operations': return { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' };
      case 'consultant': return { bg: '#f0fdfa', text: '#0f766e', border: '#99f6e4' };
      case 'support': return { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' };
      case 'data_steward': return { bg: '#ecfeff', text: '#0e7490', border: '#a5f3fc' };
      case 'viewer': return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
      default: return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
    }
  };

  const currentAccount = dummyAccounts.find(a => a.uid === selectedUid) || (selectedUid ? dummyAccounts[0] : {
    uid: '', email, name: registerName || 'Registered member', designation: 'Registered Reviewer',
    role: 'viewer' as UserRole, avatar: (registerName || 'RM').split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase(),
    description: 'Verified read-only workspace member'
  });
  if(mode==='login-otp') return <main className="executive-otp-shell"><section className="executive-otp-card">
    <img className="executive-logo otp-logo" src="/assets/ojix-primary-dark.png" alt="OJIX Property Intelligence"/>
    <span className="executive-secure-pill"><ShieldCheck size={13}/> TWO-STEP VERIFICATION</span>
    <h1>Confirm your secure sign-in</h1>
    <p>Enter the six-digit code sent by {otpDeliveryMode==='sms'?'SMS':'email'} to <strong>{otpDeliveryTarget||email}</strong>. It can be used once.</p>
    <div className="otp-delivery-options" aria-label="Verification code delivery method">
      <button type="button" className={otpDeliveryMode==='email'?'active':''} disabled={loading||resendSecondsLeft>0} onClick={()=>requestLoginOtp('email')}><Mail size={15}/><span><strong>Email</strong><small>{otpDeliveryMode==='email'?otpDeliveryTarget:'Send a new code'}</small></span></button>
      <button type="button" className={otpDeliveryMode==='sms'?'active':''} disabled={loading||resendSecondsLeft>0} onClick={()=>requestLoginOtp('sms')}><Smartphone size={15}/><span><strong>Verified mobile</strong><small>{otpDeliveryMode==='sms'?otpDeliveryTarget:'Send SMS code'}</small></span></button>
    </div>
    <p role="timer" aria-live="polite">{timeLeft>0?`Code expires in ${Math.floor(timeLeft/60)}:${String(timeLeft%60).padStart(2,'0')}`:'Code expired. Generate a new code.'}</p>
    {developmentOtpAutofilled&&<div className="executive-alert service"><ShieldCheck size={16}/><span>Local development mobile OTP was generated and autofilled. This feature is disabled in production.</span></div>}
    {error&&<div className="executive-alert error"><AlertCircle size={16}/><span>{error}</span></div>}
    <form onSubmit={verifyLoginOtp}><label>Verification code<input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" value={otp} onChange={event=>setOtp(event.target.value.replace(/\D/g,''))} placeholder="000000"/></label><button className="executive-submit" disabled={loading||otp.length!==6||timeLeft===0}>{loading?<><span className="executive-spinner"/> Verifying…</>:<>Verify and enter workspace <ArrowRight/></>}</button></form>
    <div className="executive-otp-actions"><button onClick={()=>{setMode('landing');setLoginCardOpen(true);setOtp('');setError('');}}>Back to sign in</button><button disabled={loading||resendSecondsLeft>0} onClick={()=>requestLoginOtp(otpDeliveryMode)}>{resendSecondsLeft>0?`Resend code in ${resendSecondsLeft}s`:`Resend by ${otpDeliveryMode==='sms'?'SMS':'email'}`}</button></div>
    <p className="executive-legal">Never share your verification code. OJIX staff will not ask you for it.</p>
  </section></main>;

  if (mode !== 'login' && mode !== 'landing') {
    const isOtp = mode === 'otp';
    const isVerified = mode === 'verified';
    return (
      <main className="portal-auth-page portal-register-page"><header className="portal-masthead"><div className="portal-brand-lockup"><img src="/assets/ojix-wordmark-header.png" alt="OJIX"/><div><strong>Property Intelligence</strong><span>Karnataka due diligence workspace</span></div></div><div className="portal-head-actions"><button type="button" className="portal-login-tab" onClick={()=>navigateAuth('login')}>Login</button><button type="button" className="portal-register-tab active" onClick={()=>navigateAuth('register')}>Register</button></div></header><section className="portal-auth-main portal-register-main">
        <div className="registration-modal" role="dialog" aria-modal="true" aria-labelledby="registration-title">
          <div className="registration-modal-header"><h1 id="registration-title">Create Account</h1><button type="button" className="registration-close" aria-label="Close registration" onClick={()=>navigateAuth('landing')}><X size={19}/></button></div>
          <div className="registration-modal-content">
            <div className="registration-steps" aria-label="Registration steps">{['Account details','Verify email','Sign in'].map((label,index)=>{const active=isVerified?2:isOtp?1:0;return <div className={index<=active?'active':''} key={label}><i/>{index+1}. {label}</div>})}</div>
            <p className="registration-intro">{isVerified?'Registration is complete. Continue to sign in with your new password.':isOtp?`Enter the six-digit email code sent to ${registerEmail}. It expires in 10 minutes.`:'Enter your account and contact details, then verify your work email.'}</p>
            {error&&<div className="registration-error" role="alert">{error}</div>}
            {isVerified ? <div className="registration-complete"><CheckCircle2 size={34}/><p>Your email is verified. Your password is ready for sign-in.</p><button className="registration-primary" type="button" onClick={()=>navigateAuth('login')}>Continue to Sign In <ArrowRight size={16}/></button></div> : isOtp ? (
              <form onSubmit={verifyOtp} className="registration-otp-form"><p className="registration-otp-time" role="timer" aria-live="polite">{timeLeft>0?`Code expires in ${Math.floor(timeLeft/60)}:${String(timeLeft%60).padStart(2,'0')}`:'Code expired. Request a new code.'}</p><label className="registration-field"><span>Six-digit email code*</span><input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,''))} required pattern="\d{6}" placeholder="000000"/></label><button className="registration-primary" disabled={loading||otp.length!==6||timeLeft===0}>{loading?<><span className="executive-spinner"/> Verifying…</>:'Verify and Activate Account'}</button><button className="registration-link-button" type="button" disabled={loading||resendSecondsLeft>0} onClick={()=>requestOtp()}>{resendSecondsLeft>0?`Resend code in ${resendSecondsLeft}s`:'Resend verification code'}</button><button className="registration-link-button" type="button" onClick={()=>{setOtp('');setError('');setMode('register');}}>Change registration details</button></form>
            ) : (
              <form ref={registrationFormRef} onSubmit={requestOtp} className="registration-form" noValidate>
                <div className="registration-person-grid">
                  <label className="registration-field"><span>First Name*</span><input autoComplete="given-name" value={registerFirstName} onChange={e=>setRegisterFirstName(sanitizePersonNameInput(e.target.value))} {...registrationValidationProps('firstName')} required minLength={2} maxLength={50}/>{registrationErrorMessage('firstName')}</label>
                  <label className="registration-field"><span>Middle Name <small>(optional)</small></span><input autoComplete="additional-name" value={registerMiddleName} onChange={e=>setRegisterMiddleName(sanitizePersonNameInput(e.target.value))} {...registrationValidationProps('middleName')} minLength={2} maxLength={50}/>{registrationErrorMessage('middleName')}</label>
                  <label className="registration-field"><span>Last Name*</span><input autoComplete="family-name" value={registerLastName} onChange={e=>setRegisterLastName(sanitizePersonNameInput(e.target.value))} {...registrationValidationProps('lastName')} required minLength={2} maxLength={50}/>{registrationErrorMessage('lastName')}</label>
                  <label className="registration-field"><span>Gender*</span><select value={registerGender} onChange={e=>setRegisterGender(e.target.value)} {...registrationValidationProps('gender')} required><option value="">Select gender</option><option value="female">Female</option><option value="male">Male</option><option value="non_binary">Non-binary</option><option value="prefer_not_to_say">Prefer not to say</option></select>{registrationErrorMessage('gender')}</label>
                </div>
                <label className="registration-field registration-wide"><span>Mobile Number*</span><div className="registration-phone"><select aria-label="Country calling code" value={registerCountryCode} onChange={e=>{setRegisterCountryCode(e.target.value);setRegisterMobile('');}}><option value="+91">India (+91)</option><option value="+1">United States / Canada (+1)</option><option value="+44">United Kingdom (+44)</option><option value="+61">Australia (+61)</option><option value="+971">United Arab Emirates (+971)</option><option value="+65">Singapore (+65)</option></select><input type="tel" autoComplete="tel-national" inputMode="numeric" value={registerMobile} onChange={e=>setRegisterMobile(formatRegistrationPhone(registerCountryCode,e.target.value))} {...registrationValidationProps('mobileNumber')} required aria-label="Mobile number" placeholder="98765 43210"/></div><small className="registration-note">Enter a valid number for the selected country. Repeated and placeholder numbers are rejected.</small>{registrationErrorMessage('mobileNumber')}</label>
                <label className="registration-field registration-wide"><span>Work Email*</span><input type="email" autoComplete="email" value={registerEmail} onChange={e=>setRegisterEmail(e.target.value)} {...registrationValidationProps('email')} required maxLength={255} placeholder="name@company.com"/>{registrationErrorMessage('email')}</label>
                <div className="registration-two-col">
                  <label className="registration-field"><span>Security Question*</span><select value={registerSecurityQuestion} onChange={e=>setRegisterSecurityQuestion(e.target.value)} {...registrationValidationProps('securityQuestion')} required><option value="">Select a question</option><option value="first_school">What was the name of your first school?</option><option value="first_employer">What was the name of your first employer?</option><option value="childhood_city">In what city did you grow up?</option><option value="favorite_teacher">What was the name of a favorite teacher?</option></select>{registrationErrorMessage('securityQuestion')}<small className="registration-note">Your answer is hashed, but is not currently used for sign-in or account recovery.</small></label>
                  <label className="registration-field"><span>Answer*</span><input autoComplete="off" value={registerSecurityAnswer} onChange={e=>setRegisterSecurityAnswer(e.target.value)} {...registrationValidationProps('securityAnswer')} required minLength={3} maxLength={120}/>{registrationErrorMessage('securityAnswer')}<small className="registration-note">Your answer is hashed before storage.</small></label>
                </div>
                <fieldset className="registration-password-section"><legend>Password setup</legend><div className="registration-two-col"><label className="registration-field"><span>Create Password*</span><div className="registration-password-input"><input type={showRegisterPassword?'text':'password'} autoComplete="new-password" value={registerPassword} onChange={e=>setRegisterPassword(e.target.value)} {...registrationValidationProps('password')} required minLength={8} maxLength={128}/><button type="button" aria-label={showRegisterPassword?'Hide password':'Show password'} onClick={()=>setShowRegisterPassword(value=>!value)}>{showRegisterPassword?<EyeOff size={15}/>:<Eye size={15}/>}</button></div>{registrationErrorMessage('password')}<small className="registration-note">8+ characters with uppercase, lowercase, number and special character.</small></label><label className="registration-field"><span>Confirm Password*</span><div className="registration-password-input"><input type={showRegisterConfirmPassword?'text':'password'} autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} {...registrationValidationProps('confirmPassword')} required minLength={8} maxLength={128}/><button type="button" aria-label={showRegisterConfirmPassword?'Hide password':'Show password'} onClick={()=>setShowRegisterConfirmPassword(value=>!value)}>{showRegisterConfirmPassword?<EyeOff size={15}/>:<Eye size={15}/>}</button></div>{registrationErrorMessage('confirmPassword')}</label></div></fieldset>
                <div className="registration-actions"><button type="reset" className="registration-reset" onClick={()=>{setRegisterFirstName('');setRegisterMiddleName('');setRegisterLastName('');setRegisterGender('');setRegisterCountryCode('+91');setRegisterMobile('');setRegisterEmail('');setRegisterSecurityQuestion('');setRegisterSecurityAnswer('');setRegisterPassword('');setConfirmPassword('');setRegistrationSubmitted(false);setRegistrationTouched({});setError('');}}><RotateCcw size={15}/> Reset</button><button className="registration-primary" disabled={loading}>{loading?<><span className="executive-spinner"/> Sending code…</>:'Register'}</button></div>
                <p className="registration-login-prompt">Already a user? <button type="button" onClick={()=>navigateAuth('login')}>Login</button></p>
              </form>
            )}
          </div>
        </div></section></main>
    );
  }

  const isOwner = currentAccount?.role === 'owner';
  const SelectedLoginRoleIcon = loginRoleIcons[selectedRole as keyof typeof loginRoleIcons] || UserCheck;

  if (mode === 'landing') return <>
    <PropertyIntelligenceLanding onLogin={()=>{setLoginModalClosing(false);setLoginCardOpen(true);}} onRegister={()=>navigateAuth('register')}/>
    {loginCardOpen&&<div className={`landing-login-backdrop${loginModalClosing?' is-closing':''}`} onMouseDown={event=>{if(event.target===event.currentTarget)closeLandingLogin();}}>
      <section className="landing-login-modal" role="dialog" aria-modal="true" aria-labelledby="landing-login-title">
        <header className="landing-login-header"><span>Secure OJIX workspace access</span><button ref={loginModalCloseRef} type="button" aria-label="Close login" onClick={closeLandingLogin}><X size={20}/></button></header>
        <div className="landing-login-layout">
          <div className="landing-login-visual">
            <img className="landing-login-logo" src="/assets/ojix-wordmark-header.png" alt="OJIX"/>
            <span className="portal-eyebrow">PROPERTY INTELLIGENCE</span>
            <h2>Welcome back.<br/><em>Continue your review.</em></h2>
            <p>Access connected property records, review documents, and evidence-led due-diligence workflows.</p>
            <img className="landing-login-property-image" src="/images/ojix-property-hero.webp" alt="Property documents, survey map and review workspace"/>
            <div className="landing-login-trust"><ShieldCheck size={15}/><span>Backend-verified roles</span><i/><span>Email OTP protected</span></div>
          </div>
          <div className="landing-login-form-panel">
            <div className="landing-login-tabs" role="tablist" aria-label="Account access"><button className="active" type="button" role="tab" aria-selected="true">Login</button><button type="button" role="tab" aria-selected="false" onClick={()=>navigateAuth('register')}>Register</button></div>
            <span className="executive-secure-pill"><ShieldCheck size={13}/> {recoveryStep?'Account recovery':'Secure access'}</span>
            <h1 id="landing-login-title">{recoveryStep==='request'?'Reset your password':recoveryStep==='reset'?'Enter recovery code':recoveryStep==='success'?'Password updated':'Sign in to OJIX'}</h1>
            <p className="landing-login-intro">{recoveryStep==='request'?'Select your assigned role and enter the account email. We will send a one-time recovery code.':recoveryStep==='reset'?`Enter the six-digit code sent for ${email} and choose a new password.`:recoveryStep==='success'?'Your password was changed and existing sessions were securely revoked.':'Choose your assigned role, then continue with email verification.'}</p>
            {(!recoveryStep||recoveryStep==='request')&&<div className="landing-modal-role-grid" aria-label="Choose assigned role">
              {loginRoleOrder.map(value=>{const RoleIcon=loginRoleIcons[value];const active=selectedRole===value;return <button type="button" className={active?'selected':''} aria-pressed={active} onClick={()=>{setSelectedRole(value);setError('');}} key={value}><RoleIcon size={14}/><span>{roleLoginCopy[value].label}</span></button>})}
            </div>}
            {serviceStatus==='unavailable'&&<div className="executive-alert service"><ShieldAlert size={16}/><span>{serviceMessage}</span></div>}
            {error&&<div className="executive-alert error" role="alert"><AlertCircle size={16}/><span>{error}</span></div>}
            {!recoveryStep&&<form className="executive-login-form landing-modal-form" onSubmit={handleLogin}>
              <div className="login-selected-role"><span className="login-selected-role-icon"><SelectedLoginRoleIcon size={17}/></span><span><small>Signing in as</small><strong>{roleLoginCopy[selectedRole]?.label}</strong></span></div>
              <label><span>Work email</span><div className="executive-input"><UserCheck/><input autoFocus type="email" autoComplete="username" value={email} onChange={event=>setEmail(event.target.value)} required placeholder="name@organisation.com"/></div></label>
              <label><span>Password</span><div className="executive-input"><Lock/><input type={showPassword?'text':'password'} autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} required/><button type="button" aria-label={showPassword?'Hide password':'Show password'} onClick={()=>setShowPassword(value=>!value)}>{showPassword?<EyeOff/>:<Eye/>}</button></div></label>
              <div className="executive-form-meta"><span className="executive-otp-hint"><ShieldCheck size={13}/>Code expires in 10 minutes</span><button type="button" onClick={openPasswordRecovery}>Forgot password?</button></div>
              <button className="executive-submit" type="submit" disabled={loading||serviceStatus==='checking'||!selectedRole}>{loading?<><span className="executive-spinner"/>Sending secure code…</>:<>Continue with email OTP <ArrowRight/></>}</button>
            </form>}
            {recoveryStep==='request'&&<form className="executive-login-form landing-modal-form recovery-form" onSubmit={requestPasswordRecovery}>
              <div className="login-selected-role"><span className="login-selected-role-icon"><SelectedLoginRoleIcon size={17}/></span><span><small>Recovering access for</small><strong>{roleLoginCopy[selectedRole]?.label}</strong></span></div>
              <label><span>Work email</span><div className="executive-input"><UserCheck/><input autoFocus type="email" autoComplete="username" value={email} onChange={event=>setEmail(event.target.value)} required placeholder="name@organisation.com"/></div></label>
              <button className="executive-submit" type="submit" disabled={loading||serviceStatus!=='ready'}>{loading?<><span className="executive-spinner"/>Sending recovery code…</>:<>Send recovery code <ArrowRight/></>}</button>
              <button className="recovery-link" type="button" onClick={()=>{setRecoveryStep(null);setError('');}}>Back to sign in</button>
            </form>}
            {recoveryStep==='reset'&&<form className="executive-login-form landing-modal-form recovery-form" onSubmit={resetForgottenPassword}>
              <p className="recovery-timer" role="timer" aria-live="polite">{recoveryTimeLeft>0?`Code expires in ${Math.floor(recoveryTimeLeft/60)}:${String(recoveryTimeLeft%60).padStart(2,'0')}`:'Code expired. Request a new code.'}</p>
              <label><span>Six-digit recovery code</span><div className="executive-input"><Key/><input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" value={recoveryOtp} onChange={event=>setRecoveryOtp(event.target.value.replace(/\D/g,''))} required placeholder="000000"/></div></label>
              <label><span>New password</span><div className="executive-input"><Lock/><input type="password" autoComplete="new-password" minLength={selectedRole==='super-admin'?12:8} maxLength={128} value={recoveryPassword} onChange={event=>setRecoveryPassword(event.target.value)} required/></div><small className="recovery-password-hint">{selectedRole==='super-admin'?'12+ characters with uppercase, lowercase, a number and a special character.':'At least 8 characters with uppercase, lowercase and a number.'}</small></label>
              <label><span>Confirm new password</span><div className="executive-input"><Lock/><input type="password" autoComplete="new-password" minLength={selectedRole==='super-admin'?12:8} maxLength={128} value={recoveryConfirmPassword} onChange={event=>setRecoveryConfirmPassword(event.target.value)} required/></div></label>
              <button className="executive-submit" type="submit" disabled={loading||recoveryOtp.length!==6||recoveryTimeLeft===0}>{loading?<><span className="executive-spinner"/>Updating password…</>:<>Set new password <ArrowRight/></>}</button>
              <div className="recovery-actions"><button type="button" onClick={()=>{setRecoveryStep('request');setRecoveryOtp('');setError('');}}>Change details</button><button type="button" onClick={()=>requestPasswordRecovery()} disabled={loading}>Send a new code</button></div>
            </form>}
            {recoveryStep==='success'&&<div className="recovery-result">
              <span className="recovery-result-status"><CheckCircle2 size={15}/> Password reset</span>
              <h2>{roleLoginCopy[selectedRole]?.label} Password</h2>
              <p>Your new password for <strong>{roleLoginCopy[selectedRole]?.label}</strong> is ready. It is shown only for this recovery session.</p>
              <div className="recovery-password-card">
                <span>New role password</span>
                <strong>{recoveryPassword}</strong>
                <button type="button" onClick={async()=>{await navigator.clipboard.writeText(recoveryPassword);setRecoveryPasswordCopied(true);}}>{recoveryPasswordCopied?'Password copied':'Copy Password'}</button>
              </div>
              <button className="executive-submit" type="button" onClick={()=>{setRecoveryStep(null);setPassword(recoveryPassword);setRecoveryPassword('');setRecoveryPasswordCopied(false);setError('');}}>Proceed to Sign In with this Password <ArrowRight/></button>
            </div>}
          </div>
        </div>
      </section>
    </div>}
  </>;

  if (mode === 'login') return (
    <main className="executive-login-shell">
      <header className="portal-masthead">
        <div className="portal-brand-lockup"><img src="/assets/ojix-wordmark-header.png" alt="OJIX"/><div><strong>OJIX Property Intelligence</strong><span>Karnataka Property Due Diligence Workspace</span></div></div>
        <div className="portal-head-actions"><span><i className={`portal-state ${serviceStatus}`}/>{serviceStatus==='checking'?'Connecting':serviceStatus==='ready'?'Services available':'Service unavailable'}</span><button type="button" className={`portal-login-tab${loginCardOpen?' active':''}`} aria-expanded={loginCardOpen} onClick={()=>setLoginCardOpen(open=>!open)}>Login</button><button type="button" className="portal-register-tab" onClick={()=>navigateAuth('register')}>Register</button></div>
      </header>
      <section className={`portal-login-main portal-login-only${loginCardOpen?' login-card-open':''}`}>
        <div className="portal-welcome login-welcome-panel">
          <span className="portal-eyebrow">KARNATAKA PROPERTY DUE DILIGENCE</span>
          <h1>Property intelligence.<br/><em>Clarity in every detail.</em></h1>
          <p>Organise property records, review documents and track due-diligence findings in one workspace. Keep important information connected to its source and ready for professional review.</p>
          <PropertyIntelligenceHero/>
          <div className="login-feature-grid" aria-label="Property intelligence capabilities">
            <span><CheckCircle2 size={16}/><b>Verified Records</b></span>
            <span><MapPinned size={16}/><b>Maps &amp; Spatial Data</b></span>
            <span><FileSearch size={16}/><b>Document Analysis</b></span>
            <span><ShieldCheck size={16}/><b>Secure Workspace</b></span>
          </div>
          <div className="login-review-note"><ShieldCheck size={17}/><span><strong>Built for careful review</strong><small>Important conclusions remain subject to qualified professional review.</small></span></div>
        </div>
        <div className="executive-login-access portal-login-card-wrap" aria-hidden={!loginCardOpen}>
        <div className="executive-access-card portal-login-card">
          <div className="login-card-brand"><img src="/assets/ojix-wordmark-header.png" alt="OJIX"/><span>PROPERTY INTELLIGENCE</span></div>
          <div className="login-card-tabs" role="tablist" aria-label="Account access"><button type="button" className="active" role="tab" aria-selected="true">Login</button><button type="button" role="tab" aria-selected="false" onClick={()=>navigateAuth('register')}>Register</button></div>
          <div className="executive-access-topline"><span className="executive-secure-pill"><ShieldCheck size={13}/> Secure access</span><span className={`executive-service ${serviceStatus}`}><i/>{serviceStatus==='checking'?'Checking services':serviceStatus==='ready'?'Systems available':'Service unavailable'}</span></div>
          <div className="executive-user-heading"><div><span>SECURE WORKSPACE ACCESS</span><h2>Welcome to OJIX</h2><p>{selectedRole?`${roleLoginCopy[selectedRole]?.label}: ${roleLoginCopy[selectedRole]?.description}`:'Choose your assigned role, then continue with email verification.'}</p></div></div>

          {serviceStatus==='unavailable'&&<div className="executive-alert service"><ShieldAlert size={16}/><span>{serviceMessage}</span></div>}
          {error&&<div className="executive-alert error" role="alert"><AlertCircle size={16}/><span>{error}</span></div>}

          <form className="executive-login-form" onSubmit={handleLogin}>
            <div className="login-selected-role" aria-live="polite"><span className="login-selected-role-icon"><SelectedLoginRoleIcon size={17}/></span><span><small>Signing in as</small><strong>{roleLoginCopy[selectedRole]?.label || 'Select your assigned role'}</strong></span><button type="button" onClick={()=>document.getElementById('login-role-picker')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'})}>Change</button></div>
            <label><span>Work email</span><div className="executive-input"><UserCheck/><input type="email" autoComplete="username" value={email} onChange={event=>setEmail(event.target.value)} required placeholder="name@organisation.com"/></div></label>
            <label><span>Password</span><div className="executive-input"><Lock/><input type={showPassword?'text':'password'} autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} required/><button type="button" aria-label={showPassword?'Hide password':'Show password'} onClick={()=>setShowPassword(value=>!value)}>{showPassword?<EyeOff/>:<Eye/>}</button></div></label>
            <div className="executive-form-meta"><span className="executive-otp-hint"><ShieldCheck size={13}/>Code expires in 10 minutes</span><button type="button" onClick={openPasswordRecovery}>Forgot password?</button></div>
            <button className="executive-submit" type="submit" disabled={loading||serviceStatus==='checking'||!selectedRole}>{loading?<><span className="executive-spinner"/>Sending secure code…</>:<>Continue with email OTP <ArrowRight/></>}</button>
          </form>

        </div>
        </div>
        <aside id="login-role-picker" className="login-role-panel" aria-label="Available workspace roles">
          <div className="login-role-panel-head"><span>WORKSPACE ACCESS</span><h2>Select your role</h2><p>Your assigned role is verified after authentication.</p></div>
          <div className="login-role-list">
            {loginRoleOrder.map((value,index)=>{const copy=roleLoginCopy[value];const RoleIcon=loginRoleIcons[value];const active=selectedRole===value;return <button type="button" className={`${index===0?'featured ':''}${active?'selected':''}`} aria-pressed={active} onClick={()=>{setSelectedRole(value);setError('');}} style={{'--login-role-delay':`${index*45}ms`} as React.CSSProperties} key={value}>
              <span className="login-role-badge-icon"><RoleIcon size={15}/></span><span><strong>{copy.label}</strong><small>{copy.description}</small></span>{index===0&&<em>Recommended</em>}<ArrowRight size={14}/>
            </button>})}
          </div>
          <p className="login-role-security"><ShieldCheck size={14}/> Selecting a role never changes account permissions.</p>
        </aside>
      </section>
    </main>
  );

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0f172a',
      backgroundImage: 'radial-gradient(ellipse at 50% 20%, #1e293b 0%, #0f172a 100%)',
      padding: '24px',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <div style={{
        maxWidth: '920px',
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, 1fr) minmax(360px, 1.2fr)'
      }}>
        {/* Left Column: Brand & Role Selector */}
        <div style={{
          backgroundColor: '#f8fafc',
          borderRight: '1px solid #e2e8f0',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 900,
                fontSize: '18px'
              }}>
                O
              </div>
              <div>
                <strong style={{ fontSize: '18px', color: '#0f172a', letterSpacing: '-0.3px', display: 'block' }}>
                  OJIX
                </strong>
                <span style={{ fontSize: '10px', color: '#64748b', letterSpacing: '1px', fontWeight: 700 }}>
                  PROPERTY INTELLIGENCE
                </span>
              </div>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
              Bengaluru & Karnataka Legal Due-Diligence Workspace. Select a dummy role below to immediately test RBAC guardrails.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              1-Click Dummy RBAC Accounts:
            </span>

            {dummyAccounts.map(acc => {
              const colors = getRoleBadgeColor(acc.role);
              const isSelected = acc.uid === selectedUid;

              return (
                <div
                  key={acc.uid}
                  onClick={() => selectAccount(acc)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1.5px solid ${isSelected ? '#2563eb' : '#e2e8f0'}`,
                    backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: colors.bg,
                    color: colors.text,
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 700,
                    fontSize: '12px',
                    flexShrink: 0
                  }}>
                    {acc.avatar}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <strong style={{ fontSize: '12px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {acc.name}
                      </strong>
                      <span style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: colors.bg,
                        color: colors.text,
                        border: `1px solid ${colors.border}`,
                        textTransform: 'uppercase'
                      }}>
                        {acc.role}
                      </span>
                    </div>
                    <span style={{ fontSize: '10px', color: '#64748b', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {acc.designation} • {acc.email}
                    </span>
                  </div>
                  {isSelected && <CheckCircle2 size={16} style={{ color: '#2563eb', flexShrink: 0 }} />}
                </div>
              );
            })}
          </div>

          <div style={{
            marginTop: 'auto',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '11px',
            color: '#065f46',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px'
          }}>
            <ShieldCheck size={16} style={{ color: '#059669', flexShrink: 0, marginTop: '1px' }} />
            <span>
              Official portal links are catalogued. Live government property-record connectors are not configured; use official downloads and verified uploads.
            </span>
          </div>
        </div>

        {/* Right Column: Sign In Form & Role Capabilities */}
        <div style={{ padding: '36px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '20px', color: '#0f172a', fontWeight: 800 }}>
              Sign in to Workspace
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              Selected Identity: <strong style={{ color: '#1e293b' }}>{currentAccount?.name}</strong> ({currentAccount?.role?.toUpperCase()})
            </p>
            <button type="button" onClick={()=>{navigateAuth('register');}} style={{marginTop:10,border:0,background:'transparent',padding:0,color:'#2563eb',fontSize:12,fontWeight:700,cursor:'pointer'}}>First time here? Register and verify OTP</button>
          </div>

          <div
            role="status"
            style={{
              marginBottom: '18px', padding: '9px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
              color: serviceStatus === 'ready' ? '#065f46' : serviceStatus === 'unavailable' ? '#991b1b' : '#475569',
              background: serviceStatus === 'ready' ? '#ecfdf5' : serviceStatus === 'unavailable' ? '#fef2f2' : '#f8fafc',
              border: `1px solid ${serviceStatus === 'ready' ? '#a7f3d0' : serviceStatus === 'unavailable' ? '#fecaca' : '#e2e8f0'}`
            }}
          >
            {serviceMessage}
          </div>

          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '12px',
              color: '#991b1b',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '6px', textTransform: 'uppercase' }}>
                Account Email
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#0f172a',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
                <UserCheck size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '6px', textTransform: 'uppercase' }}>
                Password (Dummy: <code style={{ color: '#2563eb' }}>ojix123</code>)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#0f172a',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
              </div>
            </div>

            {/* RBAC Capabilities Preview */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px 14px',
              fontSize: '11px',
              color: '#334155'
            }}>
              <strong style={{ display: 'block', color: '#0f172a', marginBottom: '6px' }}>
                RBAC Access Level for {currentAccount?.role?.toUpperCase()}:
              </strong>
              <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '3px', color: '#475569' }}>
                {currentAccount?.role === 'owner' && (
                  <>
                    <li>Full system authority & tenant ownership</li>
                    <li>Configure workspace & GIS buffer rules</li>
                    <li>Create properties, upload deeds & trigger screening</li>
                    <li>Dispute / verify title chain events</li>
                  </>
                )}
                {currentAccount?.role === 'admin' && (
                  <>
                    <li>Organization & GIS buffer settings configuration</li>
                    <li>Manage property workspaces & case files</li>
                    <li>Upload official records & review source-connection status</li>
                    <li>Dispute / verify title chain events</li>
                  </>
                )}
                {currentAccount?.role === 'lawyer' && (
                  <>
                    <li>Verify & dispute title chain instruments with rationales</li>
                    <li>Override OCR extracted metadata & evidence bounds</li>
                    <li>Bookmark statutory case laws & export due-diligence PDF</li>
                    <li style={{ color: '#94a3b8' }}>Workspace admin settings locked to Admin/Owner</li>
                  </>
                )}
                {currentAccount?.role === 'analyst' && (
                  <>
                    <li>Create property case files & intake survey data</li>
                    <li>Upload registered deeds & trigger document extraction</li>
                    <li>Prepare source lookups and review uploaded official records</li>
                    <li style={{ color: '#94a3b8' }}>Senior legal sign-offs locked to Lawyer/Admin</li>
                  </>
                )}
                {currentAccount?.role === 'viewer' && (
                  <>
                    <li>Inspect property details, cadastral maps & findings</li>
                    <li>View uploaded evidence and clearly labelled connection status</li>
                    <li>Read-only auditor access: all mutations blocked with 403</li>
                  </>
                )}
              </ul>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '8px',
                padding: '12px 16px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                transition: 'all 0.15s ease'
              }}
            >
              {loading ? 'Authenticating…' : `Sign In as ${currentAccount?.role?.toUpperCase()}`}
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
