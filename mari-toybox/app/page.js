'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Sparkles, Gift, BookOpen, Coins, Star, LockKeyhole, Crown, Settings,
  UserRound, LogOut, ArrowLeftRight, X, Check, Shield, Plus, Trash2,
  RefreshCw, WandSparkles, Snowflake, Heart, KeyRound, PackageOpen,
} from 'lucide-react';

const GACHA_LABELS = [
  ['christmas-gift', '크리스마스 선물', '선물 상자와 반짝이는 장식'],
  ['toy-kingdom', '장난감 왕국', '호두까기 병정과 장난감 친구들'],
  ['sugar-shop', '설탕 요정의 과자점', '달콤한 사탕과 과자'],
  ['mouse-kingdom', '생쥐 왕국', '작은 왕국의 귀여운 보물'],
  ['winter-warmth', '마리의 방', '포근한 겨울 소품'],
  ['profile-frame', '프로필 테두리', '특별한 액자'],
];

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '요청을 처리하지 못했습니다.');
  return data;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}
function unlockAt(startDate, dayOffset) {
  return new Date(`${startDate}T00:00:00+09:00`).getTime() + dayOffset * 86400000;
}
function dateText(timestamp) {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' }).format(new Date(timestamp));
}
function ItemImage({ src, name, size = 'normal' }) {
  if (src) return <img className={`item-image ${size}`} src={src} alt={name || '수집 아이템'} />;
  return <div className={`item-placeholder ${size}`}><Gift size={size === 'large' ? 34 : 24} /></div>;
}

export default function Home() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ nickname: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);
  const [siteState, setSiteState] = useState(null);
  const [modal, setModal] = useState('');
  const [activeGacha, setActiveGacha] = useState(null);
  const [drawResult, setDrawResult] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const [collection, setCollection] = useState(null);
  const [topupValue, setTopupValue] = useState('100');
  const [convertValue, setConvertValue] = useState('100');
  const [nicknameValue, setNicknameValue] = useState('');
  const [notice, setNotice] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminItems, setAdminItems] = useState([]);
  const [topups, setTopups] = useState([]);
  const [adminDraft, setAdminDraft] = useState({ gacha_key: 'christmas-gift', name: '', description: '', image_url: '', probability: '0', rarity: '일반', sort_order: '0' });
  const [savingItem, setSavingItem] = useState(false);

  const refreshState = useCallback(async () => {
    const data = await api('/api/state');
    setSiteState(data);
    setUser(data.user);
    return data;
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await api('/api/me');
        if (active && data.user) {
          setUser(data.user);
          const state = await api('/api/state');
          if (active) { setSiteState(state); setUser(state.user); }
        }
      } catch { /* The login screen is the intended initial view. */ }
      finally { if (active) setBooting(false); }
    })();
    return () => { active = false; };
  }, []);

  async function submitAuth(event) {
    event.preventDefault(); setBusy(true); setAuthError('');
    try {
      const route = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const data = await api(route, { method: 'POST', body: JSON.stringify(authForm) });
      setUser(data.user);
      await refreshState();
    } catch (error) { setAuthError(error.message); }
    finally { setBusy(false); }
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    setUser(null); setSiteState(null); setModal(''); setAuthForm({ nickname: '', password: '' });
  }

  async function showCollection() {
    try { const data = await api('/api/collection'); setCollection(data); setModal('collection'); }
    catch (error) { setNotice(error.message); }
  }
  
  async function downloadItemPng(item) {
  if (!item.image_url) {
    setNotice('다운로드할 이미지가 없어요.');
    return;
  }

  try {
    const response = await fetch(item.image_url);
    if (!response.ok) throw new Error();

    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    bitmap.close();

    const pngBlob = await new Promise(resolve =>
      canvas.toBlob(resolve, 'image/png')
    );

    if (!pngBlob) throw new Error();

    const url = URL.createObjectURL(pngBlob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${item.name || 'toy'}.png`;
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    setNotice('이미지를 PNG로 변환하지 못했어요. 이미지 주소의 접근 권한을 확인해 주세요.');
  }
}

  async function openGacha(gacha) {
    if (!siteState) return;
    const unlocked =
      gacha.key === 'profile-frame' ||
      Date.now() >= unlockAt(siteState, gacha.day);
    if (!unlocked) return;
    setActiveGacha(gacha); setDrawResult(null); setModal('draw');
  }

  async function runDraw(count) {
    if (!activeGacha || drawing) return;
    setDrawing(true);
    try {
      const result = await api('/api/draw', { method: 'POST', body: JSON.stringify({ gachaKey: activeGacha.key, count }) });
      setDrawResult(result);
      await refreshState();
    } catch (error) { setNotice(error.message); }
    finally { setDrawing(false); }
  }

  async function sendTopup(event) {
    event.preventDefault(); setBusy(true);
    try {
      const result = await api('/api/topup', { method: 'POST', body: JSON.stringify({ points: Number(topupValue) }) });
      setNotice(result.message); setModal('');
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  async function convertPoints(event) {
    event.preventDefault(); setBusy(true);
    try {
      await api('/api/convert', { method: 'POST', body: JSON.stringify({ points: Number(convertValue) }) });
      await refreshState(); setNotice(`${formatNumber(Number(convertValue) / 10)}토큰으로 교환했어요.`); setModal('');
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  async function changeNickname(event) {
    event.preventDefault(); setBusy(true);
    try {
      const data = await api('/api/nickname', { method: 'PATCH', body: JSON.stringify({ nickname: nicknameValue }) });
      setUser(data.user); await refreshState(); setModal(''); setNotice('새로운 이름으로 바뀌었어요. 도감과 토큰은 그대로예요.');
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  async function openAdmin() {
    setAdminError(''); setAdminPassword(''); setModal('admin-login');
  }
  async function submitAdminLogin(event) {
    event.preventDefault(); setBusy(true); setAdminError('');
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: adminPassword }) });
      await loadAdminData(); setModal('admin');
    } catch (error) { setAdminError(error.message); }
    finally { setBusy(false); }
  }
  async function loadAdminData() {
    const [itemsData, topupData] = await Promise.all([api('/api/admin/items'), api('/api/admin/topups')]);
    setAdminItems(itemsData.items); setTopups(topupData.requests);
  }
  async function adminLogout() {
    await api('/api/admin/logout', { method: 'POST' }); setModal('');
  }
  async function saveAdminItem(item) {
    setSavingItem(true);
    try {
      const data = await api('/api/admin/items', { method: 'PATCH', body: JSON.stringify(item) });
      setAdminItems(rows => rows.map(row => row.id === item.id ? data.item : row));
      setNotice('상품 설정을 저장했어요.');
    } catch (error) { setNotice(error.message); }
    finally { setSavingItem(false); }
  }
  async function addAdminItem(event) {
    event.preventDefault(); setSavingItem(true);
    try {
      const body = { ...adminDraft, probability: Number(adminDraft.probability), sort_order: Number(adminDraft.sort_order) };
      const data = await api('/api/admin/items', { method: 'POST', body: JSON.stringify(body) });
      setAdminItems(rows => [...rows, data.item]);
      setAdminDraft(d => ({ ...d, name: '', description: '', image_url: '', probability: '0' }));
      setNotice('새 상품을 등록했어요.');
    } catch (error) { setNotice(error.message); }
    finally { setSavingItem(false); }
  }
  async function deleteAdminItem(id) {
    if (!window.confirm('이 상품을 삭제할까요? 이미 수집한 회원의 도감에서도 제거됩니다.')) return;
    try { await api('/api/admin/items', { method: 'DELETE', body: JSON.stringify({ id }) }); setAdminItems(rows => rows.filter(row => row.id !== id)); }
    catch (error) { setNotice(error.message); }
  }
  async function reviewTopup(id, status) {
    try { await api('/api/admin/topups', { method: 'PATCH', body: JSON.stringify({ id, status }) }); await loadAdminData(); setNotice('충전 신청을 처리했어요.'); }
    catch (error) { setNotice(error.message); }
  }
  const updateAdminLocal = (id, patch) => setAdminItems(rows => rows.map(row => row.id === id ? { ...row, ...patch } : row));

  const probabilityTotals = useMemo(() => Object.fromEntries(GACHA_LABELS.map(([key]) => [key, adminItems.filter(item => item.gacha_key === key && item.is_active).reduce((sum, item) => sum + Number(item.probability || 0), 0)])), [adminItems]);

  if (booting) return <div className="loading-screen"><div className="loading-seal"><Sparkles size={28} /></div><p>마리의 방으로 들어가는 중...</p></div>;

  if (!user) return (
    <main className="auth-screen">
      <div className="auth-art-wrap"><img className="auth-room-art" src="/assets/mari-room.png" alt="마리의 크리스마스 장난감 방" /></div>
      <section className="auth-card">
        <div className="crest-mark"><Crown size={23} /></div>
        <p className="eyebrow">THE NUTCRACKER CHRISTMAS ROOM</p>
        <h1>마리의<br /><em>장난감 상자</em></h1>
        <p className="auth-subtitle">마리의 방에 오신 걸 환영해요.<br />오늘은 어떤 장난감이 기다리고 있을까요?</p>
        <div className="auth-tabs">
          <button className={authMode === 'login' ? 'selected' : ''} onClick={() => { setAuthMode('login'); setAuthError(''); }}>로그인</button>
          <button className={authMode === 'register' ? 'selected' : ''} onClick={() => { setAuthMode('register'); setAuthError(''); }}>회원가입</button>
        </div>
        <form className="auth-form" onSubmit={submitAuth}>
          <label>아이디(닉네임)<input value={authForm.nickname} maxLength={20} onChange={e => setAuthForm(v => ({ ...v, nickname: e.target.value }))} placeholder="마리" required /></label>
          <label>비밀번호<input type="password" minLength={authMode === 'register' ? 4 : 1} value={authForm.password} onChange={e => setAuthForm(v => ({ ...v, password: e.target.value }))} placeholder="비밀번호를 입력해 주세요" required /></label>
          {authMode === 'register' && <p className="field-hint">아이디는 1~20자, 비밀번호는 4자 이상 사용할 수 있어요.</p>}
          {authError && <p className="error-text">{authError}</p>}
          <button className="primary-button full-button" disabled={busy}>{busy ? '잠시만요...' : authMode === 'login' ? '마리의 방 입장하기' : '새 장난감 상자 만들기'} <span>✦</span></button>
        </form>
        <p className="auth-footnote">A LITTLE CHRISTMAS MAGIC AWAITS YOU</p>
      </section>
      <div className="auth-snow snow-a">✧</div><div className="auth-snow snow-b">✦</div>
    </main>
  );

  const gachas = siteState?.gachas || [];
  const startDate = siteState?.eventStartDate || '2026-12-01';

  return (
    <main className="site-shell">
      <header className="topbar">
        <div className="account-tools">
          <span className="mini-balance"><Star size={14} fill="currentColor" /> {formatNumber(user.points)}P</span>
          <span className="mini-balance token"><Coins size={14} /> {formatNumber(user.tokens)}T</span>
          <button className="icon-button" title="닉네임 변경" onClick={() => { setNicknameValue(user.nickname); setModal('nickname'); }}><UserRound size={17} /></button>
          <button className="icon-button" title="관리자" onClick={openAdmin}><Settings size={17} /></button>
          <button className="icon-button logout-button" title="로그아웃" onClick={logout}><LogOut size={17} /></button>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">THE HOLIDAY TOY ROOM</p>
          <h1>마리의<br /><span>장난감 상자</span></h1>
          <p>장난감을 모아<br />도감을 완성하세요.</p>
          <div className="hero-greeting"><span className="greeting-seal">M</span><span><b>{user.nickname}님, 메리 크리스마스!</b><small>행운의 장난감이 기다리고 있어요.</small></span></div>
        </div>
        <button className="hero-illustration" type="button" onClick={showCollection} aria-label="장난감 상자 도감 열기"><img src="/assets/mari-room.png" alt="마리의 방과 크리스마스 장난감 상자 — 누르면 도감이 열립니다" /></button>
        <div className="hero-ornament ornament-one">✦</div><div className="hero-ornament ornament-two">✧</div>
      </section>

      <section className="welcome-strip">
        <div><span className="strip-star">✦</span><span><b>마리의 크리스마스 수집 대작전</b><small>가챠를 돌려 여섯 개의 장난감 세계를 완성해 보세요.</small></span></div>
        <div className="currency-group">
          <div className="currency-card"><span className="currency-icon points"><Star size={16} fill="currentColor" /></span><small>보유 포인트</small><b>{formatNumber(user.points)} P</b></div>
          <div className="currency-card"><span className="currency-icon tokens"><Coins size={16} /></span><small>보유 토큰</small><b>{formatNumber(user.tokens)} T</b></div>
          <button className="text-action" onClick={() => setModal('topup')}>충전 / 교환 <ArrowLeftRight size={14} /></button>
        </div>
      </section>

      <section className="section-heading" id="gachas">
        <div><p className="eyebrow">SIX LITTLE WORLDS</p><h2>오늘은 어떤 장난감을 만날까요?</h2><p>가챠는 이틀에 한 종류씩 열려요. 해금된 머신을 눌러 보세요.</p></div>
        <div className="unlock-note"><LockKeyhole size={15} /> 첫 해금일 <b>{dateText(unlockAt(startDate, 0))}</b></div>
      </section>

      <section className="gacha-grid">
          {gachas
           .filter(gacha =>
            gacha.key === 'profile-frame' ||
            Date.now() >= unlockAt(startDate, gacha.day)
                  )
            .map((gacha, index) => {
          const unlocked = Date.now() >= unlockAt(startDate, gacha.day);
          const count = siteState?.counts?.[gacha.key] || 0;
          return (
            <button key={gacha.key} className={`gacha-card theme-${gacha.color} ${unlocked ? 'is-unlocked' : 'is-locked'}`} onClick={() => openGacha(gacha)} disabled={!unlocked}>
              <div className="machine-number">TOY GACHA · 0{index + 1}</div>
              <div className="machine-art-wrap"><img src={gacha.asset} alt={`${gacha.name} 캡슐 머신`} /></div>
              <div className="machine-info"><span className="machine-title">{gacha.name}</span><small>{gacha.subtitle || GACHA_LABELS[index]?.[2]}</small></div>
              {unlocked ? <span className="machine-status open"><Sparkles size={12} /> OPEN · 상품 {count}종</span> : <span className="machine-status locked"><LockKeyhole size={12} /> {dateText(unlockAt(startDate, gacha.day))} 해금</span>}
            </button>
          );
        })}
      </section>

      <footer className="site-footer"><span>✦ MARI’S TOY BOX ✦</span><p>THE NUTCRACKER CHRISTMAS COLLECTION</p><small>ⓒ胡桃劇場</small></footer>

      {modal && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModal(''); }}>
        {modal === 'draw' && activeGacha && <section className="modal-card draw-modal" role="dialog" aria-modal="true">
          <button className="modal-close" onClick={() => setModal('')}><X size={18} /></button>
          <div className="modal-ribbon">MARI’S GACHA</div>
          <p className="eyebrow">A LITTLE SURPRISE</p><h2>{activeGacha.name}</h2><p className="modal-intro">반짝이는 캡슐 속에서 어떤 친구가 나올까요?</p>
          {!drawResult ? <>
            <div className="draw-machine"><img src={activeGacha.asset} alt={`${activeGacha.name} 머신`} /></div>
            <div className="draw-balance"><span><Coins size={15} /> 보유 토큰 <b>{formatNumber(user.tokens)}T</b></span><small>1회 뽑기 1T · 10회 뽑기 10T</small></div>
            <div className="draw-buttons"><button className="primary-button" disabled={drawing || user.tokens < 1} onClick={() => runDraw(1)}>{drawing ? '뽑는 중...' : '1회 뽑기 · 1T'}</button><button className="gold-button" disabled={drawing || user.tokens < 10} onClick={() => runDraw(10)}>{drawing ? '뽑는 중...' : '10회 뽑기 · 10T'}</button></div>
            {user.tokens < 10 && <p className="field-hint">토큰이 부족하다면 포인트 상점에서 충전 신청 또는 교환을 해 주세요.</p>}
          </> : <>
            <div className="result-heading"><span>✦</span><b>{drawResult.items.length}개의 장난감을 만났어요!</b><span>✦</span></div>
            <div className={`result-grid ${drawResult.items.length === 1 ? 'single' : ''}`}>{drawResult.items.map((item, index) => <div className="result-item" key={`${item.id}-${index}`}><ItemImage src={item.image_url} name={item.name} /><b>{item.name}</b><small>{item.rarity}</small></div>)}</div>
            <p className="result-balance">남은 토큰 <b>{formatNumber(drawResult.tokens)}T</b></p>
            <button className="primary-button full-button" onClick={() => { setDrawResult(null); setModal(''); }}>상자에 담기</button>
          </>}
        </section>}

        {modal === 'collection' && <section className="modal-card collection-modal" role="dialog" aria-modal="true">
          <button className="modal-close" onClick={() => setModal('')}><X size={18} /></button><div className="modal-ribbon">MY TOY COLLECTION</div><p className="eyebrow">THE LITTLE TREASURE BOOK</p><h2>마리의 장난감 도감</h2>
          <p className="modal-intro">아직 만나지 못한 장난감은 물음표로 남아 있어요.</p>
          {collection ? <><div className="collection-progress"><div className="progress-track"><span style={{ width: `${collection.total ? collection.collected / collection.total * 100 : 0}%` }} /></div><b>{collection.collected} / {collection.total}</b></div>
{GACHA_LABELS.map(([key, name]) => {
  const items = collection.items.filter(
    item => item.gacha_key === key
  );

  if (!items.length) return null;

  return (
    <div className="collection-group" key={key}>
      <h3>
        {name}
        <small>
          {items.filter(item => item.collection).length}/{items.length}
        </small>
      </h3>

      <div className="collection-grid">
        {items.map(item => (
          <div
            className={`collection-item ${item.collection ? 'owned' : 'unknown'}`}
            key={item.id}
          >
            {item.collection ? (
              <>
                <ItemImage src={item.image_url} name={item.name} />
                <b>{item.name}</b>

                {item.collection.quantity > 1 && (
                  <small>×{item.collection.quantity}</small>
                )}

                {item.image_url && (
                  <button
                    type="button"
                    className="download-png-button"
                    onClick={() => downloadItemPng(item)}
                  >
                    PNG 다운로드
                  </button>
                )}
              </>
            ) : (
              <>
                <span className="question-mark">?</span>
                <b>미수집</b>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
})}
            {!collection.total && <div className="empty-state"><PackageOpen size={34} /><b>아직 등록된 장난감이 없어요.</b><small>관리자가 상품을 등록하면 이곳에 도감이 만들어져요.</small></div>}
          </> : <div className="empty-state">도감을 불러오는 중...</div>}
        </section>}

        {modal === 'topup' && <section className="modal-card compact-modal" role="dialog" aria-modal="true">
          <button className="modal-close" onClick={() => setModal('')}><X size={18} /></button><div className="modal-ribbon">POINT SALON</div><p className="eyebrow">A LITTLE MAGIC FOR YOUR TOYS</p><h2>포인트 상점</h2><p className="modal-intro">충전 신청이 승인되면 포인트가 반영돼요.</p>
          <form className="shop-form" onSubmit={sendTopup}><label>충전 신청 포인트<input type="number" min="10" max="10000000" step="10" value={topupValue} onChange={e => setTopupValue(e.target.value)} required /></label><div className="shop-note"><Star size={15} /> 신청 후 관리자 승인 시 <b>{formatNumber(topupValue || 0)}P</b> 지급</div><button className="primary-button full-button" disabled={busy}>충전 신청하기</button></form>
          <div className="modal-divider"><span>POINT → TOKEN</span></div>
          <form className="shop-form" onSubmit={convertPoints}><label>교환할 포인트<input type="number" min="10" step="10" value={convertValue} onChange={e => setConvertValue(e.target.value)} required /></label><div className="shop-note"><ArrowLeftRight size={15} /> {formatNumber(convertValue || 0)}P → <b>{formatNumber(Math.floor(Number(convertValue || 0) / 10))}T</b></div><button className="gold-button full-button" disabled={busy || Number(convertValue) % 10 !== 0 || Number(convertValue) <= 0}>토큰으로 교환하기</button><p className="field-hint">10포인트당 1토큰으로 교환할 수 있어요. 교환한 토큰은 되돌릴 수 없어요.</p></form>
        </section>}

        {modal === 'nickname' && <section className="modal-card compact-modal" role="dialog" aria-modal="true"><button className="modal-close" onClick={() => setModal('')}><X size={18} /></button><div className="modal-ribbon">A NEW NAME</div><p className="eyebrow">YOUR LITTLE IDENTITY</p><h2>닉네임 변경</h2><form className="shop-form" onSubmit={changeNickname}><label>현재 닉네임<input value={user.nickname} readOnly /></label><label>변경할 닉네임<input value={nicknameValue} maxLength={20} onChange={e => setNicknameValue(e.target.value)} placeholder="새로운 닉네임" required /></label><p className="field-hint">변경한 아이디는 기존 사이트에도 적용되며, 도감과 포인트·토큰은 그대로 유지돼요.</p><button className="primary-button full-button" disabled={busy}>변경하기</button></form></section>}

        {modal === 'admin-login' && <section className="modal-card compact-modal"><button className="modal-close" onClick={() => setModal('')}><X size={18} /></button><div className="admin-seal"><Shield size={26} /></div><p className="eyebrow">PRIVATE ROOM</p><h2>관리자 입장</h2><p className="modal-intro">관리자 암호를 입력해 주세요.</p><form className="shop-form" onSubmit={submitAdminLogin}><label>관리자 암호<input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} required /></label>{adminError && <p className="error-text">{adminError}</p>}<button className="primary-button full-button" disabled={busy}>확인하고 입장하기</button></form></section>}

        {modal === 'admin' && <section className="modal-card admin-modal"><button className="modal-close" onClick={() => setModal('')}><X size={18} /></button><div className="admin-header"><div><p className="eyebrow">THE OWNER’S DESK</p><h2><Settings size={22} /> 관리자 페이지</h2></div><button className="outline-button small" onClick={adminLogout}>관리자 로그아웃</button></div>
          <div className="admin-section"><div className="admin-section-title"><div><h3>가챠 상품 관리</h3><p>상품을 등록하고 이미지 URL과 등장 확률을 설정하세요.</p></div></div>
            <form className="new-item-form" onSubmit={addAdminItem}><div className="admin-form-grid"><label>가챠 종류<select value={adminDraft.gacha_key} onChange={e => setAdminDraft(d => ({ ...d, gacha_key: e.target.value }))}>{GACHA_LABELS.map(([key,name]) => <option key={key} value={key}>{name}</option>)}</select></label><label>상품명<input value={adminDraft.name} onChange={e => setAdminDraft(d => ({ ...d, name: e.target.value }))} placeholder="예: 빨간 리본 곰인형" required /></label><label>확률 (%)<input type="number" min="0" max="100" step="0.001" value={adminDraft.probability} onChange={e => setAdminDraft(d => ({ ...d, probability: e.target.value }))} required /></label><label>등급<input value={adminDraft.rarity} onChange={e => setAdminDraft(d => ({ ...d, rarity: e.target.value }))} placeholder="일반 / 레어 / 스페셜" /></label><label className="wide-field">이미지 URL<input value={adminDraft.image_url} onChange={e => setAdminDraft(d => ({ ...d, image_url: e.target.value }))} placeholder="https://... (투명 PNG 권장)" /></label><label className="wide-field">설명<input value={adminDraft.description} onChange={e => setAdminDraft(d => ({ ...d, description: e.target.value }))} placeholder="상품 설명 (선택)" /></label></div><button className="primary-button add-item-button" disabled={savingItem}><Plus size={16} /> 상품 추가</button></form>
            <div className="probability-summary">{GACHA_LABELS.map(([key,name]) => <div key={key} className="probability-line"><span>{name}</span><b className={Math.abs((probabilityTotals[key] || 0) - 100) < 0.01 ? 'sum-good' : 'sum-warn'}>{Number(probabilityTotals[key] || 0).toFixed(3)}%</b><small>{Math.abs((probabilityTotals[key] || 0) - 100) < 0.01 ? '설정 완료' : '합계 100% 필요'}</small></div>)}</div>
            <div className="admin-item-list">{adminItems.map(item => <div className="admin-item-row" key={item.id}><div className="admin-item-thumb">{item.image_url ? <img src={item.image_url} alt="" /> : <Gift size={20} />}</div><div className="admin-item-fields"><input aria-label="상품명" value={item.name} onChange={e => updateAdminLocal(item.id, { name: e.target.value })} /><div className="admin-item-inline"><input aria-label="이미지 URL" value={item.image_url || ''} onChange={e => updateAdminLocal(item.id, { image_url: e.target.value })} placeholder="이미지 URL" /><input aria-label="확률" type="number" min="0" max="100" step="0.001" value={item.probability} onChange={e => updateAdminLocal(item.id, { probability: e.target.value })} /></div><small>{GACHA_LABELS.find(g => g[0] === item.gacha_key)?.[1]} · {item.rarity}</small></div><div className="admin-item-actions"><button title="저장" onClick={() => saveAdminItem({ ...item, probability: Number(item.probability) })} disabled={savingItem}><Check size={16} /></button><button title="삭제" onClick={() => deleteAdminItem(item.id)}><Trash2 size={16} /></button></div></div>)}</div>
            {!adminItems.length && <div className="empty-state small-empty">등록된 상품이 없습니다.</div>}
          </div>
          <div className="admin-section"><div className="admin-section-title"><div><h3>포인트 충전 승인</h3><p>승인하면 신청한 회원의 포인트가 추가됩니다.</p></div><span className="pending-count">대기 {topups.filter(t => t.status === 'pending').length}건</span></div>
            <div className="topup-admin-list">{topups.map(row => <div className="topup-admin-row" key={row.id}><div><b>{row.nickname}</b><small>{new Date(row.created_at).toLocaleString('ko-KR')}</small></div><strong>{formatNumber(row.amount_points)}P</strong>{row.status === 'pending' ? <div className="review-actions"><button className="approve-button" onClick={() => reviewTopup(row.id, 'approved')}>승인</button><button className="reject-button" onClick={() => reviewTopup(row.id, 'rejected')}>거절</button></div> : <span className={`status-label ${row.status}`}>{row.status === 'approved' ? '승인 완료' : '거절됨'}</span>}</div>)}{!topups.length && <div className="empty-state small-empty">충전 신청이 없습니다.</div>}</div>
          </div>
        </section>}
      </div>}

      {notice && <div className="toast-note" role="status"><span>{notice}</span><button onClick={() => setNotice('')}><X size={15} /></button></div>}
    </main>
  );
}
