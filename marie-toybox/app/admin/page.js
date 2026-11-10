'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Settings, Shield, Gift, Plus, Check, Trash2, X, ArrowLeft, LogOut } from 'lucide-react';

const GACHA_LABELS = [
  ['christmas-gift', '크리스마스 선물'],
  ['toy-kingdom', '장난감 왕국'],
  ['sugar-shop', '설탕 요정의 과자점'],
  ['mouse-kingdom', '생쥐 왕국'],
  ['winter-warmth', '마리의 방'],
  ['profile-frame', '프로필 테두리'],
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

async function uploadAdminImage(file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch('/api/admin/upload-image', { method: 'POST', body: formData });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '이미지 업로드에 실패했어요.');
  return data.url;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [topups, setTopups] = useState([]);
  const [draft, setDraft] = useState({ gacha_key: 'christmas-gift', name: '', description: '', image_url: '', probability: '0', rarity: '일반', sort_order: '0' });
  const [busy, setBusy] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState('');

  const loadAdminData = useCallback(async () => {
    const [itemsData, topupData] = await Promise.all([api('/api/admin/items'), api('/api/admin/topups')]);
    setItems(itemsData.items || []);
    setTopups(topupData.requests || []);
    setAuthorized(true);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([api('/api/admin/items'), api('/api/admin/topups')])
      .then(([itemsData, topupData]) => {
        if (!active) return;
        setItems(itemsData.items || []);
        setTopups(topupData.requests || []);
        setAuthorized(true);
      })
      .catch(() => { if (active) setAuthorized(false); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  async function submitLogin(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
      await loadAdminData();
      setPassword('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try { await api('/api/admin/logout', { method: 'POST' }); }
    finally {
      setAuthorized(false);
      setItems([]);
      setTopups([]);
      window.location.href = '/';
    }
  }

  async function saveItem(item) {
    setSavingItem(true);
    try {
      const data = await api('/api/admin/items', { method: 'PATCH', body: JSON.stringify({ ...item, probability: Number(item.probability) }) });
      setItems(rows => rows.map(row => row.id === item.id ? data.item : row));
      setNotice('상품 설정을 저장했어요.');
    } catch (e) { setNotice(e.message); }
    finally { setSavingItem(false); }
  }

  async function uploadNewImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSavingItem(true);
    try {
      const image_url = await uploadAdminImage(file);
      setDraft(d => ({ ...d, image_url }));
      setNotice('상품 이미지가 업로드됐어요.');
    } catch (e) { setNotice(e.message); }
    finally { setSavingItem(false); event.target.value = ''; }
  }

  async function uploadExistingImage(id, event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSavingItem(true);
    try {
      const image_url = await uploadAdminImage(file);
      setItems(rows => rows.map(row => row.id === id ? { ...row, image_url } : row));
      setNotice('이미지를 교체했어요. 저장 버튼을 눌러 적용해 주세요.');
    } catch (e) { setNotice(e.message); }
    finally { setSavingItem(false); event.target.value = ''; }
  }

  async function addItem(event) {
    event.preventDefault();
    setSavingItem(true);
    try {
      const body = { ...draft, probability: Number(draft.probability), sort_order: Number(draft.sort_order) };
      const data = await api('/api/admin/items', { method: 'POST', body: JSON.stringify(body) });
      setItems(rows => [...rows, data.item]);
      setDraft(d => ({ ...d, name: '', description: '', image_url: '', probability: '0' }));
      setNotice('새 상품을 등록했어요.');
    } catch (e) { setNotice(e.message); }
    finally { setSavingItem(false); }
  }

  async function deleteItem(id) {
    if (!window.confirm('이 상품을 삭제할까요? 이미 수집한 회원의 도감에서도 제거됩니다.')) return;
    try {
      await api('/api/admin/items', { method: 'DELETE', body: JSON.stringify({ id }) });
      setItems(rows => rows.filter(row => row.id !== id));
      setNotice('상품을 삭제했어요.');
    } catch (e) { setNotice(e.message); }
  }

  async function reviewTopup(id, status) {
    try {
      await api('/api/admin/topups', { method: 'PATCH', body: JSON.stringify({ id, status }) });
      await loadAdminData();
      setNotice('충전 신청을 처리했어요.');
    } catch (e) { setNotice(e.message); }
  }

  const probabilityTotals = useMemo(() => Object.fromEntries(
    GACHA_LABELS.map(([key]) => [key, items.filter(item => item.gacha_key === key && item.is_active).reduce((sum, item) => sum + Number(item.probability || 0), 0)])
  ), [items]);

  if (checking) return <div className="loading-screen"><div className="loading-seal"><Shield size={28} /></div><p>관리자 권한을 확인하고 있어요...</p></div>;

  if (!authorized) return (
    <main className="admin-page-shell">
      <section className="admin-login-card">
        <a className="admin-back-link" href="/"><ArrowLeft size={15} /> 장난감 상자로 돌아가기</a>
        <div className="admin-seal"><Shield size={26} /></div>
        <p className="eyebrow">PRIVATE ROOM</p>
        <h1>관리자 입장</h1>
        <p className="modal-intro">관리자 암호를 입력해 주세요.</p>
        <form className="shop-form" onSubmit={submitLogin}>
          <label>관리자 암호<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label>
          {error && <p className="error-text">{error}</p>}
          <button className="primary-button full-button" disabled={busy}>{busy ? '확인 중...' : '확인하고 입장하기'}</button>
        </form>
      </section>
    </main>
  );

  return (
    <main className="admin-page-shell">
      <div className="admin-page-content">
        <header className="admin-page-top">
          <a className="admin-back-link" href="/"><ArrowLeft size={15} /> 장난감 상자로 돌아가기</a>
          <button className="outline-button small" onClick={logout}><LogOut size={14} /> 관리자 로그아웃</button>
        </header>
        <section className="admin-page-panel">
          <div className="admin-header">
            <div><p className="eyebrow">THE OWNER’S DESK</p><h2><Settings size={22} /> 관리자 페이지</h2></div>
          </div>

          <div className="admin-section">
            <div className="admin-section-title"><div><h3>가챠 상품 관리</h3><p>상품을 등록하고 PNG 이미지와 등장 확률을 설정하세요.</p></div></div>
            <form className="new-item-form" onSubmit={addItem}>
              <div className="admin-form-grid">
                <label>가챠 종류<select value={draft.gacha_key} onChange={e => setDraft(d => ({ ...d, gacha_key: e.target.value }))}>{GACHA_LABELS.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
                <label>상품명<input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="예: 빨간 리본 곰인형" required /></label>
                <label>확률 (%)<input type="number" min="0" max="100" step="5" value={draft.probability} onChange={e => setDraft(d => ({ ...d, probability: e.target.value }))} required /></label>
                <label>등급<input value={draft.rarity} onChange={e => setDraft(d => ({ ...d, rarity: e.target.value }))} placeholder="일반 / 레어 / 스페셜" /></label>
                <label className="wide-field">상품 이미지 (PNG)<input type="file" accept="image/png" onChange={uploadNewImage} /></label>
                {draft.image_url && <div className="wide-field"><small>업로드된 이미지 미리보기</small><img src={draft.image_url} alt="상품 이미지 미리보기" className="admin-new-preview" /></div>}
                <label className="wide-field">설명<input value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} placeholder="상품 설명 (선택)" /></label>
              </div>
              <button className="primary-button add-item-button" disabled={savingItem}><Plus size={16} /> 상품 추가</button>
            </form>
            <div className="probability-summary">{GACHA_LABELS.map(([key, name]) => <div key={key} className="probability-line"><span>{name}</span><b className={Math.abs((probabilityTotals[key] || 0) - 100) < 0.01 ? 'sum-good' : 'sum-warn'}>{Number(probabilityTotals[key] || 0).toFixed(3)}%</b><small>{Math.abs((probabilityTotals[key] || 0) - 100) < 0.01 ? '설정 완료' : '합계 100% 필요'}</small></div>)}</div>
            <div className="admin-item-list">
              {items.map(item => <div className="admin-item-row" key={item.id}>
                <div className="admin-item-thumb">{item.image_url ? <img src={item.image_url} alt="" /> : <Gift size={20} />}</div>
                <div className="admin-item-fields">
                  <input aria-label="상품명" value={item.name} onChange={e => setItems(rows => rows.map(row => row.id === item.id ? { ...row, name: e.target.value } : row))} />
                  <div className="admin-item-inline">
                    <input aria-label="이미지 파일 교체" type="file" accept="image/png" onChange={e => uploadExistingImage(item.id, e)} />
                    <input aria-label="확률" type="number" min="0" max="100" step="0.001" value={item.probability} onChange={e => setItems(rows => rows.map(row => row.id === item.id ? { ...row, probability: e.target.value } : row))} />
                  </div>
                  <small>{GACHA_LABELS.find(g => g[0] === item.gacha_key)?.[1]} · {item.rarity}</small>
                </div>
                <div className="admin-item-actions">
                  <button title="저장" onClick={() => saveItem(item)} disabled={savingItem}><Check size={16} /></button>
                  <button title="삭제" onClick={() => deleteItem(item.id)}><Trash2 size={16} /></button>
                </div>
              </div>)}
              {!items.length && <div className="empty-state small-empty">등록된 상품이 없습니다.</div>}
            </div>
          </div>

          <div className="admin-section">
            <div className="admin-section-title"><div><h3>포인트 충전 승인</h3><p>승인하면 신청한 회원의 포인트가 추가됩니다.</p></div><span className="pending-count">대기 {topups.filter(t => t.status === 'pending').length}건</span></div>
            <div className="topup-admin-list">
              {topups.map(row => <div className="topup-admin-row" key={row.id}>
                <div><b>{row.nickname}</b><small>{new Date(row.created_at).toLocaleString('ko-KR')}</small></div>
                <strong>{formatNumber(row.amount_points)}P</strong>
                {row.status === 'pending' ? <div className="review-actions"><button className="approve-button" onClick={() => reviewTopup(row.id, 'approved')}>승인</button><button className="reject-button" onClick={() => reviewTopup(row.id, 'rejected')}>거절</button></div> : <span className={`status-label ${row.status}`}>{row.status === 'approved' ? '승인 완료' : '거절됨'}</span>}
              </div>)}
              {!topups.length && <div className="empty-state small-empty">충전 신청이 없습니다.</div>}
            </div>
          </div>
        </section>
      </div>
      {notice && <div className="toast-note" role="status"><span>{notice}</span><button onClick={() => setNotice('')}><X size={15} /></button></div>}
    </main>
  );
}
