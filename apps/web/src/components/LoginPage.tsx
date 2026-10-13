import { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, UserCheck, Key, Lock, ArrowRight, Building2, CheckCircle2, AlertCircle, Eye, EyeOff, BriefcaseBusiness, Scale, BadgeCheck, Activity } from 'lucide-react';
import type { UserAccount, UserRole } from '../types';

interface LoginPageProps {
  apiUrl: string;
  onLoginSuccess: (token: string, user: UserAccount) => void;
}

export function LoginPage({ apiUrl, onLoginSuccess }: LoginPageProps) {
  const [mode, setMode] = useState<'login'|'login-otp'|'register'|'otp'|'verified'>('login');
  const [dummyAccounts, setDummyAccounts] = useState<UserAccount[]>([]);
  const [selectedUid, setSelectedUid] = useState<string>('user-owner');
  const [email, setEmail] = useState<string>('owner@ojix.local');
  const [password, setPassword] = useState<string>('ojix123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [developmentOtp, setDevelopmentOtp] = useState('');
  const [serviceStatus, setServiceStatus] = useState<'checking'|'ready'|'unavailable'>('checking');
  const [serviceMessage, setServiceMessage] = useState('Checking API and database…');

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

    fetch(`${apiUrl}/api/auth/dummy-accounts`)
      .then(res => res.json())
      .then(data => {
        if (data.accounts) {
          setDummyAccounts(data.accounts);
        }
      })
      .catch(() => {
        // Fallback dummy accounts if API is booting
        setDummyAccounts([
          {
            uid: 'user-owner',
            email: 'owner@ojix.local',
            name: 'Rajesh Sharma',
            designation: 'Managing Partner',
            role: 'owner',
            avatar: 'RS',
            description: 'Workspace Owner — full tenant and governance administration, deletion, and system authorization.'
          },
          {
            uid: 'user-admin',
            email: 'admin@ojix.local',
            name: 'Priya Nair',
            designation: 'Firm Administrator',
            role: 'admin',
            avatar: 'PN',
            description: 'Firm Administrator — workspace settings, GIS configurations, member governance, and data export.'
          },
          {
            uid: 'user-lawyer',
            email: 'lawyer@ojix.local',
            name: 'Adv. Anand Rao',
            designation: 'Senior Legal Reviewer',
            role: 'lawyer',
            avatar: 'AR',
            description: 'Senior Legal Counsel — dispute/verify title chain events, override OCR extractions, and sign off reports.'
          },
          {
            uid: 'user-analyst',
            email: 'analyst@ojix.local',
            name: 'Kavita Reddy',
            designation: 'Due Diligence Analyst',
            role: 'analyst',
            avatar: 'KR',
            description: 'Due Diligence Analyst — case intake, document upload, trigger preliminary analyses, and run registry sync.'
          },
          {
            uid: 'user-operations',
            email: 'operations@ojix.local',
            name: 'Meera Kulkarni',
            designation: 'Document Intake Specialist',
            role: 'operations',
            avatar: 'MK',
            description: 'Paralegal / Operations — bulk document intake, property assignment, metadata checks, and processing follow-up.'
          },
          {
            uid: 'user-consultant',
            email: 'consultant@ojix.local',
            name: 'Sanjay Hegde',
            designation: 'Property Consultant',
            role: 'consultant',
            avatar: 'SH',
            description: 'Property Consultant — matter access, client-ready dossier preparation, issue-list review, and approved exports.'
          },
          {
            uid: 'user-support',
            email: 'support@ojix.local',
            name: 'Nikhil Dev',
            designation: 'OJIX Support Engineer',
            role: 'support',
            avatar: 'ND',
            description: 'OJIX Support — time-limited, read-only diagnostics with no business-data access by default.'
          },
          {
            uid: 'user-data-steward',
            email: 'steward@ojix.local',
            name: 'Asha Iyer',
            designation: 'OJIX Data Steward',
            role: 'data_steward',
            avatar: 'AI',
            description: 'OJIX Data Steward — source mappings, rule configuration, ingestion quality, and reference-data governance.'
          },
          {
            uid: 'user-viewer',
            email: 'viewer@ojix.local',
            name: 'Vikram Mehta',
            designation: 'Client / Audit Inspector',
            role: 'viewer',
            avatar: 'VM',
            description: 'External Auditor / Read-Only Client — inspect evidence, view map layers and reports (all mutations blocked).'
          }
        ]);
      });
  }, [apiUrl]);

  const selectAccount = (acc: UserAccount) => {
    setSelectedUid(acc.uid);
    setEmail(acc.email);
    setPassword('ojix123');
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${apiUrl}/api/auth/login/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to authenticate');
      }

      setChallengeId(data.challengeId);
      setDevelopmentOtp(data.developmentOtp||'');
      setOtp('');
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
      const res=await fetch(`${apiUrl}/api/auth/login/verify-otp`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({challengeId,email,otp})});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||'Unable to verify the sign-in code.');
      onLoginSuccess(data.token,data.user);
    } catch(err){setError(err instanceof Error?err.message:'OTP verification failed.');}
    finally{setLoading(false);}
  };

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (registerPassword !== confirmPassword) return setError('Passwords do not match.');
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/auth/register/request-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: registerName, email: registerEmail, password: registerPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to create registration.');
      setChallengeId(data.challengeId);
      setRegisterEmail(data.email);
      setDevelopmentOtp(data.developmentOtp || '');
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

  if(mode==='login-otp') return <main className="executive-otp-shell"><section className="executive-otp-card"><div className="executive-brand-mark otp"><span>O</span><i/></div><span className="executive-secure-pill"><ShieldCheck size={13}/> TWO-STEP VERIFICATION</span><h1>Confirm your secure sign-in</h1><p>Enter the six-digit code for <strong>{email}</strong>. It expires in 10 minutes and can be used only once.</p>{developmentOtp&&<div className="executive-development-otp"><span>LOCAL DEVELOPMENT CODE</span><strong>{developmentOtp}</strong><small>Configure RESEND_API_KEY and a real email address for email delivery.</small></div>}{error&&<div className="executive-alert error"><AlertCircle size={16}/><span>{error}</span></div>}<form onSubmit={verifyLoginOtp}><label>Verification code<input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" value={otp} onChange={event=>setOtp(event.target.value.replace(/\D/g,''))} placeholder="000000"/></label><button className="executive-submit" disabled={loading||otp.length!==6}>{loading?<><span className="executive-spinner"/> Verifying…</>:<>Verify and enter workspace <ArrowRight/></>}</button></form><div className="executive-otp-actions"><button onClick={()=>{setMode('login');setOtp('');setError('');}}>Back to sign in</button><button onClick={handleLogin as any}>Send a new code</button></div><p className="executive-legal">Never share your verification code. OJIX staff will not ask you for it.</p></section></main>;

  if (mode !== 'login') {
    const isOtp = mode === 'otp';
    const isVerified = mode === 'verified';
    return (
      <div style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'radial-gradient(ellipse at 50% 20%, #1e293b 0%, #0f172a 100%)',padding:24,fontFamily:'Inter, system-ui, sans-serif'}}>
        <div style={{width:'100%',maxWidth:520,background:'#fff',borderRadius:16,padding:36,boxShadow:'0 25px 50px -12px rgba(0,0,0,.4)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:24}}><div style={{width:38,height:38,borderRadius:9,background:'linear-gradient(135deg,#1e3a8a,#2563eb)',color:'#fff',display:'grid',placeItems:'center',fontWeight:900}}>O</div><div><strong style={{display:'block',color:'#0f172a'}}>OJIX Property Intelligence</strong><span style={{fontSize:11,color:'#64748b'}}>SECURE MEMBER ONBOARDING</span></div></div>
          <div style={{display:'flex',gap:8,marginBottom:24}}>{['Account','Verify OTP','Sign in'].map((label,index)=>{const active=isVerified?2:isOtp?1:0;return <div key={label} style={{flex:1,fontSize:11,fontWeight:700,color:index<=active?'#1d4ed8':'#94a3b8'}}><div style={{height:3,borderRadius:3,background:index<=active?'#2563eb':'#e2e8f0',marginBottom:7}}/>{index+1}. {label}</div>})}</div>
          <h2 style={{margin:'0 0 6px',fontSize:22,color:'#0f172a'}}>{isVerified?'Account verified':isOtp?'Verify your email':'Create your account'}</h2>
          <p style={{margin:'0 0 22px',fontSize:13,color:'#64748b',lineHeight:1.5}}>{isVerified?'Registration is complete. Continue to the sign-in page using your new password.':isOtp?`Enter the six-digit code sent for ${registerEmail}. The code expires in 10 minutes.`:'First-time users must register and verify their email before signing in.'}</p>
          {error&&<div style={{background:'#fef2f2',border:'1px solid #fecaca',color:'#991b1b',padding:'10px 12px',borderRadius:8,fontSize:12,marginBottom:16}}>{error}</div>}
          {developmentOtp&&isOtp&&<div style={{background:'#eff6ff',border:'1px solid #bfdbfe',color:'#1e40af',padding:'12px',borderRadius:8,fontSize:12,marginBottom:16}}><strong>Development OTP:</strong> <code style={{fontSize:16,letterSpacing:3}}>{developmentOtp}</code><br/><span style={{fontSize:10}}>In production this code will be delivered by email or SMS and will not appear here.</span></div>}
          {isVerified ? <button onClick={()=>{setMode('login');setError('');}} style={{width:'100%',padding:12,border:0,borderRadius:8,background:'#2563eb',color:'#fff',fontWeight:700,cursor:'pointer'}}>Continue to Sign In <ArrowRight size={16} style={{verticalAlign:'middle',marginLeft:6}}/></button> : isOtp ? (
            <form onSubmit={verifyOtp} style={{display:'grid',gap:15}}><label style={{fontSize:11,fontWeight:700,color:'#334155'}}>SIX-DIGIT OTP<input autoFocus inputMode="numeric" maxLength={6} value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,''))} required pattern="\d{6}" style={{display:'block',width:'100%',boxSizing:'border-box',marginTop:7,padding:13,border:'1px solid #cbd5e1',borderRadius:8,fontSize:20,letterSpacing:8,textAlign:'center'}}/></label><button disabled={loading||otp.length!==6} style={{padding:12,border:0,borderRadius:8,background:'#2563eb',color:'#fff',fontWeight:700,cursor:'pointer'}}>{loading?'Verifying…':'Verify and Activate Account'}</button><button type="button" onClick={()=>{setMode('register');setOtp('');setError('');}} style={{border:0,background:'transparent',color:'#2563eb',cursor:'pointer'}}>Change registration details</button></form>
          ) : (
            <form onSubmit={requestOtp} style={{display:'grid',gap:14}}>
              <label style={{fontSize:11,fontWeight:700,color:'#334155'}}>FULL NAME<input value={registerName} onChange={e=>setRegisterName(e.target.value)} required minLength={2} style={{display:'block',width:'100%',boxSizing:'border-box',marginTop:6,padding:11,border:'1px solid #cbd5e1',borderRadius:8}}/></label>
              <label style={{fontSize:11,fontWeight:700,color:'#334155'}}>WORK EMAIL<input type="email" value={registerEmail} onChange={e=>setRegisterEmail(e.target.value)} required style={{display:'block',width:'100%',boxSizing:'border-box',marginTop:6,padding:11,border:'1px solid #cbd5e1',borderRadius:8}}/></label>
              <label style={{fontSize:11,fontWeight:700,color:'#334155'}}>CREATE PASSWORD<input type="password" value={registerPassword} onChange={e=>setRegisterPassword(e.target.value)} required minLength={8} style={{display:'block',width:'100%',boxSizing:'border-box',marginTop:6,padding:11,border:'1px solid #cbd5e1',borderRadius:8}}/><small style={{display:'block',marginTop:5,color:'#64748b',fontWeight:400}}>Minimum 8 characters with uppercase, lowercase and a number.</small></label>
              <label style={{fontSize:11,fontWeight:700,color:'#334155'}}>CONFIRM PASSWORD<input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required style={{display:'block',width:'100%',boxSizing:'border-box',marginTop:6,padding:11,border:'1px solid #cbd5e1',borderRadius:8}}/></label>
              <button disabled={loading} style={{padding:12,border:0,borderRadius:8,background:'#2563eb',color:'#fff',fontWeight:700,cursor:'pointer'}}>{loading?'Creating OTP…':'Register and Send OTP'}</button>
              <button type="button" onClick={()=>{setMode('login');setError('');}} style={{border:0,background:'transparent',color:'#2563eb',cursor:'pointer'}}>Already registered? Sign in</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const isOwner = currentAccount?.role === 'owner';
  const ownerAccount = dummyAccounts.find(account => account.role === 'owner');

  if (mode === 'login') return (
    <main className="executive-login-shell">
      <section className="executive-login-brand" aria-label="OJIX Property Intelligence">
        <div className="executive-brand-mark"><span>O</span><i/></div>
        <div className="executive-brand-name"><strong>OJIX</strong><span>PROPERTY INTELLIGENCE</span></div>
        <div className="executive-brand-copy">
          <div className="executive-kicker"><ShieldCheck size={14}/> EVIDENCE-FIRST LEGAL WORKSPACE</div>
          <h1>Command every property matter with clarity.</h1>
          <p>A controlled workspace for Karnataka property due diligence, document evidence, review assignments and auditable legal decisions.</p>
        </div>
        <div className="executive-feature-grid">
          <article><BriefcaseBusiness/><div><strong>Portfolio command</strong><span>Applications, deadlines and team ownership</span></div></article>
          <article><Scale/><div><strong>Legal review controls</strong><span>Evidence-linked findings and approvals</span></div></article>
          <article><BadgeCheck/><div><strong>Release safeguards</strong><span>Verification required before completion</span></div></article>
          <article><Activity/><div><strong>Complete audit trail</strong><span>Accountable workflow and change history</span></div></article>
        </div>
        <div className="executive-trust-note"><Lock size={15}/><span><strong>Private organisation workspace</strong>Access is role-controlled and every privileged action is recorded.</span></div>
      </section>

      <section className="executive-login-access">
        <div className="executive-access-card">
          <div className="executive-access-topline"><span className="executive-secure-pill"><ShieldCheck size={13}/> Secure access</span><span className={`executive-service ${serviceStatus}`}><i/>{serviceStatus==='checking'?'Checking services':serviceStatus==='ready'?'Systems available':'Service unavailable'}</span></div>
          <div className="executive-user-heading">
            <div className="executive-avatar">{currentAccount?.avatar||'RS'}</div>
            <div><span>{isOwner?'MANAGING PARTNER ACCESS':'WORKSPACE ACCESS'}</span><h2>{isOwner?'Welcome back, Rajesh':`Welcome, ${currentAccount?.name}`}</h2><p>{isOwner?'Sign in to the Owner command centre.':currentAccount?.designation}</p></div>
          </div>

          {serviceStatus==='unavailable'&&<div className="executive-alert service"><ShieldAlert size={16}/><span>{serviceMessage}</span></div>}
          {error&&<div className="executive-alert error" role="alert"><AlertCircle size={16}/><span>{error}</span></div>}

          <form className="executive-login-form" onSubmit={handleLogin}>
            <label><span>Work email</span><div className="executive-input"><UserCheck/><input type="email" autoComplete="username" value={email} onChange={event=>setEmail(event.target.value)} required placeholder="name@organisation.com"/></div></label>
            <label><span>Password</span><div className="executive-input"><Lock/><input type={showPassword?'text':'password'} autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} required/><button type="button" aria-label={showPassword?'Hide password':'Show password'} onClick={()=>setShowPassword(value=>!value)}>{showPassword?<EyeOff/>:<Eye/>}</button></div></label>
            <div className="executive-form-meta"><label><input type="checkbox"/> Keep me signed in</label><button type="button" onClick={()=>setError('Password recovery is not enabled in this local development workspace.')}>Forgot password?</button></div>
            <button className="executive-submit" type="submit" disabled={loading||serviceStatus==='checking'}>{loading?<><span className="executive-spinner"/> Sending secure code…</>:<>Continue with email OTP <ArrowRight/></>}</button>
          </form>

          <div className="executive-local-access">
            <div><strong>Local development access</strong><span>Use the configured demonstration identities to test role permissions.</span></div>
            <select aria-label="Select demonstration account" value={selectedUid} onChange={event=>{const account=dummyAccounts.find(item=>item.uid===event.target.value);if(account)selectAccount(account);}}>
              {dummyAccounts.map(account=><option value={account.uid} key={account.uid}>{account.name} — {account.designation}</option>)}
            </select>
            {ownerAccount&&selectedUid!=='user-owner'&&<button type="button" onClick={()=>selectAccount(ownerAccount)}>Return to Owner login</button>}
            <small>Local password: <code>ojix123</code></small>
          </div>

          <button className="executive-register-link" type="button" onClick={()=>{setMode('register');setError('');}}>New authorised member? Register and verify access <ArrowRight size={13}/></button>
          <p className="executive-legal">By continuing, you acknowledge that OJIX supports professional review and does not independently certify title, ownership or government records.</p>
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
            <button type="button" onClick={()=>{setMode('register');setError('');}} style={{marginTop:10,border:0,background:'transparent',padding:0,color:'#2563eb',fontSize:12,fontWeight:700,cursor:'pointer'}}>First time here? Register and verify OTP</button>
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
