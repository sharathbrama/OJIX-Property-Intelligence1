import { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, UserCheck, Key, Lock, ArrowRight, Building2, CheckCircle2, AlertCircle, Eye, EyeOff, MapPinned, FileSearch, Landmark, Clock } from 'lucide-react';
import { PropertyIntelligenceHero } from './PropertyIntelligenceHero';
import { PropertyIntelligenceLanding } from './PropertyIntelligenceLanding';
import type { UserAccount, UserRole } from '../types';

interface LoginPageProps {
  apiUrl: string;
  onLoginSuccess: (token: string, user: UserAccount, requestedRole?: string) => void;
  expectedRole?: string;
}

const roleLoginCopy:Record<string,{label:string;description:string}>={
  'super-admin':{label:'Super Admin',description:'Authorized platform administrators only.'},owner:{label:'Workspace Owner',description:'Manage workspace operations and property matters.'},admin:{label:'Organization Admin',description:'Manage organization members, workflows and records.'},lawyer:{label:'Legal Reviewer',description:'Review title evidence and due-diligence findings.'},analyst:{label:'Evidence Analyst',description:'Analyze property records and prepare assigned matters.'},operations:{label:'Document Operations',description:'Manage document intake and processing queues.'},consultant:{label:'Consultant',description:'Review assigned client dossiers and evidence.'},support:{label:'Support',description:'Access authorized workspace diagnostics.'},data_steward:{label:'Data Steward',description:'Maintain source data and reference records.'},viewer:{label:'Viewer',description:'Access approved read-only workspace records.'}
};

export const ROLE_PASSWORDS: Record<string, string> = {
  'super-admin': 'SuperAdmin@3126',
  'owner': 'Owner@3126',
  'admin': 'Admin@3126',
  'lawyer': 'Lawyer@3126',
  'analyst': 'Analyst@3126',
  'operations': 'Operations@3126',
  'consultant': 'Consultant@3126',
  'support': 'Support@3126',
  'data_steward': 'Steward@3126',
  'viewer': 'Viewer@3126'
};
export function LoginPage({ apiUrl, onLoginSuccess, expectedRole }: LoginPageProps) {
  const [mode, setMode] = useState<'landing'|'login'|'login-otp'|'register'|'otp'|'phone-otp'|'verified'>(() => {
    const path = window.location.pathname.replace(/\/$/, '');
    return path === '/register' ? 'register' : 'login';
  });
  const [loginCardOpen, setLoginCardOpen] = useState(Boolean(expectedRole));
  const [dummyAccounts, setDummyAccounts] = useState<UserAccount[]>([]);
  const [selectedUid, setSelectedUid] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [developmentOtp, setDevelopmentOtp] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [challengeRole, setChallengeRole] = useState('');
  const [phoneChallengeId, setPhoneChallengeId] = useState('');
  const [deliveryChannel, setDeliveryChannel] = useState<'email'|'sms'>('email');
  const [selectedRole, setSelectedRole] = useState(expectedRole || '');
  const [otpDeliveryTarget, setOtpDeliveryTarget] = useState('');
  const [timeLeft, setTimeLeft] = useState(600);
  const [serviceStatus, setServiceStatus] = useState<'checking'|'ready'|'unavailable'>('checking');
  const [serviceMessage, setServiceMessage] = useState('Checking API and database…');

  useEffect(() => {
    if (mode !== 'login-otp') return;
    setTimeLeft(600);
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [mode, challengeId]);

  const navigateAuth = (next: 'landing'|'login'|'register') => {
    setMode(next);
    setLoginCardOpen(next === 'login');
    setError('');
    setOtp('');
    const path = next === 'register' ? '/register' : next === 'login' ? '/login' : '/';
    if (window.location.pathname !== path) window.history.pushState({ auth: next }, '', path);
  };

  useEffect(() => {
    setSelectedRole(expectedRole || '');
  }, [expectedRole]);

  useEffect(() => {
    const syncRoute = () => {
      const path = window.location.pathname.replace(/\/$/, '');
      const next = path === '/register' ? 'register' : 'login';
      setLoginCardOpen(Boolean(path.startsWith('/login/')));
      setMode(current => current === 'login-otp' || current === 'otp' || current === 'phone-otp' || current === 'verified' ? current : next);
    };
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

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
        if (!res.ok || data.database !== 'connected') throw new Error(data.error || 'Database is not ready.');
        setServiceStatus('ready');
        setServiceMessage(`API ready • ${data.databaseEngine || 'Database'} connected`);
      })
      .catch(() => {
        setServiceStatus('unavailable');
        setServiceMessage('API or database unavailable. Start the local stack and retry.');
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
    // The local Owner is also the development Super Admin. Preserve the
    // dedicated portal selection instead of downgrading it to Owner when the
    // account chooser fills the credentials.
    const roleKey = expectedRole === 'super-admin' && acc.role === 'owner' ? 'super-admin' : acc.role;
    setSelectedRole(roleKey);
    setEmail(acc.email);
    setPassword(ROLE_PASSWORDS[roleKey] || 'ojix123');
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const requestedRole = selectedRole;
      // Only the special developer identity bypasses OTP. Named demo accounts
      // use the normal OTP request/verification flow and deliver to the
      // configured demo inbox.
      const isLocalDemoAccount = normalizedEmail === 'developer@localhost';
      const res = await fetch(`${apiUrl}${isLocalDemoAccount ? '/api/auth/login' : '/api/auth/login/request-otp'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password.trim(), channel: deliveryChannel, expectedRole: requestedRole })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to authenticate');
      }

      if (isLocalDemoAccount) {
        if (!matchesRequestedRole(data.user, requestedRole)) throw new Error(`This account cannot access the ${roleLoginCopy[requestedRole]?.label || 'selected'} sign-in page.`);
        onLoginSuccess(data.token, data.user, requestedRole);
        return;
      }

      setChallengeId(data.challengeId);
      setChallengeRole(requestedRole);
      setOtpDeliveryTarget(data.deliveryTarget || email);
      setDevelopmentOtp(data.developmentOtp || '');
      setOtp(''); // Leaves verification input empty so user enters the generated OTP
      setMode('login-otp');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const verifyLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();setLoading(true);setError('');
    try {
      const requestedRole=challengeRole||selectedRole;
      const res=await fetch(`${apiUrl}/api/auth/login/verify-otp`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({challengeId,email,otp,expectedRole:requestedRole})});
      const data=await res.json();
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

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (registerPassword !== confirmPassword) return setError('Passwords do not match.');
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/auth/register/request-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: registerName, email: registerEmail, phone: registerPhone, password: registerPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to create registration.');
      setChallengeId(data.challengeId);
      setPhoneChallengeId(data.phoneChallengeId || '');
      setRegisterEmail(data.email);
      setMode('otp');
    } catch (err) { setError(err instanceof Error ? err.message : 'Registration failed.'); }
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'OTP verification failed.');
      if (data.phoneVerificationRequired) { setOtp(''); setMode('phone-otp'); return; }
      setEmail(registerEmail);
      setPassword(registerPassword);
      setSelectedUid('');
      setMode('verified');
    } catch (err) { setError(err instanceof Error ? err.message : 'OTP verification failed.'); }
    finally { setLoading(false); }
  };

  const verifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res=await fetch(`${apiUrl}/api/auth/register/verify-phone-otp`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({challengeId:phoneChallengeId,email:registerEmail,otp})});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||'Phone verification failed.');
      setEmail(registerEmail); setPassword(registerPassword); setSelectedUid(''); setMode('verified');
    } catch(err) { setError(err instanceof Error?err.message:'Phone verification failed.'); }
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
  const isLocalDemoLogin = email.trim().toLowerCase() === 'developer@localhost';

  if (mode === 'login-otp') return (
    <main className="executive-otp-shell">
      <section className="executive-otp-card">
        <img className="executive-logo otp-logo" src="/assets/ojix-primary-dark.png" alt="OJIX Property Intelligence" />
        <span className="executive-secure-pill"><ShieldCheck size={13} /> TWO-STEP VERIFICATION</span>
        <h1>Confirm your secure sign-in</h1>
        <p>
          Enter the six-digit sign-in code sent by {deliveryChannel === 'email' ? 'email' : 'SMS'} to <strong>{otpDeliveryTarget || email}</strong>. Check your inbox on your phone or computer.
        </p>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '8px 16px',
          borderRadius: '9999px',
          background: timeLeft < 60 ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${timeLeft < 60 ? '#fca5a5' : '#bbf7d0'}`,
          color: timeLeft < 60 ? '#dc2626' : '#15803d',
          fontSize: '13px',
          fontWeight: 600,
          margin: '12px auto 18px auto',
          width: 'fit-content'
        }}>
          <Clock size={16} />
          <span>
            {timeLeft > 0
              ? `Code expires in: ${String(Math.floor(timeLeft / 60)).padStart(2, '0')}:${String(timeLeft % 60).padStart(2, '0')}`
              : 'Code expired — please generate a new code'}
          </span>
        </div>

        {error && <div className="executive-alert error"><AlertCircle size={16} /><span>{error}</span></div>}
        <form onSubmit={verifyLoginOtp}>
          <label>
            Verification code
            <input
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="\d{6}"
              value={otp}
              onChange={event => setOtp(event.target.value.replace(/\D/g, ''))}
              placeholder="Enter 6-digit OTP"
            />
          </label>
          <button className="executive-submit" disabled={loading || otp.length !== 6 || timeLeft === 0}>
            {loading ? <><span className="executive-spinner" /> Verifying…</> : <>Verify and enter workspace <ArrowRight /></>}
          </button>
        </form>
        <div className="executive-otp-actions">
          <button onClick={() => { setMode('login'); setOtp(''); setDevelopmentOtp(''); setError(''); }}>Back to sign in</button>
          <button onClick={handleLogin as any}>Generate a new code</button>
        </div>
        <p className="executive-legal">Never share your verification code. OJIX staff will not ask you for it.</p>
      </section>
    </main>
  );

  if (mode !== 'login' && mode !== 'landing') {
    const isOtp = mode === 'otp';
    const isPhoneOtp = mode === 'phone-otp';
    const isVerified = mode === 'verified';
    return (
      <main className="portal-auth-page"><header className="portal-masthead"><div className="portal-brand-lockup"><img src="/assets/ojix-wordmark-header.png" alt="OJIX"/><div><strong>Property Intelligence</strong><span>Karnataka due diligence workspace</span></div></div><div className="portal-head-actions"><button type="button" className="portal-login-tab" onClick={()=>navigateAuth('login')}>Login</button><button type="button" className="portal-register-tab active" onClick={()=>navigateAuth('register')}>Register</button></div></header><section className="portal-auth-main">
        <div className="portal-auth-card" style={{width:'100%',maxWidth:520,background:'#fff',borderRadius:16,padding:36,boxShadow:'0 25px 50px -12px rgba(0,0,0,.4)'}}>
          <div className="portal-auth-card-brand"><img src="/assets/ojix-wordmark-header.png" alt="OJIX"/><span>SECURE MEMBER ONBOARDING</span></div>
          <div style={{display:'flex',gap:8,marginBottom:24}}>{['Account','Verify email','Verify phone','Sign in'].map((label,index)=>{const active=isVerified?3:isPhoneOtp?2:isOtp?1:0;return <div key={label} style={{flex:1,fontSize:10,fontWeight:700,color:index<=active?'#1d4ed8':'#94a3b8'}}><div style={{height:3,borderRadius:3,background:index<=active?'#2563eb':'#e2e8f0',marginBottom:7}}/>{index+1}. {label}</div>})}</div>
          <h2 style={{margin:'0 0 6px',fontSize:22,color:'#0f172a'}}>{isVerified?'Account verified':isPhoneOtp?'Verify your phone':isOtp?'Verify your email':'Create your account'}</h2>
          <p style={{margin:'0 0 22px',fontSize:13,color:'#64748b',lineHeight:1.5}}>{isVerified?'Registration is complete. Continue to the sign-in page using your new password.':isPhoneOtp?`Enter the six-digit SMS code sent to ${registerPhone}.`:isOtp?`Enter the six-digit email code sent to ${registerEmail}. The code expires in 10 minutes.`:'First-time users can add a phone number to enable SMS sign-in.'}</p>
          {error&&<div style={{background:'#fef2f2',border:'1px solid #fecaca',color:'#991b1b',padding:'10px 12px',borderRadius:8,fontSize:12,marginBottom:16}}>{error}</div>}
          {isVerified ? <button onClick={()=>{navigateAuth('login');}} style={{width:'100%',padding:12,border:0,borderRadius:8,background:'#2563eb',color:'#fff',fontWeight:700,cursor:'pointer'}}>Continue to Sign In <ArrowRight size={16} style={{verticalAlign:'middle',marginLeft:6}}/></button> : isPhoneOtp ? (
            <form onSubmit={verifyPhoneOtp} style={{display:'grid',gap:15}}><label style={{fontSize:11,fontWeight:700,color:'#334155'}}>SIX-DIGIT SMS CODE<input autoFocus inputMode="numeric" maxLength={6} value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,''))} required pattern="\d{6}" style={{display:'block',width:'100%',boxSizing:'border-box',marginTop:7,padding:13,border:'1px solid #cbd5e1',borderRadius:8,fontSize:20,letterSpacing:8,textAlign:'center'}}/></label><button disabled={loading||otp.length!==6} style={{padding:12,border:0,borderRadius:8,background:'#2563eb',color:'#fff',fontWeight:700,cursor:'pointer'}}>{loading?'Verifying…':'Verify Phone and Finish'}</button></form>
          ) : isOtp ? (
            <form onSubmit={verifyOtp} style={{display:'grid',gap:15}}><label style={{fontSize:11,fontWeight:700,color:'#334155'}}>SIX-DIGIT OTP<input autoFocus inputMode="numeric" maxLength={6} value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,''))} required pattern="\d{6}" style={{display:'block',width:'100%',boxSizing:'border-box',marginTop:7,padding:13,border:'1px solid #cbd5e1',borderRadius:8,fontSize:20,letterSpacing:8,textAlign:'center'}}/></label><button disabled={loading||otp.length!==6} style={{padding:12,border:0,borderRadius:8,background:'#2563eb',color:'#fff',fontWeight:700,cursor:'pointer'}}>{loading?'Verifying…':'Verify and Activate Account'}</button><button type="button" onClick={()=>{navigateAuth('register');}} style={{border:0,background:'transparent',color:'#2563eb',cursor:'pointer'}}>Change registration details</button></form>
          ) : (
            <form onSubmit={requestOtp} style={{display:'grid',gap:14}} autoComplete="off">
              <label style={{fontSize:11,fontWeight:700,color:'#334155'}}>FULL NAME<input value={registerName} onChange={e=>setRegisterName(e.target.value)} required minLength={2} style={{display:'block',width:'100%',boxSizing:'border-box',marginTop:6,padding:11,border:'1px solid #cbd5e1',borderRadius:8}}/></label>
              <label style={{fontSize:11,fontWeight:700,color:'#334155'}}>WORK EMAIL<input type="email" value={registerEmail} onChange={e=>setRegisterEmail(e.target.value)} required autoComplete="off" style={{display:'block',width:'100%',boxSizing:'border-box',marginTop:6,padding:11,border:'1px solid #cbd5e1',borderRadius:8}}/></label>
              <label style={{fontSize:11,fontWeight:700,color:'#334155'}}>PHONE NUMBER (OPTIONAL)<input type="tel" value={registerPhone} onChange={e=>setRegisterPhone(e.target.value)} placeholder="+14155552671" pattern="\+[1-9]\d{7,14}" style={{display:'block',width:'100%',boxSizing:'border-box',marginTop:6,padding:11,border:'1px solid #cbd5e1',borderRadius:8}}/><small style={{display:'block',marginTop:5,color:'#64748b',fontWeight:400}}>Include country code. We will verify email and phone separately.</small></label>
              <label style={{fontSize:11,fontWeight:700,color:'#334155'}}>CREATE PASSWORD<input type="password" value={registerPassword} onChange={e=>setRegisterPassword(e.target.value)} required minLength={8} autoComplete="new-password" style={{display:'block',width:'100%',boxSizing:'border-box',marginTop:6,padding:11,border:'1px solid #cbd5e1',borderRadius:8}}/><small style={{display:'block',marginTop:5,color:'#64748b',fontWeight:400}}>Minimum 8 characters with uppercase, lowercase and a number.</small></label>
              <label style={{fontSize:11,fontWeight:700,color:'#334155'}}>CONFIRM PASSWORD<input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required autoComplete="new-password" style={{display:'block',width:'100%',boxSizing:'border-box',marginTop:6,padding:11,border:'1px solid #cbd5e1',borderRadius:8}}/></label>
              <button disabled={loading} style={{padding:12,border:0,borderRadius:8,background:'#2563eb',color:'#fff',fontWeight:700,cursor:'pointer'}}>{loading?'Creating OTP…':'Register and Send OTP'}</button>
              <button type="button" onClick={()=>{navigateAuth('login');}} style={{border:0,background:'transparent',color:'#2563eb',cursor:'pointer'}}>Already registered? Sign in</button>
            </form>
          )}
        </div></section></main>
    );
  }

  const isOwner = currentAccount?.role === 'owner';

  if (mode === 'landing') return <PropertyIntelligenceLanding onLogin={()=>navigateAuth('login')} onRegister={()=>navigateAuth('register')}/>;

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
          <div className="portal-welcome-points" aria-label="Property intelligence capabilities">
            <article><img src="/images/ojix-property-records.webp" alt="" width="1254" height="1254" loading="lazy" decoding="async"/><span>Property Records</span></article>
            <article><img src="/images/ojix-document-review.webp" alt="" width="1254" height="1254" loading="lazy" decoding="async"/><span>Document Review</span></article>
            <article><img src="/images/ojix-risk-assessment.webp" alt="" width="1254" height="1254" loading="lazy" decoding="async"/><span>Risk Assessment</span></article>
          </div>
          <div className="login-review-note"><ShieldCheck size={17}/><span><strong>Built for careful review</strong><small>Important conclusions remain subject to qualified professional review.</small></span></div>
        </div>
        <div className="executive-login-access portal-login-card-wrap" aria-hidden={!loginCardOpen}>
        <div className="executive-access-card portal-login-card">
          <div className="executive-access-topline"><span className="executive-secure-pill"><ShieldCheck size={13}/> Secure access</span><span className={`executive-service ${serviceStatus}`}><i/>{serviceStatus==='checking'?'Checking services':serviceStatus==='ready'?'Systems available':'Service unavailable'}</span></div>
          <div className="executive-user-heading"><div><span>OJIX PROPERTY INTELLIGENCE</span><h2>{selectedRole?`${roleLoginCopy[selectedRole]?.label||'Member'} Sign In`:'Welcome back'}</h2><p>{selectedRole?roleLoginCopy[selectedRole]?.description:'Choose the role you need, then sign in to continue.'}</p></div></div>

          {serviceStatus==='unavailable'&&<div className="executive-alert service"><ShieldAlert size={16}/><span>{serviceMessage}</span></div>}
          {error&&<div className="executive-alert error" role="alert"><AlertCircle size={16}/><span>{error}</span></div>}

          <form className="executive-login-form" onSubmit={handleLogin} autoComplete="off">
            <label>
              <span>Which role do you want to access?</span>
              <select
                required
                value={selectedRole}
                onChange={event => {
                  const roleKey = event.target.value;
                  setSelectedRole(roleKey);
                  setError('');
                }}
                style={{ width: '100%', height: 44, padding: '0 11px', border: '1px solid #d2dbe6', borderRadius: 8, background: '#fff', color: '#172334' }}
              >
                <option value="" disabled>Select your assigned role</option>
                {Object.entries(roleLoginCopy).map(([value, copy]) => (
                  <option key={value} value={value}>{copy.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Password</span>
              <div className="executive-input">
                <Lock />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  required
                  placeholder={selectedRole ? `Enter password for ${roleLoginCopy[selectedRole]?.label || 'role'}` : 'Enter assigned role password'}
                />
                <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(value => !value)}>
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </label>
            <label>
              <span>Work email</span>
              <div className="executive-input">
                <UserCheck />
                <input
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  required
                  placeholder="name@organisation.com"
                />
              </div>
            </label>
            {!isLocalDemoLogin && (
              <label>
                <span>Send verification code by</span>
                <select
                  value={deliveryChannel}
                  onChange={event => setDeliveryChannel(event.target.value as 'email' | 'sms')}
                  style={{ width: '100%', height: 44, padding: '0 11px', border: '1px solid #d2dbe6', borderRadius: 8, background: '#fff', color: '#172334' }}
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS to verified phone</option>
                </select>
              </label>
            )}
            <div className="executive-form-meta">
              <span className="executive-otp-hint"><ShieldCheck size={13} />Code expires in 10 minutes</span>
              <button type="button" onClick={() => setError('Password reset is not available yet. Please contact your workspace administrator.')}>Forgot password?</button>
            </div>
            <button className="executive-submit" type="submit" disabled={loading || serviceStatus === 'checking'}>
              {loading ? (
                <><span className="executive-spinner" />Sending verification code…</>
              ) : (
                <>Continue with {deliveryChannel === 'email' ? 'email' : 'SMS'} OTP <ArrowRight /></>
              )}
            </button>
          </form>

        </div>
        </div>
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
