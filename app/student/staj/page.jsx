"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

export default function StajTakipPage() {
  const [stajlar, setStajlar] = useState([]);
  const [kurum, setKurum] = useState('');
  const [baslangic, setBaslangic] = useState('');
  const [bitis, setBitis] = useState('');
  const [loading, setLoading] = useState(false);

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  useEffect(() => {
    async function fetchStajlar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.from('stajlar').select('*').eq('student_id', session.user.id);
      if (data) setStajlar(data);
    }
    fetchStajlar();
  }, []);

  async function handleBasvuru(e) {
    e.preventDefault();
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase.from('stajlar').insert([{ student_id: session.user.id, kurum_adi: kurum, baslangic_tarihi: baslangic, bitis_tarihi: bitis, onay_durumu: 'beklemede' }]);
    if (!error) { window.location.reload(); } else { alert('Hata: ' + error.message); }
    setLoading(false);
  }

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>📋 Staj Başvuru ve Takip Paneli (Vol 1-3)</h1>
      <form onSubmit={handleBasvuru} style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #ddd' }}>
        <h3>Yeni Staj Başvurusu Oluştur</h3>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Kurum / Şirket Adı:</label>
          <input type="text" value={kurum} onChange={(e) => setKurum(e.target.value)} required style={{ width: '100%', padding: '8px' }} />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Başlangıç Tarihi:</label>
          <input type="date" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} required style={{ width: '100%', padding: '8px' }} />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Bitiş Tarihi:</label>
          <input type="date" value={bitis} onChange={(e) => setBitis(e.target.value)} required style={{ width: '100%', padding: '8px' }} />
        </div>
        <button type="submit" disabled={loading} style={{ background: '#0070f3', color: '#fff', padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          {loading ? 'Gönderiliyor...' : 'Başvuruyu Gönder'}
        </button>
      </form>
      <h3>Mevcut Staj Durumlarım</h3>
      {stajlar.length === 0 ? (
        <p>Henüz aktif bir staj başvurunuz bulunmuyor.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {stajlar.map((staj) => (
            <li key={staj.id} style={{ background: '#fff', border: '1px solid #eee', padding: '15px', marginBottom: '10px', borderRadius: '6px' }}>
              <strong>Kurum:</strong> {staj.kurum_adi} <br />
              <strong>Tarih:</strong> {staj.baslangic_tarihi} / {staj.bitis_tarihi} <br />
              <strong>Durum:</strong> <span style={{ color: staj.onay_durumu === 'beklemede' ? 'orange' : 'green' }}>{staj.onay_durumu.toUpperCase()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
